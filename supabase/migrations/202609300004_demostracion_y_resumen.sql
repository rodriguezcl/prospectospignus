begin;
-- Solo el operador de base puede marcar un lote. Las RPC de edición no aceptan este campo.
alter table public.registros_iniciales add column lote_demostracion text;
alter table public.perfiles add column lote_demostracion text;

-- SECURITY INVOKER: agregación y detalle parten de las mismas filas permitidas por RLS.
create function public.listar_resumen_mensual(p_mes date)
returns table(id uuid,nombre text,origen text,creado_por uuid,responsable_id uuid,
 dia date,lote_demostracion text)
language plpgsql stable security invoker set search_path = '' as $$
begin
 if p_mes is null or extract(day from p_mes) <> 1 then
   raise exception 'Indicá el primer día del mes' using errcode='22023';
 end if;
 return query select r.id,r.nombre,r.origen,r.creado_por,r.responsable_id,
   (r.creado_en at time zone 'America/Argentina/Cordoba')::date,r.lote_demostracion
 from public.registros_iniciales r
 where r.creado_en >= (p_mes::timestamp at time zone 'America/Argentina/Cordoba')
   and r.creado_en < ((p_mes + interval '1 month') at time zone 'America/Argentina/Cordoba')
 order by r.creado_en,r.id;
end;
$$;
revoke all on function public.listar_resumen_mensual(date) from public,anon;
grant execute on function public.listar_resumen_mensual(date) to authenticated;
commit;
