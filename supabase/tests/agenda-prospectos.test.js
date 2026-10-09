import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("agenda de prospecto sin cotización: búsqueda, reserva, reprogramación, permisos e historial", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; grant usage on schema auth to authenticated;
 create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  const carpeta = new URL("../migrations/", import.meta.url);
  for (const f of (await readdir(carpeta))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(new URL(f, carpeta), "utf8"));
  const [admin, a, b, agente, inactivo, registro, otro, caso] = Array.from(
    { length: 8 },
    randomUUID,
  );
  for (const [id, rol] of [
    [admin, "administrador"],
    [a, "vendedor"],
    [b, "vendedor"],
    [agente, "agente"],
    [inactivo, "vendedor"],
  ])
    await db.query("insert into auth.users values($1,$2,$3)", [
      id,
      id + "@example.invalid",
      {
        pignus_autorizado: true,
        nombre: rol + id,
        rol,
        ...(id === admin ? {} : { creado_por: admin }),
      },
    ]);
  await db.query("update public.perfiles set activo=false where id=$1", [
    inactivo,
  ]);
  const como = async (id) => {
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  };

  await como(a);
  await db.query('select public.guardar_registro_inicial_032($1,0,$2)',[registro,{nombre:'MARIO PRUEBA',telefono:'+54 9 3513 00-0000',origen:'whatsapp'}]);
  const buscar=async texto=>(await db.query('select * from public.buscar_prospectos_agenda_040($1)',[texto])).rows;
  assert.equal((await buscar('MARIO'))[0].id,registro);
  assert.equal((await buscar('3513000000'))[0].id,registro);
  const inicio = new Date(Date.now()+3*86400000).toISOString();
  const datos={tipo:'visita',titulo:'Visita comercial a Mario',estado:'programada',registro_id:registro,inicio_previsto:inicio};
  const operacion=randomUUID();
  const guardar=(id,version,op,accion,d)=>db.query('select public.gestionar_actividad_040($1,$2,$3,$4,$5)',[id,version,op,accion,d]);
  await assert.rejects(guardar(caso,0,operacion,'crear',{...datos,inicio_previsto:'2020-01-01T12:00:00Z'}),/AGENDA_FECHA/);
  assert.equal((await db.query('select public.atencion_prospecto_039($1) r',[registro])).rows[0].r.vendedor_id,null);
  await guardar(caso,0,operacion,'crear',datos);
  await guardar(caso,0,operacion,'crear',datos);
  let actividad=(await db.query('select * from public.actividades_agenda where id=$1',[caso])).rows[0];
  assert.equal(actividad.registro_id,registro);assert.equal(actividad.oportunidad_id,null);assert.equal(actividad.estado,'programada');
  assert.equal((await db.query('select * from public.oportunidades')).rows.length,0);
  assert.equal((await db.query('select public.atencion_prospecto_039($1) r',[registro])).rows[0].r.vendedor_id,a);
  const nuevaFecha=new Date(Date.now()+4*86400000).toISOString();
  await guardar(caso,1,randomUUID(),'editar',{...datos,inicio_previsto:nuevaFecha,motivo:'Cliente solicita otro día'});
  await assert.rejects(guardar(caso,1,randomUUID(),'editar',{...datos,motivo:'Versión anterior'}),/AGENDA_CONFLICTO/);
  await assert.rejects(db.query('select public.tomar_prospecto_039($1,2,true)',[registro]),/AGENDA_CONTACTO_PENDIENTE/);
  await como(b);await assert.rejects(guardar(randomUUID(),0,randomUUID(),'crear',datos),/PROSPECTO_OCUPADO/);
  assert.equal((await db.query('select * from public.actividades_agenda where id=$1',[caso])).rows.length,0);
  await como(a);
  await guardar(caso,2,randomUUID(),'cancelar',{motivo:'Cliente solicita cancelar'});
  await db.query('select public.tomar_prospecto_039($1,2,true)',[registro]);
  await guardar(otro,0,randomUUID(),'crear',datos);
  await como(admin);
  await db.query("select public.eliminar_prospecto_034($1,1,'Contacto de prueba')",[registro]);
  assert.equal((await db.query('select estado from public.actividades_agenda where id=$1',[otro])).rows[0].estado,'cancelada');
  assert.equal((await buscar('MARIO')).length,0);
  assert.ok((await db.query('select * from public.eventos_agenda where actividad_id=$1',[caso])).rows.length>=3);
  await como(agente);await assert.rejects(guardar(randomUUID(),0,randomUUID(),'crear',datos),/AGENDA_ACCESO/);
});
