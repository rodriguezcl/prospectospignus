-- Ejecutar una sola vez mediante Supabase migrations. No modifica datos comerciales.
begin;

create schema if not exists privado;
revoke all on schema privado from public;
grant usage on schema privado to authenticated;

create table public.perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nombre text not null check (char_length(nombre) between 2 and 100),
  correo text not null unique,
  rol text not null check (rol in ('administrador', 'vendedor')),
  activo boolean not null default true,
  creado_por uuid references auth.users(id) on delete set null,
  creado_en timestamptz not null default now()
);
alter table public.perfiles enable row level security;
revoke all on table public.perfiles from anon, authenticated;
grant select on table public.perfiles to authenticated;
grant all on table public.perfiles to service_role;

create function privado.es_administrador()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.perfiles p
    where p.id = (select auth.uid()) and p.activo and p.rol = 'administrador'
  );
$$;
revoke all on function privado.es_administrador() from public, anon;
grant execute on function privado.es_administrador() to authenticated;

create policy perfiles_lectura on public.perfiles for select to authenticated
using ((id = (select auth.uid()) and activo) or (select privado.es_administrador()));
-- Sin políticas ni permisos INSERT/UPDATE/DELETE para navegador, incluidos administradores.

create table public.eventos_cuentas (
  id bigint generated always as identity primary key,
  usuario_id uuid not null,
  actor_id uuid,
  tipo text not null,
  rol text not null,
  ocurrido_en timestamptz not null default now()
);
alter table public.eventos_cuentas enable row level security;
revoke all on public.eventos_cuentas from anon, authenticated;
grant select on public.eventos_cuentas to authenticated;
create policy eventos_cuentas_lectura on public.eventos_cuentas for select to authenticated
using ((select privado.es_administrador()));

create function privado.crear_perfil_autorizado()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  datos jsonb := new.raw_app_meta_data;
  actor uuid;
begin
  perform pg_catalog.pg_advisory_xact_lock(740127);
  -- app_metadata solo puede ser administrado por servidor; ignorar user_metadata.
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
  -- Primer administrador: únicamente vía credencial privilegiada del servidor.
  if actor is null and (datos->>'rol' <> 'administrador' or exists (select 1 from public.perfiles)) then
    raise exception 'Se requiere un administrador responsable';
  end if;
  insert into public.perfiles (id, nombre, correo, rol, creado_por)
  values (new.id, trim(datos->>'nombre'), lower(new.email), datos->>'rol', actor);
  insert into public.eventos_cuentas (usuario_id, actor_id, tipo, rol)
  values (new.id, actor, 'cuenta_creada', datos->>'rol');
  return new;
end;
$$;
revoke all on function privado.crear_perfil_autorizado() from public, anon, authenticated;
create trigger pignus_crear_perfil after insert on auth.users
for each row execute function privado.crear_perfil_autorizado();

commit;
