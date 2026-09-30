begin;

alter table public.oportunidades add column ciclo integer not null default 1 check(ciclo>0);

-- Un nuevo ciclo no corrige ni elimina el cierre anterior: queda en el evento.
create function public.reactivar_oportunidad(p_id uuid,p_version integer,p_operacion uuid,p_datos jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 actor public.perfiles; responsable public.perfiles;
 anterior public.oportunidades; nueva public.oportunidades;
 evento public.eventos_oportunidades; solicitud jsonb;
 plazo timestamptz; v_resumen text := trim(coalesce(p_datos->>'resumen',''));
begin
 perform pg_advisory_xact_lock(740127);
 select * into actor from public.perfiles where id=auth.uid() and activo;
 if not found then raise exception 'COMERCIAL_ACCESO'; end if;
 if p_id is null or p_operacion is null or p_version is null or p_version<1
   or jsonb_typeof(p_datos) is distinct from 'object'
   or char_length(v_resumen) not between 5 and 2000 then raise exception 'COMERCIAL_DATOS'; end if;
 solicitud := jsonb_build_object('id',p_id,'version',p_version,'accion','reactivar','datos',p_datos);
 select * into evento from public.eventos_oportunidades where id=p_operacion;
 if found then
   if evento.actor_id=actor.id and evento.solicitud=solicitud then return evento.oportunidad_id; end if;
   raise exception 'COMERCIAL_CONFLICTO';
 end if;
 select * into anterior from public.oportunidades where id=p_id for update;
 if not found or (actor.rol<>'administrador' and anterior.responsable_id is distinct from actor.id)
   then raise exception 'COMERCIAL_ACCESO'; end if;
 if anterior.version<>p_version then raise exception 'COMERCIAL_CONFLICTO'; end if;
 if anterior.estado<>'perdida' then raise exception 'COMERCIAL_TRANSICION'; end if;
 select * into responsable from public.perfiles where id=anterior.responsable_id and activo and rol in ('vendedor','agente');
 if not found then raise exception 'COMERCIAL_DESTINO'; end if;
 plazo := (p_datos->>'plazo')::timestamptz;
 if plazo is null or plazo<=now() then raise exception 'COMERCIAL_PLAZO'; end if;
 update public.oportunidades set
   estado=case when responsable.rol='agente' then 'recuperacion' else 'seguimiento' end,
   ciclo=ciclo+1,version=version+1,actualizado_en=now(),proxima_accion_en=plazo,
   resumen=v_resumen,condiciones='',motivo_perdida=null,canal_confirmacion=null,
   confirmado_en=null,cerrado_en=null,cerrado_por=null
 where id=p_id returning * into nueva;
 insert into public.eventos_oportunidades(id,oportunidad_id,actor_id,tipo,solicitud,anterior,nuevo)
 values(p_operacion,p_id,actor.id,'reactivar',solicitud,to_jsonb(anterior),to_jsonb(nueva));
 insert into public.notificaciones(destinatario_id,oportunidad_id,evento_id,mensaje)
 values(nueva.responsable_id,p_id,p_operacion,'Oportunidad reactivada: nuevo seguimiento');
 return p_id;
end $$;
revoke all on function public.reactivar_oportunidad(uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.reactivar_oportunidad(uuid,integer,uuid,jsonb) to authenticated;
commit;
