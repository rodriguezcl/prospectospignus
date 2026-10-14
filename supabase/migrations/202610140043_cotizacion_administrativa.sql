begin;
-- Administración puede preparar una cotización sin reservarse el contacto.
-- La primera oferta sigue exigiendo un vendedor activo y sincroniza la reserva
-- en esa misma transacción. Una reserva existente nunca puede ser sustituida
-- por el vendedor elegido al registrar la oferta.
create or replace function privado.exigir_atencion_039(p_registro uuid,p_vendedor uuid default null)
returns void language plpgsql security definer set search_path='' as $$
declare a public.atencion_prospectos; rol_actor text;
begin
 select rol into rol_actor from public.perfiles where id=auth.uid() and activo;
 select * into a from public.atencion_prospectos where registro_id=p_registro for update;
 if not found then return; end if;
 if a.vendedor_id is null then
  if rol_actor='vendedor' then perform public.tomar_prospecto_039(p_registro,a.version,false);
  elsif rol_actor='administrador' then return;
  else raise exception 'PROSPECTO_TOMAR'; end if;
 elsif (rol_actor<>'administrador' and a.vendedor_id<>auth.uid()) or (p_vendedor is not null and a.vendedor_id<>p_vendedor) then
  raise exception 'PROSPECTO_OCUPADO';
 end if;
end $$;
revoke all on function privado.exigir_atencion_039(uuid,uuid) from public,anon,authenticated;
commit;
