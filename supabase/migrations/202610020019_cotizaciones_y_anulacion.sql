begin;

-- Las tablas conservan sus nombres internos y sus identidades históricas.
alter table public.oportunidades drop constraint oportunidades_estado_check;
alter table public.oportunidades add constraint oportunidades_estado_check
 check(estado in ('cotizacion','visita','seguimiento','recuperacion','ganada','perdida','anulada'));
alter table public.oportunidades drop constraint oportunidades_check;
alter table public.oportunidades add constraint oportunidades_check
 check(responsable_id is not null or estado in ('recuperacion','anulada'));
alter table public.oportunidades drop constraint oportunidades_check1;
alter table public.oportunidades add constraint oportunidades_check1
 check(estado in ('cotizacion','ganada','perdida','anulada') or proxima_accion_en is not null);
alter table public.oportunidades drop constraint oportunidades_visita_actual;
alter table public.oportunidades add constraint oportunidades_visita_actual
 check(estado<>'visita' or periodo_historico is not null or (visita_en is not null and vendedor_visita_id is not null));
alter table public.oportunidades add column anulado_en timestamptz;
alter table public.oportunidades add column anulado_por uuid references public.perfiles(id);
alter table public.oportunidades add column motivo_anulacion text;
-- Preparar una propuesta no acredita una calificación ni contacto efectivo.
alter table public.prospectos drop constraint prospectos_calificacion_actual;

-- La ficha de contacto es la fuente editable. La identidad interna heredada
-- acompaña las correcciones; los snapshots de eventos permanecen inmutables.
create function privado.sincronizar_contacto_cotizaciones() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 update public.prospectos set nombre=new.nombre,telefono=coalesce(new.telefono,''),direccion=coalesce(new.ubicacion,'')
 where registro_id=new.id;
 return new;
end $$;
revoke all on function privado.sincronizar_contacto_cotizaciones() from public,anon,authenticated;
create trigger sincronizar_contacto_cotizaciones after update of nombre,telefono,ubicacion on public.registros_iniciales
for each row execute function privado.sincronizar_contacto_cotizaciones();

-- Un vendedor también encuentra el contacto de una negociación que le asignó
-- un agente. Solo lectura: las RPC de edición siguen exigiendo dueño/admin.
create policy registros_contactos_asignados on public.registros_iniciales for select to authenticated
using(privado.usuario_activo() and exists(
 select 1 from public.prospectos p join public.oportunidades o on o.prospecto_id=p.id
 where p.registro_id=registros_iniciales.id and o.estado<>'anulada'
 and (o.responsable_id=auth.uid() or o.vendedor_visita_id=auth.uid() or o.creado_por=auth.uid())
));

create function public.listar_contactos_cotizaciones(p_busqueda text default '',p_pagina integer default 0)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare salida jsonb;
begin
 if not privado.usuario_activo() then raise exception 'COMERCIAL_ACCESO'; end if;
 if p_pagina is null or p_pagina<0 or p_pagina>1000000 then raise exception 'COMERCIAL_DATOS'; end if;
 with contactos as materialized (
  select r.id,r.nombre,r.telefono,r.ubicacion,r.responsable_id,r.creado_en
  from public.registros_iniciales r where r.lote_demostracion is null
   and (coalesce(p_busqueda,'')='' or position(lower(trim(p_busqueda)) in lower(r.nombre))>0)
 ), pagina as (select * from contactos order by creado_en desc,id limit 20 offset p_pagina*20), filas as (
  select p.*,coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'necesidad',o.necesidad,'estado',o.estado,
    'responsable_id',o.responsable_id) order by o.actualizado_en desc,o.id)
   from public.oportunidades o join public.prospectos n on n.id=o.prospecto_id
   where n.registro_id=p.id and o.estado<>'anulada'),'[]'::jsonb) casos from pagina p
 ) select jsonb_build_object('total',(select count(*) from contactos),'filas',coalesce((select jsonb_agg(to_jsonb(f) order by creado_en desc,id) from filas f),'[]')) into salida;
 return salida;
end $$;
revoke all on function public.listar_contactos_cotizaciones(text,integer) from public,anon;
grant execute on function public.listar_contactos_cotizaciones(text,integer) to authenticated;

create function public.iniciar_cotizacion(p_id uuid,p_version integer,p_operacion uuid,p_datos jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor public.perfiles; registro public.registros_iniciales; nueva public.oportunidades;
 evento public.eventos_oportunidades; solicitud jsonb; persona uuid; destino uuid;
interes jsonb; servicios jsonb; modalidad text; necesidad text; nota text; origen_nuevo text;
begin
 perform pg_advisory_xact_lock(740127);
 select * into actor from public.perfiles where id=auth.uid() and activo;
 if not found then raise exception 'COMERCIAL_ACCESO'; end if;
 if p_id is null or p_operacion is null or p_version is distinct from 0 or jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'COMERCIAL_DATOS'; end if;
 solicitud:=jsonb_build_object('id',p_id,'version',p_version,'accion','iniciar_cotizacion','datos',p_datos);
 select * into evento from public.eventos_oportunidades where id=p_operacion;
 if found then
  if evento.actor_id=actor.id and evento.solicitud=solicitud then return evento.oportunidad_id; end if;
  raise exception 'COMERCIAL_CONFLICTO';
 end if;
 if exists(select 1 from public.oportunidades where id=p_id) then raise exception 'COMERCIAL_CONFLICTO'; end if;
 select * into registro from public.registros_iniciales where id=(p_datos->>'registro_id')::uuid for update;
 if not found or registro.lote_demostracion is not null or (actor.rol<>'administrador' and registro.responsable_id is distinct from actor.id) then raise exception 'COMERCIAL_ACCESO'; end if;
 destino:=(p_datos->>'vendedor_id')::uuid;
 if actor.rol='vendedor' and destino is distinct from actor.id then raise exception 'COMERCIAL_ACCESO'; end if;
 if not exists(select 1 from public.perfiles where id=destino and activo and rol='vendedor') then raise exception 'COMERCIAL_VENDEDOR'; end if;
 origen_nuevo:=nullif(p_datos->>'origen_comercial','');
 if origen_nuevo is not null and (origen_nuevo not in ('propio','asignado_agente') or (actor.rol='vendedor' and origen_nuevo<>'propio') or (actor.rol='agente' and origen_nuevo<>'asignado_agente')) then raise exception 'COMERCIAL_ORIGEN'; end if;
 interes:=p_datos->'interes_comercial'; servicios:=interes->'servicios'; modalidad:=interes->>'tipo_alarma';
 if jsonb_typeof(interes) is distinct from 'object' or jsonb_typeof(servicios) is distinct from 'array' then raise exception 'COMERCIAL_INTERES'; end if;
 if jsonb_array_length(servicios) not between 1 and 3
 or exists(select 1 from jsonb_array_elements(servicios) s where s not in ('"alarma"'::jsonb,'"camaras"'::jsonb,'"cerco"'::jsonb))
 or (select count(distinct s) from jsonb_array_elements(servicios) s)<>jsonb_array_length(servicios) then raise exception 'COMERCIAL_INTERES'; end if;
 if servicios ? 'alarma' then
  if modalidad is null or modalidad not in ('a_definir','docta','nobu','con_monitoreo','sin_monitoreo') then raise exception 'COMERCIAL_INTERES'; end if;
 else modalidad:=null; end if;
 nota:=trim(coalesce(p_datos->>'observaciones',''));
 if char_length(nota)>2000 or (nullif(p_datos->>'canal_contacto','') is not null and p_datos->>'canal_contacto' not in ('whatsapp','llamada','presencial','correo','otro')) then raise exception 'COMERCIAL_DATOS'; end if;
 select string_agg(case s when 'alarma' then 'Instalación de Alarma · '||case modalidad
 when 'docta' then 'Docta Urbanización' when 'nobu' then 'Nobu Town' when 'con_monitoreo' then 'Residencial con monitoreo'
 when 'sin_monitoreo' then 'Residencial sin monitoreo' else 'A definir en la visita' end
 when 'camaras' then 'Instalación de Cámaras' else 'Instalación de Cerco Eléctrico' end,' + ' order by n)
 into necesidad from jsonb_array_elements_text(servicios) with ordinality as t(s,n);
 if exists(select 1 from public.oportunidades o join public.prospectos p on p.id=o.prospecto_id where p.registro_id=registro.id and o.estado<>'anulada')
 and p_datos->>'otra_necesidad' is distinct from 'si' then raise exception 'COMERCIAL_EXISTENTE'; end if;
 insert into public.prospectos(registro_id,nombre,telefono,direccion,contacto_efectivo,calificado_por,captado_por)
 values(registro.id,registro.nombre,coalesce(registro.telefono,''),coalesce(registro.ubicacion,''),null,null,registro.creado_por) on conflict(registro_id) do nothing;
 select id into persona from public.prospectos where registro_id=registro.id;
 insert into public.oportunidades(id,prospecto_id,necesidad,estado,responsable_id,vendedor_visita_id,creado_por,
 visita_en,proxima_accion_en,resumen,interes_comercial,observaciones_visita,canal_contacto)
 values(p_id,persona,necesidad,'cotizacion',destino,destino,actor.id,null,null,'Preparación de cotización iniciada.',
 jsonb_build_object('servicios',servicios,'tipo_alarma',modalidad),nota,nullif(p_datos->>'canal_contacto','')) returning * into nueva;
 insert into public.eventos_oportunidades(id,oportunidad_id,actor_id,tipo,solicitud,nuevo)
 values(p_operacion,p_id,actor.id,'iniciar_cotizacion',solicitud,to_jsonb(nueva));
 update public.ciclos_comerciales set origen=origen_nuevo,coordinador_id=case when actor.rol='agente' then actor.id end where oportunidad_id=p_id and ciclo=1;
 if destino<>actor.id then insert into public.notificaciones(destinatario_id,oportunidad_id,evento_id,mensaje)
 values(destino,p_id,p_operacion,'Nueva negociación asignada en Cotizaciones'); end if;
 return p_id;
end $$;
revoke all on function public.iniciar_cotizacion(uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.iniciar_cotizacion(uuid,integer,uuid,jsonb) to authenticated;

create function public.puede_anular_cotizacion(p_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.oportunidades o join public.perfiles p on p.id=auth.uid()
 where o.id=p_id and p.activo and o.estado<>'anulada' and (p.rol='administrador' or
 (p.rol='vendedor' and o.responsable_id=p.id and o.creado_por=p.id
 and o.estado in ('cotizacion','visita')
 and not exists(select 1 from public.propuestas_comerciales where oportunidad_id=o.id)
 and not exists(select 1 from public.eventos_oportunidades where oportunidad_id=o.id and tipo not in ('crear','iniciar_cotizacion'))
 and not exists(select 1 from public.actividades_agenda a where a.oportunidad_id=o.id and
  (a.origen='manual' or a.estado<>'programada' or exists(select 1 from public.eventos_agenda e where e.actividad_id=a.id and e.tipo<>'visita_coordinada'))))))
$$;
revoke all on function public.puede_anular_cotizacion(uuid) from public,anon;
grant execute on function public.puede_anular_cotizacion(uuid) to authenticated;

create function public.anular_cotizacion(p_id uuid,p_version integer,p_operacion uuid,p_datos jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare anterior public.oportunidades; nueva public.oportunidades; evento public.eventos_oportunidades;
 a public.actividades_agenda; b public.actividades_agenda; solicitud jsonb; motivo text:=trim(coalesce(p_datos->>'resumen',''));
begin
 perform pg_advisory_xact_lock(740127);
 if not privado.usuario_activo() then raise exception 'COMERCIAL_ACCESO'; end if;
 if p_operacion is null or p_id is null or p_version is null or char_length(motivo) not between 5 and 2000 or p_datos->>'confirmar_anulacion' is distinct from 'si' then raise exception 'COMERCIAL_DATOS'; end if;
 solicitud:=jsonb_build_object('id',p_id,'version',p_version,'accion','anular','datos',p_datos);
 select * into evento from public.eventos_oportunidades where id=p_operacion;
 if found then
  if evento.actor_id=auth.uid() and evento.solicitud=solicitud then return evento.oportunidad_id; end if;
  raise exception 'COMERCIAL_CONFLICTO';
 end if;
 if not public.puede_anular_cotizacion(p_id) then raise exception 'COMERCIAL_ANULACION'; end if;
 select * into anterior from public.oportunidades where id=p_id for update;
 if anterior.version<>p_version then raise exception 'COMERCIAL_CONFLICTO'; end if;
 update public.oportunidades set estado='anulada',anulado_en=now(),anulado_por=auth.uid(),motivo_anulacion=motivo,
 proxima_accion_en=null,resumen=motivo,version=version+1,actualizado_en=now() where id=p_id returning * into nueva;
 insert into public.eventos_oportunidades(id,oportunidad_id,actor_id,tipo,solicitud,anterior,nuevo)
 values(p_operacion,p_id,auth.uid(),'anular',solicitud,to_jsonb(anterior),to_jsonb(nueva));
 for a in select * from public.actividades_agenda where oportunidad_id=p_id and tipo='visita' and estado in ('programada','en_curso') for update loop
  update public.actividades_agenda set estado='cancelada',resultado='Negociación anulada por error de carga. Consultá el motivo en su historial comercial.',
   version=version+1,actualizado_en=now() where id=a.id returning * into b;
  insert into public.eventos_agenda values(gen_random_uuid(),a.id,auth.uid(),'negociacion_anulada',jsonb_build_object('evento_comercial',p_operacion),to_jsonb(a),to_jsonb(b),now());
 end loop;
 update public.notificaciones set leida_en=coalesce(leida_en,now()) where oportunidad_id=p_id;
 insert into public.notificaciones(destinatario_id,oportunidad_id,evento_id,mensaje)
 select distinct x,p_id,p_operacion,'Negociación anulada por error de carga. El prospecto se conserva.'
 from unnest(array[anterior.responsable_id,anterior.vendedor_visita_id]) x where x is not null and x<>auth.uid();
 return p_id;
end $$;
revoke all on function public.anular_cotizacion(uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.anular_cotizacion(uuid,integer,uuid,jsonb) to authenticated;

-- Bloquea la gestión desde clientes anteriores, sin borrar ni reescribir eventos.
create function privado.proteger_cotizacion_anulada() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='oportunidades' then
  if old.estado='anulada' then raise exception 'COMERCIAL_ANULADA'; end if;
 elsif tg_table_name='propuestas_comerciales' then
  if exists(select 1 from public.oportunidades where id=new.oportunidad_id and estado='anulada') then raise exception 'COMERCIAL_ANULADA'; end if;
 elsif exists(select 1 from public.oportunidades where id=new.oportunidad_id and estado='anulada') then
  -- No crear nuevos vínculos. Una actividad manual ya declarada conserva su
  -- gestión propia; las visitas pendientes anuladas no se pueden reabrir.
  if tg_op='INSERT' then raise exception 'COMERCIAL_ANULADA'; end if;
  if new.oportunidad_id is distinct from old.oportunidad_id or
    (old.estado='cancelada' and new.estado<>'cancelada') then raise exception 'COMERCIAL_ANULADA'; end if;
 end if;
 return new;
end $$;
revoke all on function privado.proteger_cotizacion_anulada() from public,anon,authenticated;
create trigger proteger_anulada before update on public.oportunidades for each row execute function privado.proteger_cotizacion_anulada();
create trigger proteger_anulada before insert on public.propuestas_comerciales for each row execute function privado.proteger_cotizacion_anulada();
create trigger proteger_anulada before insert or update on public.actividades_agenda for each row execute function privado.proteger_cotizacion_anulada();

-- Ajustes acotados a proyecciones existentes, con verificación de cada sustitución.
do $$
declare original text; cambio text;
begin
 original:=pg_get_viewdef('privado.visitas_medibles'::regclass,true);
 execute 'create or replace view privado.visitas_medibles as select v.* from ('||rtrim(original,E';\n\r ')||') v where not exists(select 1 from public.oportunidades o where o.id=v.oportunidad_id and o.estado=''anulada'')';
 original:=pg_get_functiondef('public.listar_historico_mensual(date)'::regprocedure);
 cambio:=replace(original,'where o.periodo_historico=p_mes','where o.estado<>''anulada'' and o.periodo_historico=p_mes');
 if cambio=original then raise exception 'MIGRACION_HISTORICO_INESPERADO'; end if; execute cambio;
 original:=pg_get_functiondef('privado.proteger_participacion_comercial()'::regprocedure);
 cambio:=replace(original,'estado not in (''ganada'',''perdida'')','estado not in (''ganada'',''perdida'',''anulada'')');
 if cambio=original then raise exception 'MIGRACION_PARTICIPACION_INESPERADA'; end if; execute cambio;
end $$;
commit;
