begin;

-- Proyección de cierres, no un segundo almacenamiento de ventas.
-- La consulta general conserva permisos de participación; esta consulta atribuye
-- exclusivamente al responsable al cierre, nunca al actor que pulsó Guardar.
create function public.listar_ventas_concretadas(
  p_mes date default null, p_responsable uuid default null, p_pagina integer default 0
) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare resultado jsonb;
begin
  if not exists(select 1 from public.perfiles where id=auth.uid() and activo) then
    raise exception 'VENTAS_ACCESO' using errcode='42501';
  end if;
  if p_pagina is null or p_pagina<0 or p_pagina>1000000
    or (p_mes is not null and extract(day from p_mes)<>1) then
    raise exception 'VENTAS_FILTROS' using errcode='22023';
  end if;
  with accesibles as materialized (
    select o.id, p.nombre, o.necesidad, o.cerrado_por,
      cierre.nombre as responsable_nombre, visita.nombre as vendedor_visita_nombre,
      o.cerrado_en, o.confirmado_en, o.condiciones, o.canal_confirmacion,
      coalesce(date_trunc('month',o.cerrado_en at time zone 'America/Argentina/Cordoba')::date,
        o.periodo_historico) as mes_cierre
    from public.oportunidades o
    join public.prospectos p on p.id=o.prospecto_id
    join public.perfiles actor on actor.id=auth.uid() and actor.activo
    left join public.perfiles cierre on cierre.id=o.cerrado_por
    left join public.perfiles visita on visita.id=o.vendedor_visita_id
    where o.estado='ganada' and (actor.rol='administrador' or o.cerrado_por=actor.id)
  ), filtradas as (
    select * from accesibles a
    where (p_mes is null or a.mes_cierre=p_mes)
      and (p_responsable is null or a.cerrado_por=p_responsable)
  ), pagina as (
    select * from filtradas order by mes_cierre desc nulls last,cerrado_en desc nulls last,id
    limit 20 offset p_pagina*20
  )
  select jsonb_build_object(
    'total',(select count(*) from filtradas),
    'filas',coalesce((select jsonb_agg(to_jsonb(p) order by p.mes_cierre desc nulls last,p.cerrado_en desc nulls last,p.id) from pagina p),'[]'::jsonb),
    'responsables',coalesce((select jsonb_agg(to_jsonb(r) order by r.nombre,r.id) from
      (select distinct cerrado_por as id,responsable_nombre as nombre from accesibles where cerrado_por is not null) r),'[]'::jsonb)
  ) into resultado;
  return resultado;
end $$;
revoke all on function public.listar_ventas_concretadas(date,uuid,integer) from public,anon;
grant execute on function public.listar_ventas_concretadas(date,uuid,integer) to authenticated;
commit;
