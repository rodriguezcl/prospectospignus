-- Carga EXPLÍCITA y opcional. No pertenece a las migraciones de producción.
-- Ejecutar como operador de base después de 202609300004. No requiere claves ni contraseñas.
begin;
create table if not exists privado.lotes_demostracion (
 codigo text primary key, usuarios uuid[] not null, registros jsonb not null,
 cargado_en timestamptz not null default now()
);
alter table privado.lotes_demostracion enable row level security;
revoke all on privado.lotes_demostracion from public,anon,authenticated;
do $$
declare
 lote constant text := 'pignus-demo-septiembre-2026-v1';
 vendedores uuid[] := array['d3a02026-0900-4000-8000-000000000001','d3a02026-0900-4000-8000-000000000002']::uuid[];
 administrador uuid;
 nombres text[] := array['Lucía','Martín','Sofía','Diego','Valentina','Nicolás','Camila','Federico','Julieta','Agustín'];
 apellidos text[] := array['Gómez','Pérez','Fernández','López','González','Romero','Sosa','Torres','Díaz'];
 direcciones text[] := array['Av. Poeta Leopoldo Lugones 411','Av. Hipólito Yrigoyen 511','Av. Hipólito Yrigoyen 622','Rivera Indarte 55','Independencia 122'];
 referencias text[] := array['Museo Emilio Caraffa','Museo Evita / Palacio Ferreyra','Palacio Dionisi','Museo de las Mujeres','Museo Juan de Tejeda'];
 origenes text[] := array['puerta_a_puerta','whatsapp','llamada','sitio_web','instagram','facebook','oficina','referido','campana','cliente_existente','otro'];
 i integer; direccion integer; vendedor uuid; ficha public.registros_iniciales;
begin
 perform pg_advisory_xact_lock(740130);
 if exists(select 1 from privado.lotes_demostracion where codigo=lote) then
   raise notice 'El lote ya fue cargado; no se inserta ni modifica nada.';
   return;
 end if;
 select id into administrador from public.perfiles
 where rol='administrador' and activo and lote_demostracion is null order by creado_en,id limit 1;
 if administrador is null then raise exception 'Se necesita un administrador real activo'; end if;
 -- IDs y correos exclusivos: una colisión aborta toda la carga; nunca se reutiliza una cuenta real.
 for i in 1..2 loop
   insert into auth.users(id,instance_id,aud,role,email,encrypted_password,banned_until,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
   values(vendedores[i],'00000000-0000-0000-0000-000000000000','authenticated','authenticated',
     'vendedor-demo-'||i||'@example.invalid','', '2099-12-31T23:59:59Z',
     jsonb_build_object('pignus_autorizado',true,'nombre',case i when 1 then 'Matías Gómez · DEMO' else 'Florencia Pérez · DEMO' end,
       'rol','vendedor','creado_por',administrador,'lote_demostracion',lote),'{}',now(),now());
 end loop;
 set constraints auth.pignus_crear_perfil immediate;
 update public.perfiles set activo=false,lote_demostracion=lote where id=any(vendedores);
 for i in 1..90 loop
   vendedor := vendedores[1 + ((i-1)%2)];
   direccion := 1 + ((i*7)%5);
   insert into public.registros_iniciales(id,nombre,telefono,correo,ubicacion,observaciones,origen,responsable_id,creado_por,creado_en,actualizado_en,lote_demostracion)
   values(md5(lote||':'||i)::uuid,
     nombres[1+((i-1)%10)]||' '||apellidos[1+((i-1)/10)],
     '351-000-'||lpad(i::text,4,'0')||' (DEMO)',
     'contacto-demo-'||i||'@example.invalid',
     direcciones[direccion]||', Córdoba Capital · referencia pública DEMO',
     'DEMO — NO CONTACTAR. Persona y teléfono ficticios. Dirección de '||referencias[direccion]||
     ', tomada de Google Maps como referencia; no es el domicilio de esta persona. Fecha simulada, incluida la parte futura del mes. Lote: '||lote,
     origenes[1+((i-1)%11)],case when i%10=0 then null else vendedor end,vendedor,
     (timestamp '2026-09-01 09:00:00' + ((i-1)/3)*interval '1 day' + (i%3)*interval '3 hours') at time zone 'America/Argentina/Cordoba',
     now(),lote) returning * into ficha;
   insert into public.eventos_registros(registro_id,actor_id,tipo,nuevo,motivo)
   values(ficha.id,administrador,'registro_creado',to_jsonb(ficha),'Carga de demostración: fecha comercial simulada, no actividad real del vendedor.');
 end loop;
 insert into privado.lotes_demostracion(codigo,usuarios,registros)
 select lote,vendedores,jsonb_agg(to_jsonb(r) order by r.id) from public.registros_iniciales r where r.lote_demostracion=lote;
end $$;
commit;
