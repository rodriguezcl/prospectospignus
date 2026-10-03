-- Referencia opaca y permanente; los snapshots y UUID originales se conservan.
begin;
alter table public.propuestas_comerciales add column codigo_interno text;
create unique index propuestas_codigo_interno on public.propuestas_comerciales(codigo_interno);

create function privado.codigo_propuesta_aleatorio() returns text
language plpgsql volatile set search_path='' as $$
declare
 alfabeto constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
 numero bigint := ('x'||substr(replace(gen_random_uuid()::text,'-',''),1,10))::bit(40)::bigint;
 codigo text := '';
begin
 for i in 1..8 loop
  codigo := substr(alfabeto,(numero % 32)::integer+1,1)||codigo;
  numero := numero / 32;
 end loop;
 return 'P-'||substr(codigo,1,4)||'-'||substr(codigo,5,4);
end $$;

create function privado.asignar_codigo_propuesta() returns trigger
language plpgsql set search_path='' as $$
begin
 if TG_OP='UPDATE' then
  if old.codigo_interno is not null then
   if new.codigo_interno is distinct from old.codigo_interno then
    raise exception 'PROPUESTA_CODIGO_INMUTABLE';
   end if;
   return new;
  end if;
 end if;
 -- Serializa la asignación; la restricción UNIQUE es la última garantía.
 perform pg_advisory_xact_lock(740128);
 loop
  new.codigo_interno := privado.codigo_propuesta_aleatorio();
  exit when not exists(select 1 from public.propuestas_comerciales where codigo_interno=new.codigo_interno);
 end loop;
 return new;
end $$;
revoke all on function privado.codigo_propuesta_aleatorio() from public,anon,authenticated;
revoke all on function privado.asignar_codigo_propuesta() from public,anon,authenticated;
create trigger asignar_codigo_interno before insert or update of codigo_interno
 on public.propuestas_comerciales for each row execute function privado.asignar_codigo_propuesta();

-- Solo agrega la referencia; no modifica detalle, solicitud, fechas ni precios.
update public.propuestas_comerciales set codigo_interno=null where codigo_interno is null;
alter table public.propuestas_comerciales alter column codigo_interno set not null;
alter table public.propuestas_comerciales add constraint propuesta_codigo_formato
 check(codigo_interno ~ '^P-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$');

-- Mismos permisos y snapshot aceptado de 016; añade la referencia en la lectura.
create or replace function public.detalle_venta(p_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o public.oportunidades; propuesta jsonb; activacion public.activaciones_ventas; plazos jsonb;
begin
 select * into o from public.oportunidades where id=p_id and estado='ganada';
 if o.id is null or not exists(select 1 from public.perfiles where id=auth.uid() and activo and (rol='administrador' or id=o.cerrado_por)) then raise exception 'VENTAS_ACCESO'; end if;
 select p.detalle||jsonb_build_object('codigo_interno',p.codigo_interno) into propuesta from public.ciclos_comerciales c join public.propuestas_comerciales p on p.id=c.propuesta_aceptada_id where c.oportunidad_id=o.id and c.ciclo=o.ciclo;
 select * into activacion from public.activaciones_ventas where oportunidad_id=o.id;
 select coalesce(jsonb_agg(jsonb_build_object('concepto',x->>'familia','meses',x->>'meses_congelamiento',
 'hasta_inclusive',privado.fin_congelamiento(activacion.fecha,(x->>'meses_congelamiento')::integer))), '[]') into plazos
 from jsonb_array_elements(propuesta->'conceptos') x where x->>'abono' is not null;
 return jsonb_build_object('oportunidad_id',o.id,'ciclo',o.ciclo,'propuesta',propuesta,
 'activacion',case when activacion.oportunidad_id is null then null else to_jsonb(activacion) end,
 'congelamientos',plazos,'historial',coalesce((select jsonb_agg(to_jsonb(e) order by e.ocurrido_en desc) from public.eventos_activacion e where oportunidad_id=o.id),'[]'));
end $$;
revoke all on function public.detalle_venta(uuid) from public,anon;
grant execute on function public.detalle_venta(uuid) to authenticated;
commit;
