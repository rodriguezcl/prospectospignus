import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { generarAlternativas } from "../../src/features/oportunidades/domain/alternativas.js";
import { convertirAdicionales } from "../../src/features/productos/domain/convertirAdicionales.js";
import { prepararCatalogo } from "../../src/features/productos/domain/catalogo.js";
import { calcularPago } from "../../src/features/oportunidades/domain/pago.js";

test("listas ARS/USD: validación, conversión autoritativa y permisos", async (t) => {
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
    esquema: 6,
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
    db.query("select privado.validar_catalogo_029($1)", [d]);
  await validar(catalogo);
  catalogo.moneda_adicionales = "USD";
  await assert.rejects(validar(catalogo), /CATALOGO_USD/);
  catalogo.items[0].precios_usd = {
    alto: "2.333333",
    bajo: "2",
    telefonico: "1.111111",
  };
  catalogo.items[1].precios_usd = { telefonico: "3" };
  await validar(catalogo);
  const mala = structuredClone(catalogo);
  mala.items[0].precios_usd.bajo = "5";
  await assert.rejects(validar(mala), /CATALOGO_USD/);
  await como(admin);
  await assert.rejects(
    db.query("select public.registrar_cotizacion_dolar('1500',now())"),
    /permission denied/,
  );
  await assert.rejects(
    db.query(
      "insert into public.cotizaciones_dolar(venta,fecha_fuente) values(1,now())",
    ),
    /permission denied/,
  );
  await db.exec("reset role");
  const cambio = (
    await db.query(
      "select public.registrar_cotizacion_dolar('1500.123456',now()) r",
    )
  ).rows[0].r;
  const primaria = (
    await db.query(
      "select public.registrar_cotizacion_dolar_037('1501',now()-interval '1 minute','monedapi') r",
    )
  ).rows[0].r;
  assert.equal(primaria.proveedor, "monedapi");
  await assert.rejects(
    db.query(
      "select public.registrar_cotizacion_dolar_037('1501',now()-interval '2 minutes','monedapi')",
    ),
    /DOLAR_ATRASADO/,
  );
  await assert.rejects(
    db.query(
      "select public.registrar_cotizacion_dolar_037('1501',now(),'bna')",
    ),
    /DOLAR_DATOS/,
  );
  await como(admin);
  await assert.rejects(
    db.query(
      "select public.registrar_cotizacion_dolar_037('1501',now(),'monedapi')",
    ),
    /permission denied/,
  );
  await db.exec("reset role");
  assert.equal(
    (
      await db.query(
        "select venta::text from public.cotizaciones_dolar where id=$1",
        [cambio.id],
      )
    ).rows[0].venta,
    "1500.123456",
  );
  const convertido = convertirAdicionales(catalogo, cambio);
  const calcular = async (seleccion) =>
    (
      await db.query("select privado.calcular_propuesta($1,$2,false) r", [
        catalogo,
        seleccion,
      ])
    ).rows[0].r;
  let opcion;
  for (const [familiaId, kitId, extraId] of [
    [fa, kit, sensor],
    [fc, kitCamara, camara],
    [fa, plan, sensor],
  ]) {
    for (const seleccion of generarAlternativas({
      catalogo: convertido,
      familiaId,
      kitId,
      nivel: "alto",
      subcategoria: "sin_monitoreo",
      extras: [{ item_id: extraId, cantidad: 2 }],
    })) {
      const resultado = await calcular(seleccion.seleccion);
      assert.equal(
        Number(Number(resultado.total_exacto).toFixed(2)),
        Number(seleccion.total),
      );
      assert.equal(resultado.tipo_cambio.venta, cambio.venta);
      if (kitId === kit) opcion = seleccion;
    }
  }
  await assert.rejects(
    calcular({ ...opcion.seleccion, tipo_cambio_id: randomUUID() }),
    /PROPUESTA_DOLAR/,
  );
  await assert.rejects(
    calcular({ ...opcion.seleccion, tipo_cambio_id: null }),
    /PROPUESTA_DOLAR/,
  );
  await db.query(
    "update public.cotizaciones_dolar set consultado_en=now()-interval '31 minutes'",
  );
  await assert.rejects(calcular(opcion.seleccion), /PROPUESTA_DOLAR/);
  await db.query("update public.cotizaciones_dolar set consultado_en=now()");
  await como(admin);
  const op = randomUUID();
  await db.query("select public.guardar_catalogo_029(0,$1,$2)", [op, catalogo]);
  await db.query("select public.guardar_catalogo_029(0,$1,$2)", [op, catalogo]);
  await assert.rejects(
    db.query("select public.guardar_catalogo_026(1,$1,$2)", [
      randomUUID(),
      { ...catalogo, esquema: 5 },
    ]),
    /CATALOGO_ESQUEMA/,
  );
  await como(vendedor);
  const vista = (await db.query("select public.leer_catalogo() r")).rows[0].r
    .datos;
  assert.equal(vista.esquema, 6);
  assert.equal(vista.moneda_adicionales, "USD");
  assert.equal(
    vista.items.find((i) => i.id === plan).precios.telefonico,
    undefined,
  );
  assert.equal(
    vista.items.find((i) => i.id === sensor).precios_usd.telefonico,
    "1.111111",
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
  const datos = {
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
  await db.query("select public.guardar_propuesta($1,$2,1,1,0,$3)", [
    propuesta,
    oportunidad,
    datos,
  ]);
  const historica = (
    await db.query("select * from public.propuestas_comerciales where id=$1", [
      propuesta,
    ])
  ).rows[0];
  assert.equal(historica.restringida, false);
  assert.equal(historica.detalle.conceptos[0].tipo_cambio.id, cambio.id);
  assert.equal(historica.detalle.base, opcion.total);
  await db.exec("reset role");
  await db.query(
    "update public.cotizaciones_dolar set consultado_en=now()-interval '31 minutes'",
  );
  await como(vendedor);
  await db.query("select public.guardar_propuesta($1,$2,1,1,0,$3)", [
    propuesta,
    oportunidad,
    datos,
  ]);
  assert.deepEqual(
    (
      await db.query(
        "select detalle from public.propuestas_comerciales where id=$1",
        [propuesta],
      )
    ).rows[0].detalle,
    historica.detalle,
  );

  let versionOferta = 2;
  for (const baseEfectivo of ["0", "100"])
    for (const cuotas of [1, 3, 6]) {
      const id = randomUUID();
      const solicitud = {
        ...datos,
        pago: {
          base_efectivo: baseEfectivo,
          medio_saldo: "credito",
          cuotas,
          redondeo_manual: "15.42",
        },
      };
      await db.exec("reset role");
      await db.query(
        "update public.cotizaciones_dolar set consultado_en=now()",
      );
      await como(vendedor);
      const parametros = [id, oportunidad, versionOferta++, solicitud];
      await db.query(
        "select public.guardar_propuesta_030($1,$2,$3,1,0,$4)",
        parametros,
      );
      await db.query(
        "select public.guardar_propuesta_030($1,$2,$3,1,0,$4)",
        parametros,
      );
      const guardado = (
        await db.query(
          "select detalle from public.propuestas_comerciales where id=$1",
          [id],
        )
      ).rows[0].detalle;
      const local = calcularPago({
        total: opcion.total,
        baseEfectivo,
        medioSaldo: "credito",
        cuotas,
        redondeoManual: "15.42",
      });
      assert.equal(guardado.total, local.total);
      assert.equal(guardado.redondeo_manual, "15.42");
      assert.equal(guardado.pago.efectivo_a_abonar, local.efectivo_a_abonar);
      assert.equal(guardado.pago.saldo, local.saldo);
      assert.equal(guardado.pago.cuota, local.cuotas[0]);
    }
  for (const redondeo_manual of ["-1", "999999999999", "1.001"])
    await assert.rejects(
      db.query("select public.guardar_propuesta_030($1,$2,$3,1,0,$4)", [
        randomUUID(),
        oportunidad,
        versionOferta,
        { ...datos, pago: { ...datos.pago, redondeo_manual } },
      ]),
      /PROPUESTA_REDONDEO/,
    );
  // La condición publicada solo puede cambiarla Administración.
  const condiciones = (await db.query("select public.leer_condiciones() valor"))
    .rows[0].valor;
  assert.equal(condiciones.datos.redondeo_maximo_porcentaje, "1");
  await assert.rejects(
    db.query("select public.guardar_propuesta_030($1,$2,$3,1,0,$4)", [
      randomUUID(),
      oportunidad,
      versionOferta,
      { ...datos, pago: { ...datos.pago, redondeo_manual: opcion.total } },
    ]),
    /PROPUESTA_REDONDEO/,
  );
  const condicionesCero = {
    ...condiciones.datos,
    redondeo_maximo_porcentaje: "0",
  };
  await assert.rejects(
    db.query("select public.guardar_condiciones(0,$1,$2)", [
      randomUUID(),
      condicionesCero,
    ]),
    /CATALOGO_ACCESO/,
  );
  await como(admin);
  for (const porcentaje of ["-1", "100.01", "1.001", "abc", null]) {
    await assert.rejects(
      db.query("select public.guardar_condiciones(0,$1,$2)", [
        randomUUID(),
        { ...condiciones.datos, redondeo_maximo_porcentaje: porcentaje },
      ]),
      /CATALOGO_CONDICIONES/,
    );
  }
  const operacionCondiciones = randomUUID();
  for (let intento = 0; intento < 2; intento++)
    await db.query("select public.guardar_condiciones(0,$1,$2)", [
      operacionCondiciones,
      condicionesCero,
    ]);
  await como(vendedor);
  const solicitudRedondeo = {
    ...datos,
    pago: { ...datos.pago, redondeo_manual: "15.42" },
  };
  await assert.rejects(
    db.query("select public.guardar_propuesta_030($1,$2,$3,1,0,$4)", [
      randomUUID(),
      oportunidad,
      versionOferta,
      solicitudRedondeo,
    ]),
    /PROPUESTA_VIGENCIA/,
  );
  await assert.rejects(
    db.query("select public.guardar_propuesta_030($1,$2,$3,1,1,$4)", [
      randomUUID(),
      oportunidad,
      versionOferta,
      solicitudRedondeo,
    ]),
    /PROPUESTA_REDONDEO/,
  );
  await como(admin);
  await db.query("select public.guardar_condiciones(1,$1,$2)", [
    randomUUID(),
    { ...condiciones.datos, redondeo_maximo_porcentaje: "2" },
  ]);
  const { redondeo_maximo_porcentaje: omitido, ...sinPorcentaje } =
    condiciones.datos;
  await assert.rejects(
    db.query("select public.guardar_condiciones(2,$1,$2)", [
      randomUUID(),
      sinPorcentaje,
    ]),
    /CATALOGO_CONDICIONES/,
  );
  await como(vendedor);
  await db.query("select public.guardar_propuesta_030($1,$2,$3,1,2,$4)", [
    randomUUID(),
    oportunidad,
    versionOferta++,
    solicitudRedondeo,
  ]);
  const cierre = {
    resumen: "Aceptó la oferta",
    condiciones: "Propuesta guardada",
    aceptacion_confirmada: "si",
    canal: "whatsapp",
    confirmado_en: new Date().toISOString(),
    propuesta_id: propuesta,
  };
  const cerrar = (operacion = randomUUID()) =>
    db.query(
      `select public.gestionar_oportunidad($1,${versionOferta},$2,'ganar',$3)`,
      [oportunidad, operacion, cierre],
    );
  await db.exec("reset role");
  await db.query(
    "update public.propuestas_comerciales set creado_en=now()-interval '120 hours' where id=$1",
    [propuesta],
  );
  await como(vendedor);
  await assert.rejects(cerrar(), /PROPUESTA_VENCIDA/);
  await db.exec("reset role");
  await db.query(
    "update public.propuestas_comerciales set creado_en=now()-interval '119 hours' where id=$1",
    [propuesta],
  );
  await como(admin);
  await db.query("select public.guardar_catalogo_029(1,$1,$2)", [
    randomUUID(),
    { ...catalogo, moneda_adicionales: "ARS" },
  ]);
  await como(vendedor);
  const operacionCierre = randomUUID();
  await cerrar(operacionCierre);
  await db.exec("reset role");
  await db.query(
    "update public.propuestas_comerciales set creado_en=now()-interval '121 hours' where id=$1",
    [propuesta],
  );
  await como(vendedor);
  await cerrar(operacionCierre); // Reintento de un cierre ya confirmado no se invalida.
});
