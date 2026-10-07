begin;
create function privado.ubicaciones_marca_035(m jsonb) returns jsonb
language sql immutable set search_path='' as $$
 select coalesce(m->'ubicaciones_alarma',case when upper(trim(m->>'nombre'))='HIKVISION'
 then '["con_monitoreo","sin_monitoreo"]'::jsonb else '["docta","nobu","con_monitoreo","sin_monitoreo"]'::jsonb end)
$$;
create function privado.validar_ubicaciones_035(d jsonb) returns void
language plpgsql set search_path='' as $$
declare x jsonb; u jsonb;
begin
 if d->'ubicaciones_version' is distinct from '1'::jsonb then raise exception 'CATALOGO_UBICACION'; end if;
 for x in select value from jsonb_array_elements(d->'marcas') union all
 select value from jsonb_array_elements(d->'items') where value->>'tipo'='kit' and value->>'servicio'='alarma' loop
  u:=x->'ubicaciones_alarma';
  if jsonb_typeof(u) is distinct from 'array' then raise exception 'CATALOGO_UBICACION'; end if;
  if exists(select 1 from jsonb_array_elements(u) v where jsonb_typeof(v)<>'string' or not (v #>> '{}'=any(array['docta','nobu','con_monitoreo','sin_monitoreo'])))
    or jsonb_array_length(u)<>(select count(distinct value) from jsonb_array_elements(u)) then raise exception 'CATALOGO_UBICACION'; end if;
 end loop;
end $$;
revoke all on function privado.ubicaciones_marca_035(jsonb), privado.validar_ubicaciones_035(jsonb) from public,anon,authenticated;

alter function public.guardar_catalogo(integer,uuid,jsonb) rename to guardar_catalogo_base_035;
revoke all on function public.guardar_catalogo_base_035(integer,uuid,jsonb) from public,anon,authenticated;
create function public.guardar_catalogo(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare actual jsonb;
begin
 perform pg_advisory_xact_lock(740127);
 if not privado.es_administrador() then raise exception 'CATALOGO_ACCESO'; end if;
 if exists(select 1 from public.versiones_catalogo where operacion=p_operacion) then
  return public.guardar_catalogo_base_035(p_version,p_operacion,p_datos);
 end if;
 select datos into actual from public.versiones_catalogo order by version desc limit 1;
 if p_datos ? 'ubicaciones_version' then
  perform privado.validar_ubicaciones_035(p_datos);
 elsif actual->'ubicaciones_version'='1'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
 return public.guardar_catalogo_base_035(p_version,p_operacion,p_datos);
end $$;
revoke all on function public.guardar_catalogo(integer,uuid,jsonb) from public,anon;
grant execute on function public.guardar_catalogo(integer,uuid,jsonb) to authenticated;
create function public.guardar_catalogo_035(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
begin
 if p_datos->'esquema' is distinct from '7'::jsonb or p_datos->'ubicaciones_version' is distinct from '1'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
 return public.guardar_catalogo(p_version,p_operacion,p_datos);
end $$;
revoke all on function public.guardar_catalogo_035(integer,uuid,jsonb) from public,anon;
grant execute on function public.guardar_catalogo_035(integer,uuid,jsonb) to authenticated;

alter function public.leer_catalogo(uuid) rename to leer_catalogo_base_035;
revoke all on function public.leer_catalogo_base_035(uuid) from public,anon,authenticated;
create function public.leer_catalogo(p_oportunidad uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb; d jsonb; i jsonb; original jsonb; m jsonb; salida jsonb:='[]'; marcas jsonb:='[]';
begin
 r:=public.leer_catalogo_base_035(p_oportunidad);
 if r->'datos'->'esquema' is distinct from '7'::jsonb then return r; end if;
 select datos into d from public.versiones_catalogo order by version desc limit 1;
 for m in select value from jsonb_array_elements(r->'datos'->'marcas') loop
  marcas:=marcas||jsonb_build_array(m||jsonb_build_object('ubicaciones_alarma',privado.ubicaciones_marca_035(m)));
 end loop;
 for i in select value from jsonb_array_elements(r->'datos'->'items') loop
  if i->>'tipo'='kit' and i->>'servicio'='alarma' then
   select value into original from jsonb_array_elements(d->'items') where value->>'id'=i->>'id';
   select value into m from jsonb_array_elements(d->'marcas') where value->>'id'=i->>'marca_id';
   i:=i||jsonb_build_object('ubicaciones_alarma',coalesce(original->'ubicaciones_alarma',privado.ubicaciones_marca_035(m)));
  end if;
  salida:=salida||jsonb_build_array(i);
 end loop;
 return jsonb_set(r,'{datos}',(r->'datos')||jsonb_build_object('marcas',marcas,'items',salida,'ubicaciones_version',1));
end $$;
revoke all on function public.leer_catalogo(uuid) from public,anon;
grant execute on function public.leer_catalogo(uuid) to authenticated;

alter function privado.calcular_propuesta(jsonb,jsonb,boolean) rename to calcular_propuesta_base_035;
revoke all on function privado.calcular_propuesta_base_035(jsonb,jsonb,boolean) from public,anon,authenticated;
create function privado.calcular_propuesta(p_catalogo jsonb,p_seleccion jsonb,p_telefonico boolean) returns jsonb
language plpgsql set search_path='' as $$
declare k jsonb; m jsonb; ubicacion text; resultado jsonb;
begin
 if p_catalogo->'esquema'='7'::jsonb then
  select value into k from jsonb_array_elements(p_catalogo->'items') where value->>'id'=p_seleccion->>'kit_id';
  if k->>'servicio'='alarma' then
   select value into m from jsonb_array_elements(p_catalogo->'marcas') where value->>'id'=k->>'marca_id';
   ubicacion:=coalesce(p_seleccion->>'ubicacion_alarma',p_seleccion->>'subcategoria');
   if k->>'modalidad'='plan' and ubicacion is distinct from p_seleccion->>'subcategoria' then raise exception 'PROPUESTA_UBICACION'; end if;
   -- Clientes antiguos de venta no enviaban ubicación. Su contexto implícito era residencial.
   if ubicacion is null and k->>'modalidad'='kit' and not(p_catalogo ? 'ubicaciones_version') then ubicacion:='sin_monitoreo'; end if;
   if ubicacion is null or not(privado.ubicaciones_marca_035(m) ? ubicacion)
     or not(coalesce(k->'ubicaciones_alarma',privado.ubicaciones_marca_035(m)) ? ubicacion) then raise exception 'PROPUESTA_UBICACION'; end if;
  end if;
 end if;
 resultado:=privado.calcular_propuesta_base_035(p_catalogo,p_seleccion,p_telefonico);
 if ubicacion is not null then resultado:=resultado||jsonb_build_object('ubicacion_alarma',ubicacion); end if;
 return resultado;
end $$;
revoke all on function privado.calcular_propuesta(jsonb,jsonb,boolean) from public,anon,authenticated;
commit;
