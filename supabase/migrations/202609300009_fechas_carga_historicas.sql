begin;
-- La fecha de importación y la evidencia original no se sobrescriben.
alter table public.registros_iniciales add column fecha_carga_historica timestamptz;
alter table public.registros_iniciales add constraint fecha_historica_con_procedencia
 check(fecha_carga_historica is null or importacion_historica is not null);
create index registros_fecha_historica on public.registros_iniciales(fecha_carga_historica)
 where fecha_carga_historica is not null;

-- Solo operador de base: confirma un lote y huella revisados, con auditoría por fila.
create function privado.confirmar_fechas_lote(p_lote text,p_sha256 text,p_actor uuid,p_total integer)
returns integer language plpgsql security definer set search_path='' as $$
declare anterior public.registros_iniciales; nuevo public.registros_iniciales;
 fecha_local timestamp; fecha timestamptz; cantidad integer := 0;
begin
 perform pg_advisory_xact_lock(740127);
 if p_total is null or p_total<1 or not exists(select 1 from public.perfiles where id=p_actor and activo and rol='administrador')
 then raise exception 'FECHAS_CONTROL'; end if;
 if (select count(*) from public.registros_iniciales where importacion_historica->>'lote'=p_lote)<>p_total
 or exists(select 1 from public.registros_iniciales where importacion_historica->>'lote'=p_lote
   and importacion_historica->>'sha256' is distinct from p_sha256) then raise exception 'FECHAS_LOTE'; end if;
 for anterior in select * from public.registros_iniciales where importacion_historica->>'lote'=p_lote for update loop
   if coalesce(anterior.importacion_historica->>'fecha_estimada','') !~ '^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}$'
   then raise exception 'FECHAS_FORMATO'; end if;
   fecha_local := (anterior.importacion_historica->>'fecha_estimada')::timestamp;
   if date_trunc('month',fecha_local)::date is distinct from (anterior.importacion_historica->>'mes')::date
   then raise exception 'FECHAS_PERIODO'; end if;
   fecha := fecha_local at time zone 'America/Argentina/Cordoba';
   if anterior.fecha_carga_historica=fecha then continue; end if;
   if anterior.fecha_carga_historica is not null then raise exception 'FECHAS_CONFLICTO'; end if;
   update public.registros_iniciales set fecha_carga_historica=fecha,version=version+1,actualizado_en=now()
   where id=anterior.id returning * into nuevo;
   insert into public.eventos_registros(registro_id,actor_id,tipo,anterior,nuevo,motivo)
   values(anterior.id,p_actor,'registro_actualizado',to_jsonb(anterior),to_jsonb(nuevo),
     'Administración confirma fecha y hora del Excel como fecha real de carga. Se conserva la etiqueta original de la fuente y la fecha de importación.');
   cantidad := cantidad+1;
 end loop;
 return cantidad;
end $$;
revoke all on function privado.confirmar_fechas_lote(text,text,uuid,integer) from public,anon,authenticated;

-- Nuevo contrato: fecha completa y origen de fecha, sin cambiar la API anterior.
create function public.listar_cargas_mensuales(p_mes date)
returns table(id uuid,nombre text,origen text,creado_por uuid,responsable_id uuid,dia date,
 lote_demostracion text,fecha_carga timestamptz,tipo_carga text)
language plpgsql stable security invoker set search_path='' as $$
begin
 if p_mes is null or extract(day from p_mes)<>1 then raise exception 'Indicá el primer día del mes' using errcode='22023'; end if;
 return query
 select r.id,r.nombre,r.origen,r.creado_por,r.responsable_id,
   (coalesce(r.fecha_carga_historica,r.creado_en) at time zone 'America/Argentina/Cordoba')::date,
   r.lote_demostracion,coalesce(r.fecha_carga_historica,r.creado_en),
   case when r.fecha_carga_historica is not null then 'historica_confirmada' else 'plataforma' end
 from public.registros_iniciales r
 where (r.importacion_historica is null or r.fecha_carga_historica is not null)
 and coalesce(r.fecha_carga_historica,r.creado_en)>=(p_mes::timestamp at time zone 'America/Argentina/Cordoba')
 and coalesce(r.fecha_carga_historica,r.creado_en)<((p_mes+interval '1 month') at time zone 'America/Argentina/Cordoba')
 order by coalesce(r.fecha_carga_historica,r.creado_en),r.id;
end $$;
revoke all on function public.listar_cargas_mensuales(date) from public,anon;
grant execute on function public.listar_cargas_mensuales(date) to authenticated;
commit;
