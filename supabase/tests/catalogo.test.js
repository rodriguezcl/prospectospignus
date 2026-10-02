import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
test("catálogo: versiones, activación, RLS y precios restringidos", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; grant usage on schema auth to authenticated;
 create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  const carpeta = new URL("../migrations/", import.meta.url);
  for (const archivo of (await readdir(carpeta))
    .filter((a) => a.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(new URL(archivo, carpeta), "utf8"));
  const [admin, vendedor, agente] = Array.from({ length: 3 }, randomUUID);
  for (const [id, rol] of [
    [admin, "administrador"],
    [vendedor, "vendedor"],
    [agente, "agente"],
  ])
    await db.query("insert into auth.users values($1,$2,$3)", [
      id,
      `${id}@example.invalid`,
      {
        pignus_autorizado: true,
        nombre: `Prueba ${rol}`,
        rol,
        ...(id === admin ? {} : { creado_por: admin }),
      },
    ]);
  async function como(id) {
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  }
  const guardar = (version, datos, op = randomUUID()) =>
    db.query("select public.guardar_catalogo($1,$2,$3)", [version, op, datos]);
  const f = randomUUID(),
    pir = randomUUID(),
    kit = randomUUID();
  const datos = {
    familias: [
      {
        id: f,
        nombre: "Familia prueba",
        marca: "Marca prueba",
        servicio: "alarma",
        estado: "activo",
      },
    ],
    items: [
      {
        id: pir,
        familia_id: f,
        codigo: "PIR",
        nombre: "Sensor prueba",
        tipo: "adicional",
        unidad: "unidad",
        estado: "activo",
        validado_tecnicamente: true,
        precios: { alto: "112228.71", bajo: "92914.932", telefonico: "86999" },
        abonos: {},
        incluidos: [],
        kits_compatibles: [],
      },
      {
        id: kit,
        familia_id: f,
        codigo: "KIT",
        nombre: "Kit prueba",
        tipo: "kit",
        unidad: "unidad",
        estado: "activo",
        validado_tecnicamente: true,
        precios: {
          catalogo: "449999",
          alto: "359999",
          medio: "259999",
          bajo: "149999",
          telefonico: "53000",
        },
        abonos: {
          alto: "90000",
          medio: "80000",
          bajo: "70000",
          telefonico: "65000",
        },
        incluidos: [{ item_id: pir, cantidad: 1 }],
        kits_compatibles: [],
      },
    ],
  };
  await como(vendedor);
  await assert.rejects(guardar(0, datos), /CATALOGO_ACCESO/);
  await como(admin);
  const op = randomUUID();
  await guardar(0, datos, op);
  await guardar(0, datos, op);
  await assert.rejects(guardar(0, datos), /CATALOGO_CONFLICTO/);
  assert.equal(
    (await db.query("select * from public.versiones_catalogo")).rows.length,
    1,
  );
  for (const id of [vendedor, agente]) {
    await como(id);
    assert.equal(
      (await db.query("select * from public.versiones_catalogo")).rows.length,
      0,
    );
    const vista = (await db.query("select public.leer_catalogo() as v")).rows[0]
      .v;
    assert.equal(JSON.stringify(vista).includes("telefonico"), false);
    await assert.rejects(
      db.exec("update public.versiones_catalogo set datos='{}'"),
      /permission denied/,
    );
  }
  await como(admin);
  const sinPrecio = structuredClone(datos);
  delete sinPrecio.items[0].precios.bajo;
  await assert.rejects(guardar(1, sinPrecio), /CATALOGO_INCOMPLETO/);
  const invalido = structuredClone(datos);
  invalido.items[0].precios.bajo = "-1";
  await assert.rejects(guardar(1, invalido), /CATALOGO_PRECIO/);
  const incompatible = structuredClone(datos);
  incompatible.items[1].incluidos[0].item_id = randomUUID();
  await assert.rejects(guardar(1, incompatible), /CATALOGO_COMPATIBILIDAD/);
  await assert.rejects(
    guardar(1, { familias: datos.familias, items: [] }),
    /CATALOGO_CONSERVAR/,
  );
  const baja = structuredClone(datos);
  baja.items[1].estado = "inactivo";
  await guardar(1, baja);
  assert.equal(
    (
      await db.query(
        "select datos from public.versiones_catalogo where version=1",
      )
    ).rows[0].datos.items[1].estado,
    "activo",
  );
  await como(vendedor);
  assert.equal(
    (await db.query("select public.leer_catalogo() as v")).rows[0].v.datos.items
      .length,
    1,
  );
  const condiciones = (await db.query("select public.leer_condiciones() as v"))
    .rows[0].v;
  assert.equal(condiciones.datos.efectivo_porcentaje, 10);
  await assert.rejects(
    db.query("select public.guardar_condiciones(0,$1,$2)", [
      randomUUID(),
      condiciones.datos,
    ]),
    /CATALOGO_ACCESO/,
  );
  await como(admin);
  await db.query("select public.guardar_condiciones(0,$1,$2)", [
    randomUUID(),
    { ...condiciones.datos, congelamiento_vendedor: false },
  ]);
  await assert.rejects(
    db.query("select public.guardar_condiciones(1,$1,$2)", [
      randomUUID(),
      { ...condiciones.datos, meses_congelamiento: [4, 4] },
    ]),
    /CATALOGO_CONDICIONES/,
  );
});
