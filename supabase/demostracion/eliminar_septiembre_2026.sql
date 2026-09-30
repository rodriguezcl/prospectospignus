-- NO ejecutar hasta que se solicite borrar la demostración.
-- Establecer antes: SET pignus.confirmar_limpieza = 'pignus-demo-septiembre-2026-v1';
-- Abortará si el lote fue editado, vinculado con datos ajenos o habilitado para acceso.
begin;
do $$
declare
 lote constant text := 'pignus-demo-septiembre-2026-v1';
 manifiesto privado.lotes_demostracion; actuales jsonb; ids uuid[]; eventos_actuales jsonb;
begin
 if current_setting('pignus.confirmar_limpieza',true) is distinct from lote then
   raise exception 'Falta confirmación explícita de limpieza';
 end if;
 perform pg_advisory_xact_lock(740130);
 select * into manifiesto from privado.lotes_demostracion where codigo=lote for update;
 if not found then raise exception 'No existe el manifiesto del lote'; end if;
 lock table public.registros_iniciales, public.eventos_registros, public.perfiles, public.eventos_cuentas in share row exclusive mode;
 select jsonb_agg(to_jsonb(r) order by r.id),array_agg(r.id) into actuales,ids
 from public.registros_iniciales r where r.lote_demostracion=lote;
 if actuales is distinct from manifiesto.registros then raise exception 'El lote cambió: revisar manualmente, no se borra nada'; end if;
 if (select count(*) from public.perfiles where id=any(manifiesto.usuarios) and not activo and rol='vendedor' and lote_demostracion=lote)<>2
   or (select count(*) from auth.users where id=any(manifiesto.usuarios) and banned_until='2099-12-31T23:59:59Z'::timestamptz and coalesce(encrypted_password,'')='' and raw_app_meta_data->>'lote_demostracion'=lote)<>2
   then raise exception 'Las cuentas de demostración cambiaron'; end if;
 if exists(select 1 from public.registros_iniciales where (creado_por=any(manifiesto.usuarios) or responsable_id=any(manifiesto.usuarios)) and not(id=any(ids)))
   or exists(select 1 from public.perfiles where creado_por=any(manifiesto.usuarios))
   or exists(select 1 from public.eventos_registros where actor_id=any(manifiesto.usuarios) and not(registro_id=any(ids)))
   or exists(select 1 from public.eventos_cuentas where actor_id=any(manifiesto.usuarios))
   then raise exception 'Existen vínculos ajenos al lote: revisar manualmente'; end if;
 if to_jsonb(manifiesto)->>'revision' = 'diversificada-134-v2' then
   select jsonb_agg(to_jsonb(e) order by e.id) into eventos_actuales from public.eventos_registros e where registro_id=any(ids);
   if eventos_actuales is distinct from to_jsonb(manifiesto)->'eventos' then raise exception 'La auditoría ampliada del lote cambió'; end if;
 elsif (select count(*) from public.eventos_registros where registro_id=any(ids))<>90 then
   raise exception 'La auditoría del lote cambió';
 end if;
 if (select count(*) from public.eventos_cuentas where usuario_id=any(manifiesto.usuarios))<>2
   then raise exception 'La auditoría del lote cambió'; end if;
 delete from public.eventos_registros where registro_id=any(ids);
 delete from public.registros_iniciales where id=any(ids);
 delete from public.eventos_cuentas where usuario_id=any(manifiesto.usuarios);
 delete from auth.users where id=any(manifiesto.usuarios);
 delete from privado.lotes_demostracion where codigo=lote;
end $$;
commit;
