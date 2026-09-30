import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("registros: aislamiento, escrituras atómicas, auditoría y concurrencia optimista", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  for (const nombre of [
    "202609290001_acceso_y_usuarios.sql",
    "202609290002_alta_diferida.sql",
    "202609290003_registros_iniciales.sql",
  ])
    await db.exec(
      await readFile(
        new URL(`../migrations/${nombre}`, import.meta.url),
        "utf8",
      ),
    );
  const admin = "00000000-0000-0000-0000-000000000001",
    a = "00000000-0000-0000-0000-000000000002",
    b = "00000000-0000-0000-0000-000000000003";
  for (const id of [admin, a, b])
    await db.query("insert into auth.users values($1,$2,$3)", [
      id,
      `${id}@example.com`,
      {
        pignus_autorizado: true,
        nombre: "Persona prueba",
        rol: id === admin ? "administrador" : "vendedor",
        ...(id === admin ? {} : { creado_por: admin }),
      },
    ]);
  async function como(id) {
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  }
  const datos = {
    nombre: "Contacto preliminar",
    origen: "oficina",
    telefono: "",
    correo: "",
    ubicacion: "",
    observaciones: "",
  };
  const r1 = "10000000-0000-0000-0000-000000000001",
    r2 = "10000000-0000-0000-0000-000000000002";
  async function guardar(id, version, entrada = datos) {
    return (
      await db.query(
        "select * from public.guardar_registro_inicial($1,$2,$3)",
        [id, version, entrada],
      )
    ).rows[0];
  }
  await como(a);
  const primero = await guardar(r1, 0, {
    ...datos,
    creado_por: b,
    creado_en: "2000-01-01",
  });
  assert.equal(primero.creado_por, a);
  assert.equal(primero.responsable_id, a);
  assert.equal(primero.version, 1);
  await guardar(r1, 0); // El reintento no crea evento ni fila adicionales.
  assert.equal(
    (await db.query("select * from public.eventos_registros")).rows.length,
    1,
  );
  await assert.rejects(
    guardar(r1, 0, { ...datos, nombre: "Cambio en reintento" }),
    /Recargá/,
  );
  await assert.rejects(
    guardar(r2, 0, { ...datos, responsable_id: b }),
    /otra cartera/,
  );
  await assert.rejects(
    guardar(r2, 0, { ...datos, nombre: "" }),
    /check constraint/,
  );
  await assert.rejects(
    guardar(r2, 0, { ...datos, origen: "no-existe" }),
    /Origen/,
  );
  await assert.rejects(
    guardar(r2, 0, { ...datos, correo: "no-es-correo" }),
    /check constraint/,
  );
  await assert.rejects(
    db.exec("update public.registros_iniciales set nombre='Intruso'"),
    /permission denied/,
  );
  await assert.rejects(
    db.exec("delete from public.registros_iniciales"),
    /permission denied/,
  );
  await assert.rejects(
    db.exec("delete from public.eventos_registros"),
    /permission denied/,
  );
  await como(b);
  assert.equal(
    (await db.query("select * from public.registros_iniciales")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.eventos_registros")).rows.length,
    0,
  );
  await assert.rejects(guardar(r1, 1), /no disponible/);
  await assert.rejects(guardar(r1, 0), /no disponible/);
  await como(a);
  const actualizado = await guardar(r1, 1, { ...datos, telefono: "12345" });
  assert.equal(actualizado.version, 2);
  assert.equal(String(actualizado.creado_en), String(primero.creado_en));
  await assert.rejects(guardar(r1, 1), /Recargá/);
  await assert.rejects(
    guardar(r1, 2, { ...datos, origen: "whatsapp" }),
    /origen histórico/,
  );
  assert.equal(
    (await db.query("select * from public.eventos_registros")).rows.length,
    2,
  );
  await como(admin);
  await guardar(r2, 0); // Sin asignar: únicamente visible por administrador.
  assert.equal(
    (await db.query("select * from public.registros_iniciales")).rows.length,
    2,
  );
  await assert.rejects(
    guardar(r1, 2, { ...datos, responsable_id: b }),
    /motivo/,
  );
  await guardar(r1, 2, {
    ...datos,
    responsable_id: b,
    motivo: "Cambio de cartera",
  });
  const historial = (
    await db.query(
      "select * from public.eventos_registros where registro_id=$1 order by id desc",
      [r1],
    )
  ).rows;
  assert.equal(historial[0].anterior.responsable_id, a);
  assert.equal(historial[0].nuevo.responsable_id, b);
  assert.equal(historial[0].actor_id, admin);
  await como(a);
  assert.equal(
    (await db.query("select * from public.registros_iniciales")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.eventos_registros")).rows.length,
    0,
  );
  await assert.rejects(guardar(r1, 3), /no disponible/);
  await como(b);
  assert.equal(
    (await db.query("select * from public.registros_iniciales")).rows.length,
    1,
  );
  const resultados = await Promise.allSettled([
    guardar(r1, 3, datos),
    guardar(r1, 3, datos),
  ]);
  assert.equal(resultados.filter((r) => r.status === "fulfilled").length, 1);
  await db.exec("reset role");
  await db.query("update public.perfiles set activo=false where id=$1", [b]);
  await como(b);
  assert.equal(
    (await db.query("select * from public.registros_iniciales")).rows.length,
    0,
  );
  await assert.rejects(guardar(r1, 4), /no habilitada/);
  await como(admin);
  await assert.rejects(
    guardar(r2, 1, {
      ...datos,
      responsable_id: b,
      motivo: "Asignación manual",
    }),
    /Responsable/,
  );
  await db.exec("reset role; set role anon");
  await assert.rejects(
    db.exec("select * from public.registros_iniciales"),
    /permission denied/,
  );
  await assert.rejects(guardar(r2, 1), /permission denied/);
});
