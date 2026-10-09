begin;
alter table public.registros_iniciales add column ubicacion_comercial text not null default '' check(ubicacion_comercial in ('','docta','nobu','residencial'));
create index registros_ubicacion_comercial on public.registros_iniciales(ubicacion_comercial);
do $migration$
declare d text;
begin
 d:=pg_get_functiondef('public.guardar_registro_inicial(uuid,integer,jsonb)'::regprocedure);
 d:=replace(d,'''observaciones'',''origen'',''motivo''','''observaciones'',''origen'',''motivo'',''ubicacion_comercial''');
 d:=replace(d,'observaciones,origen,responsable_id,creado_por)','observaciones,origen,responsable_id,creado_por,ubicacion_comercial)');
 d:=replace(d,'p_datos->>''origen'',responsable,actor)','p_datos->>''origen'',responsable,actor,coalesce(p_datos->>''ubicacion_comercial'',''''))');
 d:=replace(d,'or resultado.origen is distinct from p_datos->>''origen''','or resultado.origen is distinct from p_datos->>''origen'' or resultado.ubicacion_comercial is distinct from coalesce(p_datos->>''ubicacion_comercial'','''')');
 d:=replace(d,'observaciones=trim(coalesce(p_datos->>''observaciones'','''')),responsable_id=responsable,','observaciones=trim(coalesce(p_datos->>''observaciones'','''')),responsable_id=responsable,ubicacion_comercial=coalesce(p_datos->>''ubicacion_comercial'',anterior.ubicacion_comercial),');
 execute d;
 d:=pg_get_functiondef('public.listar_contactos_039(text,integer,text)'::regprocedure);
 d:=replace(d,'listar_contactos_039','listar_contactos_041');
 d:=replace(d,'p_atencion text DEFAULT ''''::text)','p_atencion text DEFAULT ''''::text, p_ubicacion text DEFAULT ''''::text)');
 if strpos(d,'p_ubicacion text')=0 then raise exception 'MIGRACION_041_FIRMA'; end if;
 d:=replace(d,'declare salida jsonb;','declare salida jsonb;');
 d:=replace(d,'with contactos as materialized (','if p_ubicacion is null or p_ubicacion not in ('''',''docta'',''nobu'',''residencial'',''sin_clasificar'') then raise exception ''COMERCIAL_DATOS''; end if; with contactos as materialized (');
 d:=replace(d,'r.ubicacion,r.creado_en','r.ubicacion,r.ubicacion_comercial,r.creado_en');
 d:=replace(d,'where r.lote_demostracion is null','where (p_ubicacion='''' or r.ubicacion_comercial=case when p_ubicacion=''sin_clasificar'' then '''' else p_ubicacion end) and r.lote_demostracion is null');
 execute d;
end $migration$;
create function public.guardar_registro_inicial_041(p_id uuid,p_version integer,p_datos jsonb) returns public.registros_iniciales language sql security invoker set search_path='' as $$select public.guardar_registro_inicial(p_id,p_version,p_datos)$$;
create function public.listar_casos_041(p_pagina integer default 0,p_estado text default '',p_busqueda text default '',p_ubicacion text default '') returns jsonb language plpgsql stable security invoker set search_path='' as $$
begin
 if not privado.usuario_activo() then raise exception 'COMERCIAL_ACCESO'; end if;
 if p_pagina is null or p_pagina<0 or p_pagina>1000000 or p_ubicacion is null or p_ubicacion not in ('','docta','nobu','residencial','sin_clasificar') then raise exception 'COMERCIAL_DATOS'; end if;
 return (with casos as materialized (
 select o.*,p.nombre nombre_orden,to_jsonb(p) prospectos,coalesce(r.ubicacion_comercial,'') ubicacion_comercial
 from public.oportunidades o join public.prospectos p on p.id=o.prospecto_id left join public.registros_iniciales r on r.id=p.registro_id
 where (case when p_estado='sin_asignar' then o.estado='recuperacion' and o.responsable_id is null when p_estado<>'' then o.estado=p_estado else o.estado<>'anulada' end)
 and (coalesce(p_busqueda,'')='' or position(lower(trim(p_busqueda)) in lower(p.nombre))>0)
 and (p_ubicacion='' or coalesce(r.ubicacion_comercial,'')=case when p_ubicacion='sin_clasificar' then '' else p_ubicacion end)
 ), pagina as (select * from casos order by nombre_orden,id limit 20 offset p_pagina*20)
 select jsonb_build_object('total',(select count(*) from casos),'filas',coalesce((select jsonb_agg(to_jsonb(pagina)-'nombre_orden' order by nombre_orden,id) from pagina),'[]')));
end $$;
revoke all on function public.guardar_registro_inicial_041(uuid,integer,jsonb),public.listar_contactos_041(text,integer,text,text),public.listar_casos_041(integer,text,text,text) from public,anon;
grant execute on function public.guardar_registro_inicial_041(uuid,integer,jsonb),public.listar_contactos_041(text,integer,text,text),public.listar_casos_041(integer,text,text,text) to authenticated;
commit;
