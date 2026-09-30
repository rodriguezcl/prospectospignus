begin;

alter table public.perfiles drop constraint perfiles_rol_check;
alter table public.perfiles add constraint perfiles_rol_check check (rol in ('administrador','vendedor','agente'));
alter table public.perfiles add column disponible boolean not null default false;

-- Conserva las comprobaciones de las migraciones anteriores, ampliando solo el catálogo.
do $$
declare definicion text;
begin
  definicion := pg_get_functiondef('privado.crear_perfil_autorizado()'::regprocedure);
  execute replace(definicion, '(''administrador'', ''vendedor'')', '(''administrador'', ''vendedor'', ''agente'')');
  definicion := pg_get_functiondef('public.gestionar_cuenta(uuid,integer,text,jsonb)'::regprocedure);
  execute replace(definicion, '(''administrador'',''vendedor'')', '(''administrador'',''vendedor'',''agente'')');
end $$;

create table public.prospectos (
  id uuid primary key default gen_random_uuid(),
  registro_id uuid not null unique references public.registros_iniciales(id),
  nombre text not null, telefono text not null, direccion text not null,
  contacto_efectivo text not null check(char_length(contacto_efectivo) between 5 and 2000),
  calificado_por uuid not null references public.perfiles(id),
  captado_por uuid not null references public.perfiles(id),
  creado_en timestamptz not null default now()
);
create table public.oportunidades (
  id uuid primary key,
  prospecto_id uuid not null references public.prospectos(id),
  necesidad text not null check(char_length(necesidad) between 5 and 2000),
  estado text not null check(estado in ('visita','seguimiento','recuperacion','ganada','perdida')),
  responsable_id uuid references public.perfiles(id),
  vendedor_visita_id uuid not null references public.perfiles(id),
  creado_por uuid not null references public.perfiles(id),
  cerrado_por uuid references public.perfiles(id),
  visita_en timestamptz not null,
  proxima_accion_en timestamptz,
  resumen text not null default '',
  condiciones text not null default '',
  motivo_perdida text,
  canal_confirmacion text,
  confirmado_en timestamptz,
  cerrado_en timestamptz,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  version integer not null default 1,
  check(responsable_id is not null or estado='recuperacion'),
  check(estado in ('ganada','perdida') or proxima_accion_en is not null)
);
create index oportunidades_cola on public.oportunidades(estado,responsable_id,proxima_accion_en);
create table public.eventos_oportunidades (
  id uuid primary key,
  oportunidad_id uuid not null references public.oportunidades(id),
  actor_id uuid not null references public.perfiles(id),
  tipo text not null,
  solicitud jsonb not null,
  anterior jsonb,
  nuevo jsonb not null,
  ocurrido_en timestamptz not null default now()
);
create index eventos_oportunidad on public.eventos_oportunidades(oportunidad_id,ocurrido_en);
create table public.notificaciones (
  id bigint generated always as identity primary key,
  destinatario_id uuid not null references public.perfiles(id),
  oportunidad_id uuid not null references public.oportunidades(id),
  evento_id uuid not null references public.eventos_oportunidades(id),
  mensaje text not null,
  creado_en timestamptz not null default now(),
  leida_en timestamptz,
  unique(destinatario_id,evento_id)
);
create index notificaciones_destino on public.notificaciones(destinatario_id,creado_en desc);

create function privado.puede_ver_oportunidad(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.oportunidades o join public.perfiles p on p.id=auth.uid()
    where o.id=p_id and p.activo and (p.rol='administrador' or o.responsable_id=p.id
      or o.vendedor_visita_id=p.id or o.creado_por=p.id
      or (p.rol='agente' and o.estado='recuperacion')));
$$;
revoke all on function privado.puede_ver_oportunidad(uuid) from public,anon;
grant execute on function privado.puede_ver_oportunidad(uuid) to authenticated;
alter table public.prospectos enable row level security;
alter table public.oportunidades enable row level security;
alter table public.eventos_oportunidades enable row level security;
alter table public.notificaciones enable row level security;
revoke all on public.prospectos,public.oportunidades,public.eventos_oportunidades,public.notificaciones from anon,authenticated;
grant select on public.prospectos,public.oportunidades,public.eventos_oportunidades,public.notificaciones to authenticated;
create policy oportunidades_lectura on public.oportunidades for select to authenticated using(privado.puede_ver_oportunidad(id));
create policy prospectos_lectura on public.prospectos for select to authenticated using(exists(select 1 from public.oportunidades o where o.prospecto_id=public.prospectos.id and privado.puede_ver_oportunidad(o.id)));
create policy eventos_oportunidades_lectura on public.eventos_oportunidades for select to authenticated using(privado.puede_ver_oportunidad(oportunidad_id));
create policy notificaciones_lectura on public.notificaciones for select to authenticated using(destinatario_id=auth.uid() and privado.usuario_activo());

-- Proyección mínima del equipo: no amplía SELECT sobre perfiles/correos.
create function public.equipo_comercial() returns table(id uuid,nombre text,rol text,disponible boolean)
language sql stable security definer set search_path='' as $$
 select p.id,p.nombre,p.rol,p.disponible from public.perfiles p
 where privado.usuario_activo() and p.activo and p.lote_demostracion is null;
$$;

create function public.disponibilidad_agente(p_disponible boolean) returns void
language plpgsql security definer set search_path='' as $$
declare anterior public.perfiles; nuevo public.perfiles;
begin
 perform pg_advisory_xact_lock(740127);
 select * into anterior from public.perfiles where id=auth.uid() and activo and rol='agente' for update;
 if not found then raise exception 'COMERCIAL_ACCESO'; end if;
 if p_disponible is null then raise exception 'COMERCIAL_DATOS'; end if;
 if anterior.disponible=p_disponible then return; end if;
 update public.perfiles set disponible=p_disponible,version=version+1 where id=auth.uid() returning * into nuevo;
 insert into public.eventos_cuentas(usuario_id,actor_id,tipo,rol,anterior,nuevo,motivo)
 values(auth.uid(),auth.uid(),'disponibilidad','agente',to_jsonb(anterior),to_jsonb(nuevo),'Disponibilidad declarada');
end $$;

create function public.leer_notificacion(p_id bigint) returns void
language sql security definer set search_path='' as $$
 update public.notificaciones set leida_en=coalesce(leida_en,now())
 where id=p_id and destinatario_id=auth.uid() and privado.usuario_activo();
$$;

create function privado.elegir_agente() returns uuid language sql volatile security definer set search_path='' as $$
 select p.id from public.perfiles p left join public.oportunidades o
 on o.responsable_id=p.id and o.estado='recuperacion'
 where p.activo and p.rol='agente' and p.disponible and p.lote_demostracion is null
 group by p.id order by count(o.id),random() limit 1;
$$;
revoke all on function privado.elegir_agente() from public,anon,authenticated;

create function public.gestionar_oportunidad(p_id uuid,p_version integer,p_operacion uuid,p_accion text,p_datos jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 actor public.perfiles; anterior public.oportunidades; nueva public.oportunidades;
 registro public.registros_iniciales; prospecto uuid; destino uuid;
 evento public.eventos_oportunidades; solicitud jsonb;
 resumen text := trim(coalesce(p_datos->>'resumen',''));
 condiciones text := trim(coalesce(p_datos->>'condiciones',''));
 plazo timestamptz; recuperacion boolean;
begin
 -- Serializa asignación equilibrada, disponibilidad y cambios de rol; después bloquea la ficha.
 perform pg_advisory_xact_lock(740127);
 select * into actor from public.perfiles where id=auth.uid() and activo;
 if not found then raise exception 'COMERCIAL_ACCESO'; end if;
 if p_id is null or p_operacion is null or p_version is null or p_version<0
   or jsonb_typeof(p_datos) is distinct from 'object' or p_accion is null then raise exception 'COMERCIAL_DATOS'; end if;
 solicitud := jsonb_build_object('id',p_id,'version',p_version,'accion',p_accion,'datos',p_datos);
 select * into evento from public.eventos_oportunidades where id=p_operacion;
 if found then
   if evento.actor_id=actor.id and evento.solicitud=solicitud then return evento.oportunidad_id; end if;
   raise exception 'COMERCIAL_CONFLICTO';
 end if;
 if char_length(resumen) not between 5 and 2000 or char_length(condiciones)>2000 then raise exception 'COMERCIAL_DATOS'; end if;
 if p_accion='crear' then
   if p_version<>0 then raise exception 'COMERCIAL_CONFLICTO'; end if;
   select * into registro from public.registros_iniciales where id=(p_datos->>'registro_id')::uuid for update;
   if not found or registro.lote_demostracion is not null or (actor.rol<>'administrador' and registro.responsable_id is distinct from actor.id) then raise exception 'COMERCIAL_ACCESO'; end if;
   if char_length(trim(registro.telefono))=0 or char_length(trim(registro.ubicacion))=0
     or p_datos->>'contacto_confirmado' is distinct from 'si'
     or char_length(trim(coalesce(p_datos->>'necesidad',''))) not between 5 and 2000 then raise exception 'COMERCIAL_CALIFICACION'; end if;
   destino := (p_datos->>'vendedor_id')::uuid;
   if actor.rol='vendedor' and destino is distinct from actor.id then raise exception 'COMERCIAL_ACCESO'; end if;
   if not exists(select 1 from public.perfiles where id=destino and activo and rol='vendedor') then raise exception 'COMERCIAL_VENDEDOR'; end if;
   plazo := (p_datos->>'plazo')::timestamptz;
   if plazo is null or plazo<=now() then raise exception 'COMERCIAL_PLAZO'; end if;
   insert into public.prospectos(registro_id,nombre,telefono,direccion,contacto_efectivo,calificado_por,captado_por)
   values(registro.id,registro.nombre,registro.telefono,registro.ubicacion,resumen,actor.id,registro.creado_por)
   on conflict(registro_id) do nothing;
   select id into prospecto from public.prospectos where registro_id=registro.id;
   insert into public.oportunidades(id,prospecto_id,necesidad,estado,responsable_id,vendedor_visita_id,creado_por,visita_en,proxima_accion_en,resumen)
   values(p_id,prospecto,trim(p_datos->>'necesidad'),'visita',destino,destino,actor.id,plazo,plazo,resumen) returning * into nueva;
 else
   select * into anterior from public.oportunidades where id=p_id for update;
   if not found or (actor.rol<>'administrador' and anterior.responsable_id is distinct from actor.id
     and not(p_accion='asignar' and actor.rol='agente' and anterior.estado='recuperacion' and anterior.responsable_id is null)) then raise exception 'COMERCIAL_ACCESO'; end if;
   if anterior.version<>p_version then raise exception 'COMERCIAL_CONFLICTO'; end if;
   if anterior.estado in ('ganada','perdida') then raise exception 'COMERCIAL_CERRADA'; end if;
   if anterior.responsable_id is null and p_accion not in ('asignar','reasignar') then raise exception 'COMERCIAL_SIN_AGENTE'; end if;
   nueva := anterior;
   nueva.version := anterior.version+1;
   nueva.actualizado_en := now(); nueva.resumen := resumen;
   recuperacion := anterior.estado='recuperacion';
   if p_accion in ('reprogramar','seguimiento','derivar') then
     plazo := (p_datos->>'plazo')::timestamptz;
     if plazo is null or plazo<=now() then raise exception 'COMERCIAL_PLAZO'; end if;
     nueva.proxima_accion_en := plazo;
   end if;
   if p_accion='derivar' then
     if recuperacion or actor.rol not in ('vendedor','administrador') or char_length(condiciones)<5 then raise exception 'COMERCIAL_TRANSICION'; end if;
     nueva.estado := 'recuperacion'; nueva.responsable_id := privado.elegir_agente(); nueva.condiciones := condiciones;
   elsif p_accion='asignar' then
     if not recuperacion or anterior.responsable_id is not null then raise exception 'COMERCIAL_TRANSICION'; end if;
     nueva.responsable_id := privado.elegir_agente();
     if nueva.responsable_id is null then raise exception 'COMERCIAL_SIN_AGENTE'; end if;
   elsif p_accion='reasignar' then
     if actor.rol<>'administrador' then raise exception 'COMERCIAL_ACCESO'; end if;
     destino := (p_datos->>'responsable_id')::uuid;
     if not exists(select 1 from public.perfiles where id=destino and activo and
       ((recuperacion and rol='agente' and disponible) or (not recuperacion and rol='vendedor'))) then raise exception 'COMERCIAL_DESTINO'; end if;
     nueva.responsable_id := destino;
     if not recuperacion then nueva.vendedor_visita_id := destino; end if;
   elsif p_accion='reprogramar' then
     if recuperacion then raise exception 'COMERCIAL_TRANSICION'; end if;
     nueva.estado := 'visita'; nueva.visita_en := plazo;
   elsif p_accion='seguimiento' then
     if not recuperacion then nueva.estado := 'seguimiento'; end if;
     if condiciones<>'' then nueva.condiciones := condiciones; end if;
   elsif p_accion in ('ganar','perder') then
     if p_accion='ganar' then
       if char_length(condiciones)<5 or coalesce(p_datos->>'canal','') not in ('presencial','llamada','whatsapp','correo','otro')
         or p_datos->>'aceptacion_confirmada' is distinct from 'si' then raise exception 'COMERCIAL_CONFIRMACION'; end if;
       nueva.confirmado_en := (p_datos->>'confirmado_en')::timestamptz;
       if nueva.confirmado_en is null or nueva.confirmado_en>now() or nueva.confirmado_en<date_trunc('minute',anterior.creado_en) then raise exception 'COMERCIAL_CONFIRMACION'; end if;
       nueva.estado := 'ganada'; nueva.canal_confirmacion := p_datos->>'canal'; nueva.condiciones := condiciones;
     else
       if coalesce(p_datos->>'motivo','') not in ('precio','competencia','no_interesado','fuera_de_zona','no_cumple_requisitos','otro') then raise exception 'COMERCIAL_MOTIVO'; end if;
       if not recuperacion and p_datos->>'motivo' not in ('fuera_de_zona','no_cumple_requisitos') then raise exception 'COMERCIAL_RECUPERAR'; end if;
       if recuperacion and (char_length(condiciones)<5 or p_datos->>'rechazo_confirmado' is distinct from 'si') then raise exception 'COMERCIAL_RECHAZO'; end if;
       nueva.estado := 'perdida'; nueva.motivo_perdida := p_datos->>'motivo';
       if condiciones<>'' then nueva.condiciones := condiciones; end if;
     end if;
     nueva.cerrado_por := anterior.responsable_id; nueva.cerrado_en := now(); nueva.proxima_accion_en := null;
   else raise exception 'COMERCIAL_TRANSICION';
   end if;
   update public.oportunidades set estado=nueva.estado,responsable_id=nueva.responsable_id,vendedor_visita_id=nueva.vendedor_visita_id,
     visita_en=nueva.visita_en,proxima_accion_en=nueva.proxima_accion_en,resumen=nueva.resumen,condiciones=nueva.condiciones,
     motivo_perdida=nueva.motivo_perdida,canal_confirmacion=nueva.canal_confirmacion,confirmado_en=nueva.confirmado_en,
     cerrado_por=nueva.cerrado_por,cerrado_en=nueva.cerrado_en,actualizado_en=nueva.actualizado_en,version=nueva.version where id=p_id;
 end if;
 insert into public.eventos_oportunidades(id,oportunidad_id,actor_id,tipo,solicitud,anterior,nuevo)
 values(p_operacion,p_id,actor.id,p_accion,solicitud,case when anterior.id is null then null else to_jsonb(anterior) end,to_jsonb(nueva));
 if p_accion in ('crear','derivar','asignar','reasignar','reprogramar') then
   if nueva.responsable_id is not null then
     insert into public.notificaciones(destinatario_id,oportunidad_id,evento_id,mensaje)
     values(nueva.responsable_id,p_id,p_operacion,case when nueva.estado='recuperacion' then 'Recuperación comercial asignada' else 'Visita comercial asignada o reprogramada' end);
   else
     insert into public.notificaciones(destinatario_id,oportunidad_id,evento_id,mensaje)
     select id,p_id,p_operacion,'Recuperación pendiente: no hay agentes disponibles' from public.perfiles where activo and rol='administrador';
   end if;
 end if;
 return p_id;
end $$;

-- FKs conservan participación histórica. Una cuenta con trabajo abierto no queda inhabilitada.
create function privado.proteger_participacion_comercial() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
   if (new.rol<>old.rol or not new.activo) and exists(select 1 from public.oportunidades where responsable_id=old.id and estado not in ('ganada','perdida')) then
     raise exception 'CUENTA_TRABAJO_PENDIENTE';
   end if;
   return new;
 end if;
 if exists(select 1 from public.eventos_oportunidades where actor_id=old.id or anterior->>'responsable_id'=old.id::text or nuevo->>'responsable_id'=old.id::text)
   or exists(select 1 from public.prospectos where calificado_por=old.id or captado_por=old.id)
   or exists(select 1 from public.oportunidades where responsable_id=old.id or vendedor_visita_id=old.id or creado_por=old.id or cerrado_por=old.id) then
   raise exception 'CUENTA_VINCULADA';
 end if;
 return old;
end $$;
revoke all on function privado.proteger_participacion_comercial() from public,anon,authenticated;
create trigger proteger_participacion before update or delete on public.perfiles for each row execute function privado.proteger_participacion_comercial();
revoke all on function public.equipo_comercial(),public.disponibilidad_agente(boolean),public.leer_notificacion(bigint),public.gestionar_oportunidad(uuid,integer,uuid,text,jsonb) from public,anon;
grant execute on function public.equipo_comercial(),public.disponibilidad_agente(boolean),public.leer_notificacion(bigint),public.gestionar_oportunidad(uuid,integer,uuid,text,jsonb) to authenticated;
commit;
