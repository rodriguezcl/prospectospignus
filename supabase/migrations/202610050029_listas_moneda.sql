begin;
create function privado.validar_catalogo_029(d jsonb) returns void
language plpgsql set search_path='' as $$
declare i jsonb; n text; v text; p jsonb; anterior numeric; niveles text[]; nivel text;
begin
 if d->'esquema' is distinct from '6'::jsonb or coalesce(d->>'moneda_adicionales','') not in ('ARS','USD') then raise exception 'CATALOGO_ESQUEMA'; end if;
 perform privado.validar_catalogo_026(jsonb_set(d,'{esquema}','5'));
 for i in select * from jsonb_array_elements(d->'items') loop
  if i->>'tipo'='adicional' then
   p:=coalesce(i->'precios_usd','{}');
   if jsonb_typeof(p) is distinct from 'object' then raise exception 'CATALOGO_USD'; end if;
   niveles:=case when i->>'servicio'='alarma' then array['alto','bajo','telefonico'] else array['telefonico'] end;
   for n,v in select * from jsonb_each_text(p) loop
    if not(n=any(niveles)) or jsonb_typeof(p->n) is distinct from 'string' or v is null or v !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$' then raise exception 'CATALOGO_USD'; end if;
   end loop;
   anterior:=null;
   foreach nivel in array niveles loop
    if p ? nivel then
     if anterior is not null and anterior<(p->>nivel)::numeric then raise exception 'CATALOGO_USD'; end if;
     anterior:=(p->>nivel)::numeric;
    end if;
   end loop;
   if d->>'moneda_adicionales'='USD' and i->>'estado'='activo' and i->'adicional_habilitado'='true'::jsonb and not(p ?& niveles) then raise exception 'CATALOGO_USD'; end if;
  elsif i ? 'precios_usd' and i->'precios_usd'<>'{}'::jsonb then raise exception 'CATALOGO_USD'; end if;
 end loop;
end $$;
revoke all on function privado.validar_catalogo_029(jsonb) from public,anon,authenticated;
alter function public.guardar_catalogo(integer,uuid,jsonb) rename to guardar_catalogo_base_029;
revoke all on function public.guardar_catalogo_base_029(integer,uuid,jsonb) from public,anon,authenticated;
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
  if repetida.datos->'esquema' is distinct from '6'::jsonb then return public.guardar_catalogo_base_029(p_version,p_operacion,p_datos); end if;
  if repetida.actor_id=auth.uid() and repetida.version_anterior=p_version and (repetida.datos=d or repetida.datos=p_datos) then return repetida.version; end if;
  raise exception 'CATALOGO_CONFLICTO';
 end if;
 select * into anterior from public.versiones_catalogo order by version desc limit 1;
 actual:=coalesce(anterior.version,0);
 if actual<>p_version then raise exception 'CATALOGO_CONFLICTO'; end if;
 if d->'esquema' is distinct from '6'::jsonb then
  if anterior.datos->'esquema'='6'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
  return public.guardar_catalogo_base_029(p_version,p_operacion,p_datos);
 end if;
 perform privado.validar_catalogo_029(d);
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
create function public.guardar_catalogo_029(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
begin
 if p_datos->'esquema' is distinct from '6'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
 return public.guardar_catalogo(p_version,p_operacion,p_datos);
end $$;
revoke all on function public.guardar_catalogo_029(integer,uuid,jsonb) from public,anon;
grant execute on function public.guardar_catalogo_029(integer,uuid,jsonb) to authenticated;
alter function public.leer_catalogo(uuid) rename to leer_catalogo_base_029;
revoke all on function public.leer_catalogo_base_029(uuid) from public,anon,authenticated;
create or replace function public.leer_catalogo(p_oportunidad uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb; d jsonb; telefonico boolean; rol text; salida jsonb;
begin
 r:=public.leer_catalogo_013(p_oportunidad);
 select datos into d from public.versiones_catalogo order by version desc limit 1;
 if d->'esquema' is distinct from '6'::jsonb then return public.leer_catalogo_base_029(p_oportunidad); end if;
 select p.rol into rol from public.perfiles p where p.id=auth.uid() and p.activo;
 if rol='administrador' then return r; end if;
 telefonico:=rol='agente' and exists(select 1 from public.oportunidades o where o.id=p_oportunidad and o.estado='recuperacion' and o.responsable_id=auth.uid());
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',i->'id','codigo',i->'codigo','nombre',i->'nombre','familia_id',i->'familia_id','tipo',i->'tipo','unidad',i->'unidad',
  'marca_id',i->'marca_id','servicio',i->'servicio','modalidad',i->'modalidad','adicional_habilitado',i->'adicional_habilitado',
  'incluidos',i->'incluidos','kits_compatibles',i->'kits_compatibles','marcas_compatibles',coalesce(i->'marcas_compatibles','[]'),
  'precios_usd',i->'precios_usd','precios',case when telefonico or i->>'modalidad'='kit' or i->>'tipo'='adicional' then i->'precios' else (i->'precios')-'telefonico' end,
  'abonos',case when telefonico then i->'abonos' else (i->'abonos')-'telefonico' end
 )),'[]') into salida from jsonb_array_elements(d->'items') i where i->>'estado'='activo';
 return jsonb_build_object('version',r->'version','datos',jsonb_build_object('esquema',6,'moneda_adicionales',d->'moneda_adicionales','familias',r->'datos'->'familias','items',salida,
 'marcas',coalesce((select jsonb_agg(x) from jsonb_array_elements(d->'marcas') x where x->>'estado'='activo'),'[]')));
end $$;

revoke all on function public.leer_catalogo(uuid) from public,anon;
grant execute on function public.leer_catalogo(uuid) to authenticated;

-- Solo el servicio servidor puede registrar un tipo de cambio obtenido de DolarAPI.
create table public.cotizaciones_dolar (
 id uuid primary key default gen_random_uuid(),
 venta numeric(18,6) not null check(venta>0),
 fecha_fuente timestamptz not null,
 consultado_en timestamptz not null default now(),
 unique(fecha_fuente,venta)
);
alter table public.cotizaciones_dolar enable row level security;
revoke all on public.cotizaciones_dolar from anon,authenticated;
grant select,insert,update on public.cotizaciones_dolar to service_role;

create function public.registrar_cotizacion_dolar(p_venta text,p_fecha timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.cotizaciones_dolar;
begin
 if p_venta is null or p_venta !~ '^[0-9]{1,8}(\.[0-9]{1,6})?$' or p_venta::numeric<=0 or p_fecha is null or p_fecha>now()+interval '5 minutes' then raise exception 'DOLAR_DATOS'; end if;
 perform pg_advisory_xact_lock(740129);
 if exists(select 1 from public.cotizaciones_dolar where fecha_fuente>p_fecha) then raise exception 'DOLAR_ATRASADO'; end if;
 insert into public.cotizaciones_dolar(venta,fecha_fuente) values(p_venta::numeric,p_fecha)
 on conflict(fecha_fuente,venta) do update set consultado_en=now() returning * into r;
 return jsonb_build_object('id',r.id,'venta',r.venta::text,'fechaActualizacion',r.fecha_fuente,'consultado_en',r.consultado_en);
end $$;
revoke all on function public.registrar_cotizacion_dolar(text,timestamptz) from public,anon,authenticated;
grant execute on function public.registrar_cotizacion_dolar(text,timestamptz) to service_role;

alter function privado.calcular_propuesta(jsonb,jsonb,boolean) rename to calcular_propuesta_026;
revoke all on function privado.calcular_propuesta_026(jsonb,jsonb,boolean) from public,anon,authenticated;
create function privado.calcular_propuesta(p_catalogo jsonb,p_seleccion jsonb,p_telefonico boolean) returns jsonb
language plpgsql set search_path='' as $$
declare cambio public.cotizaciones_dolar; i jsonb; p jsonb; items jsonb:='[]'; n text; v text; importe numeric; resultado jsonb;
begin
 if p_catalogo->'esquema' is distinct from '6'::jsonb then return privado.calcular_propuesta_026(p_catalogo,p_seleccion,p_telefonico); end if;
 if p_catalogo->>'moneda_adicionales'='USD' and jsonb_array_length(p_seleccion->'extras')>0 then
  select * into cambio from public.cotizaciones_dolar where id=(p_seleccion->>'tipo_cambio_id')::uuid;
  if cambio.id is null or cambio.consultado_en<now()-interval '30 minutes' then raise exception 'PROPUESTA_DOLAR'; end if;
  for i in select * from jsonb_array_elements(p_catalogo->'items') loop
   if i->>'tipo'='adicional' and i->'adicional_habilitado'='true'::jsonb and i->>'estado'='activo' then
    p:='{}';
    for n,v in select * from jsonb_each_text(i->'precios_usd') loop
     importe:=round(v::numeric*cambio.venta,6);
     if importe>=1000000000000 then raise exception 'PROPUESTA_PRECIO'; end if;
     p:=p||jsonb_build_object(n,importe::text);
    end loop;
    i:=jsonb_set(i,'{precios}',p);
   end if;
   items:=items||jsonb_build_array(i);
  end loop;
  p_catalogo:=jsonb_set(p_catalogo,'{items}',items);
 end if;
 resultado:=privado.calcular_propuesta_026(jsonb_set(p_catalogo,'{esquema}','5'),p_seleccion,p_telefonico);
 return resultado||jsonb_build_object('moneda_adicionales',p_catalogo->>'moneda_adicionales','tipo_cambio',case when cambio.id is null then null else
  jsonb_build_object('id',cambio.id,'venta',cambio.venta::text,'fechaActualizacion',cambio.fecha_fuente,'consultado_en',cambio.consultado_en,'fuente','DolarAPI · oficial venta') end);
end $$;
revoke all on function privado.calcular_propuesta(jsonb,jsonb,boolean) from public,anon,authenticated;

-- El permiso de venta de kits se mantiene también en el esquema 6.
do $$
declare definicion text;
begin
 definicion:=pg_get_functiondef('public.guardar_propuesta(uuid,uuid,integer,integer,integer,jsonb)'::regprocedure);
 definicion:=replace(definicion,'''4'',''5''','''4'',''5'',''6''');
 execute definicion;
end $$;
commit;
