begin;

-- Solo nombres operativos: no cambiar correos, notas, archivos ni snapshots.
create function privado.normalizar_nombre_021() returns trigger
language plpgsql set search_path='' as $$
begin
 new.nombre := upper(trim(new.nombre));
 return new;
end;
$$;
revoke all on function privado.normalizar_nombre_021() from public,anon,authenticated;
create trigger normalizar_nombre before insert or update on public.perfiles
for each row execute function privado.normalizar_nombre_021();
create trigger normalizar_nombre before insert or update on public.registros_iniciales
for each row execute function privado.normalizar_nombre_021();
create trigger normalizar_nombre before insert or update on public.prospectos
for each row execute function privado.normalizar_nombre_021();

create function privado.normalizar_catalogo_021(d jsonb) returns jsonb
language plpgsql immutable set search_path='' as $$
declare coleccion text; lista jsonb; item jsonb;
begin
 foreach coleccion in array array['marcas','tipos','familias','items'] loop
  if jsonb_typeof(d->coleccion)='array' then
   lista := '[]'::jsonb;
   for item in select * from jsonb_array_elements(d->coleccion) loop
    if jsonb_typeof(item->'nombre')='string' then
     item := jsonb_set(item,'{nombre}',to_jsonb(upper(trim(item->>'nombre'))));
    end if;
    if coleccion='familias' and jsonb_typeof(item->'marca')='string' then
     item := jsonb_set(item,'{marca}',to_jsonb(upper(trim(item->>'marca'))));
    end if;
    lista := lista || jsonb_build_array(item);
   end loop;
   d := jsonb_set(d,array[coleccion],lista);
  end if;
 end loop;
 return d;
end;
$$;
revoke all on function privado.normalizar_catalogo_021(jsonb) from public,anon,authenticated;

-- Normalizar antes de validar y comparar reintentos, nunca después del INSERT.
alter function public.guardar_catalogo(integer,uuid,jsonb) rename to guardar_catalogo_base_021;
revoke all on function public.guardar_catalogo_base_021(integer,uuid,jsonb) from public,anon,authenticated;
create function public.guardar_catalogo(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security definer set search_path='' as $$
begin
 if not privado.es_administrador() then raise exception 'CATALOGO_ACCESO'; end if;
 -- Conservar reintentos exactos de operaciones anteriores a esta migración.
 if exists(select 1 from public.versiones_catalogo where operacion=p_operacion and actor_id=auth.uid() and datos=p_datos and version_anterior=p_version) then
  return public.guardar_catalogo_base_021(p_version,p_operacion,p_datos);
 end if;
 return public.guardar_catalogo_base_021(p_version,p_operacion,privado.normalizar_catalogo_021(p_datos));
end;
$$;
revoke all on function public.guardar_catalogo(integer,uuid,jsonb) from public,anon;
grant execute on function public.guardar_catalogo(integer,uuid,jsonb) to authenticated;

-- Datos existentes: se normalizan al editar; no reescribir versiones ni eventos.
commit;
