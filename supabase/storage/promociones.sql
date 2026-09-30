-- Aplicar después de 011, una vez, en Supabase (requiere el esquema Storage).
begin;
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
 values('promociones','promociones',false,20971520,array['application/pdf','image/jpeg','image/png','image/webp']);
create policy promociones_archivos_descarga on storage.objects for select to authenticated using (
 bucket_id='promociones' and exists(select 1 from public.archivos_promociones a
 where a.ruta=name and a.estado='disponible' and privado.puede_ver_promocion(a.promocion_id))
);
create policy promociones_archivos_carga on storage.objects for insert to authenticated with check (
 bucket_id='promociones' and privado.es_administrador() and exists(
 select 1 from public.archivos_promociones a join public.promociones p on p.id=a.promocion_id
 where a.ruta=name and a.estado='pendiente' and p.estado='borrador')
);
-- No UPDATE/DELETE de objetos: los adjuntos son inmutables y se retiran de forma lógica.
-- Evitar que políticas permisivas de otros buckets abran este material.
create policy promociones_guardia_lectura on storage.objects as restrictive for select to authenticated using (
 bucket_id<>'promociones' or exists(select 1 from public.archivos_promociones a
 where a.ruta=name and a.estado='disponible' and privado.puede_ver_promocion(a.promocion_id))
);
create policy promociones_guardia_anon on storage.objects as restrictive for all to anon
 using(bucket_id<>'promociones') with check(bucket_id<>'promociones');
create policy promociones_guardia_carga on storage.objects as restrictive for insert to authenticated with check (
 bucket_id<>'promociones' or (privado.es_administrador() and exists(
 select 1 from public.archivos_promociones a join public.promociones p on p.id=a.promocion_id
 where a.ruta=name and a.estado='pendiente' and p.estado='borrador'))
);
create policy promociones_sin_sobrescritura on storage.objects as restrictive for update to authenticated
 using(bucket_id<>'promociones') with check(bucket_id<>'promociones');
create policy promociones_sin_borrado on storage.objects as restrictive for delete to authenticated using(bucket_id<>'promociones');
create function public.confirmar_archivo_promocion(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
declare a public.archivos_promociones; p public.promociones; objeto jsonb;
begin
 if not privado.es_administrador() then raise exception 'PROMO_ACCESO' using errcode='42501'; end if;
 select * into a from public.archivos_promociones where id=p_id;
 select * into p from public.promociones where id=a.promocion_id for update;
 select * into a from public.archivos_promociones where id=p_id for update;
 if a.estado='disponible' then return; end if;
 if a.id is null or a.estado<>'pendiente' or p.estado<>'borrador' then raise exception 'PROMO_ARCHIVO'; end if;
 select metadata into objeto from storage.objects where bucket_id='promociones' and name=a.ruta;
 if objeto is null or (objeto->>'size')::bigint is distinct from a.bytes or objeto->>'mimetype' is distinct from a.tipo then raise exception 'PROMO_ARCHIVO'; end if;
 update public.archivos_promociones set estado='disponible' where id=p_id;
 update public.promociones set version=version+1,actualizado_en=now() where id=p.id;
 insert into public.eventos_promociones(id,promocion_id,actor_id,accion,solicitud,anterior,nuevo)
 values(gen_random_uuid(),p.id,auth.uid(),'confirmar_archivo',jsonb_build_object('archivo',p_id),to_jsonb(a),jsonb_build_object('archivo',p_id,'estado','disponible'));
end $$;
revoke all on function public.confirmar_archivo_promocion(uuid) from public,anon;
grant execute on function public.confirmar_archivo_promocion(uuid) to authenticated;
commit;
