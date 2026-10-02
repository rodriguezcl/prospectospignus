-- Entrega 2: propuestas ofrecidas inmutables. La aceptación se integra en entrega 3.
-- Aditiva: no modifica importes, estados ni fechas del histórico comercial.
begin;
create table public.propuestas_comerciales (
 id uuid primary key,
 oportunidad_id uuid not null references public.oportunidades(id),
 ciclo integer not null,
 version_oportunidad integer not null,
 catalogo_version integer not null references public.versiones_catalogo(version),
 condiciones_version integer not null,
 actor_id uuid not null references public.perfiles(id),
 responsable_id uuid not null references public.perfiles(id),
 solicitud jsonb not null,
 detalle jsonb not null,
 restringida boolean not null,
 creado_en timestamptz not null default now()
);
create index propuestas_caso on public.propuestas_comerciales(oportunidad_id,ciclo,creado_en desc);
alter table public.propuestas_comerciales enable row level security;
revoke all on public.propuestas_comerciales from public,anon,authenticated;
grant select on public.propuestas_comerciales to authenticated;
create policy propuestas_lectura on public.propuestas_comerciales for select to authenticated using(
 privado.puede_ver_oportunidad(oportunidad_id) and (not restringida or privado.es_administrador() or exists(select 1 from public.perfiles p where p.id=auth.uid() and p.activo and p.rol='agente' and p.id=propuestas_comerciales.responsable_id))
);

create function privado.calcular_propuesta(p_catalogo jsonb,p_seleccion jsonb,p_telefonico boolean) returns jsonb
language plpgsql set search_path='' as $$
declare f jsonb; k jsonb; e jsonb; i jsonb; nivel text:=p_seleccion->>'nivel'; incluido boolean;
 base numeric:=0; bolsa numeric:=0; consumo numeric:=0; piso numeric:=0; total numeric:=0;
 cantidad numeric; gratis integer; altos integer; bajos integer; telefonos integer; parcial numeric; lista jsonb:='[]';
begin
 select x into f from jsonb_array_elements(p_catalogo->'familias') x where x->>'id'=p_seleccion->>'familia_id' and x->>'estado'='activo';
 if f is null then raise exception 'PROPUESTA_COMPOSICION'; end if;
 if f->>'servicio'='alarma' then
  if coalesce(p_seleccion->>'subcategoria','') not in ('docta','nobu','con_monitoreo','sin_monitoreo') or coalesce(nivel,'') not in ('catalogo','alto','medio','bajo','telefonico') then raise exception 'PROPUESTA_COMPOSICION'; end if;
 elsif nivel is distinct from 'unico' then raise exception 'PROPUESTA_NIVEL'; end if;
 if nivel='telefonico' and not p_telefonico then raise exception 'PROPUESTA_NIVEL'; end if;
 incluido:=f->>'servicio'='alarma' and p_seleccion->>'subcategoria' in ('docta','nobu');
 if f->>'servicio'<>'cerco' then
  select x into k from jsonb_array_elements(p_catalogo->'items') x where x->>'id'=p_seleccion->>'kit_id' and x->>'familia_id'=f->>'id' and x->>'tipo'='kit' and x->>'estado'='activo';
  if k is null then raise exception 'PROPUESTA_COMPOSICION'; end if;
  base:=case when incluido then 0 else (k->'precios'->>nivel)::numeric end;
  if base is null then raise exception 'PROPUESTA_PRECIO'; end if;
  if f->>'servicio'='alarma' and not incluido and nivel<>'telefonico' then
   piso:=(k->'precios'->>'bajo')::numeric; bolsa:=base-piso;
  end if;
 end if;
 if jsonb_typeof(p_seleccion->'extras') is distinct from 'array' or jsonb_array_length(p_seleccion->'extras')>100 then raise exception 'PROPUESTA_COMPOSICION'; end if;
 if exists(select 1 from jsonb_array_elements(p_seleccion->'extras') x group by x->>'item_id' having count(*)>1) then raise exception 'PROPUESTA_COMPOSICION'; end if;
 total:=base;
 for e in select * from jsonb_array_elements(p_seleccion->'extras') loop
  select x into i from jsonb_array_elements(p_catalogo->'items') x where x->>'id'=e->>'item_id' and x->>'familia_id'=f->>'id' and x->>'tipo'<>'kit' and x->>'estado'='activo';
  if i is null or (jsonb_array_length(i->'kits_compatibles')>0 and not (i->'kits_compatibles' ? (k->>'id'))) then raise exception 'PROPUESTA_COMPOSICION'; end if;
  if coalesce(e->>'cantidad','') !~ '^[0-9]+(\.[0-9]{1,3})?$' then raise exception 'PROPUESTA_CANTIDAD'; end if;
  cantidad:=(e->>'cantidad')::numeric;
  if cantidad<=0 or cantidad>9999 or (i->>'unidad'<>'metro' and cantidad<>trunc(cantidad)) then raise exception 'PROPUESTA_CANTIDAD'; end if;
  if f->>'servicio'='alarma' then
   if coalesce(e->>'bonificados','') !~ '^[0-9]{1,4}$' or coalesce(e->>'altos','') !~ '^[0-9]{1,4}$' or coalesce(e->>'bajos','') !~ '^[0-9]{1,4}$' or coalesce(e->>'telefonicos','') !~ '^[0-9]{1,4}$' then raise exception 'PROPUESTA_CANTIDAD'; end if;
   gratis:=(e->>'bonificados')::integer; altos:=(e->>'altos')::integer; bajos:=(e->>'bajos')::integer; telefonos:=(e->>'telefonicos')::integer;
   if gratis+altos+bajos+telefonos<>cantidad or (telefonos>0 and (not p_telefonico or nivel<>'telefonico')) or (gratis>0 and (incluido or nivel='telefonico')) then raise exception 'PROPUESTA_NIVEL'; end if;
   parcial:=altos*(i->'precios'->>'alto')::numeric+bajos*(i->'precios'->>'bajo')::numeric+telefonos*(i->'precios'->>'telefonico')::numeric;
   consumo:=consumo+gratis*(i->'precios'->>'bajo')::numeric;
   if not incluido and nivel<>'telefonico' then piso:=piso+cantidad*(i->'precios'->>'bajo')::numeric; end if;
  else
   if coalesce(e->>'bonificados','0')<>'0' or coalesce(e->>'nivel','')<>'unico' then raise exception 'PROPUESTA_NIVEL'; end if;
   parcial:=cantidad*(i->'precios'->>'unico')::numeric;
  end if;
  if parcial is null then raise exception 'PROPUESTA_PRECIO'; end if;
  total:=total+parcial;
  lista:=lista||jsonb_build_array(jsonb_build_object('item_id',i->>'id','nombre',i->>'nombre','codigo',i->>'codigo','tipo',i->>'tipo','unidad',i->>'unidad','cantidad',cantidad,'distribucion',e,'importe_exacto',parcial::text));
 end loop;
 if consumo>bolsa or total<piso then raise exception 'PROPUESTA_BONIFICACION'; end if;
 if f->>'servicio'='cerco' and (not exists(select 1 from jsonb_array_elements(lista) x where x->>'tipo'='adicional') or not exists(select 1 from jsonb_array_elements(lista) x where x->>'tipo'='mano_obra')) then raise exception 'PROPUESTA_COMPOSICION'; end if;
 return jsonb_build_object('servicio',f->>'servicio','familia',f->>'nombre','marca',f->>'marca','kit',case when k is null then null else jsonb_build_object('id',k->>'id','nombre',k->>'nombre','incluidos',k->'incluidos','importe_exacto',base::text) end,'incluido_expensas',incluido,'extras',lista,'total_exacto',total::text);
end $$;
revoke all on function privado.calcular_propuesta(jsonb,jsonb,boolean) from public,anon,authenticated;

-- Reparte centavos, no tarifas. Los restos se asignan por peso y clave estable.
create function privado.repartir_descuento(p_partes jsonb,p_descuento numeric) returns jsonb
language sql immutable set search_path='' as $$
 with partes as (
  select x->>'clave' clave,x->>'tipo' tipo,(x->>'importe_exacto')::numeric importe from jsonb_array_elements(p_partes) x
 ), pesos as (
  select *,sum(importe) over() suma from partes
 ), exactos as (
  select *,importe*100 bruto,case when suma=0 then 0 else p_descuento*100*importe/suma end descuento from pesos
 ), restos as (
  select *,floor(bruto) bruto_base,floor(descuento) descuento_base,
   row_number() over(order by bruto-floor(bruto) desc,clave) orden_bruto,
   row_number() over(order by descuento-floor(descuento) desc,clave) orden_descuento,
   round(suma*100)-sum(floor(bruto)) over() sobrante_bruto,
   round(p_descuento*100)-sum(floor(descuento)) over() sobrante_descuento from exactos
 ), importes as (
  select *,bruto_base+case when orden_bruto<=sobrante_bruto then 1 else 0 end bruto_cent,
   descuento_base+case when orden_descuento<=sobrante_descuento then 1 else 0 end descuento_cent from restos
 ) select coalesce(jsonb_agg(jsonb_build_object('clave',clave,'tipo',tipo,'importe_exacto',importe::text,
   'bruto',round(bruto_cent/100,2)::text,'descuento',round(descuento_cent/100,2)::text,
   'neto',round((bruto_cent-descuento_cent)/100,2)::text) order by clave),'[]') from importes;
$$;
revoke all on function privado.repartir_descuento(jsonb,numeric) from public,anon,authenticated;

create function public.guardar_propuesta(p_id uuid,p_oportunidad uuid,p_version integer,p_catalogo integer,p_condiciones integer,p_datos jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor public.perfiles; o public.oportunidades; existente public.propuestas_comerciales;
 catalogo public.versiones_catalogo; configuracion jsonb; solicitud jsonb; detalle jsonb; seleccion jsonb; concepto jsonb; conceptos jsonb:='[]'; abono_total numeric:=0; tiene_abono boolean:=false;
 telefonico boolean; base numeric; total numeric; abono numeric; kit jsonb; nivel_abono text:=p_datos->>'nivel_abono';
 meses integer; cuotas integer; importe_cuota numeric; ultima numeric; medio text:=p_datos->'pago'->>'medio_saldo';
 base_efectivo numeric; descuento numeric; saldo numeric; restringida boolean:=false; ordinal integer;
 partes jsonb:='[]'; reparto jsonb; componente jsonb; numero integer:=0;
begin
 perform pg_advisory_xact_lock(740127);
 select * into actor from public.perfiles where id=auth.uid() and activo;
 if not found then raise exception 'PROPUESTA_ACCESO'; end if;
 if p_id is null or p_oportunidad is null or p_version is null or p_catalogo is null or p_condiciones is null or jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'PROPUESTA_DATOS'; end if;
 solicitud:=jsonb_build_object('oportunidad',p_oportunidad,'version',p_version,'catalogo',p_catalogo,'condiciones',p_condiciones,'datos',p_datos);
 select * into existente from public.propuestas_comerciales where id=p_id;
 if found then
  if existente.actor_id=actor.id and existente.solicitud=solicitud then return p_id; end if;
  raise exception 'PROPUESTA_CONFLICTO';
 end if;
 select * into o from public.oportunidades where id=p_oportunidad for update;
 if o.id is null or (actor.rol<>'administrador' and o.responsable_id is distinct from actor.id) or o.responsable_id is null
 or o.estado in ('ganada','perdida') or (actor.rol='vendedor' and o.estado='recuperacion') or (actor.rol='agente' and o.estado<>'recuperacion') then raise exception 'PROPUESTA_ACCESO'; end if;
 if o.version<>p_version then raise exception 'PROPUESTA_CONFLICTO'; end if;
 select * into catalogo from public.versiones_catalogo order by version desc limit 1;
 configuracion:=public.leer_condiciones();
 if catalogo.version is distinct from p_catalogo or (configuracion->>'version')::integer<>p_condiciones then raise exception 'PROPUESTA_VIGENCIA'; end if;
 telefonico:=o.estado='recuperacion' and actor.rol in ('agente','administrador');
 if jsonb_typeof(p_datos->'conceptos') is distinct from 'array' or jsonb_array_length(p_datos->'conceptos') not between 1 and 10 then raise exception 'PROPUESTA_COMPOSICION'; end if;
 base:=0;
 for concepto in select * from jsonb_array_elements(p_datos->'conceptos') loop
 seleccion:=concepto->'seleccion'; nivel_abono:=concepto->>'nivel_abono'; abono:=null;
 detalle:=privado.calcular_propuesta(catalogo.datos,seleccion,telefonico);
 base:=base+(detalle->>'total_exacto')::numeric;
 if coalesce(concepto->>'ordinal','') !~ '^[0-9]{1,5}$' or (concepto->>'ordinal')::integer not between 1 and 50000 then raise exception 'PROPUESTA_DATOS'; end if;
 ordinal:=(concepto->>'ordinal')::integer;
 restringida:=restringida or seleccion->>'nivel'='telefonico' or coalesce(nivel_abono='telefonico',false);
 if coalesce(concepto->>'meses_congelamiento','') !~ '^[0-9]{1,2}$' then raise exception 'PROPUESTA_CONGELAMIENTO'; end if;
 meses:=(concepto->>'meses_congelamiento')::integer;
 if detalle->>'servicio'='alarma' and seleccion->>'subcategoria'='con_monitoreo' then
  if coalesce(nivel_abono,'') not in ('alto','medio','bajo','telefonico') or (nivel_abono='telefonico' and not telefonico) then raise exception 'PROPUESTA_NIVEL'; end if;
  select x into kit from jsonb_array_elements(catalogo.datos->'items') x where x->>'id'=seleccion->>'kit_id';
  abono:=(kit->'abonos'->>nivel_abono)::numeric;
  if abono is null then raise exception 'PROPUESTA_PRECIO'; end if;
  if meses>0 and (not ((configuracion->'datos'->'meses_congelamiento') @> to_jsonb(array[meses]))
   or (actor.rol<>'administrador' and configuracion->'datos'->>('congelamiento_'||actor.rol) is distinct from 'true')) then raise exception 'PROPUESTA_CONGELAMIENTO'; end if;
  abono_total:=abono_total+abono; tiene_abono:=true;
 elsif meses<>0 or coalesce(nivel_abono,'')<>'' then raise exception 'PROPUESTA_CONGELAMIENTO'; end if;
 conceptos:=conceptos||jsonb_build_array(detalle||jsonb_build_object('seleccion',seleccion,'ordinal_declarado',ordinal,'abono',case when abono is null then null else abono::text end,'nivel_abono',nivel_abono,'meses_congelamiento',meses));
 numero:=numero+1;
 if detalle->'kit'<>'null'::jsonb then partes:=partes||jsonb_build_array(jsonb_build_object('clave',lpad(numero::text,2,'0')||'-kit','tipo','instalacion','importe_exacto',detalle->'kit'->>'importe_exacto')); end if;
 for componente in select * from jsonb_array_elements(detalle->'extras') loop
  partes:=partes||jsonb_build_array(jsonb_build_object('clave',lpad(numero::text,2,'0')||'-'||(componente->>'item_id'),'tipo',case when componente->>'tipo'='mano_obra' then 'instalacion' else 'adicional' end,'importe_exacto',componente->>'importe_exacto'));
 end loop;
 end loop;
 if medio not in ('debito','transferencia','credito') or medio is null or coalesce(p_datos->'pago'->>'cuotas','') !~ '^[136]$' then raise exception 'PROPUESTA_PAGO'; end if;
 cuotas:=(p_datos->'pago'->>'cuotas')::integer;
 if medio<>'credito' and cuotas<>1 then raise exception 'PROPUESTA_PAGO'; end if;
 if coalesce(p_datos->'pago'->>'base_efectivo','') !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$' then raise exception 'PROPUESTA_PAGO'; end if;
 base_efectivo:=(p_datos->'pago'->>'base_efectivo')::numeric;
 if base_efectivo>round(base,2) then raise exception 'PROPUESTA_PAGO'; end if;
 descuento:=round(base_efectivo*0.1,2); saldo:=round(base,2)-base_efectivo; total:=round(base,2)-descuento;
 importe_cuota:=trunc(saldo/cuotas,2);ultima:=saldo-importe_cuota*(cuotas-1);
 reparto:=privado.repartir_descuento(partes,descuento);
 detalle:=jsonb_build_object('codigo','PC-'||p_id::text,'conceptos',conceptos,'base',round(base,2)::text,'base_exacta',base::text,'pago',jsonb_build_object('base_efectivo',base_efectivo::text,'efectivo_a_abonar',(base_efectivo-descuento)::text,'medio_saldo',medio,'saldo',saldo::text,'cantidad_cuotas',cuotas,'cuota',importe_cuota::text,'ultima_cuota',ultima::text),'total',total::text,'descuento_pago',descuento::text,'abono',case when tiene_abono then round(abono_total,2)::text else null end,'reparto_descuento_conceptos',case when descuento>0 then 'pendiente_de_criterio' else 'no_corresponde' end);
 detalle:=detalle||jsonb_build_object('reparto_descuento_conceptos','proporcional_mayores_restos','componentes_netos',reparto);
 insert into public.propuestas_comerciales values(p_id,o.id,o.ciclo,o.version,p_catalogo,p_condiciones,actor.id,o.responsable_id,solicitud,detalle,restringida,now());
 -- Incrementa versión para invalidar formularios y serializar oferta/cierre.
 update public.oportunidades set version=version+1,actualizado_en=now() where id=o.id;
 return p_id;
end $$;
revoke all on function public.guardar_propuesta(uuid,uuid,integer,integer,integer,jsonb) from public,anon;
grant execute on function public.guardar_propuesta(uuid,uuid,integer,integer,integer,jsonb) to authenticated;

create function privado.proteger_autoria_propuesta() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.propuestas_comerciales where actor_id=old.id or responsable_id=old.id) then raise exception 'CUENTA_VINCULADA'; end if; return old;
end $$;
revoke all on function privado.proteger_autoria_propuesta() from public,anon,authenticated;
create trigger proteger_autoria_propuesta before delete on public.perfiles for each row execute function privado.proteger_autoria_propuesta();
commit;
