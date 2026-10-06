import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("eliminar prospectos: rol, vínculos, concurrencia, historial y clientes antiguos", async (t) => {
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
  const [
    admin,
    a,
    b,
    c,
    agente,
    inactivo,
    registro,
    caso,
    marca,
    familia,
    producto,
    kit,
  ] = Array.from({ length: 12 }, randomUUID);
  for (const [id, rol] of [
    [admin, "administrador"],
    [a, "vendedor"],
    [b, "vendedor"],
    [c, "vendedor"],
    [agente, "agente"],
    [inactivo, "vendedor"],
  ]) {
    await db.query("insert into auth.users values($1,$2,$3)", [
      id,
      `${id}@example.invalid`,
      {
        pignus_autorizado: true,
        nombre: `Persona ${id}`,
        rol,
        ...(id === admin ? {} : { creado_por: admin }),
      },
    ]);
  }
  await db.query("update public.perfiles set activo=false where id=$1", [
    inactivo,
  ]);
  async function como(id) {
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  }

  const datos = { nombre: "Contacto sin uso", origen: "whatsapp" };
  const crear = (id) =>
    db.query("select public.guardar_registro_inicial_032($1,0,$2)", [
      id,
      datos,
    ]);
  const eliminar = (id, version = 1, motivo = "Carga duplicada") =>
    db.query("select public.eliminar_prospecto_033($1,$2,$3)", [
      id,
      version,
      motivo,
    ]);
  await como(a);
  await crear(registro);
  for (const usuario of [a, b, agente, inactivo]) {
    await como(usuario);
    await assert.rejects(eliminar(registro), /PROSPECTO_ADMIN/);
  }
  await como(admin);
  await assert.rejects(eliminar(registro, 1, ""), /PROSPECTO_MOTIVO/);
  await assert.rejects(eliminar(registro, 2), /Recargá/);
  await eliminar(registro);
  await eliminar(registro); // reintento idéntico, sin duplicar auditoría
  assert.equal(
    (
      await db.query("select * from public.registros_iniciales where id=$1", [
        registro,
      ])
    ).rows.length,
    0,
  );
  const eventos = (
    await db.query(
      "select * from public.eventos_registros where registro_id=$1 and tipo='registro_eliminado'",
      [registro],
    )
  ).rows;
  assert.equal(eventos.length, 1);
  assert.equal(eventos[0].actor_id, admin);
  assert.equal(eventos[0].nuevo.creado_por, a);
  assert.equal(eventos[0].motivo, "Carga duplicada");
  await assert.rejects(
    db.query("select public.guardar_registro_inicial_032($1,2,$2)", [
      registro,
      datos,
    ]),
    /PROSPECTO_NO_DISPONIBLE/,
  );
  await como(a);
  const inicio = (id, contacto) =>
    db.query("select public.iniciar_cotizacion_032($1,0,$2,$3)", [
      id,
      randomUUID(),
      {
        registro_id: contacto,
        interes_comercial: {
          servicios: ["alarma"],
          tipo_alarma: "con_monitoreo",
        },
        canal_contacto: "presencial",
      },
    ]);
  await assert.rejects(inicio(randomUUID(), registro), /COMERCIAL_ACCESO/);
  assert.equal(
    (await db.query("select public.listar_contactos_cotizaciones() as lista"))
      .rows[0].lista.total,
    0,
  );
  await crear(caso);
  await inicio(randomUUID(), caso);
  await como(admin);
  await assert.rejects(eliminar(caso), /PROSPECTO_VINCULADO/);
  assert.equal(
    (
      await db.query("select * from public.registros_iniciales where id=$1", [
        caso,
      ])
    ).rows.length,
    1,
  );
  await db.exec("reset role; set role anon");
  await assert.rejects(eliminar(caso), /permission denied/);
});
