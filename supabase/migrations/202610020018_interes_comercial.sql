begin;

-- No se deducen servicios ni modalidades a partir de texto histórico.
alter table public.oportunidades add column interes_comercial jsonb;
alter table public.oportunidades add column observaciones_visita text;
alter table public.oportunidades add column canal_contacto text;

alter function public.gestionar_oportunidad(uuid,integer,uuid,text,jsonb) rename to gestionar_oportunidad_base_v17;
revoke all on function public.gestionar_oportunidad_base_v17(uuid,integer,uuid,text,jsonb) from public,anon,authenticated;
create function public.gestionar_oportunidad(p_id uuid,p_version integer,p_operacion uuid,p_accion text,p_datos jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare interes jsonb; servicios jsonb; modalidad text; observaciones text;
 necesidad text; resultado uuid; repetida boolean;
begin
 perform pg_advisory_xact_lock(740127);
 if not privado.usuario_activo() then raise exception 'COMERCIAL_ACCESO'; end if;
 -- Clientes anteriores conservan el contrato textual, sin inventar una categoría.
 if p_accion<>'crear' or not (p_datos ? 'interes_comercial') then
  return public.gestionar_oportunidad_base_v17(p_id,p_version,p_operacion,p_accion,p_datos);
 end if;
 interes:=p_datos->'interes_comercial'; servicios:=interes->'servicios';
 if jsonb_typeof(interes) is distinct from 'object' or jsonb_typeof(servicios) is distinct from 'array' then
  raise exception 'COMERCIAL_INTERES';
 end if;
 if jsonb_array_length(servicios) not between 1 and 3
  or exists(select 1 from jsonb_array_elements(servicios) s where s not in ('"alarma"'::jsonb,'"camaras"'::jsonb,'"cerco"'::jsonb))
  or (select count(distinct s) from jsonb_array_elements(servicios) s)<>jsonb_array_length(servicios) then
  raise exception 'COMERCIAL_INTERES';
 end if;
 modalidad:=interes->>'tipo_alarma';
 if servicios ? 'alarma' then
  if modalidad is null or modalidad not in ('a_definir','docta','nobu','con_monitoreo','sin_monitoreo') then raise exception 'COMERCIAL_INTERES'; end if;
 else modalidad:=null;
 end if;
 if p_datos ? 'observaciones' and jsonb_typeof(p_datos->'observaciones') is distinct from 'string' then raise exception 'COMERCIAL_DATOS'; end if;
 observaciones:=trim(coalesce(p_datos->>'observaciones',''));
 if coalesce(p_datos->>'canal_contacto','') not in ('whatsapp','llamada','presencial','correo','otro') then raise exception 'COMERCIAL_INTERES'; end if;
 if char_length(observaciones)>2000 then raise exception 'COMERCIAL_DATOS'; end if;
 select string_agg(case s
  when 'alarma' then 'Instalación de Alarma · ' || case modalidad
   when 'docta' then 'Docta Urbanización' when 'nobu' then 'Nobu Town'
   when 'con_monitoreo' then 'Residencial con monitoreo'
   when 'sin_monitoreo' then 'Residencial sin monitoreo' else 'A definir en la visita' end
  when 'camaras' then 'Instalación de Cámaras' when 'cerco' then 'Instalación de Cerco Eléctrico' end,
  ' + ' order by n) into necesidad from jsonb_array_elements_text(servicios) with ordinality as t(s,n);
 interes:=jsonb_build_object('servicios',servicios,'tipo_alarma',modalidad);
 -- Resumen operativo generado, no evidencia ni observación inventada del cliente.
 -- La nota original (incluso vacía/corta) queda separada en la solicitud auditada.
 p_datos:=p_datos || jsonb_build_object('interes_comercial',interes,'observaciones',observaciones,
  'necesidad',necesidad,'resumen',case when char_length(observaciones)>=5 then observaciones else 'Visita coordinada. Servicios: '||necesidad||case when observaciones<>'' then '. Observaciones: '||observaciones else '' end end);
 repetida:=exists(select 1 from public.eventos_oportunidades where id=p_operacion);
 resultado:=public.gestionar_oportunidad_base_v17(p_id,p_version,p_operacion,p_accion,p_datos);
 if not repetida then
  update public.oportunidades set interes_comercial=interes, observaciones_visita=observaciones,
   canal_contacto=p_datos->>'canal_contacto' where id=resultado;
 end if;
 return resultado;
end $$;
revoke all on function public.gestionar_oportunidad(uuid,integer,uuid,text,jsonb) from public,anon;
grant execute on function public.gestionar_oportunidad(uuid,integer,uuid,text,jsonb) to authenticated;
commit;
