begin;
alter table public.actividades_agenda add column registro_id uuid references public.registros_iniciales(id);
alter table public.actividades_agenda add constraint agenda_un_vinculo check(registro_id is null or oportunidad_id is null);
create index agenda_contacto on public.actividades_agenda(registro_id) where registro_id is not null;
create function public.buscar_prospectos_agenda_040(p_busqueda text) returns table(id uuid,nombre text,telefono text,ubicacion text,atencion jsonb)
language sql stable security invoker set search_path='' as $$
 select r.id,r.nombre,r.telefono,r.ubicacion,public.atencion_prospecto_039(r.id)
 from public.registros_iniciales r where privado.usuario_activo() and r.lote_demostracion is null
 and char_length(trim(p_busqueda))>=2 and (position(lower(trim(p_busqueda)) in lower(r.nombre))>0
 or (length(regexp_replace(p_busqueda,'[^0-9]','','g'))>=4 and position(regexp_replace(p_busqueda,'[^0-9]','','g') in regexp_replace(r.telefono,'[^0-9]','','g'))>0))
 order by r.nombre,r.id limit 20;
$$;
revoke all on function public.buscar_prospectos_agenda_040(text) from public,anon;
grant execute on function public.buscar_prospectos_agenda_040(text) to authenticated;
-- Reutilizar fechas, estados, permisos, auditoría e idempotencia de Agenda.
do $migration$
declare d text; old text;
begin
 d:=pg_get_functiondef('public.gestionar_actividad(uuid,integer,uuid,text,jsonb)'::regprocedure);
 old:='nueva.oportunidad_id:=nullif(p_datos->>''oportunidad_id'','''')::uuid;';
 if strpos(d,old)=0 then raise exception 'MIGRACION_040_VINCULO'; end if;
 d:=replace(d,old,old||$patch$
   nueva.registro_id:=case when p_datos ? 'registro_id' then nullif(p_datos->>'registro_id','')::uuid else anterior.registro_id end;
   if nueva.registro_id is not null then
    if nueva.oportunidad_id is not null then raise exception 'AGENDA_DATOS'; end if;
    perform 1 from public.registros_iniciales where id=nueva.registro_id and eliminado_en is null and lote_demostracion is null for update;
    if not found then raise exception 'PROSPECTO_NO_DISPONIBLE'; end if;
    perform privado.exigir_atencion_039(nueva.registro_id,actor.id);
    if exists(select 1 from public.prospectos p join public.oportunidades o on o.prospecto_id=p.id where p.registro_id=nueva.registro_id and not o.preparacion_compartida and o.estado not in ('anulada','ganada','perdida') and o.responsable_id is distinct from actor.id) then raise exception 'PROSPECTO_OCUPADO'; end if;
   end if;
 $patch$);
 old:='oportunidad_id=nueva.oportunidad_id,estado=nueva.estado';
 if strpos(d,old)=0 then raise exception 'MIGRACION_040_EDICION'; end if;
 d:=replace(d,old,'registro_id=nueva.registro_id,'||old);
 execute d;
 -- Evitar liberar o transferir una atención mientras el vendedor tiene una visita pendiente.
 d:=pg_get_functiondef('public.tomar_prospecto_039(uuid,integer,boolean)'::regprocedure);
 old:='destino:=null;';
 if strpos(d,old)=0 then raise exception 'MIGRACION_040_LIBERACION'; end if;
 execute replace(d,old,$patch$
 if exists(select 1 from public.actividades_agenda where registro_id=p_registro and estado in ('programada','en_curso')) then raise exception 'AGENDA_CONTACTO_PENDIENTE'; end if;
 $patch$||old);
 d:=pg_get_functiondef('privado.sincronizar_atencion_039()'::regprocedure);
 old:='update public.atencion_prospectos set vendedor_id=new.responsable_id';
 if strpos(d,old)=0 then raise exception 'MIGRACION_040_REASIGNACION'; end if;
 execute replace(d,old,$patch$
 if exists(select 1 from public.actividades_agenda where registro_id=registro and estado in ('programada','en_curso') and vendedor_id<>new.responsable_id) then raise exception 'AGENDA_CONTACTO_PENDIENTE'; end if;
 $patch$||old);
end $migration$;
create function public.gestionar_actividad_040(p_id uuid,p_version integer,p_operacion uuid,p_accion text,p_datos jsonb) returns uuid
language sql security invoker set search_path='' as $$ select public.gestionar_actividad(p_id,p_version,p_operacion,p_accion,p_datos) $$;
revoke all on function public.gestionar_actividad_040(uuid,integer,uuid,text,jsonb) from public,anon;
grant execute on function public.gestionar_actividad_040(uuid,integer,uuid,text,jsonb) to authenticated;
create function privado.cancelar_agenda_contacto_040() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.actividades_agenda; nueva public.actividades_agenda;
begin
 if old.eliminado_en is null and new.eliminado_en is not null then
  for a in select * from public.actividades_agenda where registro_id=new.id and estado in ('programada','en_curso') for update loop
   update public.actividades_agenda set estado='cancelada',resultado='Prospecto eliminado por administración',version=version+1,actualizado_en=now() where id=a.id returning * into nueva;
   insert into public.eventos_agenda values(gen_random_uuid(),a.id,auth.uid(),'prospecto_eliminado',jsonb_build_object('registro_id',new.id),to_jsonb(a),to_jsonb(nueva),now());
  end loop;
 end if;
 return new;
end $$;
create trigger cancelar_agenda_contacto_040 after update of eliminado_en on public.registros_iniciales for each row execute function privado.cancelar_agenda_contacto_040();
revoke all on function privado.cancelar_agenda_contacto_040() from public,anon,authenticated;
commit;
