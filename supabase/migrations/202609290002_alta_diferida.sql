-- Auth inserta el usuario y luego actualiza app_metadata en la misma transacción.
-- NEW conserva la versión insertada: consultar la fila final al confirmar.
begin;

create or replace function privado.crear_perfil_autorizado()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  datos jsonb;
  correo_final text;
  actor uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(740127);
  select raw_app_meta_data, email into datos, correo_final
  from auth.users where id = new.id;
  if not found then return new; end if;
  if datos->>'pignus_autorizado' is distinct from 'true'
     or coalesce(datos->>'rol', '') not in ('administrador', 'vendedor') then
    raise exception 'Alta no autorizada para Pignus';
  end if;
  actor := nullif(datos->>'creado_por', '')::uuid;
  if actor is not null and not exists (
    select 1 from public.perfiles where id = actor and activo and rol = 'administrador'
  ) then
    raise exception 'Administrador no habilitado';
  end if;
  if actor is null and (datos->>'rol' <> 'administrador' or exists (select 1 from public.perfiles)) then
    raise exception 'Se requiere un administrador responsable';
  end if;
  insert into public.perfiles (id, nombre, correo, rol, creado_por)
  values (new.id, trim(datos->>'nombre'), lower(correo_final), datos->>'rol', actor);
  insert into public.eventos_cuentas (usuario_id, actor_id, tipo, rol)
  values (new.id, actor, 'cuenta_creada', datos->>'rol');
  return new;
end;
$$;

drop trigger pignus_crear_perfil on auth.users;
create constraint trigger pignus_crear_perfil
after insert on auth.users deferrable initially deferred
for each row execute function privado.crear_perfil_autorizado();

commit;
