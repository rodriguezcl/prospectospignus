begin;
-- Entrada nueva: los clientes anteriores conservan la restricción de 033.
do $migration$
declare d text; anterior text;
begin
 d:=pg_get_functiondef('public.eliminar_prospecto_033(uuid,integer,text)'::regprocedure);
 d:=replace(d,'public.eliminar_prospecto_033(', 'public.eliminar_prospecto_034(');
 d:=replace(d,'nuevo public.registros_iniciales;', 'nuevo public.registros_iniciales; caso record; actividad record; cancelada public.actividades_agenda;');
 anterior:=$old$if anterior.lote_demostracion is not null or anterior.importacion_historica is not null
 or exists(select 1 from public.prospectos where registro_id=p_id) then raise exception 'PROSPECTO_VINCULADO'; end if;$old$;
 if strpos(d,anterior)=0 then raise exception 'MIGRACION_034_INCOMPATIBLE'; end if;
 d:=replace(d,anterior,$new$
 if anterior.lote_demostracion is not null then raise exception 'PROSPECTO_DEMO'; end if;
 for caso in
  select o.id,o.version from public.oportunidades o join public.prospectos p on p.id=o.prospecto_id
  where p.registro_id=p_id and o.estado in ('cotizacion','visita','seguimiento','recuperacion')
  order by o.id for update of o
 loop
  perform public.anular_cotizacion(caso.id,caso.version,gen_random_uuid(),
   jsonb_build_object('confirmar_anulacion','si','resumen','Prospecto eliminado: '||trim(p_motivo)));
  -- Anular cancela visitas. También se cancelan tareas manuales pendientes de estos casos.
  for actividad in select * from public.actividades_agenda
   where oportunidad_id=caso.id and estado in ('programada','en_curso') for update
  loop
   update public.actividades_agenda set estado='cancelada',
    resultado='Prospecto eliminado: '||trim(p_motivo),version=version+1,actualizado_en=now()
    where id=actividad.id returning * into cancelada;
   insert into public.eventos_agenda(id,actividad_id,actor_id,tipo,solicitud,anterior,nuevo)
    values(gen_random_uuid(),actividad.id,auth.uid(),'prospecto_eliminado',
     jsonb_build_object('registro_id',p_id,'motivo',trim(p_motivo)),to_jsonb(actividad),to_jsonb(cancelada));
  end loop;
 end loop;
 $new$);
 execute d;
end $migration$;
revoke all on function public.eliminar_prospecto_034(uuid,integer,text) from public,anon;
grant execute on function public.eliminar_prospecto_034(uuid,integer,text) to authenticated;
commit;
