begin;
-- La marca manda: recortar ubicaciones de ofertas en cada guardado, incluidos clientes anteriores.
create or replace function public.guardar_catalogo(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare actual jsonb; item jsonb; marca jsonb; permitidas jsonb; salida jsonb := '[]'::jsonb;
begin
 perform pg_advisory_xact_lock(740127);
 if not privado.es_administrador() then raise exception 'CATALOGO_ACCESO'; end if;
 if not (p_datos ? 'ubicaciones_version') and exists(select 1 from public.versiones_catalogo where operacion=p_operacion) then
  return public.guardar_catalogo_base_035(p_version,p_operacion,p_datos);
 end if;
 select datos into actual from public.versiones_catalogo order by version desc limit 1;
 if p_datos ? 'ubicaciones_version' then
  perform privado.validar_ubicaciones_035(p_datos);
 elsif actual->'ubicaciones_version'='1'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
 if p_datos->'ubicaciones_version'='1'::jsonb then
  for item in select value from jsonb_array_elements(p_datos->'items') loop
   if item->>'tipo'='kit' and item->>'servicio'='alarma' then
    select value into marca from jsonb_array_elements(p_datos->'marcas') where value->>'id'=item->>'marca_id';
    permitidas:=case when marca is null then '[]'::jsonb else privado.ubicaciones_marca_035(marca) end;
    item:=jsonb_set(item,'{ubicaciones_alarma}',coalesce((select jsonb_agg(value) from jsonb_array_elements(item->'ubicaciones_alarma') where permitidas ? (value #>> '{}')),'[]'::jsonb));
   end if;
   salida:=salida||jsonb_build_array(item);
  end loop;
  p_datos:=jsonb_set(p_datos,'{items}',salida);
 end if;
 return public.guardar_catalogo_base_035(p_version,p_operacion,p_datos);
end $$;
commit;
