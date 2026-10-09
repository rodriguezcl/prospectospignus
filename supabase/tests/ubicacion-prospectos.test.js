import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("ubicaciones: persistencia, auditoría, compatibilidad, filtros y paginación", async (t) => {
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
  const guardar = (id, version, datos) =>
    db.query("select public.guardar_registro_inicial_041($1,$2,$3)", [
      id,
      version,
      datos,
    ]);
  const datos = {
    nombre: "Contacto Docta",
    origen: "whatsapp",
    ubicacion_comercial: "docta",
  };
  await guardar(registro, 0, datos);
  await guardar(registro, 0, datos);
  await assert.rejects(
    guardar(registro, 0, { ...datos, ubicacion_comercial: "nobu" }),
    /registro cambió/,
  );
  await assert.rejects(
    guardar(randomUUID(), 0, { ...datos, ubicacion_comercial: "invalida" }),
  );
  await assert.rejects(
    guardar(randomUUID(), 0, { ...datos, ubicacion_comercial: 4 }),
  );
  await guardar(otro, 0, { nombre: "Sin clasificar", origen: "whatsapp" });
  const contactos = async (
    ubicacion,
    pagina = 0,
    busqueda = "",
    atencion = "",
  ) =>
    (
      await db.query("select public.listar_contactos_041($1,$2,$3,$4) r", [
        busqueda,
        pagina,
        atencion,
        ubicacion,
      ])
    ).rows[0].r;
  assert.equal((await contactos("docta")).total, 1);
  assert.equal((await contactos("sin_clasificar")).total, 1);
  assert.equal((await contactos("nobu")).total, 0);
  await guardar(registro, 1, { ...datos, ubicacion_comercial: "nobu" });
  assert.equal((await contactos("docta")).total, 0);
  assert.equal((await contactos("nobu")).filas[0].ubicacion_comercial, "nobu");
  await db.query("select public.guardar_registro_inicial_032($1,2,$2)", [
    registro,
    { nombre: datos.nombre, origen: datos.origen },
  ]);
  assert.equal((await contactos("nobu")).total, 1);
  const eventos = (
    await db.query(
      "select anterior,nuevo from public.eventos_registros where registro_id=$1 and tipo='registro_actualizado' order by id",
      [registro],
    )
  ).rows;
  assert.equal(eventos[0].anterior.ubicacion_comercial, "docta");
  assert.equal(eventos[0].nuevo.ubicacion_comercial, "nobu");
  for (let i = 0; i < 21; i++)
    await guardar(randomUUID(), 0, { ...datos, nombre: "Docta " + i });
  assert.equal((await contactos("docta")).total, 21);
  assert.equal((await contactos("docta")).filas.length, 20);
  assert.equal((await contactos("docta", 1)).filas.length, 1);
  assert.equal((await contactos("docta", 0, "Docta 20")).total, 1);
  await assert.rejects(contactos("invalida"), /COMERCIAL_DATOS/);
  await db.query("select public.iniciar_cotizacion_032($1,0,$2,$3)", [
    caso,
    randomUUID(),
    {
      registro_id: registro,
      interes_comercial: { servicios: ["camaras"], tipo_alarma: null },
    },
  ]);
  const casos = async (ubicacion, estado = "") =>
    (
      await db.query("select public.listar_casos_041(0,$1,$2,$3) r", [
        estado,
        "",
        ubicacion,
      ])
    ).rows[0].r;
  assert.equal((await casos("nobu")).total, 1);
  assert.equal((await casos("docta")).total, 0);
  assert.equal(
    (await casos("nobu")).filas[0].prospectos.nombre,
    datos.nombre.toUpperCase(),
  );
  await db.exec("reset role");
  await db.query(
    "update public.oportunidades set estado='recuperacion',proxima_accion_en=now()+interval '1 day',preparacion_compartida=false,responsable_id=$2 where id=$1",
    [caso, a],
  );
  await como(a);
  assert.equal((await casos("nobu", "recuperacion")).total, 1);
  await guardar(registro, 3, { ...datos, ubicacion_comercial: "residencial" });
  assert.equal((await casos("nobu", "recuperacion")).total, 0);
  assert.equal((await casos("residencial", "recuperacion")).total, 1);
  await como(inactivo);
  await assert.rejects(casos(""), /COMERCIAL_ACCESO/);
  await como(inactivo);
  await assert.rejects(contactos(""), /COMERCIAL_ACCESO/);
});
