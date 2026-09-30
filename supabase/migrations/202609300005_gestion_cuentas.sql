begin;

alter table public.perfiles add column version integer not null default 1 check (version > 0);
alter table public.eventos_cuentas add column anterior jsonb;
alter table public.eventos_cuentas add column nuevo jsonb;
alter table public.eventos_cuentas add column motivo text not null default '';

-- Operación acotada, atómica y autorizada con identidad del JWT, nunca del cuerpo.
-- perfiles es la fuente de permisos; no se confía en metadatos del JWT.
create function public.gestionar_cuenta(p_id uuid, p_version integer, p_accion text, p_datos jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  anterior public.perfiles;
  nueva public.perfiles;
  motivo text;
  nombre_nuevo text;
  rol_nuevo text;
  activo_nuevo boolean;
begin
  -- Mismo bloqueo que altas: serializa cambios de elegibilidad administrativa.
  perform pg_catalog.pg_advisory_xact_lock(740127);
  perform 1 from public.perfiles where id=actor and activo and rol='administrador' for update;
  if not found then raise exception 'CUENTA_ACCESO' using errcode='42501'; end if;
  if p_id is null or p_version is null or p_version < 1
    or p_accion is null or p_accion not in ('editar','desactivar','reactivar','eliminar')
    or jsonb_typeof(p_datos) is distinct from 'object' then
    raise exception 'CUENTA_DATOS';
  end if;
  motivo := trim(coalesce(p_datos->>'motivo',''));
  if char_length(motivo) not between 5 and 500 then raise exception 'CUENTA_MOTIVO'; end if;
  select * into anterior from public.perfiles where id=p_id for update;
  if not found then raise exception 'CUENTA_NO_EXISTE'; end if;
  if anterior.version <> p_version then raise exception 'CUENTA_CONFLICTO'; end if;
  if anterior.lote_demostracion is not null then raise exception 'CUENTA_DEMO'; end if;
  nombre_nuevo := anterior.nombre;
  rol_nuevo := anterior.rol;
  activo_nuevo := anterior.activo;
  if p_accion='editar' then
    nombre_nuevo := trim(p_datos->>'nombre');
    rol_nuevo := p_datos->>'rol';
    if nombre_nuevo is null or char_length(nombre_nuevo) not between 2 and 100
      or rol_nuevo is null or rol_nuevo not in ('administrador','vendedor') then raise exception 'CUENTA_DATOS'; end if;
  elsif p_accion='desactivar' then activo_nuevo := false;
  elsif p_accion='reactivar' then activo_nuevo := true;
  end if;
  if anterior.activo and anterior.rol='administrador'
    and (not activo_nuevo or rol_nuevo<>'administrador' or p_accion='eliminar')
    and not exists(select 1 from public.perfiles p where p.id<>p_id and p.activo and p.rol='administrador') then
    raise exception 'CUENTA_ULTIMO_ADMIN';
  end if;
  if p_id=actor and (not activo_nuevo or rol_nuevo<>anterior.rol or p_accion='eliminar') then
    raise exception 'CUENTA_PROPIA';
  end if;
  if p_accion='eliminar' then
    -- Evita que se agregue historial entre la comprobación y la eliminación.
    lock table public.registros_iniciales, public.eventos_registros in share row exclusive mode;
    if exists(select 1 from public.registros_iniciales where creado_por=p_id or responsable_id=p_id)
      or exists(select 1 from public.eventos_registros e where e.actor_id=p_id
        or e.anterior->>'responsable_id'=p_id::text or e.nuevo->>'responsable_id'=p_id::text
        or e.anterior->>'creado_por'=p_id::text or e.nuevo->>'creado_por'=p_id::text)
      or exists(select 1 from public.perfiles where creado_por=p_id)
      or exists(select 1 from public.eventos_cuentas where actor_id=p_id and usuario_id<>p_id) then
      raise exception 'CUENTA_VINCULADA';
    end if;
    if p_datos->>'confirmacion' is distinct from anterior.correo then raise exception 'CUENTA_CONFIRMACION'; end if;
    -- Borrado Auth + perfil (FK cascade) en una transacción; conservar auditoría sin FK.
    -- No borra historial ni objetos de Storage: cualquier FK restante aborta la operación.
    delete from auth.users where id=p_id;
    insert into public.eventos_cuentas(usuario_id,actor_id,tipo,rol,anterior,motivo)
      values(p_id,actor,'cuenta_eliminada',anterior.rol,to_jsonb(anterior),motivo);
  else
    if nombre_nuevo=anterior.nombre and rol_nuevo=anterior.rol and activo_nuevo=anterior.activo then return; end if;
    update public.perfiles set nombre=nombre_nuevo, rol=rol_nuevo,
      activo=activo_nuevo, version=version+1 where id=p_id returning * into nueva;
    insert into public.eventos_cuentas(usuario_id,actor_id,tipo,rol,anterior,nuevo,motivo)
      values(p_id,actor,'cuenta_' || case p_accion when 'editar' then 'editada' when 'reactivar' then 'reactivada' else 'desactivada' end,
        nueva.rol,to_jsonb(anterior),to_jsonb(nueva),motivo);
  end if;
end;
$$;
revoke all on function public.gestionar_cuenta(uuid,integer,text,jsonb) from public, anon;
grant execute on function public.gestionar_cuenta(uuid,integer,text,jsonb) to authenticated;
commit;
