-- Plantilla del operador. La entrada se genera localmente; nunca versionar datos personales.
begin;
create temporary table entrada_historica(datos jsonb) on commit drop;
alter table entrada_historica enable row level security;
revoke all on entrada_historica from public,anon,authenticated;
insert into entrada_historica values (__ENTRADA_JSON__::jsonb);
do $$
declare
 entrada jsonb; fila jsonb; existente public.registros_iniciales;
 registro public.registros_iniciales; oportunidad public.oportunidades;
 administrador uuid; vendedor uuid; registro_id uuid; prospecto_id uuid; oportunidad_id uuid;
 lote text; huella text; mes date; estado text; nota text;
begin
 perform pg_advisory_xact_lock(740127);
 select datos into entrada from entrada_historica;
 administrador := (entrada->>'administrador')::uuid;
 lote := entrada->>'lote'; huella := entrada->>'sha256'; mes := (entrada->>'mes')::date;
 if not exists(select 1 from public.perfiles where id=administrador and activo and rol='administrador') then raise exception 'IMPORTACION_ADMINISTRADOR'; end if;
 if extract(day from mes)<>1 or lote is null or huella !~ '^[0-9a-f]{64}$'
   or jsonb_array_length(entrada->'filas')<>(entrada->>'total')::int
   or (select count(*) from jsonb_array_elements(entrada->'filas') f where f->>'estado'='ganada')<>(entrada->>'ganadas')::int
   then raise exception 'IMPORTACION_CONTROL'; end if;
 if exists(select 1 from public.registros_iniciales where importacion_historica->>'lote'=lote and importacion_historica->>'sha256' is distinct from huella) then raise exception 'IMPORTACION_ARCHIVO_CAMBIADO'; end if;
 for fila in select value from jsonb_array_elements(entrada->'filas') loop
   vendedor := (entrada->'vendedores'->>(fila->>'vendedor'))::uuid;
   if not exists(select 1 from public.perfiles where id=vendedor and activo and rol='vendedor' and upper(trim(nombre))=upper(trim(fila->>'vendedor'))) then raise exception 'IMPORTACION_VENDEDOR'; end if;
   estado := fila->>'estado';
   if estado not in ('ganada','perdida') then raise exception 'IMPORTACION_ESTADO'; end if;
   registro_id := md5(lote||':'||(fila->>'fila')||':registro')::uuid;
   prospecto_id := md5(lote||':'||(fila->>'fila')||':prospecto')::uuid;
   oportunidad_id := md5(lote||':'||(fila->>'fila')||':oportunidad')::uuid;
   select * into existente from public.registros_iniciales where id=registro_id;
   if found then
     if existente.importacion_historica->>'sha256' is distinct from huella then raise exception 'IMPORTACION_CONFLICTO'; end if;
     continue; -- Reintentos no sobrescriben ediciones o reactivaciones posteriores.
   end if;
   if exists(select 1 from public.registros_iniciales where telefono=fila->>'telefono' or (correo<>'' and correo=fila->>'correo')) then raise exception 'IMPORTACION_POSIBLE_DUPLICADO'; end if;
   insert into public.registros_iniciales(id,nombre,telefono,correo,ubicacion,observaciones,origen,responsable_id,creado_por,importacion_historica)
   values(registro_id,fila->>'nombre',fila->>'telefono',fila->>'correo',fila->>'direccion',fila->>'observaciones',
     'importacion_excel',vendedor,administrador,jsonb_build_object('lote',lote,'fila',fila->>'fila','sha256',huella,
     'mes',mes,'fecha_estimada',fila->>'fecha_estimada','naturaleza_fecha','Distribución estimada',
     'responsable_original',vendedor,'resultado_original',estado)) returning * into registro;
   insert into public.eventos_registros(registro_id,actor_id,tipo,nuevo,motivo)
   values(registro_id,administrador,'registro_creado',to_jsonb(registro),'Importación retrospectiva de Excel; no es captación del día');
   insert into public.prospectos(id,registro_id,nombre,telefono,direccion,historico)
   values(prospecto_id,registro_id,registro.nombre,registro.telefono,registro.ubicacion,true);
   nota := case when estado='ganada' then 'Ganada identificada en el Excel por administración. Canal, condiciones y fecha exacta no informados.'
     else 'Perdida por clasificación histórica indicada por administración para septiembre de 2026. Motivo individual no informado; no acredita rechazo final del prospecto.' end;
   insert into public.oportunidades(id,prospecto_id,necesidad,estado,responsable_id,creado_por,cerrado_por,periodo_historico,responsable_historico_id,resumen,motivo_perdida)
   values(oportunidad_id,prospecto_id,'Necesidad comercial histórica: detalle no informado',estado,vendedor,administrador,vendedor,mes,vendedor,nota,
     case when estado='perdida' then 'no_informado_historico' end) returning * into oportunidad;
   insert into public.eventos_oportunidades(id,oportunidad_id,actor_id,tipo,solicitud,nuevo)
   values(md5(lote||':'||(fila->>'fila')||':evento')::uuid,oportunidad_id,administrador,'importacion_historica',
     jsonb_build_object('lote',lote,'fila',fila->>'fila','sha256',huella,'mes',mes,'responsable_nombre',fila->>'vendedor'),to_jsonb(oportunidad));
 end loop;
 if (select count(*) from public.registros_iniciales where importacion_historica->>'lote'=lote)<>(entrada->>'total')::int then raise exception 'IMPORTACION_TOTAL'; end if;
end $$;
commit;
