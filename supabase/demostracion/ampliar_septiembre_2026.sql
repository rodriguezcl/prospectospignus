-- Ampliación EXPLÍCITA: 90 -> 134 fichas DEMO. Nunca ejecutar como migración automática.
begin;
alter table privado.lotes_demostracion add column if not exists revision text;
alter table privado.lotes_demostracion add column if not exists registros_anteriores jsonb;
alter table privado.lotes_demostracion add column if not exists eventos jsonb;
do $$
declare
 lote constant text := 'pignus-demo-septiembre-2026-v1';
 revision_nueva constant text := 'diversificada-134-v2';
 manifiesto privado.lotes_demostracion;
 actuales jsonb; administrador uuid; vendedores uuid[];
 cantidades integer[] := array[4,7,3,6,2,0,5,9,4,8,3,1,0,6,10,5,7,4,2,0,8,3,11,5,6,1,0,7,4,3];
 nombres text[] := array['Carolina','Javier','Mariana','Sebastián','Paula','Leandro','Victoria','Pablo','Rocío','Emiliano','Natalia'];
 apellidos text[] := array['Acosta','Medina','Castro','Suárez'];
 i integer := 0; dia integer; posicion integer; valor integer;
 vendedor uuid; origen_nuevo text; instante timestamptz;
 anterior public.registros_iniciales; ficha public.registros_iniciales;
begin
 perform pg_advisory_xact_lock(740130);
 select * into manifiesto from privado.lotes_demostracion where codigo=lote for update;
 if not found then raise exception 'Falta el lote original'; end if;
 if manifiesto.revision=revision_nueva then raise notice 'Ampliación ya aplicada; no se modifica nada'; return; end if;
 if manifiesto.revision is not null then raise exception 'Revisión desconocida'; end if;
 lock table public.registros_iniciales, public.eventos_registros, public.perfiles, public.eventos_cuentas in share row exclusive mode;
 select jsonb_agg(to_jsonb(r) order by r.id) into actuales from public.registros_iniciales r where lote_demostracion=lote;
 if actuales is distinct from manifiesto.registros or jsonb_array_length(actuales)<>90 then raise exception 'El lote cambió: no se modifica nada'; end if;
 vendedores := manifiesto.usuarios;
 if cardinality(vendedores)<>2 or (select count(*) from public.perfiles where id=any(vendedores) and not activo and rol='vendedor' and lote_demostracion=lote)<>2 then raise exception 'Cuentas DEMO modificadas'; end if;
 if (select count(*) from public.eventos_registros e join public.registros_iniciales r on r.id=e.registro_id where r.lote_demostracion=lote)<>90
   or exists(select 1 from public.eventos_registros e join public.registros_iniciales r on r.id=e.registro_id where r.lote_demostracion=lote and (e.tipo<>'registro_creado' or e.nuevo is distinct from to_jsonb(r))) then
   raise exception 'Auditoría original modificada';
 end if;
 select id into administrador from public.perfiles where activo and rol='administrador' and lote_demostracion is null order by creado_en,id limit 1;
 if administrador is null then raise exception 'Falta administrador activo'; end if;
 for dia in 1..30 loop
   for posicion in 1..cantidades[dia] loop
     i := i+1;
     vendedor := vendedores[case when (i*7+dia)%10<6 then 1 else 2 end];
     valor := (i*37+dia*11)%100;
     origen_nuevo := case when valor<28 then 'whatsapp' when valor<46 then 'referido'
       when valor<60 then 'puerta_a_puerta' when valor<71 then 'instagram' when valor<80 then 'llamada'
       when valor<86 then 'sitio_web' when valor<91 then 'facebook' when valor<95 then 'oficina'
       when valor<97 then 'campana' when valor<99 then 'cliente_existente' else 'otro' end;
     instante := (timestamp '2026-09-01 08:15:00'+(dia-1)*interval '1 day'+((i*73+dia*17)%660)*interval '1 minute') at time zone 'America/Argentina/Cordoba';
     if i<=90 then
       select * into anterior from public.registros_iniciales where id=md5(lote||':'||i)::uuid and lote_demostracion=lote;
       if not found then raise exception 'Identificador original no encontrado'; end if;
       update public.registros_iniciales set creado_en=instante, creado_por=vendedor,
         responsable_id=case when i%8=0 then null else vendedor end, origen=origen_nuevo,
         actualizado_en=now(),version=version+1 where id=anterior.id returning * into ficha;
       insert into public.eventos_registros(registro_id,actor_id,tipo,anterior,nuevo,motivo)
         values(ficha.id,administrador,'registro_actualizado',to_jsonb(anterior),to_jsonb(ficha),'Redistribución DEMO expresamente autorizada: fechas, creador y origen sintéticos; no representa actividad real.');
     else
       insert into public.registros_iniciales(id,nombre,telefono,correo,ubicacion,observaciones,origen,responsable_id,creado_por,creado_en,actualizado_en,lote_demostracion)
         values(md5(lote||':'||i)::uuid,nombres[1+(i-91)%11]||' '||apellidos[1+(i-91)/11],
           '351-000-'||lpad(i::text,4,'0')||' (DEMO)',case when i%5=0 then '' else 'contacto-demo-'||i||'@example.invalid' end,
           case when i%4=0 then '' else 'Córdoba Capital · zona de referencia DEMO, sin domicilio real' end,
           'DEMO — NO CONTACTAR. Persona, teléfono y actividad ficticios. Fecha simulada de septiembre. Lote: '||lote,
           origen_nuevo,case when i%8=0 then null else vendedor end,vendedor,instante,now(),lote) returning * into ficha;
       insert into public.eventos_registros(registro_id,actor_id,tipo,nuevo,motivo)
         values(ficha.id,administrador,'registro_creado',to_jsonb(ficha),'Ampliación DEMO autorizada: fecha comercial simulada, no actividad real.');
     end if;
   end loop;
 end loop;
 if i<>134 then raise exception 'Cantidad inesperada'; end if;
 update privado.lotes_demostracion set revision=revision_nueva,registros_anteriores=manifiesto.registros,
   registros=(select jsonb_agg(to_jsonb(r) order by r.id) from public.registros_iniciales r where lote_demostracion=lote),
   eventos=(select jsonb_agg(to_jsonb(e) order by e.id) from public.eventos_registros e join public.registros_iniciales r on r.id=e.registro_id where r.lote_demostracion=lote)
 where codigo=lote;
end $$;
commit;
