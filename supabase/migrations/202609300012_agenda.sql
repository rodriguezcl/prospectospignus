begin;

create table public.actividades_agenda (
 id uuid primary key,
 vendedor_id uuid not null references public.perfiles(id),
 oportunidad_id uuid references public.oportunidades(id),
 origen text not null check(origen in ('manual','visita')),
 tipo text not null check(tipo in ('visita','llamada','puerta_a_puerta','reunion','traslado','administrativa','otra')),
 titulo text not null check(char_length(trim(titulo)) between 3 and 160),
 nota text not null default '' check(char_length(nota)<=2000),
 estado text not null check(estado in ('programada','en_curso','realizada','cancelada')),
 inicio_previsto timestamptz,
 fin_previsto timestamptz,
 inicio_real timestamptz,
 fin_real timestamptz,
 resultado text not null default '' check(char_length(resultado)<=2000),
 creado_por uuid not null references public.perfiles(id),
 creado_en timestamptz not null default now(),
 actualizado_en timestamptz not null default now(),
 version integer not null default 1,
 check(inicio_previsto is not null or inicio_real is not null),
 check(fin_previsto is null or (inicio_previsto is not null and fin_previsto>inicio_previsto)),
 check(fin_real is null or (inicio_real is not null and fin_real>inicio_real)),
 check(estado<>'programada' or (inicio_previsto is not null and inicio_real is null and fin_real is null)),
 check(estado<>'en_curso' or (inicio_real is not null and fin_real is null)),
 check(estado<>'realizada' or (inicio_real is not null and fin_real is not null and char_length(trim(resultado))>=3)),
 check(estado<>'cancelada' or char_length(trim(resultado))>=3),
 check(origen<>'visita' or oportunidad_id is not null)
);
create index agenda_vendedor_fecha on public.actividades_agenda(vendedor_id,(coalesce(inicio_real,inicio_previsto)));
create index agenda_visita on public.actividades_agenda(oportunidad_id) where origen='visita';
create table public.eventos_agenda (
 id uuid primary key,
 actividad_id uuid not null references public.actividades_agenda(id),
 actor_id uuid not null references public.perfiles(id),
 tipo text not null,
 solicitud jsonb not null,
 anterior jsonb,
 nuevo jsonb not null,
 ocurrido_en timestamptz not null default now()
);
create index agenda_historial on public.eventos_agenda(actividad_id,ocurrido_en);
create table public.recordatorios_agenda_leidos (
 actividad_id uuid not null references public.actividades_agenda(id),
 version integer not null,
 vendedor_id uuid not null references public.perfiles(id),
 leido_en timestamptz not null default now(),
 primary key(actividad_id,version,vendedor_id)
);
create function privado.puede_ver_agenda(p_vendedor uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.perfiles where id=auth.uid() and activo
 and (rol='administrador' or (rol='vendedor' and id=p_vendedor)));
$$;
revoke all on function privado.puede_ver_agenda(uuid) from public,anon;
grant execute on function privado.puede_ver_agenda(uuid) to authenticated;
alter table public.actividades_agenda enable row level security;
alter table public.eventos_agenda enable row level security;
alter table public.recordatorios_agenda_leidos enable row level security;
revoke all on public.actividades_agenda,public.eventos_agenda,public.recordatorios_agenda_leidos from anon,authenticated;
grant select on public.actividades_agenda,public.eventos_agenda to authenticated;
create policy agenda_lectura on public.actividades_agenda for select to authenticated using(privado.puede_ver_agenda(vendedor_id));
create policy agenda_eventos_lectura on public.eventos_agenda for select to authenticated
 using(exists(select 1 from public.actividades_agenda a where a.id=actividad_id and privado.puede_ver_agenda(a.vendedor_id)));

create function public.equipo_agenda() returns table(id uuid,nombre text,activo boolean)
language sql stable security definer set search_path='' as $$
 select p.id,p.nombre,p.activo from public.perfiles p where privado.puede_ver_agenda(p.id)
 and (p.rol='vendedor' or exists(select 1 from public.actividades_agenda a where a.vendedor_id=p.id)) order by p.nombre,p.id;
$$;

-- Rango inclusivo de fechas de Córdoba; devuelve también actividades que cruzan medianoche.
create function public.listar_agenda(p_vendedor uuid,p_desde date,p_hasta date,p_pagina integer default 0)
returns setof public.actividades_agenda language plpgsql stable security invoker set search_path='' as $$
begin
 if p_desde is null or p_hasta is null or p_hasta<p_desde or p_hasta-p_desde>6 or p_pagina is null or p_pagina<0 then raise exception 'AGENDA_DATOS'; end if;
 return query select a.* from public.actividades_agenda a where a.vendedor_id=p_vendedor
 and coalesce(a.inicio_real,a.inicio_previsto)<((p_hasta+1)::timestamp at time zone 'America/Argentina/Cordoba')
 and (coalesce(a.fin_real,case when a.estado='en_curso' then now() end,a.inicio_real,a.fin_previsto,a.inicio_previsto)>
 (p_desde::timestamp at time zone 'America/Argentina/Cordoba')
 or coalesce(a.inicio_real,a.inicio_previsto)>=(p_desde::timestamp at time zone 'America/Argentina/Cordoba'))
 order by coalesce(a.inicio_real,a.inicio_previsto),a.id limit 100 offset p_pagina*100;
end $$;

create function public.gestionar_actividad(p_id uuid,p_version integer,p_operacion uuid,p_accion text,p_datos jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare actor public.perfiles; anterior public.actividades_agenda; nueva public.actividades_agenda;
 evento public.eventos_agenda; solicitud jsonb; motivo text:=trim(coalesce(p_datos->>'motivo',''));
begin
 -- Mismo orden de bloqueo que asignaciones comerciales y cambios de elegibilidad.
 perform pg_advisory_xact_lock(740127);
 select * into actor from public.perfiles where id=auth.uid() and activo and rol in ('vendedor','administrador');
 if not found then raise exception 'AGENDA_ACCESO'; end if;
 if p_id is null or p_operacion is null or p_version is null or p_version<0 or p_accion is null or jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'AGENDA_DATOS'; end if;
 solicitud:=jsonb_build_object('id',p_id,'version',p_version,'accion',p_accion,'datos',p_datos);
 select * into evento from public.eventos_agenda where id=p_operacion;
 if found then
   if evento.actor_id=actor.id and evento.solicitud=solicitud then return evento.actividad_id; end if;
   raise exception 'AGENDA_CONFLICTO';
 end if;
 if p_accion='crear' then
   if actor.rol<>'vendedor' then raise exception 'AGENDA_ACCESO'; end if;
   if p_version<>0 or exists(select 1 from public.actividades_agenda where id=p_id) then raise exception 'AGENDA_CONFLICTO'; end if;
   nueva.id:=p_id; nueva.vendedor_id:=actor.id; nueva.origen:='manual'; nueva.creado_por:=actor.id;
   nueva.creado_en:=now(); nueva.version:=1;
   nueva.estado:=coalesce(p_datos->>'estado','programada');
   if nueva.estado not in ('programada','realizada') then raise exception 'AGENDA_TRANSICION'; end if;
 else
   select * into anterior from public.actividades_agenda where id=p_id for update;
   if not found or (actor.rol<>'administrador' and anterior.vendedor_id<>actor.id) then raise exception 'AGENDA_ACCESO'; end if;
   -- Gerencia consulta; solo puede cancelar pendientes con motivo para resolver bajas de cuentas.
   if actor.rol='administrador' and p_accion<>'cancelar' then raise exception 'AGENDA_ACCESO'; end if;
   if anterior.version<>p_version then raise exception 'AGENDA_CONFLICTO'; end if;
   nueva:=anterior; nueva.version:=anterior.version+1;
 end if;
 if p_accion in ('crear','editar') then
   if p_accion='editar' and (anterior.origen<>'manual' or anterior.estado<>'programada' or char_length(motivo) not between 3 and 2000) then raise exception 'AGENDA_TRANSICION'; end if;
   nueva.titulo:=trim(coalesce(p_datos->>'titulo',''));
   nueva.tipo:=p_datos->>'tipo'; nueva.nota:=trim(coalesce(p_datos->>'nota',''));
   nueva.oportunidad_id:=nullif(p_datos->>'oportunidad_id','')::uuid;
   if nueva.oportunidad_id is not null and not privado.puede_ver_oportunidad(nueva.oportunidad_id) then raise exception 'AGENDA_ACCESO'; end if;
   nueva.inicio_previsto:=nullif(p_datos->>'inicio_previsto','')::timestamptz;
   nueva.fin_previsto:=nullif(p_datos->>'fin_previsto','')::timestamptz;
   if nueva.estado='programada' and (nueva.inicio_previsto is null or nueva.inicio_previsto<=now()) then raise exception 'AGENDA_FECHA'; end if;
   if nueva.estado='realizada' then
     nueva.inicio_real:=nullif(p_datos->>'inicio_real','')::timestamptz;
     nueva.fin_real:=nullif(p_datos->>'fin_real','')::timestamptz;
   end if;
   nueva.resultado:=trim(coalesce(p_datos->>'resultado',''));
 elsif p_accion='iniciar' and anterior.estado='programada' then
   nueva.estado:='en_curso'; nueva.inicio_real:=now();
 elsif p_accion='finalizar' and anterior.estado in ('programada','en_curso') then
   nueva.estado:='realizada'; nueva.inicio_real:=coalesce(anterior.inicio_real,nullif(p_datos->>'inicio_real','')::timestamptz);
   nueva.fin_real:=nullif(p_datos->>'fin_real','')::timestamptz;
   nueva.resultado:=trim(coalesce(p_datos->>'resultado',''));
 elsif p_accion='corregir' and anterior.estado='realizada' then
   if char_length(motivo) not between 3 and 2000 then raise exception 'AGENDA_DATOS'; end if;
   nueva.inicio_real:=nullif(p_datos->>'inicio_real','')::timestamptz;
   nueva.fin_real:=nullif(p_datos->>'fin_real','')::timestamptz;
   nueva.resultado:=trim(coalesce(p_datos->>'resultado',''));
 elsif p_accion='cancelar' and anterior.estado in ('programada','en_curso') then
   if char_length(motivo) not between 3 and 2000 then raise exception 'AGENDA_DATOS'; end if;
   nueva.estado:='cancelada'; nueva.resultado:=motivo;
 else raise exception 'AGENDA_TRANSICION'; end if;
 if (nueva.inicio_real is not null and (not isfinite(nueva.inicio_real) or nueva.inicio_real>now()))
 or (nueva.fin_real is not null and (not isfinite(nueva.fin_real) or nueva.fin_real>now()))
 or (nueva.inicio_previsto is not null and not isfinite(nueva.inicio_previsto))
 or (nueva.fin_previsto is not null and not isfinite(nueva.fin_previsto)) then raise exception 'AGENDA_FECHA'; end if;
 nueva.actualizado_en:=now();
 if p_accion='crear' then insert into public.actividades_agenda select nueva.*;
 else update public.actividades_agenda set titulo=nueva.titulo,tipo=nueva.tipo,nota=nueva.nota,
 oportunidad_id=nueva.oportunidad_id,estado=nueva.estado,inicio_previsto=nueva.inicio_previsto,fin_previsto=nueva.fin_previsto,
 inicio_real=nueva.inicio_real,fin_real=nueva.fin_real,resultado=nueva.resultado,version=nueva.version,actualizado_en=now() where id=p_id;
 end if;
 insert into public.eventos_agenda values(p_operacion,p_id,actor.id,p_accion,solicitud,
 case when anterior.id is null then null else to_jsonb(anterior) end,to_jsonb(nueva),now());
 return p_id;
end $$;

-- Integración transaccional a través del evento comercial, sin importar código entre features.
-- Nunca declara que una visita se realizó ni modifica el resultado comercial.
create function privado.agendar_visita() returns trigger language plpgsql security definer set search_path='' as $$
declare a public.actividades_agenda; nueva public.actividades_agenda; identificador uuid;
begin
 if new.tipo not in ('crear','reprogramar','reasignar') or new.nuevo->>'estado'<>'visita' then return new; end if;
 for a in select * from public.actividades_agenda where oportunidad_id=new.oportunidad_id and origen='visita' and estado in ('programada','en_curso') for update loop
   update public.actividades_agenda set estado='cancelada',resultado='Visita sustituida por reprogramación o reasignación desde Prospectos',version=version+1,actualizado_en=now()
   where id=a.id returning * into nueva;
   insert into public.eventos_agenda values(gen_random_uuid(),a.id,new.actor_id,'visita_sustituida',jsonb_build_object('evento_comercial',new.id),to_jsonb(a),to_jsonb(nueva),now());
 end loop;
 identificador:=gen_random_uuid();
 insert into public.actividades_agenda(id,vendedor_id,oportunidad_id,origen,tipo,titulo,nota,estado,inicio_previsto,creado_por)
 values(identificador,(new.nuevo->>'vendedor_visita_id')::uuid,new.oportunidad_id,'visita','visita','Visita comercial coordinada',
 'Consultá dirección y detalles en la ficha de Prospectos.','programada',(new.nuevo->>'visita_en')::timestamptz,new.actor_id) returning * into nueva;
 insert into public.eventos_agenda values(gen_random_uuid(),identificador,new.actor_id,'visita_coordinada',jsonb_build_object('evento_comercial',new.id),null,to_jsonb(nueva),now());
 return new;
end $$;
revoke all on function privado.agendar_visita() from public,anon,authenticated;
create trigger agendar_visita after insert on public.eventos_oportunidades for each row execute function privado.agendar_visita();

-- Recordatorios internos consultados con la aplicación abierta; no requieren un cron.
create function public.recordatorios_agenda() returns table(id text,actividad_id uuid,mensaje text,creado_en timestamptz)
language sql stable security definer set search_path='' as $$
 select a.id::text||'/'||a.version::text,a.id,
 case when a.inicio_previsto<=now() then 'Agenda pendiente de actualizar: ' else 'Agenda en los próximos 30 minutos: ' end||a.titulo,a.inicio_previsto
 from public.actividades_agenda a join public.perfiles p on p.id=auth.uid()
 where p.activo and p.rol='vendedor' and a.vendedor_id=p.id and a.estado='programada'
 and a.inicio_previsto between now()-interval '24 hours' and now()+interval '30 minutes'
 and not exists(select 1 from public.recordatorios_agenda_leidos l where l.actividad_id=a.id and l.version=a.version and l.vendedor_id=p.id)
 order by a.inicio_previsto limit 50;
$$;
create function public.leer_recordatorio_agenda(p_id uuid,p_version integer) returns void
language sql security definer set search_path='' as $$
 insert into public.recordatorios_agenda_leidos(actividad_id,version,vendedor_id)
 select a.id,a.version,auth.uid() from public.actividades_agenda a join public.perfiles p on p.id=auth.uid()
 where a.id=p_id and a.version=p_version and a.vendedor_id=p.id and p.activo and p.rol='vendedor'
 on conflict do nothing;
$$;
create function privado.proteger_agenda() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
   if (new.rol<>old.rol or not new.activo) and exists(select 1 from public.actividades_agenda where vendedor_id=old.id and estado in ('programada','en_curso')) then raise exception 'CUENTA_TRABAJO_PENDIENTE'; end if;
   return new;
 end if;
 if exists(select 1 from public.actividades_agenda where vendedor_id=old.id or creado_por=old.id)
 or exists(select 1 from public.eventos_agenda where actor_id=old.id) then raise exception 'CUENTA_VINCULADA'; end if;
 return old;
end $$;
revoke all on function privado.proteger_agenda() from public,anon,authenticated;
create trigger proteger_agenda before update or delete on public.perfiles for each row execute function privado.proteger_agenda();
revoke all on function public.equipo_agenda(),public.listar_agenda(uuid,date,date,integer),public.gestionar_actividad(uuid,integer,uuid,text,jsonb),public.recordatorios_agenda(),public.leer_recordatorio_agenda(uuid,integer) from public,anon;
grant execute on function public.equipo_agenda(),public.listar_agenda(uuid,date,date,integer),public.gestionar_actividad(uuid,integer,uuid,text,jsonb),public.recordatorios_agenda(),public.leer_recordatorio_agenda(uuid,integer) to authenticated;
commit;
