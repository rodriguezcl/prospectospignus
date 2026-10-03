begin;
create function privado.componente_compatible_026(d jsonb, componente jsonb, oferta jsonb) returns boolean
language sql immutable set search_path='' as $$
 select coalesce(componente->>'servicio'=oferta->>'servicio' and (
 componente->>'marca_id'=oferta->>'marca_id' or (
 componente->>'tipo'='adicional' and componente->'marcas_compatibles' ? (oferta->>'marca_id')
 and exists(select 1 from jsonb_array_elements(d->'marcas') m where m->>'id'=componente->>'marca_id' and upper(trim(m->>'nombre'))='COMPONENTES')
 )),false)
$$;
revoke all on function privado.componente_compatible_026(jsonb,jsonb,jsonb) from public,anon,authenticated;


create function privado.validar_catalogo_componentes_026(p_datos jsonb) returns void
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
  or coalesce(f->>'servicio','') not in ('alarma','camaras')
  or coalesce(f->>'estado','') not in ('borrador','activo','inactivo') then raise exception 'CATALOGO_FAMILIA'; end if;
  perform (f->>'id')::uuid;
 end loop;
 for i in select * from jsonb_array_elements(p_datos->'items') loop
  select x into familia from jsonb_array_elements(p_datos->'familias') x where x->>'id'=i->>'familia_id';
  if familia is null or coalesce(i->>'id','') !~ '^[0-9a-f-]{36}$'
  or char_length(trim(coalesce(i->>'nombre',''))) not between 2 and 150
  or char_length(trim(coalesce(i->>'codigo',''))) not between 1 and 50
  or coalesce(i->>'tipo','') not in ('kit','adicional')
  or coalesce(i->>'unidad','') not in ('unidad','pack')
  or coalesce(i->>'estado','') not in ('borrador','activo','inactivo')
  or jsonb_typeof(i->'precios') is distinct from 'object'
  or jsonb_typeof(i->'abonos') is distinct from 'object'
  or jsonb_typeof(i->'incluidos') is distinct from 'array'
  or jsonb_typeof(i->'kits_compatibles') is distinct from 'array'
  then raise exception 'CATALOGO_ITEM'; end if;
  perform (i->>'id')::uuid;
  if (i->>'tipo'='kit' and i->>'unidad'<>'unidad')
  or (i->>'tipo'<>'kit' and jsonb_array_length(i->'incluidos')>0)
  or ((i->>'tipo'<>'kit' or familia->>'servicio'<>'alarma') and i->'abonos'<>'{}'::jsonb)
  then raise exception 'CATALOGO_COMPOSICION'; end if;
  for precios in select i->'precios' union all select i->'abonos' loop
   for nivel,valor in select * from jsonb_each_text(precios) loop
    if nivel not in ('catalogo','alto','medio','bajo','telefonico')
    or jsonb_typeof(precios->nivel) is distinct from 'string'
    or valor is null or valor !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,6})?$'
    then raise exception 'CATALOGO_PRECIO'; end if;
   end loop;
  end loop;
  if exists(select 1 from jsonb_object_keys(i->'precios') n where not (n = any(case
   when i->>'tipo'='kit' and i->>'modalidad' in ('plan','pendiente') then array['catalogo','alto','medio','bajo','telefonico']
   when i->>'tipo'='adicional' and familia->>'servicio'='alarma' then array['alto','bajo','telefonico']
   else array['telefonico'] end))) then raise exception 'CATALOGO_PRECIO'; end if;
  for c in select * from jsonb_array_elements(i->'incluidos') loop
   select x into otro from jsonb_array_elements(p_datos->'items') x where x->>'id'=c->>'item_id';
   if otro is null or not privado.componente_compatible_026(p_datos,otro,i) or otro->>'tipo'<>'adicional'
   or coalesce(c->>'cantidad','') !~ '^[1-9][0-9]{0,3}$'
   then raise exception 'CATALOGO_COMPATIBILIDAD'; end if;
  end loop;
  if exists(select 1 from jsonb_array_elements(i->'incluidos') x group by x->>'item_id' having count(*)>1) then raise exception 'CATALOGO_DUPLICADO'; end if;
  for c in select * from jsonb_array_elements(i->'kits_compatibles') loop
   if not exists(select 1 from jsonb_array_elements(p_datos->'items') x where x->>'id'=c#>>'{}' and x->>'tipo'='kit' and privado.componente_compatible_026(p_datos,i,x))
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
   if familia->>'servicio'='alarma' and (i->>'tipo'='adicional' or i->>'modalidad'='plan') then
    if not (i->'precios' ?& case when i->>'tipo'='kit' then array['catalogo','alto','medio','bajo','telefonico'] else array['alto','bajo','telefonico'] end)
    then raise exception 'CATALOGO_INCOMPLETO'; end if;
    if (i->'precios'->>'alto')::numeric < (i->'precios'->>'bajo')::numeric
    or (i->'precios'->>'bajo')::numeric < (i->'precios'->>'telefonico')::numeric
    or (i->>'tipo'='kit' and ((i->'precios'->>'catalogo')::numeric < (i->'precios'->>'alto')::numeric
     or (i->'precios'->>'alto')::numeric < (i->'precios'->>'medio')::numeric
     or (i->'precios'->>'medio')::numeric < (i->'precios'->>'bajo')::numeric)) then raise exception 'CATALOGO_ESCALA'; end if;
   elsif not (i->'precios' ? 'telefonico') then raise exception 'CATALOGO_INCOMPLETO'; end if;
   if exists(select 1 from jsonb_array_elements(i->'incluidos') comp join jsonb_array_elements(p_datos->'items') x on x->>'id'=comp->>'item_id' where x->>'estado'<>'activo') then raise exception 'CATALOGO_COMPATIBILIDAD'; end if;
  end if;
 end loop;
end $$;
revoke all on function privado.validar_catalogo_componentes_026(jsonb) from public,anon,authenticated;

create function privado.validar_catalogo_026(d jsonb) returns void
language plpgsql set search_path='' as $$
declare coleccion text; x jsonb; i jsonb; m jsonb; t jsonb; f jsonb;
begin
 if d ? 'tipos' or d ? 'plantillas_version' or exists(select 1 from jsonb_array_elements(d->'items') componente where componente ? 'tipo_comercial_id') then raise exception 'CATALOGO_ESQUEMA'; end if;
 if d->'esquema' is distinct from '5'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
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
 for i in select * from jsonb_array_elements(d->'items') loop
  select a into m from jsonb_array_elements(d->'marcas') a where a->>'id'=i->>'marca_id';
  if jsonb_typeof(coalesce(i->'marcas_compatibles','[]')) is distinct from 'array' then raise exception 'CATALOGO_COMPATIBILIDAD'; end if;
  if upper(trim(m->>'nombre'))='COMPONENTES' then
   if i->>'tipo'<>'adicional' or (i->>'estado'='activo' and jsonb_array_length(coalesce(i->'marcas_compatibles','[]'))=0) then raise exception 'CATALOGO_COMPATIBILIDAD'; end if;
  elsif jsonb_array_length(coalesce(i->'marcas_compatibles','[]'))>0 then raise exception 'CATALOGO_COMPATIBILIDAD'; end if;
  if exists(select 1 from jsonb_array_elements(coalesce(i->'marcas_compatibles','[]')) c group by c having count(*)>1) then raise exception 'CATALOGO_DUPLICADO'; end if;
  for t in select * from jsonb_array_elements(coalesce(i->'marcas_compatibles','[]')) loop
   if jsonb_typeof(t)<>'string' or not exists(select 1 from jsonb_array_elements(d->'marcas') a where a->>'id'=t#>>'{}' and upper(trim(a->>'nombre'))<>'COMPONENTES') then raise exception 'CATALOGO_COMPATIBILIDAD'; end if;
  end loop;
 end loop;
 perform privado.validar_catalogo_componentes_026(d);
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
revoke all on function privado.validar_catalogo_026(jsonb) from public,anon,authenticated;

alter function public.guardar_catalogo(integer,uuid,jsonb) rename to guardar_catalogo_base_026;
revoke all on function public.guardar_catalogo_base_026(integer,uuid,jsonb) from public,anon,authenticated;
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
  if repetida.datos->'esquema' is distinct from '5'::jsonb then return public.guardar_catalogo_base_026(p_version,p_operacion,p_datos); end if;
  if repetida.actor_id=auth.uid() and repetida.version_anterior=p_version and (repetida.datos=d or repetida.datos=p_datos) then return repetida.version; end if;
  raise exception 'CATALOGO_CONFLICTO';
 end if;
 select * into anterior from public.versiones_catalogo order by version desc limit 1;
 actual:=coalesce(anterior.version,0);
 if actual<>p_version then raise exception 'CATALOGO_CONFLICTO'; end if;
 if d->'esquema' is distinct from '5'::jsonb then
  if anterior.datos->'esquema'='5'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
  return public.guardar_catalogo_base_026(p_version,p_operacion,p_datos);
 end if;
 perform privado.validar_catalogo_026(d);
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
create function public.guardar_catalogo_026(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
begin
 if p_datos->'esquema' is distinct from '5'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
 return public.guardar_catalogo(p_version,p_operacion,p_datos);
end $$;
revoke all on function public.guardar_catalogo_026(integer,uuid,jsonb) from public,anon;
grant execute on function public.guardar_catalogo_026(integer,uuid,jsonb) to authenticated;
alter function public.leer_catalogo(uuid) rename to leer_catalogo_base_026;
revoke all on function public.leer_catalogo_base_026(uuid) from public,anon,authenticated;
create or replace function public.leer_catalogo(p_oportunidad uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb; d jsonb; telefonico boolean; rol text; salida jsonb;
begin
 r:=public.leer_catalogo_013(p_oportunidad);
 select datos into d from public.versiones_catalogo order by version desc limit 1;
 if d->'esquema' is distinct from '5'::jsonb then return public.leer_catalogo_base_026(p_oportunidad); end if;
 select p.rol into rol from public.perfiles p where p.id=auth.uid() and p.activo;
 if rol='administrador' then return r; end if;
 telefonico:=rol='agente' and exists(select 1 from public.oportunidades o where o.id=p_oportunidad and o.estado='recuperacion' and o.responsable_id=auth.uid());
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',i->'id','codigo',i->'codigo','nombre',i->'nombre','familia_id',i->'familia_id','tipo',i->'tipo','unidad',i->'unidad',
  'marca_id',i->'marca_id','servicio',i->'servicio','modalidad',i->'modalidad','adicional_habilitado',i->'adicional_habilitado',
  'incluidos',i->'incluidos','kits_compatibles',i->'kits_compatibles','marcas_compatibles',coalesce(i->'marcas_compatibles','[]'),
  'precios',case when telefonico or i->>'modalidad'='kit' or i->>'tipo'='adicional' then i->'precios' else (i->'precios')-'telefonico' end,
  'abonos',case when telefonico then i->'abonos' else (i->'abonos')-'telefonico' end
 )),'[]') into salida from jsonb_array_elements(d->'items') i where i->>'estado'='activo';
 return jsonb_build_object('version',r->'version','datos',jsonb_build_object('esquema',5,'familias',r->'datos'->'familias','items',salida,
 'marcas',coalesce((select jsonb_agg(x) from jsonb_array_elements(d->'marcas') x where x->>'estado'='activo'),'[]')));
end $$;

revoke all on function public.leer_catalogo(uuid) from public,anon;
grant execute on function public.leer_catalogo(uuid) to authenticated;

alter function privado.calcular_propuesta(jsonb,jsonb,boolean) rename to calcular_propuesta_025;
revoke all on function privado.calcular_propuesta_025(jsonb,jsonb,boolean) from public,anon,authenticated;
create function privado.calcular_propuesta(p_catalogo jsonb,p_seleccion jsonb,p_telefonico boolean) returns jsonb
language plpgsql set search_path='' as $$
declare k jsonb; i jsonb; c jsonb; items jsonb:='[]'; proyectado jsonb;
begin
 if p_catalogo->'esquema' is distinct from '5'::jsonb then return privado.calcular_propuesta_025(p_catalogo,p_seleccion,p_telefonico); end if;
 select x into k from jsonb_array_elements(p_catalogo->'items') x where x->>'id'=p_seleccion->>'kit_id' and x->>'tipo'='kit' and x->>'estado'='activo' and x->>'familia_id'=p_seleccion->>'familia_id';
 if k is null then raise exception 'PROPUESTA_COMPOSICION'; end if;
 for c in select * from jsonb_array_elements(k->'incluidos') loop
  select x into i from jsonb_array_elements(p_catalogo->'items') x where x->>'id'=c->>'item_id';
  if not privado.componente_compatible_026(p_catalogo,i,k) then raise exception 'PROPUESTA_COMPOSICION'; end if;
 end loop;
 -- Proyección privada para reutilizar el motor de precios. No cambia IDs ni el catálogo guardado.
 for i in select * from jsonb_array_elements(p_catalogo->'items') loop
  if i->>'tipo'='adicional' and privado.componente_compatible_026(p_catalogo,i,k) then
   i:=jsonb_set(i,'{familia_id}',k->'familia_id');
  end if;
  items:=items||jsonb_build_array(i);
 end loop;
 proyectado:=jsonb_set(jsonb_set(p_catalogo,'{items}',items),'{esquema}','4');
 return privado.calcular_propuesta_025(proyectado,p_seleccion,p_telefonico);
end $$;
revoke all on function privado.calcular_propuesta(jsonb,jsonb,boolean) from public,anon,authenticated;
create or replace function public.guardar_propuesta(p_id uuid,p_oportunidad uuid,p_version integer,p_catalogo integer,p_condiciones integer,p_datos jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor public.perfiles; o public.oportunidades; existente public.propuestas_comerciales;
 catalogo public.versiones_catalogo; configuracion jsonb; solicitud jsonb; detalle jsonb; seleccion jsonb; concepto jsonb; conceptos jsonb:='[]'; abono_total numeric:=0; tiene_abono boolean:=false;
 telefonico boolean; base numeric; total numeric; abono numeric; kit jsonb; nivel_abono text:=p_datos->>'nivel_abono';
 meses integer; cuotas integer; importe_cuota numeric; ultima numeric; medio text:=p_datos->'pago'->>'medio_saldo';
 base_efectivo numeric; descuento numeric; saldo numeric; restringida boolean:=false; ordinal integer;
 partes jsonb:='[]'; reparto jsonb; componente jsonb; numero integer:=0;
begin
 perform pg_advisory_xact_lock(740127);
 select * into actor from public.perfiles where id=auth.uid() and activo;
 if not found then raise exception 'PROPUESTA_ACCESO'; end if;
 if p_id is null or p_oportunidad is null or p_version is null or p_catalogo is null or p_condiciones is null or jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'PROPUESTA_DATOS'; end if;
 solicitud:=jsonb_build_object('oportunidad',p_oportunidad,'version',p_version,'catalogo',p_catalogo,'condiciones',p_condiciones,'datos',p_datos);
 select * into existente from public.propuestas_comerciales where id=p_id;
 if found then
  if existente.actor_id=actor.id and existente.solicitud=solicitud then return p_id; end if;
  raise exception 'PROPUESTA_CONFLICTO';
 end if;
 select * into o from public.oportunidades where id=p_oportunidad for update;
 if o.id is null or (actor.rol<>'administrador' and o.responsable_id is distinct from actor.id) or o.responsable_id is null
 or o.estado in ('ganada','perdida') or (actor.rol='vendedor' and o.estado='recuperacion') or (actor.rol='agente' and o.estado<>'recuperacion') then raise exception 'PROPUESTA_ACCESO'; end if;
 if o.version<>p_version then raise exception 'PROPUESTA_CONFLICTO'; end if;
 select * into catalogo from public.versiones_catalogo order by version desc limit 1;
 configuracion:=public.leer_condiciones();
 if catalogo.version is distinct from p_catalogo or (configuracion->>'version')::integer<>p_condiciones then raise exception 'PROPUESTA_VIGENCIA'; end if;
 telefonico:=o.estado='recuperacion' and actor.rol in ('agente','administrador');
 if jsonb_typeof(p_datos->'conceptos') is distinct from 'array' or jsonb_array_length(p_datos->'conceptos') not between 1 and 10 then raise exception 'PROPUESTA_COMPOSICION'; end if;
 base:=0;
 for concepto in select * from jsonb_array_elements(p_datos->'conceptos') loop
 seleccion:=concepto->'seleccion'; nivel_abono:=concepto->>'nivel_abono'; abono:=null;
 detalle:=privado.calcular_propuesta(catalogo.datos,seleccion,telefonico);
 base:=base+(detalle->>'total_exacto')::numeric;
 if coalesce(concepto->>'ordinal','') !~ '^[0-9]{1,5}$' or (concepto->>'ordinal')::integer not between 1 and 50000 then raise exception 'PROPUESTA_DATOS'; end if;
 ordinal:=(concepto->>'ordinal')::integer;
 restringida:=restringida or (seleccion->>'nivel'='telefonico' and not coalesce(catalogo.datos->>'esquema' in ('4','5') and detalle->>'modalidad'='kit',false)) or coalesce(nivel_abono='telefonico',false);
 if coalesce(concepto->>'meses_congelamiento','') !~ '^[0-9]{1,2}$' then raise exception 'PROPUESTA_CONGELAMIENTO'; end if;
 meses:=(concepto->>'meses_congelamiento')::integer;
 if detalle->>'servicio'='alarma' and seleccion->>'subcategoria'='con_monitoreo' then
  if coalesce(nivel_abono,'') not in ('alto','medio','bajo','telefonico') or (nivel_abono='telefonico' and not telefonico) then raise exception 'PROPUESTA_NIVEL'; end if;
  select x into kit from jsonb_array_elements(catalogo.datos->'items') x where x->>'id'=seleccion->>'kit_id';
  abono:=(kit->'abonos'->>nivel_abono)::numeric;
  if abono is null then raise exception 'PROPUESTA_PRECIO'; end if;
  if meses>0 and (not ((configuracion->'datos'->'meses_congelamiento') @> to_jsonb(array[meses]))
   or (actor.rol<>'administrador' and configuracion->'datos'->>('congelamiento_'||actor.rol) is distinct from 'true')) then raise exception 'PROPUESTA_CONGELAMIENTO'; end if;
  abono_total:=abono_total+abono; tiene_abono:=true;
 elsif meses<>0 or coalesce(nivel_abono,'')<>'' then raise exception 'PROPUESTA_CONGELAMIENTO'; end if;
 conceptos:=conceptos||jsonb_build_array(detalle||jsonb_build_object('seleccion',seleccion,'ordinal_declarado',ordinal,'abono',case when abono is null then null else abono::text end,'nivel_abono',nivel_abono,'meses_congelamiento',meses));
 numero:=numero+1;
 if detalle->'kit'<>'null'::jsonb then partes:=partes||jsonb_build_array(jsonb_build_object('clave',lpad(numero::text,2,'0')||'-kit','tipo','instalacion','importe_exacto',detalle->'kit'->>'importe_exacto')); end if;
 for componente in select * from jsonb_array_elements(detalle->'extras') loop
  partes:=partes||jsonb_build_array(jsonb_build_object('clave',lpad(numero::text,2,'0')||'-'||(componente->>'item_id'),'tipo',case when componente->>'tipo'='mano_obra' then 'instalacion' else 'adicional' end,'importe_exacto',componente->>'importe_exacto'));
 end loop;
 end loop;
 if medio not in ('debito','transferencia','credito') or medio is null or coalesce(p_datos->'pago'->>'cuotas','') !~ '^[136]$' then raise exception 'PROPUESTA_PAGO'; end if;
 cuotas:=(p_datos->'pago'->>'cuotas')::integer;
 if medio<>'credito' and cuotas<>1 then raise exception 'PROPUESTA_PAGO'; end if;
 if coalesce(p_datos->'pago'->>'base_efectivo','') !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$' then raise exception 'PROPUESTA_PAGO'; end if;
 base_efectivo:=(p_datos->'pago'->>'base_efectivo')::numeric;
 if base_efectivo>round(base,2) then raise exception 'PROPUESTA_PAGO'; end if;
 descuento:=round(base_efectivo*0.1,2); saldo:=round(base,2)-base_efectivo; total:=round(base,2)-descuento;
 importe_cuota:=trunc(saldo/cuotas,2);ultima:=saldo-importe_cuota*(cuotas-1);
 reparto:=privado.repartir_descuento(partes,descuento);
 detalle:=jsonb_build_object('codigo','PC-'||p_id::text,'conceptos',conceptos,'base',round(base,2)::text,'base_exacta',base::text,'pago',jsonb_build_object('base_efectivo',base_efectivo::text,'efectivo_a_abonar',(base_efectivo-descuento)::text,'medio_saldo',medio,'saldo',saldo::text,'cantidad_cuotas',cuotas,'cuota',importe_cuota::text,'ultima_cuota',ultima::text),'total',total::text,'descuento_pago',descuento::text,'abono',case when tiene_abono then round(abono_total,2)::text else null end,'reparto_descuento_conceptos',case when descuento>0 then 'pendiente_de_criterio' else 'no_corresponde' end);
 detalle:=detalle||jsonb_build_object('reparto_descuento_conceptos','proporcional_mayores_restos','componentes_netos',reparto);
 insert into public.propuestas_comerciales values(p_id,o.id,o.ciclo,o.version,p_catalogo,p_condiciones,actor.id,o.responsable_id,solicitud,detalle,restringida,now());
 -- Incrementa versión para invalidar formularios y serializar oferta/cierre.
 update public.oportunidades set version=version+1,actualizado_en=now() where id=o.id;
 return p_id;
end $$;
revoke all on function public.guardar_propuesta(uuid,uuid,integer,integer,integer,jsonb) from public,anon;
grant execute on function public.guardar_propuesta(uuid,uuid,integer,integer,integer,jsonb) to authenticated;


commit;
