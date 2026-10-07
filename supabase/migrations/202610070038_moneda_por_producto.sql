begin;

create function privado.validar_moneda_productos_038(d jsonb) returns void
language plpgsql set search_path='' as $$
declare i jsonb; niveles text[];
begin
 if d->'moneda_productos_version' is distinct from '1'::jsonb
 or d->>'moneda_adicionales' is distinct from 'ARS' then raise exception 'CATALOGO_ESQUEMA'; end if;
 for i in select * from jsonb_array_elements(d->'items') loop
  if i->>'tipo'='adicional' then
   if coalesce(i->>'moneda_referencia','') not in ('ARS','USD') then raise exception 'CATALOGO_USD'; end if;
   niveles:=case when i->>'servicio'='alarma' then array['alto','bajo','telefonico'] else array['telefonico'] end;
   if i->>'moneda_referencia'='USD' and i->>'estado'='activo' and i->'adicional_habilitado'='true'::jsonb
    and not coalesce(i->'precios_usd' ?& niveles,false) then raise exception 'CATALOGO_USD'; end if;
  elsif i ? 'moneda_referencia' and i->>'moneda_referencia' is distinct from 'ARS' then raise exception 'CATALOGO_USD'; end if;
 end loop;
 -- Conserva escala de ambas listas, packs, composición y permisos de precios.
 perform privado.validar_catalogo_031(d);
end $$;
revoke all on function privado.validar_moneda_productos_038(jsonb) from public,anon,authenticated;

alter function public.guardar_catalogo(integer,uuid,jsonb) rename to guardar_catalogo_base_038;
revoke all on function public.guardar_catalogo_base_038(integer,uuid,jsonb) from public,anon,authenticated;
create function public.guardar_catalogo(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare actual jsonb;
begin
 perform pg_advisory_xact_lock(740127);
 if not privado.es_administrador() then raise exception 'CATALOGO_ACCESO'; end if;
 -- Los reintentos exactos anteriores siguen bajo su validación original.
 if exists(select 1 from public.versiones_catalogo where operacion=p_operacion) then
  return public.guardar_catalogo_base_038(p_version,p_operacion,p_datos);
 end if;
 select datos into actual from public.versiones_catalogo order by version desc limit 1;
 if p_datos ? 'moneda_productos_version' then
  perform privado.validar_moneda_productos_038(p_datos);
 elsif actual->'moneda_productos_version'='1'::jsonb then raise exception 'CATALOGO_ESQUEMA';
 end if;
 return public.guardar_catalogo_base_038(p_version,p_operacion,p_datos);
end $$;
revoke all on function public.guardar_catalogo(integer,uuid,jsonb) from public,anon;
grant execute on function public.guardar_catalogo(integer,uuid,jsonb) to authenticated;

create function public.guardar_catalogo_038(p_version integer,p_operacion uuid,p_datos jsonb) returns integer
language plpgsql security invoker set search_path='' as $$
begin
 if p_datos->'esquema' is distinct from '7'::jsonb or p_datos->'ubicaciones_version' is distinct from '1'::jsonb
 or p_datos->'moneda_productos_version' is distinct from '1'::jsonb then raise exception 'CATALOGO_ESQUEMA'; end if;
 return public.guardar_catalogo(p_version,p_operacion,p_datos);
end $$;
revoke all on function public.guardar_catalogo_038(integer,uuid,jsonb) from public,anon;
grant execute on function public.guardar_catalogo_038(integer,uuid,jsonb) to authenticated;

alter function public.leer_catalogo(uuid) rename to leer_catalogo_base_038;
revoke all on function public.leer_catalogo_base_038(uuid) from public,anon,authenticated;
create function public.leer_catalogo(p_oportunidad uuid default null) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare r jsonb; d jsonb; salida jsonb;
begin
 r:=public.leer_catalogo_base_038(p_oportunidad);
 select datos into d from public.versiones_catalogo order by version desc limit 1;
 if d->'moneda_productos_version' is distinct from '1'::jsonb then return r; end if;
 select coalesce(jsonb_agg(case when i->>'tipo'='adicional' then i||jsonb_build_object('moneda_referencia',
  (select x->'moneda_referencia' from jsonb_array_elements(d->'items') x where x->>'id'=i->>'id')) else i end),'[]')
 into salida from jsonb_array_elements(r->'datos'->'items') i;
 return jsonb_set(r,'{datos}',(r->'datos')||jsonb_build_object('moneda_productos_version',1,'items',salida));
end $$;
revoke all on function public.leer_catalogo(uuid) from public,anon;
grant execute on function public.leer_catalogo(uuid) to authenticated;

alter function privado.calcular_propuesta(jsonb,jsonb,boolean) rename to calcular_propuesta_base_038;
revoke all on function privado.calcular_propuesta_base_038(jsonb,jsonb,boolean) from public,anon,authenticated;
create function privado.calcular_propuesta(p_catalogo jsonb,p_seleccion jsonb,p_telefonico boolean) returns jsonb
language plpgsql set search_path='' as $$
declare cambio public.cotizaciones_dolar; i jsonb; items jsonb:='[]'; campo text; n text; v text; p jsonb; importe numeric; r jsonb; salida jsonb;
begin
 if p_catalogo->'moneda_productos_version' is distinct from '1'::jsonb then
  return privado.calcular_propuesta_base_038(p_catalogo,p_seleccion,p_telefonico);
 end if;
 if exists(select 1 from jsonb_array_elements(p_catalogo->'items') x
  join jsonb_array_elements(p_seleccion->'extras') e on e->>'item_id'=x->>'id'
  where x->>'moneda_referencia'='USD' and x->>'tipo'='adicional') then
  select * into cambio from public.cotizaciones_dolar where id=(p_seleccion->>'tipo_cambio_id')::uuid;
  if cambio.id is null or cambio.consultado_en<now()-interval '30 minutes' then raise exception 'PROPUESTA_DOLAR'; end if;
 end if;
 for i in select * from jsonb_array_elements(p_catalogo->'items') loop
  if i->>'tipo'='adicional' and i->>'moneda_referencia'='USD'
   and exists(select 1 from jsonb_array_elements(p_seleccion->'extras') e where e->>'item_id'=i->>'id') then
   foreach campo in array array['precios','precios_pack_2'] loop
    p:='{}';
    for n,v in select * from jsonb_each_text(coalesce(i->(campo||'_usd'),'{}')) loop
     importe:=round(v::numeric*cambio.venta,6);
     if campo='precios_pack_2' then importe:=least(importe,2*(i->'precios'->>n)::numeric); end if;
     if importe>=1000000000000 then raise exception 'PROPUESTA_PRECIO'; end if;
     p:=p||jsonb_build_object(n,importe::text);
    end loop;
    i:=jsonb_set(i,array[campo],p);
   end loop;
  end if;
  items:=items||jsonb_build_array(i);
 end loop;
 -- El motor recibe importes ARS: conserva bolsa, piso, packs y restricciones.
 r:=privado.calcular_propuesta_base_038(p_catalogo||jsonb_build_object('moneda_adicionales','ARS','items',items),p_seleccion,p_telefonico);
 select coalesce(jsonb_agg(e||jsonb_build_object('moneda_referencia',
  (select x->>'moneda_referencia' from jsonb_array_elements(p_catalogo->'items') x where x->>'id'=e->>'item_id'))),'[]')
 into salida from jsonb_array_elements(r->'extras') e;
 return r||jsonb_build_object('extras',salida,'moneda_productos_version',1,'tipo_cambio',case when cambio.id is null then null else
  jsonb_build_object('id',cambio.id,'venta',cambio.venta::text,'fechaActualizacion',cambio.fecha_fuente,'consultado_en',cambio.consultado_en,'fuente','Dólar oficial · venta') end);
end $$;
revoke all on function privado.calcular_propuesta(jsonb,jsonb,boolean) from public,anon,authenticated;
commit;
