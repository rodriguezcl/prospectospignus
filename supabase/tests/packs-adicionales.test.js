import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { generarAlternativas } from "../../src/features/oportunidades/domain/alternativas.js";
import { convertirAdicionales } from "../../src/features/productos/domain/convertirAdicionales.js";
import { prepararCatalogo } from "../../src/features/productos/domain/catalogo.js";
import { calcularPago } from "../../src/features/oportunidades/domain/pago.js";

test("packs de adicionales: cantidades, moneda, validación, persistencia y permisos", async (t) => {
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
    esquema: 7,
    moneda_adicionales: "ARS",
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
    db.query("select privado.validar_catalogo_031($1)", [d]);
  const pir = catalogo.items[0];
  pir.precios_pack_2 = { alto: "50", bajo: "35", telefonico: "18" };
  pir.precios_usd = { alto: "3", bajo: "2", telefonico: "1" };
  pir.precios_pack_2_usd = { alto: "5", bajo: "3.5", telefonico: "1.8" };
  catalogo.items[1].precios_usd = { telefonico: "2.5" };
  catalogo.items[1].precios_pack_2 = { telefonico: "40" };
  catalogo.items[1].precios_pack_2_usd = { telefonico: "4" };
  await validar(catalogo);
  for (const alteracion of [
    (d) => (d.items[0].precios_pack_2.alto = "61"),
    (d) => (d.items[0].precios_pack_2.bajo = "10"),
    (d) => (d.items[0].precios_pack_2.telefonico = null),
    (d) => (d.items[0].precios_pack_2.alto = "1.1234567"),
    (d) => (d.items[0].precios_pack_2.otro = "1"),
    (d) => (d.items[0].precios_pack_2 = []),
    (d) => (d.items[2].precios_pack_2 = { alto: "500" }),
    (d) => (d.items[0].unidad = "pack"),
    (d) => (d.items[0].precios_pack_2 = { alto: "30" }), // no puede superar el nivel Alto efectivo con Bajo individual
    (d) => (d.items[0].precios_pack_2_usd.bajo = "4.1"),
  ]) {
    const malo = structuredClone(catalogo);
    alteracion(malo);
    await assert.rejects(validar(malo), /CATALOGO_PACK/);
  }
  const cambio = (
    await db.query(
      "select public.registrar_cotizacion_dolar('1500.123456',now()) r",
    )
  ).rows[0].r;
  for (const moneda of ["ARS", "USD"]) {
    catalogo.moneda_adicionales = moneda;
    const vista = convertirAdicionales(catalogo, cambio);
    for (const [familiaId, kitId, extraId] of [
      [fa, kit, sensor],
      [fc, kitCamara, camara],
      [fa, plan, sensor],
    ])
      for (const cantidad of [1, 2, 3, 4, 5])
        for (const nivel of kitId === plan
          ? ["catalogo", "bajo", "telefonico"]
          : ["telefonico"]) {
          const opciones = generarAlternativas({
            catalogo: vista,
            familiaId,
            kitId,
            nivel,
            telefonico: true,
            extras: [{ item_id: extraId, cantidad }],
          });
          assert.ok(opciones.length);
          for (const opcion of opciones) {
            const [manual] = generarAlternativas({
              catalogo: vista, familiaId, kitId, nivel, telefonico: true,
              distribucionManual: true, extras: opcion.seleccion.extras,
            });
            assert.equal(manual.total, opcion.total);
            assert.deepEqual(manual.seleccion, opcion.seleccion);
            assert.deepEqual(manual.packs, opcion.packs);
            const calculado = (
              await db.query(
                "select privado.calcular_propuesta($1,$2,true) r",
                [catalogo, opcion.seleccion],
              )
            ).rows[0].r;
            assert.equal(
              Number(Number(calculado.total_exacto).toFixed(2)),
              Number(opcion.total),
            );
            const guardados = calculado.extras[0].packs.map(
              ({ nivel, packs, individuales, ahorro }) => ({
                nivel,
                packs: Number(packs),
                individuales: Number(individuales),
                ahorro,
              }),
            );
            assert.deepEqual(
              guardados,
              opcion.packs.map(({ item_id, ...p }) => p),
            );
            if (moneda === "ARS" && kitId === kit)
              assert.equal(
                opcion.total,
                ["160.00", "168.00", "178.00", "186.00", "196.00"][
                  cantidad - 1
                ],
              );
          }
        }
  }
  catalogo.moneda_adicionales = "ARS";
  await como(admin);
  const operacion = randomUUID();
  await db.query("select public.guardar_catalogo_031(0,$1,$2)", [
    operacion,
    catalogo,
  ]);
  await db.query("select public.guardar_catalogo_031(0,$1,$2)", [
    operacion,
    catalogo,
  ]);
  await assert.rejects(
    db.query("select public.guardar_catalogo_029(1,$1,$2)", [
      randomUUID(),
      { ...catalogo, esquema: 6 },
    ]),
    /CATALOGO_ESQUEMA/,
  );
  await como(vendedor);
  const vista = (await db.query("select public.leer_catalogo() r")).rows[0].r
    .datos;
  assert.deepEqual(
    vista.items.find((i) => i.id === sensor).precios_pack_2,
    pir.precios_pack_2,
  );
  assert.equal(
    vista.items.find((i) => i.id === plan).precios.telefonico,
    undefined,
  );
  await assert.rejects(
    db.query("select public.guardar_catalogo_031(1,$1,$2)", [
      randomUUID(),
      catalogo,
    ]),
    /CATALOGO_ACCESO/,
  );
  const registro = randomUUID(),
    oportunidad = randomUUID(),
    propuesta = randomUUID();
  await db.query("select public.guardar_registro_inicial($1,0,$2)", [
    registro,
    {
      nombre: "Prueba",
      telefono: "351 prueba",
      ubicacion: "Prueba",
      origen: "whatsapp",
    },
  ]);
  await db.query("select public.iniciar_cotizacion($1,0,$2,$3)", [
    oportunidad,
    randomUUID(),
    {
      registro_id: registro,
      vendedor_id: vendedor,
      interes_comercial: { servicios: ["alarma"], tipo_alarma: "a_definir" },
    },
  ]);
  const opcion = generarAlternativas({
    catalogo: vista,
    familiaId: fa,
    kitId: kit,
    extras: [{ item_id: sensor, cantidad: 3 }],
  })[0];
  const solicitud = {
    conceptos: [
      {
        seleccion: opcion.seleccion,
        ordinal: 1,
        meses_congelamiento: 0,
        nivel_abono: null,
      },
    ],
    pago: { base_efectivo: "0", medio_saldo: "credito", cuotas: 3 },
  };
  await db.query("select public.guardar_propuesta_030($1,$2,1,1,0,$3)", [
    propuesta,
    oportunidad,
    solicitud,
  ]);
  const historica = (
    await db.query(
      "select detalle from public.propuestas_comerciales where id=$1",
      [propuesta],
    )
  ).rows[0].detalle;
  assert.equal(historica.base, "178.00");
  assert.equal(historica.conceptos[0].extras[0].packs[0].precio_pack, "18");
  await como(admin);
  pir.precios_pack_2.telefonico = "19";
  await db.query("select public.guardar_catalogo_031(1,$1,$2)", [
    randomUUID(),
    catalogo,
  ]);
  await como(vendedor);
  await db.query("select public.guardar_propuesta_030($1,$2,1,1,0,$3)", [
    propuesta,
    oportunidad,
    solicitud,
  ]);
  assert.deepEqual(
    (
      await db.query(
        "select detalle from public.propuestas_comerciales where id=$1",
        [propuesta],
      )
    ).rows[0].detalle,
    historica,
  );
  // Ubicaciones 035: restricciones en ambas entidades y guardado versionado.
  await como(admin);
  const configurado = prepararCatalogo(catalogo);
  configurado.marcas[0].ubicaciones_alarma = ["docta", "con_monitoreo", "sin_monitoreo"];
  configurado.items.find(i => i.id === plan).ubicaciones_alarma = ["docta"];
  const opUbicacion = randomUUID();
  assert.equal((await db.query("select public.guardar_catalogo_035(2,$1,$2) v", [opUbicacion,configurado])).rows[0].v,3);
  assert.equal((await db.query("select public.guardar_catalogo_035(2,$1,$2) v", [opUbicacion,configurado])).rows[0].v,3);
  await assert.rejects(db.query("select public.guardar_catalogo_031(3,$1,$2)",[randomUUID(),catalogo]),/CATALOGO_ESQUEMA/);
  const invalido=structuredClone(configurado);invalido.marcas[0].ubicaciones_alarma=["docta","docta"];
  await assert.rejects(db.query("select public.guardar_catalogo_035(3,$1,$2)",[randomUUID(),invalido]),/CATALOGO_UBICACION/);
  await como(vendedor);
  const limitado=(await db.query("select public.leer_catalogo() r")).rows[0].r.datos;
  assert.deepEqual(limitado.items.find(i=>i.id===plan).ubicaciones_alarma,["docta"]);
  assert.equal(limitado.items.find(i=>i.id===plan).precios.telefonico,undefined);
  await assert.rejects(db.query("select public.guardar_catalogo_035(3,$1,$2)",[randomUUID(),configurado]),/CATALOGO_ACCESO/);
  await db.exec("reset role");
  const seleccion={familia_id:fa,kit_id:plan,nivel:"catalogo",subcategoria:"docta",extras:[]};
  await db.query("select privado.calcular_propuesta($1,$2,false)",[configurado,seleccion]);
  for(const lugar of ["nobu","con_monitoreo","sin_monitoreo"])
    await assert.rejects(db.query("select privado.calcular_propuesta($1,$2,false)",[configurado,{...seleccion,subcategoria:lugar}]),/PROPUESTA_UBICACION/);
  const directa={...seleccion,kit_id:kit,nivel:"telefonico",subcategoria:null,ubicacion_alarma:"docta"};
  await db.query("select privado.calcular_propuesta($1,$2,false)",[configurado,directa]);
  await assert.rejects(db.query("select privado.calcular_propuesta($1,$2,false)",[configurado,{...directa,ubicacion_alarma:null}]),/PROPUESTA_UBICACION/);
  const hik=structuredClone(catalogo);hik.marcas[0].nombre="HIKVISION";
  await assert.rejects(db.query("select privado.calcular_propuesta($1,$2,false)",[hik,seleccion]),/PROPUESTA_UBICACION/);
  await db.query("select privado.calcular_propuesta($1,$2,false)",[hik,{...seleccion,subcategoria:"sin_monitoreo"}]);

});
