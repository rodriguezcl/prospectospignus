begin;
-- Procedencia inmutable para importaciones retrospectivas, sin fingir captación en vivo.
alter table public.registros_iniciales add column importacion_historica jsonb;
create unique index registros_clave_importacion on public.registros_iniciales
 ((importacion_historica->>'lote'),(importacion_historica->>'fila'))
 where importacion_historica is not null;
alter table public.prospectos add column historico boolean not null default false;
alter table public.prospectos alter column contacto_efectivo drop not null;
alter table public.prospectos alter column calificado_por drop not null;
alter table public.prospectos alter column captado_por drop not null;
alter table public.prospectos add constraint prospectos_calificacion_actual
 check(historico or (contacto_efectivo is not null and calificado_por is not null and captado_por is not null));
alter table public.oportunidades add column periodo_historico date;
alter table public.oportunidades add column responsable_historico_id uuid references public.perfiles(id);
alter table public.oportunidades alter column visita_en drop not null;
alter table public.oportunidades alter column vendedor_visita_id drop not null;
alter table public.oportunidades add constraint oportunidades_visita_actual
 check(periodo_historico is not null or (visita_en is not null and vendedor_visita_id is not null));

create or replace function privado.puede_ver_oportunidad(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.oportunidades o join public.perfiles p on p.id=auth.uid()
 where o.id=p_id and p.activo and (p.rol='administrador' or o.responsable_id=p.id
 or o.vendedor_visita_id=p.id or o.responsable_historico_id=p.id or o.creado_por=p.id
 or (p.rol='agente' and o.estado='recuperacion')));
$$;

insert into public.origenes_registros(codigo,nombre,activo)
 values('importacion_excel','Importación Excel (origen comercial no informado)',true);

-- No contar la importación masiva como captación comercial del día en que se ejecutó.
create or replace function public.listar_resumen_mensual(p_mes date)
returns table(id uuid,nombre text,origen text,creado_por uuid,responsable_id uuid,dia date,lote_demostracion text)
language plpgsql stable security invoker set search_path='' as $$
begin
 if p_mes is null or extract(day from p_mes)<>1 then raise exception 'Indicá el primer día del mes' using errcode='22023'; end if;
 return query select r.id,r.nombre,r.origen,r.creado_por,r.responsable_id,
 (r.creado_en at time zone 'America/Argentina/Cordoba')::date,r.lote_demostracion
 from public.registros_iniciales r where r.importacion_historica is null
 and r.creado_en >= (p_mes::timestamp at time zone 'America/Argentina/Cordoba')
 and r.creado_en < ((p_mes+interval '1 month') at time zone 'America/Argentina/Cordoba')
 order by r.creado_en,r.id;
end $$;

-- El cierre inicial vive en el evento de importación; reactivar no reescribe septiembre.
-- SECURITY INVOKER aplica la misma cartera que el detalle y no expone teléfonos.
create function public.listar_historico_mensual(p_mes date)
returns table(id uuid,nombre text,responsable_id uuid,responsable_nombre text,resultado text,estado_actual text)
language sql stable security invoker set search_path='' as $$
 select o.id,p.nombre,(e.nuevo->>'cerrado_por')::uuid,
   e.solicitud->>'responsable_nombre',e.nuevo->>'estado',o.estado
 from public.oportunidades o join public.prospectos p on p.id=o.prospecto_id
 join public.eventos_oportunidades e on e.oportunidad_id=o.id and e.tipo='importacion_historica'
 where o.periodo_historico=p_mes order by o.id;
$$;
revoke all on function public.listar_historico_mensual(date) from public,anon;
grant execute on function public.listar_historico_mensual(date) to authenticated;
commit;
