begin;
alter table public.cotizaciones_dolar add column proveedor text not null default 'dolarapi'
 check(proveedor in ('monedapi','dolarapi'));
alter table public.cotizaciones_dolar drop constraint cotizaciones_dolar_fecha_fuente_venta_key;
alter table public.cotizaciones_dolar add unique(proveedor,fecha_fuente,venta);

create function public.registrar_cotizacion_dolar_037(p_venta text,p_fecha timestamptz,p_proveedor text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.cotizaciones_dolar;
begin
 if p_proveedor is null or p_proveedor not in ('monedapi','dolarapi') or p_venta is null or p_venta !~ '^[0-9]{1,8}(\.[0-9]{1,6})?$' or p_venta::numeric<=0 or p_fecha is null or p_fecha>now()+interval '5 minutes' then raise exception 'DOLAR_DATOS'; end if;
 perform pg_advisory_xact_lock(740129);
 if exists(select 1 from public.cotizaciones_dolar where proveedor=p_proveedor and fecha_fuente>p_fecha) then raise exception 'DOLAR_ATRASADO'; end if;
 insert into public.cotizaciones_dolar(venta,fecha_fuente,proveedor) values(p_venta::numeric,p_fecha,p_proveedor)
 on conflict(proveedor,fecha_fuente,venta) do update set consultado_en=now() returning * into r;
 return jsonb_build_object('id',r.id,'venta',r.venta::text,'fechaActualizacion',r.fecha_fuente,'consultado_en',r.consultado_en,'proveedor',r.proveedor);
end $$;
revoke all on function public.registrar_cotizacion_dolar_037(text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.registrar_cotizacion_dolar_037(text,timestamptz,text) to service_role;

-- Compatibilidad con la función anterior durante el despliegue.
create or replace function public.registrar_cotizacion_dolar(p_venta text,p_fecha timestamptz) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 return public.registrar_cotizacion_dolar_037(p_venta,p_fecha,'dolarapi');
end $$;

-- Los snapshots nuevos describen correctamente la referencia; los históricos no cambian.
alter function privado.calcular_propuesta(jsonb,jsonb,boolean) rename to calcular_propuesta_base_037;
revoke all on function privado.calcular_propuesta_base_037(jsonb,jsonb,boolean) from public,anon,authenticated;
create function privado.calcular_propuesta(p_catalogo jsonb,p_seleccion jsonb,p_telefonico boolean) returns jsonb
language plpgsql set search_path='' as $$
declare r jsonb;
begin
 r:=privado.calcular_propuesta_base_037(p_catalogo,p_seleccion,p_telefonico);
 if jsonb_typeof(r->'tipo_cambio')='object' then
  r:=jsonb_set(r,'{tipo_cambio,fuente}',to_jsonb('Dólar oficial · venta'::text));
 end if;
 return r;
end $$;
revoke all on function privado.calcular_propuesta(jsonb,jsonb,boolean) from public,anon,authenticated;
commit;
