begin;
create function privado.validar_catalogo_031(d jsonb) returns void
language plpgsql set search_path='' as $$
declare i jsonb; campo text; p jsonb; individuales jsonb; n text; v text; niveles text[]; anterior numeric; efectivo numeric;
begin
 if d->'esquema' is distinct from '7'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
 perform privado.validar_catalogo_029(jsonb_set(d,'{esquema}','6'));
 for i in select * from jsonb_array_elements(d->'items') loop
  foreach campo in array array['precios_pack_2','precios_pack_2_usd'] loop
   p:=coalesce(i->campo,'{}');
   if jsonb_typeof(p) is distinct from 'object' then raise exception 'CATALOGO_PACK'; end if;
   if p='{}'::jsonb then continue; end if;
   if i->>'tipo'<>'adicional' or i->>'unidad'<>'unidad' then raise exception 'CATALOGO_PACK'; end if;
   individuales:=i->case when campo='precios_pack_2' then 'precios' else 'precios_usd' end;
   niveles:=case when i->>'servicio'='alarma' then array['alto','bajo','telefonico'] else array['telefonico'] end;
   for n,v in select * from jsonb_each_text(p) loop
    if not(n=any(niveles)) or jsonb_typeof(p->n) is distinct from 'string' or v is null or v !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$'
     or individuales->>n is null then raise exception 'CATALOGO_PACK'; end if;
    if v::numeric>2*(individuales->>n)::numeric then raise exception 'CATALOGO_PACK'; end if;
   end loop;
   -- La escala también incluye niveles sin pack (dos unidades individuales).
   anterior:=null;
   foreach n in array niveles loop
    efectivo:=coalesce((p->>n)::numeric,2*(individuales->>n)::numeric);
    if anterior<efectivo then raise exception 'CATALOGO_PACK'; end if;
    anterior:=efectivo;
   end loop;
  end loop;
 end loop;
end $$;
revoke all on function privado.validar_catalogo_031(jsonb) from public,anon,authenticated;

create function privado.precio_cantidad_031(i jsonb,n text,c numeric,habilitado boolean) returns numeric
language sql immutable set search_path='' as $$
 select case when c=0 then 0
 when habilitado and i->'precios_pack_2' ? n then trunc(c/2)*(i->'precios_pack_2'->>n)::numeric+mod(c,2)*(i->'precios'->>n)::numeric
 else c*(i->'precios'->>n)::numeric end
$$;
revoke all on function privado.precio_cantidad_031(jsonb,text,numeric,boolean) from public,anon,authenticated;

-- Se mantienen las validaciones del motor existente; cambia únicamente el precio
-- por cantidad y el piso Bajo. El consumo de bonificaciones sigue a Bajo individual.
do $$
declare d text; antes text;
begin
 select pg_get_functiondef('privado.calcular_propuesta_014(jsonb,jsonb,boolean)'::regprocedure) into d;
 antes:='altos*(i->''precios''->>''alto'')::numeric+bajos*(i->''precios''->>''bajo'')::numeric+telefonos*(i->''precios''->>''telefonico'')::numeric';
 if strpos(d,antes)=0 then raise exception 'MIGRACION_PACKS_INCOMPATIBLE'; end if;
 d:=replace(d,antes,'privado.precio_cantidad_031(i,''alto'',altos,p_catalogo->''packs_031''=''true''::jsonb)+privado.precio_cantidad_031(i,''bajo'',bajos,p_catalogo->''packs_031''=''true''::jsonb)+privado.precio_cantidad_031(i,''telefonico'',telefonos,p_catalogo->''packs_031''=''true''::jsonb)');
 d:=replace(d,'piso:=piso+cantidad*(i->''precios''->>''bajo'')::numeric','piso:=piso+privado.precio_cantidad_031(i,''bajo'',cantidad,p_catalogo->''packs_031''=''true''::jsonb)');
 execute d;
 select pg_get_functiondef('privado.calcular_propuesta_025(jsonb,jsonb,boolean)'::regprocedure) into d;
 antes:='parcial:=cantidad*(i->''precios''->>''telefonico'')::numeric';
 if strpos(d,antes)=0 then raise exception 'MIGRACION_PACKS_INCOMPATIBLE'; end if;
 d:=replace(d,antes,'parcial:=privado.precio_cantidad_031(i,''telefonico'',cantidad,p_catalogo->''packs_031''=''true''::jsonb)');
 execute d;
end $$;

alter function public.guardar_catalogo(integer,uuid,jsonb) rename to guardar_catalogo_base_031;
revoke all on function public.guardar_catalogo_base_031(integer,uuid,jsonb) from public,anon,authenticated;
create function public.guardar_catalogo(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare anterior public.versiones_catalogo; repetida public.versiones_catalogo; actual integer; x jsonb; coleccion text; d jsonb;
begin
 perform pg_advisory_xact_lock(740127);
 if not privado.es_administrador() then raise exception 'CATALOGO_ACCESO'; end if;
 if p_version is null or p_version<0 or p_operacion is null then raise exception 'CATALOGO_DATOS'; end if;
 d:=privado.normalizar_catalogo_021(p_datos);
 select * into repetida from public.versiones_catalogo where operacion=p_operacion;
 if found then
  if repetida.datos->'esquema' is distinct from '7'::jsonb then return public.guardar_catalogo_base_031(p_version,p_operacion,p_datos); end if;
  if repetida.actor_id=auth.uid() and repetida.version_anterior=p_version and (repetida.datos=d or repetida.datos=p_datos) then return repetida.version; end if;
  raise exception 'CATALOGO_CONFLICTO';
 end if;
 select * into anterior from public.versiones_catalogo order by version desc limit 1;
 actual:=coalesce(anterior.version,0);
 if actual<>p_version then raise exception 'CATALOGO_CONFLICTO'; end if;
 if d->'esquema' is distinct from '7'::jsonb then
  if anterior.datos->'esquema'='7'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
  return public.guardar_catalogo_base_031(p_version,p_operacion,p_datos);
 end if;
 perform privado.validar_catalogo_031(d);
 -- Cerco y mano de obra se retiran del vigente; sus snapshots se conservan.
 foreach coleccion in array array['marcas','items'] loop
  for x in select * from jsonb_array_elements(coalesce(anterior.datos->coleccion,'[]')) loop
   if not coalesce(coleccion='items' and (coalesce(x->>'servicio',(select f->>'servicio' from jsonb_array_elements(anterior.datos->'familias') f where f->>'id'=x->>'familia_id'))='cerco' or x->>'tipo'='mano_obra'),false) and not exists(select 1 from jsonb_array_elements(d->coleccion) n where n->>'id'=x->>'id') then
    if exists(select 1 from public.propuestas_comerciales p where strpos(p.detalle::text,x->>'id')>0 or strpos(p.solicitud::text,x->>'id')>0)
    or (coleccion='marcas' and exists(select 1 from jsonb_array_elements(anterior.datos->'items') i
     where i->>'marca_id'=x->>'id' and exists(select 1 from public.propuestas_comerciales p where strpos(p.detalle::text,i->>'id')>0 or strpos(p.solicitud::text,i->>'id')>0)))
    then raise exception 'CATALOGO_USADO'; end if;
   end if;
  end loop;
 end loop;
 insert into public.versiones_catalogo values(actual+1,d,auth.uid(),p_operacion,p_version,now());
 return actual+1;
end $$;
revoke all on function public.guardar_catalogo(integer,uuid,jsonb) from public,anon;
grant execute on function public.guardar_catalogo(integer,uuid,jsonb) to authenticated;
create function public.guardar_catalogo_031(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
begin
 if p_datos->'esquema' is distinct from '7'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
 return public.guardar_catalogo(p_version,p_operacion,p_datos);
end $$;
revoke all on function public.guardar_catalogo_031(integer,uuid,jsonb) from public,anon;
grant execute on function public.guardar_catalogo_031(integer,uuid,jsonb) to authenticated;
alter function public.leer_catalogo(uuid) rename to leer_catalogo_base_031;
revoke all on function public.leer_catalogo_base_031(uuid) from public,anon,authenticated;
create or replace function public.leer_catalogo(p_oportunidad uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb; d jsonb; telefonico boolean; rol text; salida jsonb;
begin
 r:=public.leer_catalogo_013(p_oportunidad);
 select datos into d from public.versiones_catalogo order by version desc limit 1;
 if d->'esquema' is distinct from '7'::jsonb then return public.leer_catalogo_base_031(p_oportunidad); end if;
 select p.rol into rol from public.perfiles p where p.id=auth.uid() and p.activo;
 if rol='administrador' then return r; end if;
 telefonico:=rol='agente' and exists(select 1 from public.oportunidades o where o.id=p_oportunidad and o.estado='recuperacion' and o.responsable_id=auth.uid());
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',i->'id','codigo',i->'codigo','nombre',i->'nombre','familia_id',i->'familia_id','tipo',i->'tipo','unidad',i->'unidad',
  'marca_id',i->'marca_id','servicio',i->'servicio','modalidad',i->'modalidad','adicional_habilitado',i->'adicional_habilitado',
  'incluidos',i->'incluidos','kits_compatibles',i->'kits_compatibles','marcas_compatibles',coalesce(i->'marcas_compatibles','[]'),
  'precios_pack_2',coalesce(i->'precios_pack_2','{}'),'precios_pack_2_usd',coalesce(i->'precios_pack_2_usd','{}'),'precios_usd',i->'precios_usd','precios',case when telefonico or i->>'modalidad'='kit' or i->>'tipo'='adicional' then i->'precios' else (i->'precios')-'telefonico' end,
  'abonos',case when telefonico then i->'abonos' else (i->'abonos')-'telefonico' end
 )),'[]') into salida from jsonb_array_elements(d->'items') i where i->>'estado'='activo';
 return jsonb_build_object('version',r->'version','datos',jsonb_build_object('esquema',7,'moneda_adicionales',d->'moneda_adicionales','familias',r->'datos'->'familias','items',salida,
 'marcas',coalesce((select jsonb_agg(x) from jsonb_array_elements(d->'marcas') x where x->>'estado'='activo'),'[]')));
end $$;

revoke all on function public.leer_catalogo(uuid) from public,anon;
grant execute on function public.leer_catalogo(uuid) to authenticated;


alter function privado.calcular_propuesta(jsonb,jsonb,boolean) rename to calcular_propuesta_029;
revoke all on function privado.calcular_propuesta_029(jsonb,jsonb,boolean) from public,anon,authenticated;
create function privado.calcular_propuesta(p_catalogo jsonb,p_seleccion jsonb,p_telefonico boolean) returns jsonb
language plpgsql set search_path='' as $$
declare cambio public.cotizaciones_dolar; i jsonb; p jsonb; items jsonb:='[]'; n text; v text; importe numeric; resultado jsonb; campo text; extra jsonb; distribucion jsonb; packs jsonb; salida jsonb:='[]'; cantidad numeric; numero numeric; ahorro numeric;
begin
 if p_catalogo->'esquema' is distinct from '7'::jsonb then return privado.calcular_propuesta_029(p_catalogo-'packs_031',p_seleccion,p_telefonico); end if;
 p_catalogo:=p_catalogo||jsonb_build_object('packs_031',true);
 if p_catalogo->>'moneda_adicionales'='USD' and jsonb_array_length(p_seleccion->'extras')>0 then
  select * into cambio from public.cotizaciones_dolar where id=(p_seleccion->>'tipo_cambio_id')::uuid;
  if cambio.id is null or cambio.consultado_en<now()-interval '30 minutes' then raise exception 'PROPUESTA_DOLAR'; end if;
  for i in select * from jsonb_array_elements(p_catalogo->'items') loop
   if i->>'tipo'='adicional' and i->'adicional_habilitado'='true'::jsonb and i->>'estado'='activo' then
    foreach campo in array array['precios','precios_pack_2'] loop
    p:='{}';
    for n,v in select * from jsonb_each_text(coalesce(i->(campo||'_usd'),'{}')) loop
     importe:=round(v::numeric*cambio.venta,6);
     if campo='precios_pack_2' then importe:=least(importe,2*(i->'precios'->>n)::numeric); end if;
     if importe>=1000000000000 then raise exception 'PROPUESTA_PRECIO'; end if;
     p:=p||jsonb_build_object(n,importe::text);
    end loop;
    i:=jsonb_set(i,array[campo],p);
    end loop;
   end if;
   items:=items||jsonb_build_array(i);
  end loop;
  p_catalogo:=jsonb_set(p_catalogo,'{items}',items);
 end if;
 resultado:=privado.calcular_propuesta_026(jsonb_set(p_catalogo,'{esquema}','5'),p_seleccion,p_telefonico);
 for extra in select * from jsonb_array_elements(resultado->'extras') loop
  select x into i from jsonb_array_elements(p_catalogo->'items') x where x->>'id'=extra->>'item_id';
  distribucion:=extra->'distribucion'; packs:='[]';
  foreach n in array array['alto','bajo','telefonico'] loop
   campo:=case n when 'alto' then 'altos' when 'bajo' then 'bajos' else 'telefonicos' end;
   cantidad:=coalesce((distribucion->>campo)::numeric,0); numero:=trunc(cantidad/2);
   if numero>0 and i->'precios_pack_2' ? n then
    ahorro:=cantidad*(i->'precios'->>n)::numeric-privado.precio_cantidad_031(i,n,cantidad,true);
    packs:=packs||jsonb_build_array(jsonb_build_object('nivel',n,'packs',numero,'individuales',mod(cantidad,2),'precio_pack',i->'precios_pack_2'->>n,'precio_individual',i->'precios'->>n,'ahorro',round(ahorro,2)::text));
   end if;
  end loop;
  salida:=salida||jsonb_build_array(extra||jsonb_build_object('packs',packs));
 end loop;
 resultado:=jsonb_set(resultado,'{extras}',salida);
 return resultado||jsonb_build_object('moneda_adicionales',p_catalogo->>'moneda_adicionales','tipo_cambio',case when cambio.id is null then null else
  jsonb_build_object('id',cambio.id,'venta',cambio.venta::text,'fechaActualizacion',cambio.fecha_fuente,'consultado_en',cambio.consultado_en,'fuente','DolarAPI · oficial venta') end);
end $$;
revoke all on function privado.calcular_propuesta(jsonb,jsonb,boolean) from public,anon,authenticated;


do $$
declare d text;
begin
 d:=pg_get_functiondef('public.guardar_propuesta(uuid,uuid,integer,integer,integer,jsonb)'::regprocedure);
 d:=replace(d,'''4'',''5'',''6''','''4'',''5'',''6'',''7''');
 execute d;
end $$;
commit;
