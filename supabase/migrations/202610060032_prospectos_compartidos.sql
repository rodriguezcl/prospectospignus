begin;
alter table public.oportunidades add column preparacion_compartida boolean not null default false;
alter table public.oportunidades drop constraint oportunidades_check;
alter table public.oportunidades add constraint oportunidades_check check(responsable_id is not null or estado in ('cotizacion','recuperacion','anulada'));
alter table public.oportunidades alter column vendedor_visita_id drop not null;
-- Solo preparaciones sin actividad: conservar columnas históricas y snapshots.
update public.oportunidades o set preparacion_compartida=true
where estado='cotizacion' and periodo_historico is null
 and not exists(select 1 from public.propuestas_comerciales p where p.oportunidad_id=o.id)
 and not exists(select 1 from public.eventos_oportunidades e where e.oportunidad_id=o.id and e.tipo<>'iniciar_cotizacion')
 and not exists(select 1 from public.actividades_agenda a where a.oportunidad_id=o.id);
alter policy registros_lectura on public.registros_iniciales using ((select privado.usuario_activo()));
-- Directorio mínimo para atribución de carga, incluso autores hoy inactivos.
create function public.autores_prospectos_032() returns table(id uuid,nombre text,activo boolean)
language sql stable security definer set search_path='' as $$
 select p.id,p.nombre,p.activo from public.perfiles p where privado.usuario_activo()
 and (p.activo or exists(select 1 from public.registros_iniciales r where r.creado_por=p.id)
 or exists(select 1 from public.eventos_registros e where e.actor_id=p.id)) order by p.nombre,p.id;
$$;
revoke all on function public.autores_prospectos_032() from public,anon;
grant execute on function public.autores_prospectos_032() to authenticated;
create or replace function public.guardar_registro_inicial(p_id uuid, p_version integer, p_datos jsonb)
returns public.registros_iniciales language plpgsql security definer set search_path = '' as $$
declare
 actor uuid := auth.uid(); administrador boolean; anterior public.registros_iniciales;
 resultado public.registros_iniciales; responsable uuid; campo text; motivo text;
begin
 select rol='administrador' into administrador from public.perfiles where id=actor and activo for share;
 if not found then raise exception 'Sesión no habilitada' using errcode='42501'; end if;
 if p_id is null or p_version is null or p_version<0 or jsonb_typeof(p_datos) is distinct from 'object' then
   raise exception 'Datos inválidos' using errcode='22023';
 end if;
 foreach campo in array array['nombre','telefono','correo','ubicacion','observaciones','origen','motivo'] loop
   if p_datos ? campo and jsonb_typeof(p_datos->campo) is distinct from 'string' then
     raise exception 'Datos inválidos' using errcode='22023';
   end if;
 end loop;
 motivo := trim(coalesce(p_datos->>'motivo',''));
 if char_length(motivo)>500 then raise exception 'Motivo demasiado extenso' using errcode='22023'; end if;
 responsable:=null;
 if exists(select 1 from public.registros_iniciales where id=p_id and lote_demostracion is not null) then
  raise exception 'Registro de demostración no editable' using errcode='42501';
 end if;
 if p_version=0 then
   perform 1 from public.origenes_registros where codigo=p_datos->>'origen' and activo;
   if not found then raise exception 'Origen no habilitado' using errcode='22023'; end if;
   insert into public.registros_iniciales(id,nombre,telefono,correo,ubicacion,observaciones,origen,responsable_id,creado_por)
   values(p_id,upper(trim(p_datos->>'nombre')),trim(coalesce(p_datos->>'telefono','')),lower(trim(coalesce(p_datos->>'correo',''))),
     trim(coalesce(p_datos->>'ubicacion','')),trim(coalesce(p_datos->>'observaciones','')),p_datos->>'origen',responsable,actor)
   on conflict(id) do nothing returning * into resultado;
   if not found then
     select * into resultado from public.registros_iniciales where id=p_id and creado_por=actor
       ;
     if not found then raise exception 'Operación no disponible' using errcode='42501'; end if;
     -- Un reintento solo confirma la misma carga: no ignora cambios nuevos.
     if resultado.version<>1 or resultado.nombre is distinct from upper(trim(p_datos->>'nombre'))
       or resultado.telefono<>trim(coalesce(p_datos->>'telefono',''))
       or resultado.correo<>lower(trim(coalesce(p_datos->>'correo','')))
       or resultado.ubicacion<>trim(coalesce(p_datos->>'ubicacion',''))
       or resultado.observaciones<>trim(coalesce(p_datos->>'observaciones',''))
       or resultado.origen is distinct from p_datos->>'origen'
       then
       raise exception 'Recargá antes de guardar: el registro cambió' using errcode='40001';
     end if;
     return resultado;
   end if;
   insert into public.eventos_registros(registro_id,actor_id,tipo,nuevo)
   values(p_id,actor,'registro_creado',to_jsonb(resultado));
 else
   select * into anterior from public.registros_iniciales where id=p_id for update;
   if not found then
     raise exception 'Operación no disponible' using errcode='42501';
   end if;
   if anterior.version<>p_version then raise exception 'Recargá antes de guardar: el registro cambió' using errcode='40001'; end if;
   if p_datos->>'origen' is distinct from anterior.origen then raise exception 'El origen histórico no se modifica' using errcode='22023'; end if;
   responsable:=anterior.responsable_id; -- Solo compatibilidad histórica.
   update public.registros_iniciales set nombre=upper(trim(p_datos->>'nombre')),telefono=trim(coalesce(p_datos->>'telefono','')),
     correo=lower(trim(coalesce(p_datos->>'correo',''))),ubicacion=trim(coalesce(p_datos->>'ubicacion','')),
     observaciones=trim(coalesce(p_datos->>'observaciones','')),responsable_id=responsable,
     version=version+1,actualizado_en=now() where id=p_id returning * into resultado;
   insert into public.eventos_registros(registro_id,actor_id,tipo,anterior,nuevo,motivo)
   values(p_id,actor,'registro_actualizado',to_jsonb(anterior),to_jsonb(resultado),motivo);
 end if;
 return resultado;
end;
$$;

do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('public.iniciar_cotizacion(uuid,integer,uuid,jsonb)'::regprocedure);
 old:=$p$ or (actor.rol<>'administrador' and registro.responsable_id is distinct from actor.id)$p$;
 if strpos(d,old)=0 then raise exception 'MIGRACION_032_INCOMPATIBLE: public.iniciar_cotizacion(uuid,integer,uuid,jsonb)'; end if;
 d:=replace(d,old,$p$$p$);
 old:=$p$destino:=(p_datos->>'vendedor_id')::uuid;
 if actor.rol='vendedor' and destino is distinct from actor.id then raise exception 'COMERCIAL_ACCESO'; end if;
 if not exists(select 1 from public.perfiles where id=destino and activo and rol='vendedor') then raise exception 'COMERCIAL_VENDEDOR'; end if;$p$;
 if strpos(d,old)=0 then raise exception 'MIGRACION_032_INCOMPATIBLE: public.iniciar_cotizacion(uuid,integer,uuid,jsonb)'; end if;
 d:=replace(d,old,$p$destino:=null;$p$);
 old:=$p$resumen,interes_comercial,observaciones_visita,canal_contacto)$p$;
 if strpos(d,old)=0 then raise exception 'MIGRACION_032_INCOMPATIBLE: public.iniciar_cotizacion(uuid,integer,uuid,jsonb)'; end if;
 d:=replace(d,old,$p$resumen,interes_comercial,observaciones_visita,canal_contacto,preparacion_compartida)$p$);
 old:=$p$jsonb_build_object('servicios',servicios,'tipo_alarma',modalidad),nota,nullif(p_datos->>'canal_contacto',''))$p$;
 if strpos(d,old)=0 then raise exception 'MIGRACION_032_INCOMPATIBLE: public.iniciar_cotizacion(uuid,integer,uuid,jsonb)'; end if;
 d:=replace(d,old,$p$jsonb_build_object('servicios',servicios,'tipo_alarma',modalidad),nota,nullif(p_datos->>'canal_contacto',''),true)$p$);
 execute d;
end $migration$;

do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('privado.puede_ver_oportunidad(uuid)'::regprocedure);
 old:=$p$p.rol='administrador' or o.responsable_id=p.id$p$;
 if strpos(d,old)=0 then raise exception 'MIGRACION_032_INCOMPATIBLE: privado.puede_ver_oportunidad(uuid)'; end if;
 d:=replace(d,old,$p$p.rol='administrador' or (o.preparacion_compartida and o.estado='cotizacion') or o.responsable_id=p.id$p$);
 execute d;
end $migration$;

do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('public.guardar_propuesta(uuid,uuid,integer,integer,integer,jsonb)'::regprocedure);
 old:=$p$select * into o from public.oportunidades where id=p_oportunidad for update;$p$;
 if strpos(d,old)=0 then raise exception 'MIGRACION_032_INCOMPATIBLE: public.guardar_propuesta(uuid,uuid,integer,integer,integer,jsonb)'; end if;
 d:=replace(d,old,$p$select * into o from public.oportunidades where id=p_oportunidad for update;
 if o.preparacion_compartida and o.estado='cotizacion' then
  if o.version<>p_version then raise exception 'PROPUESTA_CONFLICTO'; end if;
  if actor.rol not in ('vendedor','administrador') then raise exception 'PROPUESTA_ACCESO'; end if;
  if actor.rol='vendedor' then
   o.responsable_id:=actor.id;
  else
   o.responsable_id:=nullif(p_datos->>'responsable_seguimiento_id','')::uuid;
   if not exists(select 1 from public.perfiles where id=o.responsable_id and activo and rol='vendedor') then raise exception 'COMERCIAL_VENDEDOR'; end if;
  end if;
  o.vendedor_visita_id:=o.responsable_id;
  -- Se asigna y audita dentro de la misma transacción que valida y guarda la oferta.
  -- Ante cualquier error posterior se revierte también esta asignación.
  insert into public.eventos_oportunidades(id,oportunidad_id,actor_id,tipo,solicitud,anterior,nuevo)
  select gen_random_uuid(),o.id,actor.id,'primera_oferta_asignada',jsonb_build_object('propuesta_id',p_id),to_jsonb(prev),
   to_jsonb(o)||jsonb_build_object('preparacion_compartida',false) from public.oportunidades prev where prev.id=o.id;
  update public.oportunidades set responsable_id=o.responsable_id,vendedor_visita_id=o.vendedor_visita_id,preparacion_compartida=false where id=o.id;
 end if;$p$);
 execute d;
end $migration$;

create function public.guardar_registro_inicial_032(p_id uuid,p_version integer,p_datos jsonb) returns public.registros_iniciales
language sql security invoker set search_path='' as $$select public.guardar_registro_inicial(p_id,p_version,p_datos)$$;
revoke all on function public.guardar_registro_inicial_032(uuid,integer,jsonb) from public,anon;
grant execute on function public.guardar_registro_inicial_032(uuid,integer,jsonb) to authenticated;
create function public.iniciar_cotizacion_032(p_id uuid,p_version integer,p_operacion uuid,p_datos jsonb) returns uuid
language sql security invoker set search_path='' as $$select public.iniciar_cotizacion(p_id,p_version,p_operacion,p_datos)$$;
revoke all on function public.iniciar_cotizacion_032(uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.iniciar_cotizacion_032(uuid,integer,uuid,jsonb) to authenticated;
create function privado.guardar_preparacion_compartida_032() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.preparacion_compartida and new.preparacion_compartida and (new.estado not in ('cotizacion','anulada') or new.responsable_id is distinct from old.responsable_id) then raise exception 'COMERCIAL_PRIMERA_OFERTA'; end if;
 return new;
end $$;
revoke all on function privado.guardar_preparacion_compartida_032() from public,anon,authenticated;
create trigger guardar_preparacion_compartida_032 before update on public.oportunidades for each row execute function privado.guardar_preparacion_compartida_032();

-- Solo contexto comercial básico para evitar ofrecer en paralelo sin saber quién sigue el caso.
-- El detalle, propuestas, precios y eventos mantienen su RLS por participación.
create function public.negociaciones_contacto_032(p_registro uuid) returns jsonb
language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'necesidad',o.necesidad,'estado',o.estado,
 'preparacion_compartida',o.preparacion_compartida,
 'responsable_nombre',case when o.preparacion_compartida then null else p.nombre end,
 'accesible',privado.puede_ver_oportunidad(o.id)) order by o.necesidad,o.id),'[]'::jsonb)
 from public.oportunidades o join public.prospectos n on n.id=o.prospecto_id
 join public.registros_iniciales r on r.id=n.registro_id left join public.perfiles p on p.id=o.responsable_id
 where privado.usuario_activo() and r.id=p_registro and r.lote_demostracion is null and o.estado<>'anulada';
$$;
revoke all on function public.negociaciones_contacto_032(uuid) from public,anon;
grant execute on function public.negociaciones_contacto_032(uuid) to authenticated;

create or replace function public.listar_contactos_cotizaciones(p_busqueda text default '',p_pagina integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare salida jsonb;
begin
 if not privado.usuario_activo() then raise exception 'COMERCIAL_ACCESO'; end if;
 if p_pagina is null or p_pagina<0 or p_pagina>1000000 then raise exception 'COMERCIAL_DATOS'; end if;
 with contactos as materialized (
  select r.id,r.nombre,r.telefono,r.ubicacion,r.responsable_id,r.creado_en
  from public.registros_iniciales r where r.lote_demostracion is null
   and (coalesce(p_busqueda,'')='' or position(lower(trim(p_busqueda)) in lower(r.nombre))>0)
 ), pagina as (select * from contactos order by nombre,id limit 20 offset p_pagina*20), filas as (
  select p.*,public.negociaciones_contacto_032(p.id) casos from pagina p
 ) select jsonb_build_object('total',(select count(*) from contactos),'filas',coalesce((select jsonb_agg(to_jsonb(f) order by nombre,id) from filas f),'[]')) into salida;
 return salida;
end $$;
do $migration$
declare d text;
begin
 d:=pg_get_functiondef('public.listar_cargas_mensuales(date)'::regprocedure);
 d:=replace(d,'where (r.importacion_historica', 'where (auth.uid() is null or privado.es_administrador() or r.creado_por=auth.uid() or (r.importacion_historica is not null and r.responsable_id=auth.uid())) and (r.importacion_historica');
 execute d;
end $migration$;
do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('public.puede_anular_cotizacion(uuid)'::regprocedure);
 old:='o.responsable_id=p.id and o.creado_por=p.id';
 if strpos(d,old)=0 then raise exception 'MIGRACION_032_ANULACION'; end if;
 execute replace(d,old,'(o.preparacion_compartida or o.responsable_id=p.id) and o.creado_por=p.id');
 d:=pg_get_functiondef('public.gestionar_oportunidad_base_025(uuid,integer,uuid,text,jsonb)'::regprocedure);
 old:='perform pg_advisory_xact_lock(740127);';
 if strpos(d,old)=0 then raise exception 'MIGRACION_032_CREACION'; end if;
 execute replace(d,old,old||$guard$
 if p_accion='crear' and not exists(select 1 from public.eventos_oportunidades where id=p_operacion) then
  raise exception 'COMERCIAL_PRIMERA_OFERTA';
 end if;
 $guard$);
end $migration$;
commit;
