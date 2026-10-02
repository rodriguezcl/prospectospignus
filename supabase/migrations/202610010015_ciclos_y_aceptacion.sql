begin;

-- Proyección transaccional de eventos nuevos; no reconstruye el histórico.
create table public.ciclos_comerciales (
 oportunidad_id uuid not null references public.oportunidades(id),
 ciclo integer not null check(ciclo>0),
 origen text check(origen in ('propio','asignado_agente')),
 coordinador_id uuid references public.perfiles(id),
 cierre_evento_id uuid references public.eventos_oportunidades(id),
 propuesta_aceptada_id uuid references public.propuestas_comerciales(id),
 primary key(oportunidad_id,ciclo)
);
alter table public.ciclos_comerciales enable row level security;
revoke all on public.ciclos_comerciales from public,anon,authenticated;
grant select on public.ciclos_comerciales to authenticated;
create policy ciclos_lectura on public.ciclos_comerciales for select to authenticated using(privado.puede_ver_oportunidad(oportunidad_id));

create function privado.proyectar_ciclo() returns trigger language plpgsql security definer set search_path='' as $$
declare n integer:=coalesce((new.nuevo->>'ciclo')::integer,1); origen text; coordinador uuid;
begin
 if new.tipo in ('crear','reactivar') then
  origen:=nullif(new.solicitud->'datos'->>'origen_comercial','');
  if origen='asignado_agente' and exists(select 1 from public.perfiles where id=new.actor_id and rol='agente') then coordinador:=new.actor_id; end if;
 end if;
 insert into public.ciclos_comerciales(oportunidad_id,ciclo,origen,coordinador_id)
 values(new.oportunidad_id,n,origen,coordinador) on conflict do nothing;
 if new.tipo in ('ganar','perder') then
  update public.ciclos_comerciales set cierre_evento_id=new.id,
   propuesta_aceptada_id=case when new.tipo='ganar' then nullif(new.solicitud->'datos'->>'propuesta_id','')::uuid else null end
  where oportunidad_id=new.oportunidad_id and ciclo=n;
 elsif new.tipo='corregir_perdida' then
  update public.ciclos_comerciales set cierre_evento_id=null,propuesta_aceptada_id=null where oportunidad_id=new.oportunidad_id and ciclo=n;
 end if;
 return new;
end $$;
revoke all on function privado.proyectar_ciclo() from public,anon,authenticated;
create trigger proyectar_ciclo after insert on public.eventos_oportunidades for each row execute function privado.proyectar_ciclo();

alter table public.actividades_agenda add column ciclo_comercial integer check(ciclo_comercial>0);
create function privado.vincular_ciclo_agenda() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.oportunidad_id is not null then
  select ciclo into new.ciclo_comercial from public.oportunidades where id=new.oportunidad_id;
 end if;
 return new;
end $$;
revoke all on function privado.vincular_ciclo_agenda() from public,anon,authenticated;
create trigger vincular_ciclo_agenda before insert on public.actividades_agenda for each row execute function privado.vincular_ciclo_agenda();

-- Mantiene el contrato RPC y las validaciones previas. La versión base deja
-- de ser invocable desde clientes para evitar eludir estas nuevas guardas.
alter function public.gestionar_oportunidad(uuid,integer,uuid,text,jsonb) rename to gestionar_oportunidad_base_v14;
revoke all on function public.gestionar_oportunidad_base_v14(uuid,integer,uuid,text,jsonb) from public,anon,authenticated;
create function public.gestionar_oportunidad(p_id uuid,p_version integer,p_operacion uuid,p_accion text,p_datos jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare o public.oportunidades; propuesta public.propuestas_comerciales; actor public.perfiles; configuracion jsonb;
begin
 perform pg_advisory_xact_lock(740127);
 select * into actor from public.perfiles where id=auth.uid() and activo;
 if not found then raise exception 'COMERCIAL_ACCESO'; end if;
 if exists(select 1 from public.eventos_oportunidades where id=p_operacion) then
  return public.gestionar_oportunidad_base_v14(p_id,p_version,p_operacion,p_accion,p_datos);
 end if;
 if p_accion='crear' and nullif(p_datos->>'origen_comercial','') is not null then
  if p_datos->>'origen_comercial' not in ('propio','asignado_agente')
   or (actor.rol='vendedor' and p_datos->>'origen_comercial'<>'propio')
   or (actor.rol='agente' and p_datos->>'origen_comercial'<>'asignado_agente') then raise exception 'COMERCIAL_ORIGEN'; end if;
 end if;
 if p_accion in ('ganar','derivar') then
  select * into o from public.oportunidades where id=p_id for update;
  if o.id is null or (actor.rol<>'administrador' and o.responsable_id is distinct from actor.id) then raise exception 'COMERCIAL_ACCESO'; end if;
  if o.version<>p_version then raise exception 'COMERCIAL_CONFLICTO'; end if;
  -- Una vez publicado un catálogo, cierre y derivación requieren propuesta.
  -- Los cierres previos o realizados sin catálogo conservan importes desconocidos.
  if exists(select 1 from public.versiones_catalogo) or exists(select 1 from public.propuestas_comerciales where oportunidad_id=o.id and ciclo=o.ciclo) then
   select * into propuesta from public.propuestas_comerciales where id=nullif(p_datos->>'propuesta_id','')::uuid and oportunidad_id=o.id and ciclo=o.ciclo;
   if propuesta.id is null then raise exception 'COMERCIAL_PROPUESTA'; end if;
   if propuesta.restringida and not(actor.rol='administrador' or (actor.rol='agente' and o.estado='recuperacion')) then raise exception 'COMERCIAL_ACCESO'; end if;
   configuracion:=public.leer_condiciones();
   if propuesta.catalogo_version<>(select max(version) from public.versiones_catalogo) or propuesta.condiciones_version<>(configuracion->>'version')::integer then raise exception 'PROPUESTA_VIGENCIA'; end if;
  elsif nullif(p_datos->>'propuesta_id','') is not null then raise exception 'COMERCIAL_PROPUESTA'; end if;
  if p_accion='derivar' and exists(select 1 from public.versiones_catalogo) and char_length(trim(coalesce(p_datos->>'objecion',''))) not between 5 and 2000 then raise exception 'COMERCIAL_OBJECION'; end if;
 end if;
 return public.gestionar_oportunidad_base_v14(p_id,p_version,p_operacion,p_accion,p_datos);
end $$;
revoke all on function public.gestionar_oportunidad(uuid,integer,uuid,text,jsonb) from public,anon;
grant execute on function public.gestionar_oportunidad(uuid,integer,uuid,text,jsonb) to authenticated;

alter function public.reactivar_oportunidad(uuid,integer,uuid,jsonb) rename to reactivar_oportunidad_base_v14;
revoke all on function public.reactivar_oportunidad_base_v14(uuid,integer,uuid,jsonb) from public,anon,authenticated;
create function public.reactivar_oportunidad(p_id uuid,p_version integer,p_operacion uuid,p_datos jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(740127);
 if not privado.usuario_activo() then raise exception 'COMERCIAL_ACCESO'; end if;
 if exists(select 1 from public.eventos_oportunidades where id=p_operacion) then
  return public.reactivar_oportunidad_base_v14(p_id,p_version,p_operacion,p_datos);
 end if;
 if p_datos->>'negociacion_confirmada' is distinct from 'si' then raise exception 'COMERCIAL_NEGOCIACION'; end if;
 if nullif(p_datos->>'origen_comercial','') is not null and p_datos->>'origen_comercial' not in ('propio','asignado_agente') then raise exception 'COMERCIAL_ORIGEN'; end if;
 return public.reactivar_oportunidad_base_v14(p_id,p_version,p_operacion,p_datos);
end $$;
revoke all on function public.reactivar_oportunidad(uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.reactivar_oportunidad(uuid,integer,uuid,jsonb) to authenticated;

create function public.corregir_perdida(p_id uuid,p_version integer,p_operacion uuid,p_datos jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare anterior public.oportunidades; nueva public.oportunidades; evento public.eventos_oportunidades;
 solicitud jsonb:=jsonb_build_object('id',p_id,'version',p_version,'accion','corregir_perdida','datos',p_datos); destino text; plazo timestamptz;
begin
 perform pg_advisory_xact_lock(740127);
 if not privado.es_administrador() then raise exception 'COMERCIAL_ACCESO'; end if;
 if p_operacion is null or char_length(trim(coalesce(p_datos->>'resumen',''))) not between 5 and 2000 then raise exception 'COMERCIAL_DATOS'; end if;
 select * into evento from public.eventos_oportunidades where id=p_operacion;
 if found then
  if evento.actor_id=auth.uid() and evento.solicitud=solicitud then return p_id; end if;
  raise exception 'COMERCIAL_CONFLICTO';
 end if;
 select * into anterior from public.oportunidades where id=p_id for update;
 if anterior.id is null or anterior.estado<>'perdida' then raise exception 'COMERCIAL_TRANSICION'; end if;
 if anterior.version is distinct from p_version then raise exception 'COMERCIAL_CONFLICTO'; end if;
 select case when rol='agente' then 'recuperacion' else 'seguimiento' end into destino from public.perfiles where id=anterior.responsable_id and activo and rol in ('agente','vendedor');
 if destino is null then raise exception 'COMERCIAL_DESTINO'; end if;
 plazo:=(p_datos->>'plazo')::timestamptz;
 if plazo is null or plazo<=now() then raise exception 'COMERCIAL_PLAZO'; end if;
 update public.oportunidades set estado=destino,version=version+1,actualizado_en=now(),resumen=trim(p_datos->>'resumen'),proxima_accion_en=plazo,
 cerrado_por=null,cerrado_en=null,motivo_perdida=null,canal_confirmacion=null,confirmado_en=null where id=p_id returning * into nueva;
 insert into public.eventos_oportunidades values(p_operacion,p_id,auth.uid(),'corregir_perdida',solicitud,to_jsonb(anterior),to_jsonb(nueva),now());
 insert into public.notificaciones(destinatario_id,oportunidad_id,evento_id,mensaje) values(nueva.responsable_id,p_id,p_operacion,'Administración corrigió una pérdida: retomar seguimiento');
 return p_id;
end $$;
revoke all on function public.corregir_perdida(uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.corregir_perdida(uuid,integer,uuid,jsonb) to authenticated;
commit;
