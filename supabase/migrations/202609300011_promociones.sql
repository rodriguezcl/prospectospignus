begin;
create table public.promociones (
 id uuid primary key, titulo text not null check(char_length(titulo) between 3 and 120),
 descripcion text not null check(char_length(descripcion) between 5 and 10000),
 condiciones text not null check(char_length(condiciones) between 5 and 10000),
 destinatarios text not null check(destinatarios in ('vendedor','agente','ambos')),
 desde date not null, hasta date not null check(hasta>=desde),
 estado text not null default 'borrador' check(estado in ('borrador','publicada','archivada')),
 version integer not null default 1, creado_por uuid references public.perfiles(id),
 creado_en timestamptz not null default now(), actualizado_en timestamptz not null default now()
);
create table public.archivos_promociones (
 id uuid primary key, promocion_id uuid not null references public.promociones(id),
 nombre text not null check(char_length(nombre) between 1 and 160 and nombre !~ '[/\\]'),
 ruta text not null unique, tipo text not null check(tipo in ('application/pdf','image/jpeg','image/png','image/webp')),
 bytes bigint not null check(bytes between 1 and 20971520),
 estado text not null default 'pendiente' check(estado in ('pendiente','disponible','retirado')),
 creado_en timestamptz not null default now(),
 check((tipo='application/pdf' and lower(nombre) like '%.pdf')
 or (tipo='image/jpeg' and lower(nombre) ~ '\.(jpg|jpeg)$')
 or (tipo='image/png' and lower(nombre) like '%.png')
 or (tipo='image/webp' and lower(nombre) like '%.webp'))
);
create table public.eventos_promociones (
 id uuid primary key, promocion_id uuid not null references public.promociones(id),
 actor_id uuid not null references public.perfiles(id), accion text not null,
 solicitud jsonb not null, anterior jsonb, nuevo jsonb not null, ocurrido_en timestamptz not null default now()
);
create table public.avisos_promociones (
 id bigint generated always as identity primary key, destinatario_id uuid not null references public.perfiles(id),
 promocion_id uuid not null references public.promociones(id), evento_id uuid not null references public.eventos_promociones(id),
 mensaje text not null, creado_en timestamptz not null default now(), leida_en timestamptz,
 unique(destinatario_id,evento_id)
);
create index archivos_promocion on public.archivos_promociones(promocion_id);
create index avisos_promocion_destino on public.avisos_promociones(destinatario_id,creado_en desc);
create function privado.puede_ver_promocion(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.promociones m join public.perfiles p on p.id=auth.uid() and p.activo
 where m.id=p_id and (p.rol='administrador' or (m.estado='publicada' and (m.destinatarios='ambos' or m.destinatarios=p.rol))));
$$;
revoke all on function privado.puede_ver_promocion(uuid) from public,anon;
grant execute on function privado.puede_ver_promocion(uuid) to authenticated;
alter table public.promociones enable row level security;
alter table public.archivos_promociones enable row level security;
alter table public.eventos_promociones enable row level security;
alter table public.avisos_promociones enable row level security;
revoke all on public.promociones,public.archivos_promociones,public.eventos_promociones,public.avisos_promociones from anon,authenticated;
grant select on public.promociones,public.archivos_promociones,public.eventos_promociones,public.avisos_promociones to authenticated;
create policy promociones_lectura on public.promociones for select to authenticated using(privado.puede_ver_promocion(id));
create policy archivos_promociones_lectura on public.archivos_promociones for select to authenticated
 using(privado.puede_ver_promocion(promocion_id) and (estado='disponible' or privado.es_administrador()));
create policy eventos_promociones_lectura on public.eventos_promociones for select to authenticated using(privado.es_administrador());
create policy avisos_promociones_lectura on public.avisos_promociones for select to authenticated
 using(destinatario_id=auth.uid() and privado.puede_ver_promocion(promocion_id));

create function public.gestionar_promocion(p_id uuid,p_version integer,p_operacion uuid,p_accion text,p_datos jsonb default '{}')
returns uuid language plpgsql security definer set search_path='' as $$
declare anterior public.promociones; nueva public.promociones; evento public.eventos_promociones; solicitud jsonb;
begin
 if not privado.es_administrador() then raise exception 'PROMO_ACCESO' using errcode='42501'; end if;
 if p_id is null or p_operacion is null or p_version is null or p_datos is null then raise exception 'PROMO_DATOS'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operacion::text,0));
 solicitud:=jsonb_build_object('id',p_id,'version',p_version,'accion',p_accion,'datos',p_datos);
 select * into evento from public.eventos_promociones where id=p_operacion;
 if found then
   if evento.actor_id<>auth.uid() or evento.solicitud<>solicitud then raise exception 'PROMO_CONFLICTO'; end if;
   return p_id;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,1));
 select * into anterior from public.promociones where id=p_id for update;
 if p_accion='crear' then
   if anterior.id is not null or p_version<>0 then raise exception 'PROMO_CONFLICTO'; end if;
   insert into public.promociones(id,titulo,descripcion,condiciones,destinatarios,desde,hasta,creado_por)
   values(p_id,trim(p_datos->>'titulo'),trim(p_datos->>'descripcion'),trim(p_datos->>'condiciones'),p_datos->>'destinatarios',(p_datos->>'desde')::date,(p_datos->>'hasta')::date,auth.uid());
 else
   if anterior.id is null or anterior.version<>p_version then raise exception 'PROMO_CONFLICTO'; end if;
   if p_accion='editar' and anterior.estado='borrador' then
     update public.promociones set titulo=trim(p_datos->>'titulo'),descripcion=trim(p_datos->>'descripcion'),condiciones=trim(p_datos->>'condiciones'),
       destinatarios=p_datos->>'destinatarios',desde=(p_datos->>'desde')::date,hasta=(p_datos->>'hasta')::date where id=p_id;
   elsif p_accion='borrador' and anterior.estado in ('publicada','archivada') then
     update public.promociones set estado='borrador' where id=p_id;
   elsif p_accion='archivar' and anterior.estado<>'archivada' then
     update public.promociones set estado='archivada' where id=p_id;
   elsif p_accion='publicar' and anterior.estado='borrador' then
     if anterior.hasta<(now() at time zone 'America/Argentina/Cordoba')::date then raise exception 'PROMO_VENCIDA'; end if;
     if exists(select 1 from public.archivos_promociones where promocion_id=p_id and estado='pendiente') then raise exception 'PROMO_PENDIENTE'; end if;
     update public.promociones set estado='publicada' where id=p_id;
   elsif p_accion='reservar_archivo' and anterior.estado='borrador' then
     if (select count(*) from public.archivos_promociones where promocion_id=p_id and estado<>'retirado')>=10 then raise exception 'PROMO_LIMITE'; end if;
     insert into public.archivos_promociones(id,promocion_id,nombre,ruta,tipo,bytes)
       values((p_datos->>'id')::uuid,p_id,p_datos->>'nombre',p_id::text||'/'||(p_datos->>'id')::uuid::text,p_datos->>'tipo',(p_datos->>'bytes')::bigint);
   elsif p_accion='retirar_archivo' and anterior.estado='borrador' then
     update public.archivos_promociones set estado='retirado' where id=(p_datos->>'id')::uuid and promocion_id=p_id and estado<>'retirado';
     if not found then raise exception 'PROMO_ARCHIVO'; end if;
   else raise exception 'PROMO_TRANSICION'; end if;
   update public.promociones set version=version+1,actualizado_en=now() where id=p_id;
 end if;
 select * into nueva from public.promociones where id=p_id;
 insert into public.eventos_promociones values(p_operacion,p_id,auth.uid(),p_accion,solicitud,to_jsonb(anterior),to_jsonb(nueva),now());
 if p_accion='publicar' then
   insert into public.avisos_promociones(destinatario_id,promocion_id,evento_id,mensaje)
   select id,p_id,p_operacion,'Promoción publicada: '||nueva.titulo from public.perfiles
   where activo and rol in ('vendedor','agente') and (nueva.destinatarios='ambos' or rol=nueva.destinatarios);
 end if;
 return p_id;
end $$;
create function public.leer_aviso_promocion(p_id bigint) returns void
language sql security definer set search_path='' as $$
 update public.avisos_promociones set leida_en=coalesce(leida_en,now())
 where id=p_id and destinatario_id=auth.uid() and privado.puede_ver_promocion(promocion_id);
$$;
revoke all on function public.gestionar_promocion(uuid,integer,uuid,text,jsonb),public.leer_aviso_promocion(bigint) from public,anon;
grant execute on function public.gestionar_promocion(uuid,integer,uuid,text,jsonb),public.leer_aviso_promocion(bigint) to authenticated;
create function privado.proteger_historial_promociones() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.promociones where creado_por=old.id)
 or exists(select 1 from public.eventos_promociones where actor_id=old.id)
 or exists(select 1 from public.avisos_promociones where destinatario_id=old.id) then raise exception 'CUENTA_VINCULADA'; end if;
 return old;
end $$;
revoke all on function privado.proteger_historial_promociones() from public,anon,authenticated;
create trigger proteger_historial_promociones before delete on public.perfiles for each row execute function privado.proteger_historial_promociones();
commit;
