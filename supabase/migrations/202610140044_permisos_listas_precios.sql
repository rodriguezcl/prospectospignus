begin;

-- La habilitación de una lista permite verla y usarla. Los kits de venta
-- conservan Telefónico como tarifa ordinaria, independiente de esta matriz.
create function privado.permisos_precios_044(d jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(d->'permisos_precios',
  '{"vendedor":["catalogo","alto","medio","bajo"],"agente":["catalogo","alto","medio","bajo","telefonico"]}'::jsonb);
$$;
create function privado.niveles_precios_044(d jsonb,rol text) returns jsonb
language sql immutable set search_path='' as $$
 select case when rol='administrador' then '["catalogo","alto","medio","bajo","telefonico"]'::jsonb
  else coalesce(privado.permisos_precios_044(d)->rol,'[]'::jsonb) end;
$$;
create function privado.validar_permisos_precios_044(d jsonb) returns void
language plpgsql set search_path='' as $$
declare rol text; niveles jsonb;
begin
 if d->'permisos_precios_version' is distinct from '1'::jsonb
  or jsonb_typeof(d->'permisos_precios') is distinct from 'object'
  or not (d->'permisos_precios' ?& array['vendedor','agente'])
  or (d->'permisos_precios')-array['vendedor','agente']<>'{}'::jsonb then
  raise exception 'CATALOGO_PERMISOS';
 end if;
 foreach rol in array array['vendedor','agente'] loop
  niveles:=d->'permisos_precios'->rol;
  if jsonb_typeof(niveles) is distinct from 'array' then raise exception 'CATALOGO_PERMISOS'; end if;
  if exists(select 1 from jsonb_array_elements(niveles) x where jsonb_typeof(x)<>'string'
   or x #>> '{}' not in ('catalogo','alto','medio','bajo','telefonico'))
   or exists(select 1 from jsonb_array_elements(niveles) x group by x having count(*)>1) then
   raise exception 'CATALOGO_PERMISOS';
  end if;
 end loop;
end $$;
revoke all on function privado.permisos_precios_044(jsonb),privado.niveles_precios_044(jsonb,text),privado.validar_permisos_precios_044(jsonb) from public,anon,authenticated;

alter function public.guardar_catalogo(integer,uuid,jsonb) rename to guardar_catalogo_base_044;
revoke all on function public.guardar_catalogo_base_044(integer,uuid,jsonb) from public,anon,authenticated;
create function public.guardar_catalogo(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare actual jsonb;
begin
 perform pg_advisory_xact_lock(740127);
 if not privado.es_administrador() then raise exception 'CATALOGO_ACCESO'; end if;
 if exists(select 1 from public.versiones_catalogo where operacion=p_operacion) then
  return public.guardar_catalogo_base_044(p_version,p_operacion,p_datos);
 end if;
 select datos into actual from public.versiones_catalogo order by version desc limit 1;
 if p_datos ? 'permisos_precios_version' or p_datos ? 'permisos_precios' then
  perform privado.validar_permisos_precios_044(p_datos);
 elsif actual->'permisos_precios_version'='1'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
 return public.guardar_catalogo_base_044(p_version,p_operacion,p_datos);
end $$;
create function public.guardar_catalogo_044(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
begin
 if p_datos->'esquema' is distinct from '7'::jsonb or p_datos->'ubicaciones_version' is distinct from '1'::jsonb
  or p_datos->'moneda_productos_version' is distinct from '1'::jsonb
  or p_datos->'permisos_precios_version' is distinct from '1'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
 return public.guardar_catalogo(p_version,p_operacion,p_datos);
end $$;
revoke all on function public.guardar_catalogo(integer,uuid,jsonb),public.guardar_catalogo_044(integer,uuid,jsonb) from public,anon;
grant execute on function public.guardar_catalogo(integer,uuid,jsonb),public.guardar_catalogo_044(integer,uuid,jsonb) to authenticated;

create function privado.filtrar_precios_044(precios jsonb,niveles jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(jsonb_object_agg(key,value),'{}'::jsonb)
 from jsonb_each(coalesce(precios,'{}'::jsonb)) where niveles ? key;
$$;
revoke all on function privado.filtrar_precios_044(jsonb,jsonb) from public,anon,authenticated;
alter function public.leer_catalogo(uuid) rename to leer_catalogo_base_044;
revoke all on function public.leer_catalogo_base_044(uuid) from public,anon,authenticated;
create function public.leer_catalogo(p_oportunidad uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb; d jsonb; rol text; niveles jsonb; permitidos jsonb; salida jsonb:='[]'; i jsonb; original jsonb; campo text;
begin
 r:=public.leer_catalogo_base_044(p_oportunidad);
 select p.rol into rol from public.perfiles p where p.id=auth.uid() and p.activo;
 if rol is null then raise exception 'CATALOGO_ACCESO'; end if;
 select datos into d from public.versiones_catalogo order by version desc limit 1;
 niveles:=privado.niveles_precios_044(d,rol);
 -- Los formatos previos a la venta por modalidad no tienen la excepción de
 -- Telefónico para kits; conservan su proyección hasta adaptar el catálogo.
 if coalesce(d->>'esquema','1') not in ('4','5','6','7') then
  return r;
 end if;
 if rol<>'administrador' then
  for i in select value from jsonb_array_elements(r->'datos'->'items') loop
   select value into original from jsonb_array_elements(d->'items') where value->>'id'=i->>'id';
   permitidos:=case when i->>'modalidad'='kit' then '["telefonico"]'::jsonb
    when i->>'tipo'='adicional' then niveles||'["telefonico"]'::jsonb else niveles end;
   foreach campo in array array['precios','precios_usd','precios_pack_2','precios_pack_2_usd'] loop
    i:=i||jsonb_build_object(campo,privado.filtrar_precios_044(original->campo,permitidos));
   end loop;
   i:=i||jsonb_build_object('abonos',privado.filtrar_precios_044(original->'abonos',niveles));
   salida:=salida||jsonb_build_array(i);
  end loop;
  r:=jsonb_set(r,'{datos}',(r->'datos')-'permisos_precios'||jsonb_build_object('items',salida));
 else
  r:=jsonb_set(r,'{datos}',(r->'datos')||jsonb_build_object('permisos_precios',privado.permisos_precios_044(d)));
 end if;
 return jsonb_set(r,'{datos}',(r->'datos')||jsonb_build_object('permisos_precios_version',1,
  'niveles_habilitados',niveles,'calculo_remoto',not (niveles ? 'bajo')));
end $$;
create function public.leer_catalogo_044(p_oportunidad uuid default null) returns jsonb
language sql stable security invoker set search_path='' as $$select public.leer_catalogo(p_oportunidad)$$;
revoke all on function public.leer_catalogo(uuid),public.leer_catalogo_044(uuid) from public,anon;
grant execute on function public.leer_catalogo(uuid),public.leer_catalogo_044(uuid) to authenticated;

-- Se aplican también a solicitudes de clientes anteriores: ocultar controles no
-- concede permisos. Bonificar sigue sujeto a bolsa/piso, no al acceso a Bajo.
create function privado.validar_seleccion_precios_044(d jsonb,s jsonb,rol text,abono text default null) returns void
language plpgsql set search_path='' as $$
declare k jsonb; niveles jsonb; e jsonb; n text; campo text;
begin
 niveles:=privado.niveles_precios_044(d,rol);
 select value into k from jsonb_array_elements(d->'items') where value->>'id'=s->>'kit_id';
 if k->>'modalidad'='kit' then return; end if;
 if coalesce(s->>'nivel','')<>'unico' and not (niveles ? coalesce(s->>'nivel','')) then raise exception 'PROPUESTA_NIVEL'; end if;
 if nullif(abono,'') is not null and not (niveles ? abono) then raise exception 'PROPUESTA_NIVEL'; end if;
 for e in select value from jsonb_array_elements(s->'extras') loop
  foreach n in array array['alto','bajo','telefonico'] loop
   campo:=case n when 'alto' then 'altos' when 'bajo' then 'bajos' else 'telefonicos' end;
   if coalesce(e->>campo,'0') !~ '^0+$' and not (niveles ? n) then raise exception 'PROPUESTA_NIVEL'; end if;
  end loop;
 end loop;
end $$;
revoke all on function privado.validar_seleccion_precios_044(jsonb,jsonb,text,text) from public,anon,authenticated;

-- Conserva el motor entero (USD, packs, ubicaciones, bolsa y piso). La entrada
-- privada sin actor permanece útil para verificación técnica de versiones.
alter function privado.calcular_propuesta(jsonb,jsonb,boolean) rename to calcular_propuesta_base_044;
revoke all on function privado.calcular_propuesta_base_044(jsonb,jsonb,boolean) from public,anon,authenticated;
create function privado.calcular_propuesta(p_catalogo jsonb,p_seleccion jsonb,p_telefonico boolean) returns jsonb
language plpgsql set search_path='' as $$
declare rol text;
begin
 select p.rol into rol from public.perfiles p where p.id=auth.uid() and p.activo;
 if rol is not null then
  perform privado.validar_seleccion_precios_044(p_catalogo,p_seleccion,rol);
  p_telefonico:=privado.niveles_precios_044(p_catalogo,rol) ? 'telefonico';
 end if;
 return privado.calcular_propuesta_base_044(p_catalogo,p_seleccion,p_telefonico);
end $$;
revoke all on function privado.calcular_propuesta(jsonb,jsonb,boolean) from public,anon,authenticated;

-- Lectura de simulaciones para no entregar precios Bajo ocultos al motor del
-- navegador. Lotes ordenados y acotados, sin reservas ni escrituras comerciales.
create function public.evaluar_selecciones_044(p_oportunidad uuid,p_catalogo integer,p_selecciones jsonb) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor public.perfiles; o public.oportunidades; c public.versiones_catalogo; atencion record;
 s jsonb; detalle jsonb; resultados jsonb:='[]'; niveles jsonb; abono numeric; k jsonb; codigo text;
begin
 select * into actor from public.perfiles where id=auth.uid() and activo;
 select * into o from public.oportunidades where id=p_oportunidad;
 if actor.id is null or o.id is null or o.estado in ('ganada','perdida','anulada')
  or (actor.rol='agente' and (o.estado<>'recuperacion' or o.responsable_id is distinct from actor.id))
  or (actor.rol='vendedor' and (o.estado='recuperacion' or (not o.preparacion_compartida and o.responsable_id is distinct from actor.id)))
 then raise exception 'PROPUESTA_ACCESO'; end if;
 if actor.rol='vendedor' and o.preparacion_compartida then
  select a.* into atencion from public.atencion_prospectos a join public.prospectos p on p.registro_id=a.registro_id where p.id=o.prospecto_id;
  if found and atencion.vendedor_id is distinct from actor.id then raise exception 'PROPUESTA_ACCESO'; end if;
 end if;
 select * into c from public.versiones_catalogo order by version desc limit 1;
 if c.version is null or c.version is distinct from p_catalogo then raise exception 'PROPUESTA_VIGENCIA'; end if;
 if jsonb_typeof(p_selecciones) is distinct from 'array' or jsonb_array_length(p_selecciones) not between 1 and 500
  or octet_length(p_selecciones::text)>2000000 then raise exception 'PROPUESTA_COMPOSICION'; end if;
 niveles:=privado.niveles_precios_044(c.datos,actor.rol);
 for s in select value from jsonb_array_elements(p_selecciones) loop
  begin
   perform privado.validar_seleccion_precios_044(c.datos,s,actor.rol,s->>'nivel_abono');
   detalle:=privado.calcular_propuesta(c.datos,s-'nivel_abono',niveles ? 'telefonico');
   detalle:=detalle||jsonb_build_object('seleccion',s-'nivel_abono');
   if nullif(s->>'nivel_abono','') is not null then
    if detalle->>'servicio'<>'alarma' or s->>'subcategoria' is distinct from 'con_monitoreo' then raise exception 'PROPUESTA_NIVEL'; end if;
    select value into k from jsonb_array_elements(c.datos->'items') where value->>'id'=s->>'kit_id';
    abono:=(k->'abonos'->>(s->>'nivel_abono'))::numeric;
    if abono is null then raise exception 'PROPUESTA_PRECIO'; end if;
    detalle:=detalle||jsonb_build_object('abono',abono::text,'nivel_abono',s->>'nivel_abono');
   end if;
   resultados:=resultados||jsonb_build_array(jsonb_build_object('valida',true,'detalle',detalle));
  exception when others then
   get stacked diagnostics codigo=MESSAGE_TEXT;
   if codigo not in ('PROPUESTA_NIVEL','PROPUESTA_BONIFICACION','PROPUESTA_PRECIO','PROPUESTA_COMPOSICION','PROPUESTA_CANTIDAD','PROPUESTA_UBICACION','PROPUESTA_DOLAR') then
    if sqlstate in ('22P02','22023','22003') then codigo:='PROPUESTA_COMPOSICION'; else raise; end if;
   end if;
   resultados:=resultados||jsonb_build_array(jsonb_build_object('valida',false,'error',codigo));
  end;
 end loop;
 return jsonb_build_object('version',c.version,'resultados',resultados);
end $$;
revoke all on function public.evaluar_selecciones_044(uuid,integer,jsonb) from public,anon;
grant execute on function public.evaluar_selecciones_044(uuid,integer,jsonb) to authenticated;

-- La propuesta conserva qué política autorizó su emisión. Un cambio posterior
-- no recalcula ni invalida lo ya ofrecido dentro de su vigencia comercial.
do $$
declare d text; anterior text;
begin
 d:=pg_get_functiondef('public.guardar_propuesta(uuid,uuid,integer,integer,integer,jsonb)'::regprocedure);
 anterior:='telefonico:=o.estado=''recuperacion'' and actor.rol in (''agente'',''administrador'');';
 if strpos(d,anterior)=0 then raise exception 'MIGRACION_PERMISOS_INCOMPATIBLE'; end if;
 d:=replace(d,anterior,'telefonico:=privado.niveles_precios_044(catalogo.datos,actor.rol) ? ''telefonico'';');
 anterior:='detalle:=privado.calcular_propuesta(catalogo.datos,seleccion,telefonico);';
 if strpos(d,anterior)=0 then raise exception 'MIGRACION_PERMISOS_INCOMPATIBLE'; end if;
 d:=replace(d,anterior,'perform privado.validar_seleccion_precios_044(catalogo.datos,seleccion,actor.rol,nivel_abono); '||anterior);
 anterior:='insert into public.propuestas_comerciales values';
 if strpos(d,anterior)=0 then raise exception 'MIGRACION_PERMISOS_INCOMPATIBLE'; end if;
 d:=replace(d,anterior,'detalle:=detalle||jsonb_build_object(''permisos_precios_version'',1,''permisos_precios'',privado.permisos_precios_044(catalogo.datos)); '||anterior);
 execute d;

 d:=pg_get_functiondef('public.gestionar_oportunidad_base_v17(uuid,integer,uuid,text,jsonb)'::regprocedure);
 anterior:='if propuesta.restringida and not(actor.rol=''administrador'' or (actor.rol=''agente'' and o.estado=''recuperacion'')) then raise exception ''COMERCIAL_ACCESO''; end if;';
 if strpos(d,anterior)=0 then raise exception 'MIGRACION_PERMISOS_INCOMPATIBLE'; end if;
 d:=replace(d,anterior,'if propuesta.restringida and not(actor.rol=''administrador'' or (actor.rol=''agente'' and o.estado=''recuperacion'') or coalesce(actor.rol=''vendedor'' and propuesta.detalle->''permisos_precios_version''=''1''::jsonb and propuesta.detalle->''permisos_precios''->''vendedor'' ? ''telefonico'',false)) then raise exception ''COMERCIAL_ACCESO''; end if;');
 execute d;
end $$;

drop policy propuestas_lectura on public.propuestas_comerciales;
create policy propuestas_lectura on public.propuestas_comerciales for select to authenticated using(
 privado.puede_ver_oportunidad(oportunidad_id) and (not restringida or privado.es_administrador()
  or exists(select 1 from public.perfiles p where p.id=auth.uid() and p.activo and (
   (p.rol='agente' and p.id=propuestas_comerciales.responsable_id)
   or (p.rol='vendedor' and p.id in (propuestas_comerciales.actor_id,propuestas_comerciales.responsable_id)
    and detalle->'permisos_precios_version'='1'::jsonb and detalle->'permisos_precios'->'vendedor' ? 'telefonico')
  )))
);
commit;
