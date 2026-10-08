begin;
-- La reserva de contacto es independiente de la autoría y de la asignación comercial.
create table public.atencion_prospectos (
 registro_id uuid primary key references public.registros_iniciales(id),
 vendedor_id uuid references public.perfiles(id),
 tomado_en timestamptz,
 version integer not null default 1
);
create table public.eventos_atencion_prospectos (
 id bigint generated always as identity primary key,
 registro_id uuid not null references public.registros_iniciales(id),
 actor_id uuid not null references public.perfiles(id),
 vendedor_anterior uuid references public.perfiles(id),
 vendedor_nuevo uuid references public.perfiles(id),
 creado_en timestamptz not null default now()
);
create table public.avisos_prospectos (
 id bigint generated always as identity primary key,
 registro_id uuid not null references public.registros_iniciales(id),
 destinatario_id uuid not null references public.perfiles(id),
 mensaje text not null,
 creado_en timestamptz not null default now(),
 leida_en timestamptz,
 unique(registro_id,destinatario_id)
);
alter table public.atencion_prospectos enable row level security;
alter table public.eventos_atencion_prospectos enable row level security;
alter table public.avisos_prospectos enable row level security;
revoke all on public.atencion_prospectos,public.eventos_atencion_prospectos,public.avisos_prospectos from anon,authenticated;
grant select on public.atencion_prospectos,public.eventos_atencion_prospectos,public.avisos_prospectos to authenticated;
create policy atencion_lectura on public.atencion_prospectos for select to authenticated using(privado.usuario_activo() and exists(select 1 from public.registros_iniciales r where r.id=registro_id));
create policy atencion_eventos_lectura on public.eventos_atencion_prospectos for select to authenticated using(privado.es_administrador());
create policy avisos_prospectos_lectura on public.avisos_prospectos for select to authenticated using(destinatario_id=auth.uid() and privado.usuario_activo() and exists(select 1 from public.registros_iniciales r where r.id=registro_id));
-- No cambiar responsables de negociaciones existentes ni emitir avisos retroactivos.
insert into public.atencion_prospectos(registro_id)
select r.id from public.registros_iniciales r where r.eliminado_en is null and r.lote_demostracion is null and r.importacion_historica is null
and not exists(select 1 from public.prospectos p join public.oportunidades o on o.prospecto_id=p.id where p.registro_id=r.id and not o.preparacion_compartida and o.estado<>'anulada');
create function privado.alta_atencion_prospecto_039() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.lote_demostracion is not null or new.importacion_historica is not null then return new; end if;
 insert into public.atencion_prospectos(registro_id) values(new.id);
 if exists(select 1 from public.perfiles where id=new.creado_por and rol='agente') then
  insert into public.avisos_prospectos(registro_id,destinatario_id,mensaje)
  select new.id,p.id,'Nuevo prospecto disponible: '||new.nombre from public.perfiles p where p.activo and p.rol='vendedor';
 end if;
 return new;
end $$;
create trigger alta_atencion_prospecto_039 after insert on public.registros_iniciales for each row execute function privado.alta_atencion_prospecto_039();
revoke all on function privado.alta_atencion_prospecto_039() from public,anon,authenticated;
create function public.atencion_prospecto_039(p_registro uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('registro_id',a.registro_id,'vendedor_id',a.vendedor_id,'vendedor_nombre',p.nombre,'tomado_en',a.tomado_en,'version',a.version)
 from public.atencion_prospectos a join public.registros_iniciales r on r.id=a.registro_id left join public.perfiles p on p.id=a.vendedor_id
 where a.registro_id=p_registro and privado.usuario_activo() and r.eliminado_en is null;
$$;
create function public.tomar_prospecto_039(p_registro uuid,p_version integer,p_liberar boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.atencion_prospectos; actor public.perfiles; destino uuid;
begin
 perform pg_advisory_xact_lock(740127);
 select * into actor from public.perfiles where id=auth.uid() and activo;
 if not found or actor.rol not in ('vendedor','administrador') then raise exception 'COMERCIAL_ACCESO'; end if;
 perform 1 from public.registros_iniciales where id=p_registro and eliminado_en is null for update;
 if not found then raise exception 'PROSPECTO_NO_DISPONIBLE'; end if;
 select * into a from public.atencion_prospectos where registro_id=p_registro for update;
 if not found then raise exception 'PROSPECTO_NO_DISPONIBLE'; end if;
 if p_liberar then
  if a.vendedor_id is null then return public.atencion_prospecto_039(p_registro); end if;
  if actor.rol<>'administrador' and a.vendedor_id<>actor.id then raise exception 'PROSPECTO_OCUPADO'; end if;
  if exists(select 1 from public.prospectos p join public.oportunidades o on o.prospecto_id=p.id where p.registro_id=p_registro and not o.preparacion_compartida and o.estado not in ('anulada','ganada','perdida')) then raise exception 'PROSPECTO_SEGUIMIENTO'; end if;
  destino:=null;
 else
  if actor.rol<>'vendedor' then raise exception 'COMERCIAL_VENDEDOR'; end if;
  if a.vendedor_id=actor.id then return public.atencion_prospecto_039(p_registro); end if;
  if a.vendedor_id is not null then raise exception 'PROSPECTO_OCUPADO'; end if;
  destino:=actor.id;
 end if;
 if p_version is null or a.version<>p_version then raise exception 'COMERCIAL_CONFLICTO'; end if;
 update public.atencion_prospectos set vendedor_id=destino,tomado_en=case when destino is null then null else now() end,version=version+1 where registro_id=p_registro;
 insert into public.eventos_atencion_prospectos(registro_id,actor_id,vendedor_anterior,vendedor_nuevo) values(p_registro,actor.id,a.vendedor_id,destino);
 if destino is not null then update public.avisos_prospectos set leida_en=coalesce(leida_en,now()) where registro_id=p_registro; end if;
 return public.atencion_prospecto_039(p_registro);
end $$;
-- También protege clientes anteriores y enlaces directos: tomar e iniciar son atómicos.
create function privado.exigir_atencion_039(p_registro uuid,p_vendedor uuid default null) returns void language plpgsql security definer set search_path='' as $$
declare a public.atencion_prospectos; rol_actor text;
begin
 select rol into rol_actor from public.perfiles where id=auth.uid() and activo;
 select * into a from public.atencion_prospectos where registro_id=p_registro for update;
 if not found then return; end if;
 if a.vendedor_id is null then
  if rol_actor='vendedor' then perform public.tomar_prospecto_039(p_registro,a.version,false);
  else raise exception 'PROSPECTO_TOMAR'; end if;
 elsif (rol_actor<>'administrador' and a.vendedor_id<>auth.uid()) or (p_vendedor is not null and a.vendedor_id<>p_vendedor) then
  raise exception 'PROSPECTO_OCUPADO';
 end if;
end $$;
revoke all on function privado.exigir_atencion_039(uuid,uuid) from public,anon,authenticated;
do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('public.iniciar_cotizacion(uuid,integer,uuid,jsonb)'::regprocedure);
 old:='select * into registro from public.registros_iniciales where id=(p_datos->>''registro_id'')::uuid for update;';
 if strpos(d,old)=0 then raise exception 'MIGRACION_039_INICIO'; end if;
 execute replace(d,old,old||' if registro.eliminado_en is null then perform privado.exigir_atencion_039(registro.id); end if;');
 d:=pg_get_functiondef('public.guardar_propuesta(uuid,uuid,integer,integer,integer,jsonb)'::regprocedure);
 old:='if o.preparacion_compartida and o.estado=''cotizacion'' then';
 if strpos(d,old)=0 then raise exception 'MIGRACION_039_PROPUESTA'; end if;
 execute replace(d,old,old||' perform privado.exigir_atencion_039((select registro_id from public.prospectos where id=o.prospecto_id),case when actor.rol=''administrador'' then nullif(p_datos->>''responsable_seguimiento_id'','''')::uuid else actor.id end);');
end $migration$;
create function public.leer_aviso_prospecto_039(p_id bigint) returns void language sql security definer set search_path='' as $$
 update public.avisos_prospectos set leida_en=coalesce(leida_en,now()) where id=p_id and destinatario_id=auth.uid() and privado.usuario_activo();
$$;
create function public.listar_contactos_039(p_busqueda text default '',p_pagina integer default 0,p_atencion text default '') returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare salida jsonb;
begin
 if not privado.usuario_activo() then raise exception 'COMERCIAL_ACCESO'; end if;
 if p_pagina is null or p_pagina<0 or p_pagina>1000000 or p_atencion not in ('','disponibles','mios','tomados') then raise exception 'COMERCIAL_DATOS'; end if;
 with contactos as materialized (
 select r.id,r.nombre,r.telefono,r.ubicacion,r.creado_en,public.atencion_prospecto_039(r.id) atencion
 from public.registros_iniciales r left join public.atencion_prospectos a on a.registro_id=r.id
 where r.lote_demostracion is null and (coalesce(p_busqueda,'')='' or position(lower(trim(p_busqueda)) in lower(r.nombre))>0)
 and (p_atencion='' or (p_atencion='disponibles' and a.registro_id is not null and a.vendedor_id is null)
 or (p_atencion='mios' and a.vendedor_id=auth.uid()) or (p_atencion='tomados' and a.vendedor_id is not null))
 ), pagina as (select * from contactos order by creado_en desc,id limit 20 offset p_pagina*20), filas as (
 select p.*,public.negociaciones_contacto_032(p.id) casos from pagina p
 ) select jsonb_build_object('total',(select count(*) from contactos),'filas',coalesce((select jsonb_agg(to_jsonb(f) order by creado_en desc,id) from filas f),'[]')) into salida;
 return salida;
end $$;
revoke all on function public.atencion_prospecto_039(uuid),public.tomar_prospecto_039(uuid,integer,boolean),public.leer_aviso_prospecto_039(bigint),public.listar_contactos_039(text,integer,text) from public,anon;
grant execute on function public.atencion_prospecto_039(uuid),public.tomar_prospecto_039(uuid,integer,boolean),public.leer_aviso_prospecto_039(bigint),public.listar_contactos_039(text,integer,text) to authenticated;
-- Una reasignación comercial administrativa mantiene coherente la atención del contacto.
create function privado.sincronizar_atencion_039() returns trigger language plpgsql security definer set search_path='' as $$
declare registro uuid; a public.atencion_prospectos;
begin
 if new.preparacion_compartida or new.responsable_id is null or new.estado in ('anulada','ganada','perdida') or not exists(select 1 from public.perfiles where id=new.responsable_id and rol='vendedor') then return new; end if;
 select registro_id into registro from public.prospectos where id=new.prospecto_id;
 select * into a from public.atencion_prospectos where registro_id=registro for update;
 if not found or a.vendedor_id=new.responsable_id then return new; end if;
 if exists(select 1 from public.oportunidades o where o.prospecto_id=new.prospecto_id and o.id<>new.id and not o.preparacion_compartida and o.estado not in ('anulada','ganada','perdida') and o.responsable_id is distinct from new.responsable_id) then raise exception 'PROSPECTO_SEGUIMIENTO'; end if;
 update public.atencion_prospectos set vendedor_id=new.responsable_id,tomado_en=now(),version=version+1 where registro_id=registro;
 insert into public.eventos_atencion_prospectos(registro_id,actor_id,vendedor_anterior,vendedor_nuevo) values(registro,auth.uid(),a.vendedor_id,new.responsable_id);
 return new;
end $$;
create trigger sincronizar_atencion_039 after update of responsable_id,preparacion_compartida on public.oportunidades for each row execute function privado.sincronizar_atencion_039();
revoke all on function privado.sincronizar_atencion_039() from public,anon,authenticated;
commit;
