begin;

-- Orden global antes de paginar; se conservan permisos, filtros y contratos.
create or replace function public.listar_ventas_concretadas(
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
    select * from filtradas order by nombre,id
    limit 20 offset p_pagina*20
  )
  select jsonb_build_object(
    'total',(select count(*) from filtradas),
    'filas',coalesce((select jsonb_agg(to_jsonb(p) order by p.nombre,p.id) from pagina p),'[]'::jsonb),
    'responsables',coalesce((select jsonb_agg(to_jsonb(r) order by r.nombre,r.id) from
      (select distinct cerrado_por as id,responsable_nombre as nombre from accesibles where cerrado_por is not null) r),'[]'::jsonb)
  ) into resultado;
  return resultado;
end $$;

create or replace function public.listar_contactos_cotizaciones(p_busqueda text default '',p_pagina integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare salida jsonb;
begin
 if not privado.usuario_activo() then raise exception 'COMERCIAL_ACCESO'; end if;
 if p_pagina is null or p_pagina<0 or p_pagina>1000000 then raise exception 'COMERCIAL_DATOS'; end if;
 with contactos as materialized (
  select r.id,r.nombre,r.telefono,r.ubicacion,r.responsable_id,r.creado_en
  from public.registros_iniciales r where r.lote_demostracion is null
   and (coalesce(p_busqueda,'')='' or position(lower(trim(p_busqueda)) in lower(r.nombre))>0)
 ), pagina as (select * from contactos order by nombre,id limit 20 offset p_pagina*20), filas as (
  select p.*,coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'necesidad',o.necesidad,'estado',o.estado,
    'responsable_id',o.responsable_id) order by o.necesidad,o.id)
   from public.oportunidades o join public.prospectos n on n.id=o.prospecto_id
   where n.registro_id=p.id and o.estado<>'anulada'),'[]'::jsonb) casos from pagina p
 ) select jsonb_build_object('total',(select count(*) from contactos),'filas',coalesce((select jsonb_agg(to_jsonb(f) order by nombre,id) from filas f),'[]')) into salida;
 return salida;
end $$;

create or replace function public.detalle_rendimiento(p_mes date,p_responsable uuid,p_tipo text,p_origen text default null,p_pagina integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare salida jsonb;
begin
 if not privado.usuario_activo() or (not privado.es_administrador() and p_responsable is distinct from auth.uid()) then raise exception 'INFORMES_ACCESO'; end if;
 if p_mes is null or not isfinite(p_mes) or extract(day from p_mes)<>1 or p_responsable is null or p_tipo not in ('ventas','visitas') or p_tipo is null
  or p_pagina is null or p_pagina<0 or p_pagina>1000000 or (p_origen is not null and p_origen not in ('propio','asignado_agente','sin_identificar')) then raise exception 'INFORMES_FILTROS'; end if;
 with datos as (
  select id,ciclo,nombre,necesidad,origen,inicial::text importe,'ganar'::text resultado from privado.ventas_medibles
   where p_tipo='ventas' and mes=p_mes and responsable_id=p_responsable and (p_origen is null or origen=p_origen)
  union all
  select oportunidad_id,ciclo,nombre,necesidad,origen,null,resultado from privado.visitas_medibles
   where p_tipo='visitas' and mes=p_mes and vendedor_id=p_responsable and (p_origen is null or origen=p_origen)
 ), pagina as (select * from datos order by nombre,id,ciclo limit 20 offset p_pagina*20)
 select jsonb_build_object('total',(select count(*) from datos),'filas',coalesce((select jsonb_agg(to_jsonb(p) order by p.nombre,p.id,p.ciclo) from pagina p),'[]')) into salida;
 return salida;
end $$;

commit;
