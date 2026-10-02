begin;
create table public.activaciones_ventas (
 oportunidad_id uuid primary key references public.oportunidades(id),
 ciclo integer not null,
 fecha date not null,
 respaldo text not null check(char_length(trim(respaldo)) between 5 and 2000),
 version integer not null check(version>0),
 actor_id uuid not null references public.perfiles(id),
 actualizado_en timestamptz not null default now()
);
create table public.eventos_activacion (
 id uuid primary key,
 oportunidad_id uuid not null references public.oportunidades(id),
 actor_id uuid not null references public.perfiles(id),
 solicitud jsonb not null,anterior jsonb,nuevo jsonb not null,
 ocurrido_en timestamptz not null default now()
);
alter table public.activaciones_ventas enable row level security;
alter table public.eventos_activacion enable row level security;
revoke all on public.activaciones_ventas,public.eventos_activacion from public,anon,authenticated;
-- Lectura exclusivamente por RPC: mismo alcance que Ventas, no participación amplia.

create function privado.fin_congelamiento(p_fecha date,p_meses integer) returns date
language plpgsql immutable set search_path='' as $$
declare destino date; ultimo date;
begin
 if p_fecha is null or p_meses is null or p_meses=0 then return null; end if;
 if p_meses<0 or p_meses>99 then raise exception 'ACTIVACION_PLAZO'; end if;
 destino:=(date_trunc('month',p_fecha)+make_interval(months=>p_meses))::date;
 ultimo:=(destino+interval '1 month'-interval '1 day')::date;
 if extract(day from p_fecha)>extract(day from ultimo) then return ultimo; end if;
 return destino+(extract(day from p_fecha)::integer-1)-1;
end $$;
revoke all on function privado.fin_congelamiento(date,integer) from public,anon,authenticated;

create function public.guardar_activacion(p_id uuid,p_version integer,p_operacion uuid,p_fecha date,p_respaldo text) returns uuid
language plpgsql security definer set search_path='' as $$
declare o public.oportunidades; anterior public.activaciones_ventas; nueva public.activaciones_ventas;
 evento public.eventos_activacion; solicitud jsonb:=jsonb_build_object('id',p_id,'version',p_version,'fecha',p_fecha,'respaldo',p_respaldo);
begin
 perform pg_advisory_xact_lock(740127);
 if not privado.es_administrador() then raise exception 'ACTIVACION_ACCESO'; end if;
 if p_id is null or p_operacion is null or p_version is null or p_version<0 or p_fecha is null or not isfinite(p_fecha)
  or char_length(trim(coalesce(p_respaldo,''))) not between 5 and 2000 then raise exception 'ACTIVACION_DATOS'; end if;
 select * into evento from public.eventos_activacion where id=p_operacion;
 if found then
  if evento.actor_id=auth.uid() and evento.solicitud=solicitud then return p_id; end if;
  raise exception 'ACTIVACION_CONFLICTO';
 end if;
 select * into o from public.oportunidades where id=p_id for update;
 if o.id is null or o.estado<>'ganada' then raise exception 'ACTIVACION_VENTA'; end if;
 if p_fecha>(now() at time zone 'America/Argentina/Cordoba')::date or
  (o.confirmado_en is not null and p_fecha<(o.confirmado_en at time zone 'America/Argentina/Cordoba')::date) then raise exception 'ACTIVACION_FECHA'; end if;
 select * into anterior from public.activaciones_ventas where oportunidad_id=p_id;
 if coalesce(anterior.version,0)<>p_version then raise exception 'ACTIVACION_CONFLICTO'; end if;
 insert into public.activaciones_ventas values(p_id,o.ciclo,p_fecha,trim(p_respaldo),p_version+1,auth.uid(),now())
 on conflict(oportunidad_id) do update set fecha=excluded.fecha,respaldo=excluded.respaldo,version=excluded.version,actor_id=excluded.actor_id,actualizado_en=excluded.actualizado_en
 returning * into nueva;
 insert into public.eventos_activacion values(p_operacion,p_id,auth.uid(),solicitud,case when anterior.oportunidad_id is null then null else to_jsonb(anterior) end,to_jsonb(nueva),now());
 return p_id;
end $$;
revoke all on function public.guardar_activacion(uuid,integer,uuid,date,text) from public,anon;
grant execute on function public.guardar_activacion(uuid,integer,uuid,date,text) to authenticated;

create function public.detalle_venta(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o public.oportunidades; propuesta jsonb; activacion public.activaciones_ventas; plazos jsonb;
begin
 select * into o from public.oportunidades where id=p_id and estado='ganada';
 if o.id is null or not exists(select 1 from public.perfiles where id=auth.uid() and activo and (rol='administrador' or id=o.cerrado_por)) then raise exception 'VENTAS_ACCESO'; end if;
 select p.detalle into propuesta from public.ciclos_comerciales c join public.propuestas_comerciales p on p.id=c.propuesta_aceptada_id where c.oportunidad_id=o.id and c.ciclo=o.ciclo;
 select * into activacion from public.activaciones_ventas where oportunidad_id=o.id;
 select coalesce(jsonb_agg(jsonb_build_object('concepto',x->>'familia','meses',x->>'meses_congelamiento',
 'hasta_inclusive',privado.fin_congelamiento(activacion.fecha,(x->>'meses_congelamiento')::integer))), '[]') into plazos
 from jsonb_array_elements(propuesta->'conceptos') x where x->>'abono' is not null;
 return jsonb_build_object('oportunidad_id',o.id,'ciclo',o.ciclo,'propuesta',propuesta,
 'activacion',case when activacion.oportunidad_id is null then null else to_jsonb(activacion) end,
 'congelamientos',plazos,'historial',coalesce((select jsonb_agg(to_jsonb(e) order by e.ocurrido_en desc) from public.eventos_activacion e where oportunidad_id=o.id),'[]'));
end $$;
revoke all on function public.detalle_venta(uuid) from public,anon;
grant execute on function public.detalle_venta(uuid) to authenticated;
commit;
