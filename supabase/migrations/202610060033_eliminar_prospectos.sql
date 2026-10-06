begin;
alter table public.registros_iniciales add column eliminado_en timestamptz;
alter table public.registros_iniciales add column eliminado_por uuid references public.perfiles(id);
alter table public.eventos_registros drop constraint eventos_registros_tipo_check;
alter table public.eventos_registros add constraint eventos_registros_tipo_check
 check(tipo in ('registro_creado','registro_actualizado','registro_eliminado'));
-- Restrictiva: ninguna política de lectura anterior puede volver a mostrar una baja.
create policy registros_no_eliminados on public.registros_iniciales as restrictive
 for select to authenticated using (eliminado_en is null);
create policy eventos_eliminados_administracion on public.eventos_registros for select to authenticated
 using (privado.es_administrador());

create function public.eliminar_prospecto_033(p_id uuid,p_version integer,p_motivo text)
returns uuid language plpgsql security definer set search_path='' as $$
declare anterior public.registros_iniciales; nuevo public.registros_iniciales;
begin
 perform pg_advisory_xact_lock(740127);
 perform 1 from public.perfiles where id=auth.uid() and activo and rol='administrador' for share;
 if not found then raise exception 'PROSPECTO_ADMIN'; end if;
 if p_id is null or p_version is null or p_version<1 or p_motivo is null
 or char_length(trim(p_motivo)) not between 5 and 500 then raise exception 'PROSPECTO_MOTIVO'; end if;
 select * into anterior from public.registros_iniciales where id=p_id for update;
 if not found then raise exception 'PROSPECTO_NO_DISPONIBLE'; end if;
 if anterior.eliminado_en is not null then
  if anterior.eliminado_por=auth.uid() and anterior.version=p_version+1 and exists(
   select 1 from public.eventos_registros where registro_id=p_id and tipo='registro_eliminado' and motivo=trim(p_motivo)
  ) then return p_id; end if;
  raise exception 'PROSPECTO_NO_DISPONIBLE';
 end if;
 if anterior.version<>p_version then raise exception 'Recargá el prospecto' using errcode='40001'; end if;
 if anterior.lote_demostracion is not null or anterior.importacion_historica is not null
 or exists(select 1 from public.prospectos where registro_id=p_id) then raise exception 'PROSPECTO_VINCULADO'; end if;
 update public.registros_iniciales set eliminado_en=now(),eliminado_por=auth.uid(),version=version+1,actualizado_en=now()
 where id=p_id returning * into nuevo;
 insert into public.eventos_registros(registro_id,actor_id,tipo,anterior,nuevo,motivo)
 values(p_id,auth.uid(),'registro_eliminado',to_jsonb(anterior),to_jsonb(nuevo),trim(p_motivo));
 return p_id;
end $$;
revoke all on function public.eliminar_prospecto_033(uuid,integer,text) from public,anon;
grant execute on function public.eliminar_prospecto_033(uuid,integer,text) to authenticated;

create function privado.impedir_edicion_prospecto_eliminado() returns trigger
language plpgsql set search_path='' as $$
begin
 if old.eliminado_en is not null then raise exception 'PROSPECTO_NO_DISPONIBLE'; end if;
 return new;
end $$;
revoke all on function privado.impedir_edicion_prospecto_eliminado() from public,anon,authenticated;
create trigger impedir_edicion_prospecto_eliminado before update on public.registros_iniciales
 for each row execute function privado.impedir_edicion_prospecto_eliminado();
do $migration$
declare d text; anterior text := 'registro.lote_demostracion is not null';
begin
 d:=pg_get_functiondef('public.iniciar_cotizacion(uuid,integer,uuid,jsonb)'::regprocedure);
 if strpos(d,anterior)=0 then raise exception 'MIGRACION_033_INCOMPATIBLE'; end if;
 execute replace(d,anterior,'(registro.lote_demostracion is not null or registro.eliminado_en is not null)');
end $migration$;
commit;
