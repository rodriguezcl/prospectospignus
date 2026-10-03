import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { generarAlternativas } from "../../src/features/oportunidades/domain/alternativas.js";
import { prepararCatalogo } from "../../src/features/productos/domain/catalogo.js";

test("precios por modalidad: venta sin negociación, planes restringidos e historial inmutable", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  const carpeta = new URL("../migrations/", import.meta.url);
  for (const archivo of (await readdir(carpeta))
    .filter((a) => a.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(new URL(archivo, carpeta), "utf8"));
  const [admin, vendedor, marca, fa, fc, sensor, camara, plan, kit, kitCamara] =
    Array.from({ length: 10 }, randomUUID);
  for (const [id, rol] of [
    [admin, "administrador"],
    [vendedor, "vendedor"],
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
  const item = {
    marca_id: marca,
    familia_id: fa,
    servicio: "alarma",
    tipo: "adicional",
    modalidad: null,
    unidad: "unidad",
    estado: "activo",
    validado_tecnicamente: true,
    adicional_habilitado: true,
    incluidos: [],
    kits_compatibles: [],
    abonos: {},
  };
  const catalogo = {
    esquema: 4,
    marcas: [{ id: marca, nombre: "PRUEBA", estado: "activo" }],
    familias: [
      {
        id: fa,
        marca_id: marca,
        nombre: "PRUEBA",
        marca: "PRUEBA",
        servicio: "alarma",
        estado: "activo",
      },
      {
        id: fc,
        marca_id: marca,
        nombre: "PRUEBA",
        marca: "PRUEBA",
        servicio: "camaras",
        estado: "activo",
      },
    ],
    items: [
      {
        ...item,
        id: sensor,
        codigo: "S",
        nombre: "SENSOR",
        precios: { alto: "30", bajo: "20", telefonico: "10" },
      },
      {
        ...item,
        id: camara,
        codigo: "C",
        nombre: "CAMARA",
        familia_id: fc,
        servicio: "camaras",
        precios: { telefonico: "25" },
      },
      {
        ...item,
        id: plan,
        codigo: "P",
        nombre: "PLAN",
        tipo: "kit",
        modalidad: "plan",
        adicional_habilitado: false,
        incluidos: [{ item_id: sensor, cantidad: 7 }],
        precios: {
          catalogo: "500",
          alto: "400",
          medio: "300",
          bajo: "200",
          telefonico: "100",
        },
      },
      {
        ...item,
        id: kit,
        codigo: "K",
        nombre: "KIT",
        tipo: "kit",
        modalidad: "kit",
        adicional_habilitado: false,
        incluidos: [{ item_id: sensor, cantidad: 7 }],
        precios: { telefonico: "150" },
      },
      {
        ...item,
        id: kitCamara,
        codigo: "KC",
        nombre: "KIT CAMARAS",
        tipo: "kit",
        modalidad: "kit",
        adicional_habilitado: false,
        familia_id: fc,
        servicio: "camaras",
        incluidos: [{ item_id: camara, cantidad: 4 }],
        precios: { telefonico: "90" },
      },
    ],
  };
  const validar = (d) =>
    db.query("select privado.validar_catalogo_025($1)", [d]);
  await validar(catalogo);
  for (const cambiar of [
    (d) => {
      d.items[0].tipo = "mano_obra";
    },
    (d) => {
      d.familias[0].servicio = "cerco";
    },
    (d) => {
      d.items[0].adicional_habilitado = false;
      d.items[0].precios = {};
    },
    (d) => {
      d.items[1].precios.alto = "35";
    },
    (d) => {
      d.items[2].precios = { telefonico: "100" };
    },
    (d) => {
      d.items[3].precios.catalogo = "200";
    },
    (d) => {
      d.items[3].precios = {};
    },
    (d) => {
      d.items[4].modalidad = "plan";
    },
  ]) {
    const invalido = structuredClone(catalogo);
    cambiar(invalido);
    await assert.rejects(validar(invalido), /CATALOGO_/);
  }
  // El servidor recalcula la venta y rechaza bonificaciones/listas forzadas por el cliente.
  const calcular = async (seleccion, telefono = false) =>
    (
      await db.query("select privado.calcular_propuesta($1,$2,$3) r", [
        catalogo,
        seleccion,
        telefono,
      ])
    ).rows[0].r;
  for (const [familiaId, kitId, extraId, total] of [
    [fa, kit, sensor, "170.00"],
    [fc, kitCamara, camara, "140.00"],
  ]) {
    const opciones = generarAlternativas({
      catalogo,
      familiaId,
      kitId,
      nivel: "alto",
      subcategoria: "docta",
      extras: [{ item_id: extraId, cantidad: 2 }],
      telefonico: false,
    });
    assert.equal(opciones.length, 1);
    const opcion = opciones[0];
    assert.equal(opcion.total, total);
    assert.equal(opcion.seleccion.nivel, "telefonico");
    assert.equal(opcion.seleccion.subcategoria, null);
    const calculada = await calcular(opcion.seleccion);
    assert.equal(Number(calculada.total_exacto), Number(total));
    assert.equal(calculada.kit.incluidos[0].propiedad, "cliente");
    assert.equal(calculada.incluido_expensas, false);
    for (const cambiar of [
      (s) => {
        s.nivel = "catalogo";
      },
      (s) => {
        s.subcategoria = "docta";
      },
      (s) => {
        s.extras[0].bonificados = 1;
        s.extras[0].telefonicos = 1;
      },
      (s) => {
        s.extras[0].altos = 1;
        s.extras[0].telefonicos = 1;
      },
      (s) => {
        s.extras.push(s.extras[0]);
      },
      (s) => {
        s.extras[0].cantidad = "0";
      },
    ]) {
      const alterada = structuredClone(opcion.seleccion);
      cambiar(alterada);
      await assert.rejects(calcular(alterada), /PROPUESTA_/);
    }
  }
  const planAlto = generarAlternativas({
    catalogo,
    familiaId: fa,
    kitId: plan,
    nivel: "alto",
    extras: [{ item_id: sensor, cantidad: 1 }],
  });
  assert.equal(planAlto[0].total, "430.00");
  assert.equal(
    Number((await calcular(planAlto[0].seleccion)).total_exacto),
    430,
  );
  assert.throws(
    () =>
      generarAlternativas({
        catalogo,
        familiaId: fa,
        kitId: plan,
        nivel: "telefonico",
      }),
    /habilitado/,
  );
  const planTelefono = generarAlternativas({
    catalogo,
    familiaId: fa,
    kitId: plan,
    nivel: "telefonico",
    telefonico: true,
  });
  await assert.rejects(calcular(planTelefono[0].seleccion), /PROPUESTA_NIVEL/);
  assert.equal(
    Number((await calcular(planTelefono[0].seleccion, true)).total_exacto),
    100,
  );
  const forzada = structuredClone(planAlto[0].seleccion);
  Object.assign(forzada.extras[0], { altos: 0, bajos: 0, telefonicos: 1 });
  await assert.rejects(calcular(forzada), /PROPUESTA_NIVEL/);

  await como(admin);
  const operacion = randomUUID();
  const guardarCatalogo = (v, d, op = randomUUID()) =>
    db.query("select public.guardar_catalogo_025($1,$2,$3)", [v, op, d]);
  await guardarCatalogo(0, catalogo, operacion);
  await guardarCatalogo(0, catalogo, operacion);
  await assert.rejects(
    db.query("select public.guardar_catalogo_024(1,$1,$2)", [
      randomUUID(),
      { ...catalogo, esquema: 3 },
    ]),
    /CATALOGO_ESQUEMA/,
  );
  await como(vendedor);
  const vista = (await db.query("select public.leer_catalogo() r")).rows[0].r
    .datos;
  assert.equal(vista.esquema, 4);
  assert.equal(
    vista.items.find((i) => i.id === plan).precios.telefonico,
    undefined,
  );
  assert.equal(vista.items.find((i) => i.id === kit).precios.telefonico, "150");
  assert.equal(
    vista.items.find((i) => i.id === sensor).precios.telefonico,
    "10",
  );
  assert.equal(
    vista.items.find((i) => i.id === kitCamara).precios.telefonico,
    "90",
  );
  await assert.rejects(guardarCatalogo(1, catalogo), /CATALOGO_ACCESO/);
  const registro = randomUUID(),
    oportunidad = randomUUID();
  await db.query("select public.guardar_registro_inicial($1,0,$2)", [
    registro,
    {
      nombre: "Contacto prueba",
      telefono: "351 prueba",
      ubicacion: "Prueba",
      origen: "whatsapp",
    },
  ]);
  const interes = {
    registro_id: registro,
    vendedor_id: vendedor,
    interes_comercial: { servicios: ["alarma"], tipo_alarma: "a_definir" },
  };
  await assert.rejects(
    db.query("select public.iniciar_cotizacion($1,0,$2,$3)", [
      oportunidad,
      randomUUID(),
      { ...interes, interes_comercial: { servicios: ["cerco"] } },
    ]),
    /COMERCIAL_INTERES/,
  );
  await db.query("select public.iniciar_cotizacion($1,0,$2,$3)", [
    oportunidad,
    randomUUID(),
    interes,
  ]);
  const seleccion = generarAlternativas({
    catalogo: vista,
    familiaId: fa,
    kitId: kit,
    extras: [{ item_id: sensor, cantidad: 2 }],
  })[0].seleccion;
  const propuesta = randomUUID();
  const datos = {
    conceptos: [
      { seleccion, ordinal: 1, meses_congelamiento: 0, nivel_abono: null },
    ],
    pago: { base_efectivo: "0", medio_saldo: "transferencia", cuotas: 1 },
  };
  const guardarPropuesta = () =>
    db.query("select public.guardar_propuesta($1,$2,1,1,0,$3)", [
      propuesta,
      oportunidad,
      datos,
    ]);
  await guardarPropuesta();
  const historica = (
    await db.query("select * from public.propuestas_comerciales where id=$1", [
      propuesta,
    ])
  ).rows[0];
  assert.equal(historica.restringida, false);
  assert.equal(historica.detalle.total, "170.00");
  await como(admin);
  const actualizada = structuredClone(catalogo);
  actualizada.items[3].precios.telefonico = "175";
  await guardarCatalogo(1, actualizada);
  await como(vendedor);
  await guardarPropuesta(); // Reintento exacto sigue disponible con otra versión vigente.
  assert.deepEqual(
    (
      await db.query(
        "select detalle from public.propuestas_comerciales where id=$1",
        [propuesta],
      )
    ).rows[0].detalle,
    historica.detalle,
  );
  await db.exec("reset role; set role anon");
  await assert.rejects(
    db.query("select public.leer_catalogo()"),
    /permission denied/,
  );
});

test("adaptación: no inventa Telefónico a partir del antiguo precio único y retira cerco", () => {
  const anterior = {
    esquema: 3,
    marcas: [],
    familias: [
      { id: "f", servicio: "camaras" },
      { id: "c", servicio: "cerco" },
    ],
    items: [
      {
        id: "p",
        servicio: "camaras",
        tipo: "adicional",
        estado: "activo",
        precios: { unico: "25" },
      },
      {
        id: "k",
        servicio: "camaras",
        tipo: "kit",
        modalidad: "kit",
        estado: "activo",
        precios: { unico: "90" },
        incluidos: [{ item_id: "p", cantidad: 4 }],
      },
      {
        id: "c",
        servicio: "cerco",
        tipo: "mano_obra",
        estado: "activo",
        precios: { unico: "10" },
      },
    ],
  };
  const copia = structuredClone(anterior),
    adaptado = prepararCatalogo(anterior);
  assert.deepEqual(anterior, copia);
  assert.equal(adaptado.items.length, 2);
  assert.equal(adaptado.familias.length, 1);
  assert.ok(
    adaptado.items.every(
      (i) => i.estado === "borrador" && Object.keys(i.precios).length === 0,
    ),
  );
  assert.equal(adaptado.items[1].precio_unico_anterior, "90");
  assert.deepEqual(prepararCatalogo(adaptado), adaptado);
});
