begin;
create table public.origenes_registros (
  codigo text primary key, nombre text not null, activo boolean not null default true
);
insert into public.origenes_registros(codigo,nombre) values
('puerta_a_puerta','Puerta a puerta'),('whatsapp','WhatsApp'),('llamada','Llamada'),
('sitio_web','Sitio web'),('instagram','Instagram'),('facebook','Facebook'),
('oficina','Oficina'),('referido','Referido'),('campana','Campaña'),
('cliente_existente','Cliente existente'),('otro','Otro');

create function privado.usuario_activo() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from public.perfiles where id=auth.uid() and activo);
$$;
revoke all on function privado.usuario_activo() from public, anon;
grant execute on function privado.usuario_activo() to authenticated;

create table public.registros_iniciales (
 id uuid primary key,
 nombre text not null check(char_length(trim(nombre)) between 2 and 150),
 telefono text not null default '' check(char_length(telefono)<=40),
 correo text not null default '' check(char_length(correo)<=254 and (correo='' or correo ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')),
 ubicacion text not null default '' check(char_length(ubicacion)<=250),
 observaciones text not null default '' check(char_length(observaciones)<=2000),
 origen text not null references public.origenes_registros(codigo),
 responsable_id uuid references public.perfiles(id),
 creado_por uuid not null references public.perfiles(id),
 creado_en timestamptz not null default now(),
 actualizado_en timestamptz not null default now(),
 version integer not null default 1 check(version>0)
);
create index registros_responsable_fecha on public.registros_iniciales(responsable_id,creado_en desc,id);
create index registros_fecha on public.registros_iniciales(creado_en desc,id);
create table public.eventos_registros (
 id bigint generated always as identity primary key,
 registro_id uuid not null references public.registros_iniciales(id),
 actor_id uuid not null references public.perfiles(id),
 tipo text not null check(tipo in ('registro_creado','registro_actualizado')),
 ocurrido_en timestamptz not null default now(),
 anterior jsonb, nuevo jsonb not null,
 motivo text not null default ''
);
create index eventos_registro_fecha on public.eventos_registros(registro_id,ocurrido_en,id);
alter table public.registros_iniciales enable row level security;
alter table public.eventos_registros enable row level security;
alter table public.origenes_registros enable row level security;
revoke all on public.registros_iniciales, public.eventos_registros, public.origenes_registros from anon, authenticated;
grant select on public.registros_iniciales, public.eventos_registros, public.origenes_registros to authenticated;
create policy registros_lectura on public.registros_iniciales for select to authenticated
using ((select privado.usuario_activo()) and (responsable_id=(select auth.uid()) or (select privado.es_administrador())));
create policy eventos_registros_lectura on public.eventos_registros for select to authenticated
using (exists(select 1 from public.registros_iniciales r where r.id=registro_id));
create policy origenes_lectura on public.origenes_registros for select to authenticated
using ((select privado.usuario_activo()));

-- Escrituras exclusivamente por esta operación: identidad, permisos, versión e historial atómicos.
create function public.guardar_registro_inicial(p_id uuid, p_version integer, p_datos jsonb)
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
 if administrador then responsable := nullif(p_datos->>'responsable_id','')::uuid;
 else
   responsable := actor;
   if nullif(p_datos->>'responsable_id','') is not null and (p_datos->>'responsable_id')::uuid<>actor then
     raise exception 'No podés asignar otra cartera' using errcode='42501';
   end if;
 end if;
 if responsable is not null then
   perform 1 from public.perfiles where id=responsable and activo for share;
   if not found then raise exception 'Responsable no habilitado' using errcode='22023'; end if;
 end if;
 if p_version=0 then
   perform 1 from public.origenes_registros where codigo=p_datos->>'origen' and activo;
   if not found then raise exception 'Origen no habilitado' using errcode='22023'; end if;
   insert into public.registros_iniciales(id,nombre,telefono,correo,ubicacion,observaciones,origen,responsable_id,creado_por)
   values(p_id,trim(p_datos->>'nombre'),trim(coalesce(p_datos->>'telefono','')),lower(trim(coalesce(p_datos->>'correo',''))),
     trim(coalesce(p_datos->>'ubicacion','')),trim(coalesce(p_datos->>'observaciones','')),p_datos->>'origen',responsable,actor)
   on conflict(id) do nothing returning * into resultado;
   if not found then
     select * into resultado from public.registros_iniciales where id=p_id and creado_por=actor
       and (responsable_id=actor or administrador);
     if not found then raise exception 'Operación no disponible' using errcode='42501'; end if;
     -- Un reintento solo confirma la misma carga: no ignora cambios nuevos.
     if resultado.version<>1 or resultado.nombre is distinct from trim(p_datos->>'nombre')
       or resultado.telefono<>trim(coalesce(p_datos->>'telefono',''))
       or resultado.correo<>lower(trim(coalesce(p_datos->>'correo','')))
       or resultado.ubicacion<>trim(coalesce(p_datos->>'ubicacion',''))
       or resultado.observaciones<>trim(coalesce(p_datos->>'observaciones',''))
       or resultado.origen is distinct from p_datos->>'origen'
       or resultado.responsable_id is distinct from responsable then
       raise exception 'Recargá antes de guardar: el registro cambió' using errcode='40001';
     end if;
     return resultado;
   end if;
   insert into public.eventos_registros(registro_id,actor_id,tipo,nuevo)
   values(p_id,actor,'registro_creado',to_jsonb(resultado));
 else
   select * into anterior from public.registros_iniciales where id=p_id for update;
   if not found or (not administrador and anterior.responsable_id is distinct from actor) then
     raise exception 'Operación no disponible' using errcode='42501';
   end if;
   if anterior.version<>p_version then raise exception 'Recargá antes de guardar: el registro cambió' using errcode='40001'; end if;
   if p_datos->>'origen' is distinct from anterior.origen then raise exception 'El origen histórico no se modifica' using errcode='22023'; end if;
   if anterior.responsable_id is distinct from responsable and char_length(motivo)<5 then
     raise exception 'Indicá el motivo de reasignación (mínimo 5 caracteres)' using errcode='22023';
   end if;
   update public.registros_iniciales set nombre=trim(p_datos->>'nombre'),telefono=trim(coalesce(p_datos->>'telefono','')),
     correo=lower(trim(coalesce(p_datos->>'correo',''))),ubicacion=trim(coalesce(p_datos->>'ubicacion','')),
     observaciones=trim(coalesce(p_datos->>'observaciones','')),responsable_id=responsable,
     version=version+1,actualizado_en=now() where id=p_id returning * into resultado;
   insert into public.eventos_registros(registro_id,actor_id,tipo,anterior,nuevo,motivo)
   values(p_id,actor,'registro_actualizado',to_jsonb(anterior),to_jsonb(resultado),motivo);
 end if;
 return resultado;
end;
$$;
revoke all on function public.guardar_registro_inicial(uuid,integer,jsonb) from public,anon;
grant execute on function public.guardar_registro_inicial(uuid,integer,jsonb) to authenticated;
commit;
