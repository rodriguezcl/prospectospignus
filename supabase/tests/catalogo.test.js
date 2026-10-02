import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import {
  prepararCatalogo,
  completarGrupos,
} from "../../src/features/productos/domain/catalogo.js";
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
  assert.equal(
    (await db.query("select nombre from public.perfiles where id=$1", [admin]))
      .rows[0].nombre,
    "PRUEBA ADMINISTRADOR",
  );
  assert.equal(
    (
      await db.query("select privado.normalizar_catalogo_021($1) as d", [
        {
          marcas: [{ nombre: "  peña álvarez  " }],
          items: [
            {
              nombre: "sensor óptico",
              codigo: "Ab-12",
              nota: "Conservar texto",
            },
          ],
        },
      ])
    ).rows[0].d.marcas[0].nombre,
    "PEÑA ÁLVAREZ",
  );
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
  assert.equal(
    (
      await db.query(
        "select datos from public.versiones_catalogo where version=1",
      )
    ).rows[0].datos.items[1].nombre,
    "KIT PRUEBA",
  );
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
  const nuevo = completarGrupos(prepararCatalogo(datos), randomUUID);
  const tipo = randomUUID();
  nuevo.tipos.push({ id: tipo, nombre: "Inicial", estado: "activo" });
  nuevo.items.forEach((i) => {
    i.estado = "activo";
    if (i.tipo === "kit") {
      i.modalidad = "plan";
      i.tipo_comercial_id = tipo;
    }
  });
  const opNuevo = randomUUID();
  await guardar(2, nuevo, opNuevo);
  await guardar(2, nuevo, opNuevo);
  await assert.rejects(guardar(3, datos), /CATALOGO_ESQUEMA/);
  await assert.rejects(
    db.query("select public.guardar_catalogo_013(3,$1,$2)", [
      randomUUID(),
      datos,
    ]),
    /permission denied/,
  );
  const invalidoNuevo = structuredClone(nuevo);
  invalidoNuevo.tipos[0].estado = "inactivo";
  await assert.rejects(guardar(3, invalidoNuevo), /CATALOGO_CLASIFICACION/);
  const sinMarca = structuredClone(nuevo);
  sinMarca.marcas = [];
  await assert.rejects(guardar(3, sinMarca), /CATALOGO_REFERENCIA/);
  const sinComponente = structuredClone(nuevo);
  sinComponente.items = sinComponente.items.filter((i) => i.id !== pir);
  await assert.rejects(guardar(3, sinComponente), /CATALOGO_COMPATIBILIDAD/);
  await como(vendedor);
  const vistaNueva = (await db.query("select public.leer_catalogo() v")).rows[0]
    .v;
  assert.equal(
    vistaNueva.datos.items.find((i) => i.id === kit).modalidad,
    "plan",
  );
  assert.equal(vistaNueva.datos.tipos[0].nombre, "INICIAL");
  assert.equal(JSON.stringify(vistaNueva).includes("telefonico"), false);
  await assert.rejects(
    db.query("select public.guardar_catalogo_020(3,$1,$2)", [
      randomUUID(),
      nuevo,
    ]),
    /CATALOGO_ACCESO/,
  );
  await db.exec("reset role");
  const seleccion = {
    familia_id: nuevo.items[0].familia_id,
    kit_id: kit,
    subcategoria: "sin_monitoreo",
    nivel: "catalogo",
    extras: [
      {
        item_id: pir,
        cantidad: "3",
        bonificados: 1,
        altos: 0,
        bajos: 2,
        telefonicos: 0,
      },
    ],
  };
  const calcular = async (cat, sel = seleccion) =>
    (
      await db.query("select privado.calcular_propuesta($1,$2,false) r", [
        cat,
        sel,
      ])
    ).rows[0].r;
  const plan = await calcular(nuevo);
  assert.equal(plan.kit.incluidos[0].propiedad, "comodato");
  assert.deepEqual(plan.extras[0].propiedad, {
    comodato: 1,
    cliente: 2,
    obsequio: 0,
  });
  const venta = structuredClone(nuevo);
  venta.items[1].modalidad = "kit";
  const vendido = await calcular(venta);
  assert.equal(vendido.kit.incluidos[0].propiedad, "cliente");
  assert.deepEqual(vendido.extras[0].propiedad, {
    comodato: 0,
    cliente: 3,
    obsequio: 1,
  });
  const noExtra = structuredClone(nuevo);
  noExtra.items[0].adicional_habilitado = false;
  await assert.rejects(calcular(noExtra), /PROPUESTA_COMPOSICION/);
  assert.ok(await calcular(noExtra, { ...seleccion, extras: [] }));
  await como(admin);
  await db.exec("reset role");
  const soloIncluido = structuredClone(nuevo);
  soloIncluido.items[0].adicional_habilitado = false;
  soloIncluido.items[0].precios = {};
  await db.query("select privado.validar_catalogo_020($1)", [soloIncluido]);
  soloIncluido.items[0].adicional_habilitado = true;
  await assert.rejects(
    db.query("select privado.validar_catalogo_020($1)", [soloIncluido]),
    /CATALOGO_INCOMPLETO/,
  );
  const camaras = structuredClone(nuevo);
  camaras.familias[0].servicio = "camaras";
  camaras.items.forEach((i) => {
    i.servicio = "camaras";
    i.precios = { unico: "100" };
    i.abonos = {};
  });
  await assert.rejects(
    db.query("select privado.validar_catalogo_020($1)", [camaras]),
    /CATALOGO_MODALIDAD/,
  );
  camaras.items[1].modalidad = "kit";
  await db.query("select privado.validar_catalogo_020($1)", [camaras]);
  await como(admin);
  const vacio = { esquema: 2, marcas: [], tipos: [], familias: [], items: [] };
  await guardar(3, vacio);
  assert.equal(
    (await db.query("select count(*) n from public.versiones_catalogo")).rows[0]
      .n,
    4,
  );
  assert.equal(
    (
      await db.query(
        "select datos from public.versiones_catalogo where version=3",
      )
    ).rows[0].datos.items.length,
    2,
  );
});
