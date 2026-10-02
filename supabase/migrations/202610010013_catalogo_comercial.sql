begin;

-- Versiones completas: las referencias guardadas nunca cambian al editar catálogo.
create table public.versiones_catalogo (
 version integer primary key check(version>0),
 datos jsonb not null,
 actor_id uuid not null references public.perfiles(id),
 operacion uuid not null unique,
 version_anterior integer not null,
 creado_en timestamptz not null default now()
);
create table public.versiones_condiciones (
 version integer primary key check(version>0),
 datos jsonb not null,
 actor_id uuid not null references public.perfiles(id),
 operacion uuid not null unique,
 version_anterior integer not null,
 creado_en timestamptz not null default now()
);
alter table public.versiones_catalogo enable row level security;
alter table public.versiones_condiciones enable row level security;
revoke all on public.versiones_catalogo,public.versiones_condiciones from public,anon,authenticated;
grant select on public.versiones_catalogo,public.versiones_condiciones to authenticated;
create policy catalogo_admin on public.versiones_catalogo for select to authenticated using(privado.es_administrador());
create policy condiciones_admin on public.versiones_condiciones for select to authenticated using(privado.es_administrador());

create function privado.validar_catalogo(p_datos jsonb) returns void
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
   if familia->>'servicio'='alarma' then
    if not (i->'precios' ?& case when i->>'tipo'='kit' then array['catalogo','alto','medio','bajo','telefonico'] else array['alto','bajo','telefonico'] end)
    then raise exception 'CATALOGO_INCOMPLETO'; end if;
    if (i->'precios'->>'alto')::numeric < (i->'precios'->>'bajo')::numeric
    or (i->'precios'->>'bajo')::numeric < (i->'precios'->>'telefonico')::numeric
    or (i->>'tipo'='kit' and ((i->'precios'->>'catalogo')::numeric < (i->'precios'->>'alto')::numeric
     or (i->'precios'->>'alto')::numeric < (i->'precios'->>'medio')::numeric
     or (i->'precios'->>'medio')::numeric < (i->'precios'->>'bajo')::numeric)) then raise exception 'CATALOGO_ESCALA'; end if;
   elsif not (i->'precios' ? 'unico') then raise exception 'CATALOGO_INCOMPLETO'; end if;
   if exists(select 1 from jsonb_array_elements(i->'incluidos') comp join jsonb_array_elements(p_datos->'items') x on x->>'id'=comp->>'item_id' where x->>'estado'<>'activo') then raise exception 'CATALOGO_COMPATIBILIDAD'; end if;
  end if;
 end loop;
end $$;
revoke all on function privado.validar_catalogo(jsonb) from public,anon,authenticated;

create function public.guardar_catalogo(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare anterior public.versiones_catalogo; repetida public.versiones_catalogo; actual integer;
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
 perform privado.validar_catalogo(p_datos);
 -- No desaparición de identidades. Baja lógica, versiones históricas inmutables.
 if exists(select 1 from jsonb_array_elements(anterior.datos->'items') x where not exists(select 1 from jsonb_array_elements(p_datos->'items') n where n->>'id'=x->>'id'))
 or exists(select 1 from jsonb_array_elements(anterior.datos->'familias') x where not exists(select 1 from jsonb_array_elements(p_datos->'familias') n where n->>'id'=x->>'id')) then raise exception 'CATALOGO_CONSERVAR'; end if;
 insert into public.versiones_catalogo values(actual+1,p_datos,auth.uid(),p_operacion,p_version,now());
 return actual+1;
end $$;

create function public.leer_catalogo(p_oportunidad uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare actor public.perfiles; v public.versiones_catalogo; resultado jsonb; telefonico boolean;
begin
 select * into actor from public.perfiles where id=auth.uid() and activo;
 if not found then raise exception 'CATALOGO_ACCESO'; end if;
 select * into v from public.versiones_catalogo order by version desc limit 1;
 if v.version is null then return jsonb_build_object('version',0,'datos',jsonb_build_object('familias','[]'::jsonb,'items','[]'::jsonb)); end if;
 if actor.rol='administrador' then return jsonb_build_object('version',v.version,'datos',v.datos); end if;
 telefonico := actor.rol='agente' and exists(select 1 from public.oportunidades o where o.id=p_oportunidad and o.estado='recuperacion' and o.responsable_id=actor.id);
 select jsonb_build_object('familias',coalesce((select jsonb_agg(f) from jsonb_array_elements(v.datos->'familias') f where f->>'estado'='activo'),'[]'::jsonb),
 'items',coalesce(jsonb_agg(jsonb_build_object('id',i->'id','codigo',i->'codigo','nombre',i->'nombre','familia_id',i->'familia_id','tipo',i->'tipo','unidad',i->'unidad',
 'incluidos',i->'incluidos','kits_compatibles',i->'kits_compatibles','precios',case when telefonico then i->'precios' else (i->'precios')-'telefonico' end,
 'abonos',case when telefonico then i->'abonos' else (i->'abonos')-'telefonico' end)),'[]'::jsonb)) into resultado
 from jsonb_array_elements(v.datos->'items') i where i->>'estado'='activo';
 return jsonb_build_object('version',v.version,'datos',resultado);
end $$;

create function public.leer_condiciones() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare v public.versiones_condiciones;
begin
 if not privado.usuario_activo() then raise exception 'CATALOGO_ACCESO'; end if;
 select * into v from public.versiones_condiciones order by version desc limit 1;
 return jsonb_build_object('version',coalesce(v.version,0),'datos',coalesce(v.datos,'{"efectivo_porcentaje":10,"cuotas":[1,3,6],"meses_congelamiento":[4,6],"congelamiento_vendedor":true,"congelamiento_agente":true}'::jsonb));
end $$;
create function public.guardar_condiciones(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare v public.versiones_condiciones; actual integer; x jsonb;
begin
 perform pg_advisory_xact_lock(740127);
 if not privado.es_administrador() then raise exception 'CATALOGO_ACCESO'; end if;
 if p_operacion is null or p_version is null or p_version<0 then raise exception 'CATALOGO_DATOS'; end if;
 select * into v from public.versiones_condiciones where operacion=p_operacion;
 if found then
  if v.actor_id=auth.uid() and v.datos=p_datos and v.version_anterior=p_version then return v.version; end if;
  raise exception 'CATALOGO_CONFLICTO';
 end if;
 select coalesce(max(version),0) into actual from public.versiones_condiciones;
 if actual<>p_version then raise exception 'CATALOGO_CONFLICTO'; end if;
 if p_datos->'efectivo_porcentaje' is distinct from '10'::jsonb or p_datos->'cuotas' is distinct from '[1,3,6]'::jsonb
 or jsonb_typeof(p_datos->'meses_congelamiento') is distinct from 'array'
 or jsonb_typeof(p_datos->'congelamiento_vendedor') is distinct from 'boolean'
 or jsonb_typeof(p_datos->'congelamiento_agente') is distinct from 'boolean'
 then raise exception 'CATALOGO_CONDICIONES'; end if;
 for x in select * from jsonb_array_elements(p_datos->'meses_congelamiento') loop
  if jsonb_typeof(x)<>'number' or x::text !~ '^[1-9][0-9]?$' then raise exception 'CATALOGO_CONDICIONES'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_datos->'meses_congelamiento') plazo group by plazo having count(*)>1) then raise exception 'CATALOGO_CONDICIONES'; end if;
 insert into public.versiones_condiciones values(actual+1,p_datos,auth.uid(),p_operacion,p_version,now());
 return actual+1;
end $$;

create function privado.proteger_historial_catalogo() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.versiones_catalogo where actor_id=old.id) or exists(select 1 from public.versiones_condiciones where actor_id=old.id) then raise exception 'CUENTA_VINCULADA'; end if;
 return old;
end $$;
revoke all on function privado.proteger_historial_catalogo() from public,anon,authenticated;
create trigger proteger_historial_catalogo before delete on public.perfiles for each row execute function privado.proteger_historial_catalogo();
revoke all on function public.guardar_catalogo(integer,uuid,jsonb),public.leer_catalogo(uuid),public.leer_condiciones(),public.guardar_condiciones(integer,uuid,jsonb) from public,anon;
grant execute on function public.guardar_catalogo(integer,uuid,jsonb),public.leer_catalogo(uuid),public.leer_condiciones(),public.guardar_condiciones(integer,uuid,jsonb) to authenticated;
commit;
