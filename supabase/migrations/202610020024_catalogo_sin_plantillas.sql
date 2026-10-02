begin;

create function privado.validar_catalogo_024(d jsonb) returns void
language plpgsql set search_path='' as $$
declare coleccion text; x jsonb; i jsonb; m jsonb; t jsonb; f jsonb;
begin
 if d ? 'tipos' or d ? 'plantillas_version' or exists(select 1 from jsonb_array_elements(d->'items') componente where componente ? 'tipo_comercial_id') then raise exception 'CATALOGO_ESQUEMA'; end if;
 if d->'esquema' is distinct from '3'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
 for coleccion in select unnest(array['marcas']) loop
  if jsonb_typeof(d->coleccion) is distinct from 'array' or jsonb_array_length(d->coleccion)>200 then raise exception 'CATALOGO_DATOS'; end if;
  if exists(select 1 from jsonb_array_elements(d->coleccion) a group by a->>'id' having count(*)>1)
  or exists(select 1 from jsonb_array_elements(d->coleccion) a group by lower(trim(a->>'nombre')) having count(*)>1) then raise exception 'CATALOGO_DUPLICADO'; end if;
  for x in select * from jsonb_array_elements(d->coleccion) loop
   if coalesce(x->>'id','') !~ '^[0-9a-f-]{36}$' or char_length(trim(coalesce(x->>'nombre',''))) not between 2 and 100
   or coalesce(x->>'estado','') not in ('activo','inactivo','borrador') then raise exception 'CATALOGO_DATOS'; end if;
   perform (x->>'id')::uuid;
  end loop;
 end loop;
 perform privado.validar_catalogo_componentes_020(d);
 if exists(select 1 from jsonb_array_elements(d->'familias') a group by a->>'marca_id',a->>'servicio' having count(*)>1) then raise exception 'CATALOGO_DUPLICADO'; end if;
 for f in select * from jsonb_array_elements(d->'familias') loop
  select a into m from jsonb_array_elements(d->'marcas') a where a->>'id'=f->>'marca_id';
  if m is null or f->>'marca' is distinct from m->>'nombre' or f->>'estado' is distinct from m->>'estado' then raise exception 'CATALOGO_REFERENCIA'; end if;
 end loop;
 for i in select * from jsonb_array_elements(d->'items') loop
  select a into m from jsonb_array_elements(d->'marcas') a where a->>'id'=i->>'marca_id';
  select a into f from jsonb_array_elements(d->'familias') a where a->>'id'=i->>'familia_id';
  if m is null or i->>'servicio' is distinct from f->>'servicio' or i->>'marca_id' is distinct from f->>'marca_id'
  or jsonb_typeof(i->'adicional_habilitado') is distinct from 'boolean' then raise exception 'CATALOGO_REFERENCIA'; end if;
  if i->>'tipo'='kit' then
   if coalesce(i->>'modalidad','') not in ('plan','kit','pendiente')
   or (i->>'modalidad'='plan' and i->>'servicio'<>'alarma')
   or i->'adicional_habilitado' <> 'false'::jsonb then raise exception 'CATALOGO_MODALIDAD'; end if;
   if i->>'estado'='activo' and (i->>'modalidad'='pendiente') then raise exception 'CATALOGO_CLASIFICACION'; end if;
  elsif i->>'modalidad' is not null then raise exception 'CATALOGO_MODALIDAD'; end if;
  -- Una baja nunca deja conjuntos activos con componentes retirados.
  if i->>'estado'='activo' and m->>'estado'<>'activo' then raise exception 'CATALOGO_DEPENDENCIAS'; end if;
 end loop;
end $$;
revoke all on function privado.validar_catalogo_024(jsonb) from public,anon,authenticated;

alter function public.guardar_catalogo(integer,uuid,jsonb) rename to guardar_catalogo_base_024;
revoke all on function public.guardar_catalogo_base_024(integer,uuid,jsonb) from public,anon,authenticated;
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
  if repetida.datos->'esquema' is distinct from '3'::jsonb then return public.guardar_catalogo_base_024(p_version,p_operacion,p_datos); end if;
  if repetida.actor_id=auth.uid() and repetida.version_anterior=p_version and (repetida.datos=d or repetida.datos=p_datos) then return repetida.version; end if;
  raise exception 'CATALOGO_CONFLICTO';
 end if;
 select * into anterior from public.versiones_catalogo order by version desc limit 1;
 actual:=coalesce(anterior.version,0);
 if actual<>p_version then raise exception 'CATALOGO_CONFLICTO'; end if;
 if d->'esquema' is distinct from '3'::jsonb then
  if anterior.datos->'esquema'='3'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
  return public.guardar_catalogo_base_024(p_version,p_operacion,p_datos);
 end if;
 perform privado.validar_catalogo_024(d);
 -- Las plantillas quedan conservadas en versiones anteriores; no son dependencias vigentes.
 foreach coleccion in array array['marcas','items'] loop
  for x in select * from jsonb_array_elements(coalesce(anterior.datos->coleccion,'[]')) loop
   if not exists(select 1 from jsonb_array_elements(d->coleccion) n where n->>'id'=x->>'id') then
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
create function public.guardar_catalogo_024(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
begin
 if p_datos->'esquema' is distinct from '3'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
 return public.guardar_catalogo(p_version,p_operacion,p_datos);
end $$;
revoke all on function public.guardar_catalogo_024(integer,uuid,jsonb) from public,anon;
grant execute on function public.guardar_catalogo_024(integer,uuid,jsonb) to authenticated;
alter function public.leer_catalogo(uuid) rename to leer_catalogo_base_024;
revoke all on function public.leer_catalogo_base_024(uuid) from public,anon,authenticated;
create or replace function public.leer_catalogo(p_oportunidad uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb; d jsonb; telefonico boolean; rol text; salida jsonb;
begin
 r:=public.leer_catalogo_013(p_oportunidad);
 select datos into d from public.versiones_catalogo order by version desc limit 1;
 if d->'esquema' is distinct from '3'::jsonb then return public.leer_catalogo_base_024(p_oportunidad); end if;
 select p.rol into rol from public.perfiles p where p.id=auth.uid() and p.activo;
 if rol='administrador' then return r; end if;
 telefonico:=rol='agente' and exists(select 1 from public.oportunidades o where o.id=p_oportunidad and o.estado='recuperacion' and o.responsable_id=auth.uid());
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',i->'id','codigo',i->'codigo','nombre',i->'nombre','familia_id',i->'familia_id','tipo',i->'tipo','unidad',i->'unidad',
  'marca_id',i->'marca_id','servicio',i->'servicio','modalidad',i->'modalidad','adicional_habilitado',i->'adicional_habilitado',
  'incluidos',i->'incluidos','kits_compatibles',i->'kits_compatibles',
  'precios',case when telefonico then i->'precios' else (i->'precios')-'telefonico' end,
  'abonos',case when telefonico then i->'abonos' else (i->'abonos')-'telefonico' end
 )),'[]') into salida from jsonb_array_elements(d->'items') i where i->>'estado'='activo';
 return jsonb_build_object('version',r->'version','datos',jsonb_build_object('esquema',3,'familias',r->'datos'->'familias','items',salida,
 'marcas',coalesce((select jsonb_agg(x) from jsonb_array_elements(d->'marcas') x where x->>'estado'='activo'),'[]')));
end $$;

create or replace function privado.calcular_propuesta(p_catalogo jsonb,p_seleccion jsonb,p_telefonico boolean) returns jsonb
language plpgsql set search_path='' as $$
declare r jsonb; k jsonb; i jsonb; e jsonb; t jsonb; incluidos jsonb:='[]'; extras jsonb:='[]'; modalidad text; gratis numeric;
begin
 if coalesce(p_catalogo->>'esquema','1') not in ('2','3') then return privado.calcular_propuesta_014(p_catalogo,p_seleccion,p_telefonico); end if;
 select x into k from jsonb_array_elements(p_catalogo->'items') x where x->>'id'=p_seleccion->>'kit_id';
 modalidad:=k->>'modalidad';
 if k is not null then
  if modalidad is null or modalidad not in ('plan','kit') then raise exception 'PROPUESTA_COMPOSICION'; end if;
 end if;
 for e in select * from jsonb_array_elements(p_seleccion->'extras') loop
  select x into i from jsonb_array_elements(p_catalogo->'items') x where x->>'id'=e->>'item_id';
  if i->>'tipo'='adicional' and i->'adicional_habilitado' is distinct from 'true'::jsonb then raise exception 'PROPUESTA_COMPOSICION'; end if;
 end loop;
 r:=privado.calcular_propuesta_014(p_catalogo,p_seleccion,p_telefonico);
 for e in select * from jsonb_array_elements(coalesce(k->'incluidos','[]')) loop
  select x into i from jsonb_array_elements(p_catalogo->'items') x where x->>'id'=e->>'item_id' and x->>'estado'='activo';
  if i is null then raise exception 'PROPUESTA_COMPOSICION'; end if;
  incluidos:=incluidos||jsonb_build_array(e||jsonb_build_object('nombre',i->>'nombre','codigo',i->>'codigo','propiedad',case when modalidad='plan' then 'comodato' else 'cliente' end));
 end loop;
 for e in select * from jsonb_array_elements(r->'extras') loop
  gratis:=coalesce((e->'distribucion'->>'bonificados')::numeric,0);
  extras:=extras||jsonb_build_array(e||jsonb_build_object('propiedad',jsonb_build_object(
    'comodato',case when modalidad='plan' then gratis else 0 end,
    'cliente',(e->>'cantidad')::numeric-case when modalidad='plan' then gratis else 0 end,
    'obsequio',case when modalidad='plan' then 0 else gratis end)));
 end loop;
 if k is not null then r:=jsonb_set(r,'{kit,incluidos}',incluidos); end if;
 return r||jsonb_build_object('modalidad',modalidad,'marca_id',k->>'marca_id','extras',extras);
end $$;
revoke all on function privado.calcular_propuesta(jsonb,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.leer_catalogo(uuid) from public,anon;
grant execute on function public.leer_catalogo(uuid) to authenticated;
commit;
