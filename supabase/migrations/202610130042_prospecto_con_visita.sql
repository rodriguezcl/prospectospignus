begin;

-- Una sola transacción para el alta del contacto, su reserva y la visita inicial.
-- La identidad del vendedor se obtiene de la sesión; no se abre una cotización.
create function public.guardar_prospecto_con_visita_042(p_id uuid, p_datos jsonb, p_visita jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor uuid := auth.uid();
 registro public.registros_iniciales;
 visita jsonb;
 evento public.eventos_agenda;
 campo text;
begin
 -- Mantener el orden de bloqueo de Agenda, reservas y cambios de elegibilidad.
 perform pg_advisory_xact_lock(740127);
 if not exists(select 1 from public.perfiles where id=actor and activo and rol='vendedor') then
  raise exception 'AGENDA_ACCESO';
 end if;
 if p_id is null or jsonb_typeof(p_datos) is distinct from 'object'
 or jsonb_typeof(p_visita) is distinct from 'object' then
  raise exception 'AGENDA_DATOS';
 end if;
 for campo in select jsonb_object_keys(p_visita) loop
  if campo not in ('inicio_previsto','fin_previsto','nota') then raise exception 'AGENDA_DATOS'; end if;
 end loop;
 if jsonb_typeof(p_visita->'inicio_previsto') is distinct from 'string'
 or (p_visita ? 'fin_previsto' and jsonb_typeof(p_visita->'fin_previsto') not in ('string','null'))
 or (p_visita ? 'nota' and jsonb_typeof(p_visita->'nota') is distinct from 'string') then
  raise exception 'AGENDA_DATOS';
 end if;

 visita := jsonb_build_object(
  'tipo','visita','estado','programada','titulo',left('Visita comercial: ' || upper(trim(p_datos->>'nombre')),160),
  'registro_id',p_id,'inicio_previsto',p_visita->>'inicio_previsto',
  'fin_previsto',nullif(p_visita->>'fin_previsto',''),
  'nota',trim(coalesce(p_visita->>'nota','')),
  -- La solicitud original queda auditada para distinguir un reintento de otra alta.
  'alta_prospecto_042',p_datos
 );

 select * into registro from public.registros_iniciales where id=p_id for update;
 if found then
  select * into evento from public.eventos_agenda where id=p_id;
  if not found or evento.actor_id<>actor or evento.actividad_id<>p_id
  or evento.solicitud->'datos'->'alta_prospecto_042' is distinct from p_datos
  or (evento.solicitud->'datos'->>'registro_id') is distinct from p_id::text then
   raise exception 'ALTA_VISITA_CONFLICTO';
  end if;
  -- 040 comprueba el resto de la solicitud exacta antes de validar fechas.
  -- Permite confirmar un alta ya guardada aunque la visita luego se reprogramara.
  perform public.gestionar_actividad_040(p_id,0,p_id,'crear',visita);
 else
  select * into registro from public.guardar_registro_inicial_041(p_id,0,p_datos);
  perform public.gestionar_actividad_040(p_id,0,p_id,'crear',visita);
 end if;
 return jsonb_build_object('id',registro.id,'visita_id',p_id);
end $$;

revoke all on function public.guardar_prospecto_con_visita_042(uuid,jsonb,jsonb) from public,anon;
grant execute on function public.guardar_prospecto_con_visita_042(uuid,jsonb,jsonb) to authenticated;
commit;
