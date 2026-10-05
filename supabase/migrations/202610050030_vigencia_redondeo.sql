begin;
-- Dentro del plazo se respeta el snapshot ofrecido, aunque cambien las listas.
-- La derivación conserva la propuesta como contexto, incluso vencida.
do $$
declare definicion text; anterior text;
begin
 definicion:=pg_get_functiondef('public.gestionar_oportunidad_base_v17(uuid,integer,uuid,text,jsonb)'::regprocedure);
 anterior:='if propuesta.catalogo_version<>(select max(version) from public.versiones_catalogo) or propuesta.condiciones_version<>(configuracion->>''version'')::integer then raise exception ''PROPUESTA_VIGENCIA''; end if;';
 if strpos(definicion,anterior)=0 then raise exception 'MIGRACION_VIGENCIA_INCOMPATIBLE'; end if;
 definicion:=replace(definicion,anterior,'if p_accion=''ganar'' and clock_timestamp()>=propuesta.creado_en+interval ''120 hours'' then raise exception ''PROPUESTA_VENCIDA''; end if;');
 execute definicion;
end $$;


create or replace function public.guardar_propuesta(p_id uuid,p_oportunidad uuid,p_version integer,p_catalogo integer,p_condiciones integer,p_datos jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare actor public.perfiles; o public.oportunidades; existente public.propuestas_comerciales;
 catalogo public.versiones_catalogo; configuracion jsonb; solicitud jsonb; detalle jsonb; seleccion jsonb; concepto jsonb; conceptos jsonb:='[]'; abono_total numeric:=0; tiene_abono boolean:=false;
 telefonico boolean; base numeric; total numeric; abono numeric; kit jsonb; nivel_abono text:=p_datos->>'nivel_abono';
 meses integer; cuotas integer; importe_cuota numeric; ultima numeric; medio text:=p_datos->'pago'->>'medio_saldo';
 base_efectivo numeric; descuento numeric; saldo numeric; ajuste_redondeo numeric; redondeo_manual numeric; rebaja_efectivo numeric; restringida boolean:=false; ordinal integer;
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
 restringida:=restringida or (seleccion->>'nivel'='telefonico' and not coalesce(catalogo.datos->>'esquema' in ('4','5','6') and detalle->>'modalidad'='kit',false)) or coalesce(nivel_abono='telefonico',false);
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
 if coalesce(p_datos->'pago'->>'redondeo_manual','0') !~ '^(0|[1-9][0-9]{0,11})(\.[0-9]{1,2})?$' then raise exception 'PROPUESTA_REDONDEO'; end if;
 redondeo_manual:=coalesce(p_datos->'pago'->>'redondeo_manual','0')::numeric;
 if redondeo_manual>trunc(total*coalesce(configuracion->'datos'->>'redondeo_maximo_porcentaje','1')::numeric/100,2) then raise exception 'PROPUESTA_REDONDEO'; end if;
 rebaja_efectivo:=least(redondeo_manual,base_efectivo-descuento);
 saldo:=saldo-(redondeo_manual-rebaja_efectivo); total:=total-redondeo_manual;
 importe_cuota:=trunc(saldo/cuotas,2); ultima:=importe_cuota;
 ajuste_redondeo:=saldo-importe_cuota*cuotas; saldo:=importe_cuota*cuotas; total:=total-ajuste_redondeo;
 reparto:=privado.repartir_descuento(partes,descuento+ajuste_redondeo+redondeo_manual);
 detalle:=jsonb_build_object('codigo','PC-'||p_id::text,'conceptos',conceptos,'base',round(base,2)::text,'base_exacta',base::text,'pago',jsonb_build_object('base_efectivo',base_efectivo::text,'efectivo_a_abonar',(base_efectivo-descuento-rebaja_efectivo)::text,'medio_saldo',medio,'saldo',saldo::text,'cantidad_cuotas',cuotas,'cuota',importe_cuota::text,'ultima_cuota',ultima::text),'total',total::text,'descuento_pago',(descuento+ajuste_redondeo+redondeo_manual)::text,'descuento_efectivo',descuento::text,'redondeo_manual',redondeo_manual::text,'ajuste_redondeo',ajuste_redondeo::text,'abono',case when tiene_abono then round(abono_total,2)::text else null end,'reparto_descuento_conceptos',case when descuento>0 then 'pendiente_de_criterio' else 'no_corresponde' end);
 detalle:=detalle||jsonb_build_object('reparto_descuento_conceptos','proporcional_mayores_restos','componentes_netos',reparto);
 insert into public.propuestas_comerciales values(p_id,o.id,o.ciclo,o.version,p_catalogo,p_condiciones,actor.id,o.responsable_id,solicitud,detalle,restringida,now());
 -- Incrementa versión para invalidar formularios y serializar oferta/cierre.
 update public.oportunidades set version=version+1,actualizado_en=now() where id=o.id;
 return p_id;
end $$;
revoke all on function public.guardar_propuesta(uuid,uuid,integer,integer,integer,jsonb) from public,anon;
grant execute on function public.guardar_propuesta(uuid,uuid,integer,integer,integer,jsonb) to authenticated;
create function public.guardar_propuesta_030(p_id uuid,p_oportunidad uuid,p_version integer,p_catalogo integer,p_condiciones integer,p_datos jsonb) returns uuid
language sql security invoker set search_path='' as $$
 select public.guardar_propuesta(p_id,p_oportunidad,p_version,p_catalogo,p_condiciones,p_datos)
$$;
revoke all on function public.guardar_propuesta_030(uuid,uuid,integer,integer,integer,jsonb) from public,anon;
grant execute on function public.guardar_propuesta_030(uuid,uuid,integer,integer,integer,jsonb) to authenticated;

-- Condiciones versionadas: el porcentaje es administrativo y no viene del vendedor.
do $config$
declare definicion text;
begin
 select pg_get_functiondef('public.guardar_condiciones(integer,uuid,jsonb)'::regprocedure) into definicion;
 definicion:=replace(definicion,
  'if actual<>p_version then raise exception ''CATALOGO_CONFLICTO''; end if;',
  'if actual<>p_version then raise exception ''CATALOGO_CONFLICTO''; end if;
   if coalesce(p_datos->>''redondeo_maximo_porcentaje'',''1'') !~ ''^(0|[1-9][0-9]{0,2})(\.[0-9]{1,2})?$'' then raise exception ''CATALOGO_CONDICIONES''; end if;
   if coalesce(p_datos->>''redondeo_maximo_porcentaje'',''1'')::numeric>100 then raise exception ''CATALOGO_CONDICIONES''; end if;
   if (p_datos ? ''redondeo_maximo_porcentaje'' and p_datos->''redondeo_maximo_porcentaje''=''null''::jsonb)
     or (not (p_datos ? ''redondeo_maximo_porcentaje'') and exists(select 1 from public.versiones_condiciones where version=actual and datos ? ''redondeo_maximo_porcentaje''))
   then raise exception ''CATALOGO_CONDICIONES''; end if;');
 execute definicion;
end $config$;

alter function public.leer_condiciones() rename to leer_condiciones_base_030;
revoke all on function public.leer_condiciones_base_030() from public,anon,authenticated;
create function public.leer_condiciones() returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare resultado jsonb;
begin
 resultado:=public.leer_condiciones_base_030();
 return jsonb_set(resultado,'{datos}',jsonb_build_object('redondeo_maximo_porcentaje','1')||(resultado->'datos'));
end $$;
revoke all on function public.leer_condiciones() from public,anon;
grant execute on function public.leer_condiciones() to authenticated;

commit;
