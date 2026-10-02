begin;

-- Se conserva el motor de precios; los grupos marca/servicio son internos.
alter function public.guardar_catalogo(integer,uuid,jsonb) rename to guardar_catalogo_013;
revoke all on function public.guardar_catalogo_013(integer,uuid,jsonb) from public,anon,authenticated;
alter function public.leer_catalogo(uuid) rename to leer_catalogo_013;
revoke all on function public.leer_catalogo_013(uuid) from public,anon,authenticated;
alter function privado.calcular_propuesta(jsonb,jsonb,boolean) rename to calcular_propuesta_014;

create function privado.validar_catalogo_componentes_020(p_datos jsonb) returns void
language plpgsql set search_path='' as $$
declare f jsonb; i jsonb; c jsonb; otro jsonb; precios jsonb; valor text; nivel text; familia jsonb;
begin
 if jsonb_typeof(p_datos) is distinct from 'object'
 or jsonb_typeof(p_datos->'familias') is distinct from 'array'
 or jsonb_typeof(p_datos->'items') is distinct from 'array'
 or jsonb_array_length(p_datos->'familias')>200 or jsonb_array_length(p_datos->'items')>2000
 then raise exception 'CATALOGO_DATOS'; end if;
 if exists(select 1 from jsonb_array_elements(p_datos->'familias') x group by x->>'id' having count(*)>1)
 or exists(select 1 from jsonb_array_elements(p_datos->'items') x group by x->>'id' having count(*)>1)
 or exists(select 1 from jsonb_array_elements(p_datos->'items') x group by lower(x->>'codigo') having count(*)>1)
 then raise exception 'CATALOGO_DUPLICADO'; end if;
 for f in select * from jsonb_array_elements(p_datos->'familias') loop
  if coalesce(f->>'id','') !~ '^[0-9a-f-]{36}$' or char_length(trim(coalesce(f->>'nombre',''))) not between 2 and 100
  or char_length(trim(coalesce(f->>'marca',''))) not between 2 and 100
  or coalesce(f->>'servicio','') not in ('alarma','camaras','cerco')
  or coalesce(f->>'estado','') not in ('borrador','activo','inactivo') then raise exception 'CATALOGO_FAMILIA'; end if;
  perform (f->>'id')::uuid;
 end loop;
 for i in select * from jsonb_array_elements(p_datos->'items') loop
  select x into familia from jsonb_array_elements(p_datos->'familias') x where x->>'id'=i->>'familia_id';
  if familia is null or coalesce(i->>'id','') !~ '^[0-9a-f-]{36}$'
  or char_length(trim(coalesce(i->>'nombre',''))) not between 2 and 150
  or char_length(trim(coalesce(i->>'codigo',''))) not between 1 and 50
  or coalesce(i->>'tipo','') not in ('kit','adicional','mano_obra')
  or coalesce(i->>'unidad','') not in ('unidad','pack','metro','servicio')
  or coalesce(i->>'estado','') not in ('borrador','activo','inactivo')
  or jsonb_typeof(i->'precios') is distinct from 'object'
  or jsonb_typeof(i->'abonos') is distinct from 'object'
  or jsonb_typeof(i->'incluidos') is distinct from 'array'
  or jsonb_typeof(i->'kits_compatibles') is distinct from 'array'
  then raise exception 'CATALOGO_ITEM'; end if;
  perform (i->>'id')::uuid;
  if (i->>'tipo'='kit' and (familia->>'servicio'='cerco' or i->>'unidad'<>'unidad'))
  or (i->>'tipo'='mano_obra' and familia->>'servicio'<>'cerco')
  or (i->>'unidad'='metro' and familia->>'servicio'<>'cerco')
  or (i->>'tipo'<>'kit' and jsonb_array_length(i->'incluidos')>0)
  or ((i->>'tipo'<>'kit' or familia->>'servicio'<>'alarma') and i->'abonos'<>'{}'::jsonb)
  then raise exception 'CATALOGO_COMPOSICION'; end if;
  for precios in select i->'precios' union all select i->'abonos' loop
   for nivel,valor in select * from jsonb_each_text(precios) loop
    if nivel not in ('catalogo','alto','medio','bajo','telefonico','unico')
    or jsonb_typeof(precios->nivel) is distinct from 'string'
    or valor is null or valor !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$'
    then raise exception 'CATALOGO_PRECIO'; end if;
   end loop;
  end loop;
  -- Precio único para cámaras/cerco; experimentación requiere otra regla aprobada.
  if familia->>'servicio'<>'alarma' and exists(select 1 from jsonb_object_keys(i->'precios') n where n<>'unico') then raise exception 'CATALOGO_PRECIO'; end if;
  for c in select * from jsonb_array_elements(i->'incluidos') loop
   select x into otro from jsonb_array_elements(p_datos->'items') x where x->>'id'=c->>'item_id';
   if otro is null or otro->>'familia_id'<>i->>'familia_id' or otro->>'tipo'<>'adicional'
   or coalesce(c->>'cantidad','') !~ '^[1-9][0-9]{0,3}$'
   then raise exception 'CATALOGO_COMPATIBILIDAD'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(i->'incluidos') x group by x->>'item_id' having count(*)>1) then raise exception 'CATALOGO_DUPLICADO'; end if;
  for c in select * from jsonb_array_elements(i->'kits_compatibles') loop
   if not exists(select 1 from jsonb_array_elements(p_datos->'items') x where x->>'id'=c#>>'{}' and x->>'tipo'='kit' and x->>'familia_id'=i->>'familia_id')
   then raise exception 'CATALOGO_COMPATIBILIDAD'; end if;
  end loop;
  if i->>'estado'='activo' then
   if familia->>'estado'<>'activo' or i->'validado_tecnicamente' is distinct from 'true'::jsonb then raise exception 'CATALOGO_VALIDACION'; end if;
   if i->>'tipo'='kit' and jsonb_array_length(i->'incluidos')=0 then raise exception 'CATALOGO_COMPOSICION'; end if;
   if i->'abonos'<>'{}'::jsonb then
    if not (i->'abonos' ?& array['alto','medio','bajo','telefonico']) then raise exception 'CATALOGO_INCOMPLETO'; end if;
    if (i->'abonos'->>'alto')::numeric < (i->'abonos'->>'medio')::numeric
     or (i->'abonos'->>'medio')::numeric < (i->'abonos'->>'bajo')::numeric
     or (i->'abonos'->>'bajo')::numeric < (i->'abonos'->>'telefonico')::numeric then raise exception 'CATALOGO_ESCALA'; end if;
   end if;
   if not (i->>'tipo'='adicional' and i->'adicional_habilitado'='false'::jsonb) then
   if familia->>'servicio'='alarma' then
    if not (i->'precios' ?& case when i->>'tipo'='kit' then array['catalogo','alto','medio','bajo','telefonico'] else array['alto','bajo','telefonico'] end)
    then raise exception 'CATALOGO_INCOMPLETO'; end if;
    if (i->'precios'->>'alto')::numeric < (i->'precios'->>'bajo')::numeric
    or (i->'precios'->>'bajo')::numeric < (i->'precios'->>'telefonico')::numeric
    or (i->>'tipo'='kit' and ((i->'precios'->>'catalogo')::numeric < (i->'precios'->>'alto')::numeric
     or (i->'precios'->>'alto')::numeric < (i->'precios'->>'medio')::numeric
     or (i->'precios'->>'medio')::numeric < (i->'precios'->>'bajo')::numeric)) then raise exception 'CATALOGO_ESCALA'; end if;
   elsif not (i->'precios' ? 'unico') then raise exception 'CATALOGO_INCOMPLETO'; end if;
   end if;
   if exists(select 1 from jsonb_array_elements(i->'incluidos') comp join jsonb_array_elements(p_datos->'items') x on x->>'id'=comp->>'item_id' where x->>'estado'<>'activo') then raise exception 'CATALOGO_COMPATIBILIDAD'; end if;
  end if;
 end loop;
end $$;
revoke all on function privado.validar_catalogo_componentes_020(jsonb) from public,anon,authenticated;

create function privado.validar_catalogo_020(d jsonb) returns void
language plpgsql set search_path='' as $$
declare coleccion text; x jsonb; i jsonb; m jsonb; t jsonb; f jsonb;
begin
 if d->'esquema' is distinct from '2'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
 for coleccion in select unnest(array['marcas','tipos']) loop
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
   select a into t from jsonb_array_elements(d->'tipos') a where a->>'id'=i->>'tipo_comercial_id';
   if coalesce(i->>'modalidad','') not in ('plan','kit','pendiente')
   or (i->>'modalidad'='plan' and i->>'servicio'<>'alarma')
   or (i->>'tipo_comercial_id' is not null and t is null)
   or i->'adicional_habilitado' <> 'false'::jsonb then raise exception 'CATALOGO_MODALIDAD'; end if;
   if i->>'estado'='activo' and (t is null or t->>'estado'<>'activo' or i->>'modalidad'='pendiente') then raise exception 'CATALOGO_CLASIFICACION'; end if;
  elsif i->>'modalidad' is not null or i->>'tipo_comercial_id' is not null then raise exception 'CATALOGO_MODALIDAD'; end if;
  -- Una baja nunca deja conjuntos activos con componentes retirados.
  if i->>'estado'='activo' and m->>'estado'<>'activo' then raise exception 'CATALOGO_DEPENDENCIAS'; end if;
 end loop;
end $$;
revoke all on function privado.validar_catalogo_020(jsonb) from public,anon,authenticated;

create function public.guardar_catalogo(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare anterior public.versiones_catalogo; repetida public.versiones_catalogo; actual integer; x jsonb; coleccion text;
begin
 perform pg_advisory_xact_lock(740127);
 if not privado.es_administrador() then raise exception 'CATALOGO_ACCESO'; end if;
 if p_operacion is null or p_version is null or p_version<0 then raise exception 'CATALOGO_DATOS'; end if;
 select * into repetida from public.versiones_catalogo where operacion=p_operacion;
 if found then
  if repetida.actor_id=auth.uid() and repetida.datos=p_datos and repetida.version_anterior=p_version then return repetida.version; end if;
  raise exception 'CATALOGO_CONFLICTO';
 end if;
 select * into anterior from public.versiones_catalogo order by version desc limit 1;
 actual:=coalesce(anterior.version,0);
 if actual<>p_version then raise exception 'CATALOGO_CONFLICTO'; end if;
 if p_datos->'esquema' is distinct from '2'::jsonb then
  if anterior.datos->'esquema'='2'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
  return public.guardar_catalogo_013(p_version,p_operacion,p_datos);
 end if;
 perform privado.validar_catalogo_020(p_datos);
 -- Quitar identidades del catálogo vigente solo sin dependencias ni uso comercial.
 for coleccion in select unnest(array['marcas','tipos','items']) loop
  for x in select * from jsonb_array_elements(coalesce(anterior.datos->coleccion,'[]')) loop
   if not exists(select 1 from jsonb_array_elements(p_datos->coleccion) n where n->>'id'=x->>'id') then
    if exists(select 1 from public.propuestas_comerciales p where strpos(p.detalle::text,x->>'id')>0 or strpos(p.solicitud::text,x->>'id')>0)
    or exists(select 1 from jsonb_array_elements(anterior.datos->'items') i
      where (coleccion='marcas' and i->>'marca_id'=x->>'id' or coleccion='tipos' and i->>'tipo_comercial_id'=x->>'id')
      and exists(select 1 from public.propuestas_comerciales p where strpos(p.detalle::text,i->>'id')>0 or strpos(p.solicitud::text,i->>'id')>0))
    then raise exception 'CATALOGO_USADO'; end if;
   end if;
  end loop;
 end loop;
 insert into public.versiones_catalogo values(actual+1,p_datos,auth.uid(),p_operacion,p_version,now());
 return actual+1;
end $$;

create function public.leer_catalogo(p_oportunidad uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb; d jsonb; telefonico boolean; rol text; salida jsonb;
begin
 r:=public.leer_catalogo_013(p_oportunidad);
 select datos into d from public.versiones_catalogo order by version desc limit 1;
 if d->'esquema' is distinct from '2'::jsonb then return r; end if;
 select p.rol into rol from public.perfiles p where p.id=auth.uid() and p.activo;
 if rol='administrador' then return r; end if;
 telefonico:=rol='agente' and exists(select 1 from public.oportunidades o where o.id=p_oportunidad and o.estado='recuperacion' and o.responsable_id=auth.uid());
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',i->'id','codigo',i->'codigo','nombre',i->'nombre','familia_id',i->'familia_id','tipo',i->'tipo','unidad',i->'unidad',
  'marca_id',i->'marca_id','servicio',i->'servicio','modalidad',i->'modalidad','tipo_comercial_id',i->'tipo_comercial_id','adicional_habilitado',i->'adicional_habilitado',
  'incluidos',i->'incluidos','kits_compatibles',i->'kits_compatibles',
  'precios',case when telefonico then i->'precios' else (i->'precios')-'telefonico' end,
  'abonos',case when telefonico then i->'abonos' else (i->'abonos')-'telefonico' end
 )),'[]') into salida from jsonb_array_elements(d->'items') i where i->>'estado'='activo';
 return jsonb_build_object('version',r->'version','datos',jsonb_build_object('esquema',2,'familias',r->'datos'->'familias','items',salida,
 'marcas',coalesce((select jsonb_agg(x) from jsonb_array_elements(d->'marcas') x where x->>'estado'='activo'),'[]'),
 'tipos',coalesce((select jsonb_agg(x) from jsonb_array_elements(d->'tipos') x where x->>'estado'='activo'),'[]')));
end $$;

create function privado.calcular_propuesta(p_catalogo jsonb,p_seleccion jsonb,p_telefonico boolean) returns jsonb
language plpgsql set search_path='' as $$
declare r jsonb; k jsonb; i jsonb; e jsonb; t jsonb; incluidos jsonb:='[]'; extras jsonb:='[]'; modalidad text; gratis numeric;
begin
 if p_catalogo->'esquema' is distinct from '2'::jsonb then return privado.calcular_propuesta_014(p_catalogo,p_seleccion,p_telefonico); end if;
 select x into k from jsonb_array_elements(p_catalogo->'items') x where x->>'id'=p_seleccion->>'kit_id';
 modalidad:=k->>'modalidad';
 if k is not null then
  select x into t from jsonb_array_elements(p_catalogo->'tipos') x where x->>'id'=k->>'tipo_comercial_id' and x->>'estado'='activo';
  if t is null or modalidad not in ('plan','kit') then raise exception 'PROPUESTA_COMPOSICION'; end if;
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
 return r||jsonb_build_object('modalidad',modalidad,'marca_id',k->>'marca_id','tipo_comercial_id',k->>'tipo_comercial_id','tipo_comercial',t->>'nombre','extras',extras);
end $$;
revoke all on function privado.calcular_propuesta(jsonb,jsonb,boolean) from public,anon,authenticated;
revoke all on function public.guardar_catalogo(integer,uuid,jsonb),public.leer_catalogo(uuid) from public,anon;
grant execute on function public.guardar_catalogo(integer,uuid,jsonb),public.leer_catalogo(uuid) to authenticated;
-- Entrada nueva: un frontend nuevo nunca guarda metadatos ignorados por un servidor anterior.
create function public.guardar_catalogo_020(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language sql security invoker set search_path='' as $$ select public.guardar_catalogo(p_version,p_operacion,p_datos) $$;
revoke all on function public.guardar_catalogo_020(integer,uuid,jsonb) from public,anon;
grant execute on function public.guardar_catalogo_020(integer,uuid,jsonb) to authenticated;
commit;
