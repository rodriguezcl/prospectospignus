begin;
create index agenda_visitas_ciclo on public.actividades_agenda(oportunidad_id,ciclo_comercial,vendedor_id,inicio_real)
 where tipo='visita' and estado='realizada' and oportunidad_id is not null and ciclo_comercial is not null;
create view privado.ventas_medibles as
 select o.id,o.ciclo,o.cerrado_por responsable_id,n.nombre,o.necesidad,
 coalesce(date_trunc('month',o.cerrado_en at time zone 'America/Argentina/Cordoba')::date,o.periodo_historico) mes,
 coalesce(c.origen,'sin_identificar') origen,p.detalle is not null importes_conocidos,
 (p.detalle->>'total')::numeric inicial,(p.detalle->>'abono')::numeric abono,
 (select sum((x->>'neto')::numeric) from jsonb_array_elements(p.detalle->'componentes_netos') x where x->>'tipo'='instalacion') instalacion,
 p.detalle
 from public.oportunidades o join public.prospectos n on n.id=o.prospecto_id
 left join public.ciclos_comerciales c on c.oportunidad_id=o.id and c.ciclo=o.ciclo
 left join public.propuestas_comerciales p on p.id=c.propuesta_aceptada_id where o.estado='ganada';

create view privado.visitas_medibles as
 with primeras as (
  select oportunidad_id,ciclo_comercial ciclo,vendedor_id,min(inicio_real) primera_visita_vendedor,
   min(min(inicio_real)) over(partition by oportunidad_id,ciclo_comercial) primera_visita_ciclo
  from public.actividades_agenda where tipo='visita' and estado='realizada' and oportunidad_id is not null and ciclo_comercial is not null
  group by oportunidad_id,ciclo_comercial,vendedor_id
 ) select a.*,o.prospecto_id,n.nombre,o.necesidad,coalesce(c.origen,'sin_identificar') origen,
 date_trunc('month',a.primera_visita_ciclo at time zone 'America/Argentina/Cordoba')::date mes,
 e.tipo resultado,(e.nuevo->>'cerrado_por')::uuid cerrado_por,
 e.tipo='ganar' and e.anterior->>'estado'='recuperacion' recuperada,
 exists(select 1 from public.eventos_oportunidades d where d.oportunidad_id=o.id and d.tipo='derivar' and (d.nuevo->>'ciclo')::integer=a.ciclo) derivada
 from primeras a join public.oportunidades o on o.id=a.oportunidad_id join public.prospectos n on n.id=o.prospecto_id
 left join public.ciclos_comerciales c on c.oportunidad_id=o.id and c.ciclo=a.ciclo
 left join public.eventos_oportunidades e on e.id=c.cierre_evento_id;
revoke all on privado.ventas_medibles,privado.visitas_medibles from public,anon,authenticated;

create function public.resumen_rendimiento(p_mes date,p_origen text default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare salida jsonb; admin boolean:=privado.es_administrador();
begin
 if not privado.usuario_activo() then raise exception 'INFORMES_ACCESO'; end if;
 if p_mes is null or not isfinite(p_mes) or extract(day from p_mes)<>1 or (p_origen is not null and p_origen not in ('propio','asignado_agente','sin_identificar')) then raise exception 'INFORMES_FILTROS'; end if;
 with ventas as materialized (
  select * from privado.ventas_medibles where mes=p_mes and (admin or responsable_id=auth.uid()) and (p_origen is null or origen=p_origen)
 ), visitas as materialized (
  select * from privado.visitas_medibles where mes=p_mes and (admin or vendedor_id=auth.uid()) and (p_origen is null or origen=p_origen)
 ), personas as (
  select id,nombre,rol from public.perfiles where (admin or id=auth.uid()) and
   ((activo and rol in ('vendedor','agente')) or id in(select responsable_id from ventas) or id in(select vendedor_id from visitas))
 ), filas as (
  select p.*,v.ventas,v.con_importe,v.sin_importe,v.desconocidas,v.volumen_inicial::text,v.ticket_inicial::text,
   v.ticket_instalacion::text,v.abono_total::text,v.ticket_abono::text,v.con_instalacion,v.con_abono,
   a.visitados,a.directos,a.recuperados,a.derivados,a.pendientes,a.propios,a.asignados,a.sin_identificar,
   round(a.directos*100.0/nullif(a.visitados,0),2)::text conversion
  from personas p cross join lateral (
   select count(*) ventas,count(*) filter(where inicial>0) con_importe,count(*) filter(where inicial=0) sin_importe,
    count(*) filter(where not importes_conocidos) desconocidas,
    sum(inicial) volumen_inicial,round(avg(inicial) filter(where inicial>0),2) ticket_inicial,
    round(avg(instalacion) filter(where instalacion>0),2) ticket_instalacion,
    sum(abono) abono_total,round(avg(abono) filter(where abono>0),2) ticket_abono,
    count(*) filter(where instalacion>0) con_instalacion,count(*) filter(where abono>0) con_abono
   from ventas where responsable_id=p.id
  ) v cross join lateral (
   select count(*) visitados,count(*) filter(where resultado='ganar' and cerrado_por=p.id) directos,
    count(*) filter(where recuperada and cerrado_por<>p.id) recuperados,count(*) filter(where derivada) derivados,
    count(*) filter(where resultado is null) pendientes,
    count(*) filter(where origen='propio') propios,count(*) filter(where origen='asignado_agente') asignados,
    count(*) filter(where origen='sin_identificar') sin_identificar from visitas where vendedor_id=p.id
  ) a
 ), categorias as (
  select x->>'servicio' servicio,count(distinct v.id) ventas from ventas v cross join lateral jsonb_array_elements(v.detalle->'conceptos') x group by x->>'servicio'
 ) select jsonb_build_object('mes',p_mes,'corte',now(),'filas',coalesce((select jsonb_agg(to_jsonb(f) order by ventas desc,nombre,id) from filas f),'[]'),
 'empresa',jsonb_build_object('ventas',(select count(*) from ventas),'visitados',(select count(distinct (oportunidad_id,ciclo)) from visitas),
 'sin_importes',(select count(*) from ventas where not importes_conocidos),'volumen_inicial',(select sum(inicial)::text from ventas),
 'sin_visita',(select count(*) from ventas v where not exists(select 1 from privado.visitas_medibles a where a.oportunidad_id=v.id and a.ciclo=v.ciclo))),
 'categorias',coalesce((select jsonb_agg(to_jsonb(c)) from categorias c),'[]')) into salida;
 return salida;
end $$;
revoke all on function public.resumen_rendimiento(date,text) from public,anon;
grant execute on function public.resumen_rendimiento(date,text) to authenticated;

create function public.detalle_rendimiento(p_mes date,p_responsable uuid,p_tipo text,p_origen text default null,p_pagina integer default 0) returns jsonb
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
 select jsonb_build_object('total',(select count(*) from datos),'filas',coalesce((select jsonb_agg(to_jsonb(p)) from pagina p),'[]')) into salida;
 return salida;
end $$;
revoke all on function public.detalle_rendimiento(date,uuid,text,text,integer) from public,anon;
grant execute on function public.detalle_rendimiento(date,uuid,text,text,integer) to authenticated;
commit;
