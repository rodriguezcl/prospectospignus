import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { generarAlternativas } from "../../src/features/oportunidades/domain/alternativas.js";
import { calcularPago } from "../../src/features/oportunidades/domain/pago.js";
import {
  prepararCatalogo,
  completarGrupos,
} from "../../src/features/productos/domain/catalogo.js";

test("propuestas: servidor autoritativo, pago mixto, versiones y permisos", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; grant usage on schema auth to authenticated;
 create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  const carpeta = new URL("../migrations/", import.meta.url);
  for (const a of (await readdir(carpeta))
    .filter((a) => a.endsWith(".sql") && !a.includes("028_codigos_internos"))
    .sort())
    await db.exec(await readFile(new URL(a, carpeta), "utf8"));
  const reparto = (
    await db.query("select privado.repartir_descuento($1,20000) r", [
      [
        { clave: "kit", tipo: "instalacion", importe_exacto: "400000" },
        { clave: "pir", tipo: "adicional", importe_exacto: "100000" },
      ],
    ])
  ).rows[0].r;
  assert.deepEqual(
    reparto.map((x) => x.descuento),
    ["16000.00", "4000.00"],
  );
  for (const valores of [
    ["0", "0"],
    ["0.004", "0.006"],
    ["1.333333", "2.777777", "0.111111"],
  ]) {
    const resultado = (
      await db.query("select privado.repartir_descuento($1,$2) r", [
        valores.map((importe_exacto, i) => ({
          clave: String(i),
          tipo: "adicional",
          importe_exacto,
        })),
        valores[0] === "0" ? "0" : "0.01",
      ])
    ).rows[0].r;
    const cent = (x) => BigInt(x.replace(".", ""));
    assert.equal(
      resultado.reduce((s, x) => s + cent(x.descuento), 0n),
      valores[0] === "0" ? 0n : 1n,
    );
    assert.ok(resultado.every((x) => cent(x.neto) >= 0n));
    assert.equal(
      resultado.reduce(
        (s, x) => s + cent(x.bruto) - cent(x.descuento) - cent(x.neto),
        0n,
      ),
      0n,
    );
  }
  const [admin, vendedor, otro, agente] = Array.from({ length: 4 }, randomUUID);
  for (const [id, rol] of [
    [admin, "administrador"],
    [vendedor, "vendedor"],
    [otro, "vendedor"],
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
  const [f, k, p] = Array.from({ length: 3 }, randomUUID);
  const item = {
    familia_id: f,
    unidad: "unidad",
    estado: "activo",
    validado_tecnicamente: true,
    abonos: {},
    incluidos: [],
    kits_compatibles: [],
  };
  const catalogo = {
    familias: [
      {
        id: f,
        nombre: "Prueba",
        marca: "Prueba",
        servicio: "alarma",
        estado: "activo",
      },
    ],
    items: [
      {
        ...item,
        id: p,
        codigo: "PIR",
        nombre: "Sensor",
        tipo: "adicional",
        precios: { alto: "112228.71", bajo: "92914.932", telefonico: "86999" },
      },
      {
        ...item,
        id: k,
        codigo: "KIT",
        nombre: "Kit",
        tipo: "kit",
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
        incluidos: [{ item_id: p, cantidad: 1 }],
      },
    ],
  };
  await como(admin);
  await db.query("select public.guardar_catalogo(0,$1,$2)", [
    randomUUID(),
    catalogo,
  ]);
  await como(vendedor);
  const registro = randomUUID(),
    oportunidad = randomUUID();
  await db.query("select public.guardar_registro_inicial($1,0,$2)", [
    registro,
    {
      nombre: "Contacto prueba",
      telefono: "0351 ficticio",
      ubicacion: "Dirección prueba",
      origen: "whatsapp",
    },
  ]);
  await db.query("select public.gestionar_oportunidad($1,0,$2,$3,$4)", [
    oportunidad,
    randomUUID(),
    "crear",
    {
      registro_id: registro,
      vendedor_id: vendedor,
      plazo: new Date(Date.now() + 86400000).toISOString(),
      resumen: "Conversación real prueba",
      contacto_confirmado: "si",
      necesidad: "Protección de vivienda",
    },
  ]);
  const opcion = generarAlternativas({
    catalogo,
    familiaId: f,
    kitId: k,
    nivel: "alto",
    subcategoria: "con_monitoreo",
    extras: [{ item_id: p, cantidad: 2 }],
  }).at(-1);
  const datos = {
    conceptos: [
      {
        seleccion: opcion.seleccion,
        ordinal: opcion.ordinal,
        nivel_abono: "bajo",
        meses_congelamiento: 6,
      },
    ],
    pago: { base_efectivo: "200000", medio_saldo: "credito", cuotas: 6 },
    total: "0.01",
  };
  const guardar = (version, d = datos, id = randomUUID(), cat = 1, cond = 0) =>
    db.query("select public.guardar_propuesta($1,$2,$3,$4,$5,$6)", [
      id,
      oportunidad,
      version,
      cat,
      cond,
      d,
    ]);
  const id = randomUUID();
  await guardar(1, datos, id);
  await guardar(1, datos, id);
  const original = (
    await db.query("select * from public.propuestas_comerciales where id=$1", [
      id,
    ])
  ).rows[0];
  await db.exec("reset role");
  await db.exec(
    await readFile(
      new URL("202610030028_codigos_internos.sql", carpeta),
      "utf8",
    ),
  );
  await como(vendedor);
  await guardar(1, datos, id);
  const vista = (await db.query("select * from public.propuestas_comerciales"))
    .rows;
  assert.equal(vista.length, 1);
  const patronCodigo =
    /^P-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}$/;
  assert.match(vista[0].codigo_interno, patronCodigo);
  const { codigo_interno: codigo, ...conservada } = vista[0];
  assert.deepEqual(
    conservada,
    original,
    "asignar código al histórico conserva todo el snapshot",
  );
  await assert.rejects(
    db.exec("select privado.codigo_propuesta_aleatorio()"),
    /permission denied/,
  );
  await db.exec("reset role");
  await db.exec("begin");
  await assert.rejects(
    db.query(
      "update public.propuestas_comerciales set codigo_interno='P-2222-2222' where id=$1",
      [id],
    ),
    /PROPUESTA_CODIGO_INMUTABLE/,
  );
  await db.exec("rollback");
  await db.exec("reset role");
  await db.exec("begin");
  // Fuerza una colisión para verificar que se genera otro código y no se duplica.
  await db.exec(`create sequence privado.intentos_codigo;
    create or replace function privado.codigo_propuesta_aleatorio() returns text
    language plpgsql volatile set search_path='' as $$
    begin
      if nextval('privado.intentos_codigo')=1 then
        return (select codigo_interno from public.propuestas_comerciales limit 1);
      end if;
      return 'P-2222-3333';
    end $$;`);
  const copia = {
    ...vista[0],
    id: randomUUID(),
    codigo_interno: "P-4444-5555",
  };
  const asignada = (
    await db.query(
      "insert into public.propuestas_comerciales select * from jsonb_populate_record(null::public.propuestas_comerciales,$1) returning codigo_interno",
      [copia],
    )
  ).rows[0];
  assert.equal(
    asignada.codigo_interno,
    "P-2222-3333",
    "ignora código externo y reintenta colisión",
  );
  assert.equal(
    (await db.query("select last_value from privado.intentos_codigo")).rows[0]
      .last_value,
    2,
  );
  await db.exec("rollback");
  await como(vendedor);
  assert.equal(
    (
      await db.query(
        "select codigo_interno from public.propuestas_comerciales where id=$1",
        [id],
      )
    ).rows[0].codigo_interno,
    codigo,
  );
  assert.equal(vista[0].detalle.total, "339999.00");
  assert.equal(vista[0].detalle.abono, "70000.00");
  assert.equal(vista[0].detalle.pago.efectivo_a_abonar, "180000.00");
  const pago = calcularPago({
    total: opcion.total,
    baseEfectivo: "200000",
    medioSaldo: "credito",
    cuotas: 6,
  });
  assert.equal(vista[0].detalle.total, pago.total);
  assert.equal(vista[0].detalle.pago.ultima_cuota, pago.cuotas.at(-1));
  await assert.rejects(guardar(1), /PROPUESTA_CONFLICTO/);
  await assert.rejects(
    guardar(2, { ...datos, pago: { ...datos.pago, base_efectivo: "999999" } }),
    /PROPUESTA_PAGO/,
  );
  const bonificado = structuredClone(datos);
  bonificado.conceptos[0].seleccion.nivel = "bajo";
  await assert.rejects(guardar(2, bonificado), /PROPUESTA_BONIFICACION/);
  const telefonico = structuredClone(datos);
  telefonico.conceptos[0].nivel_abono = "telefonico";
  await assert.rejects(guardar(2, telefonico), /PROPUESTA_NIVEL/);
  await assert.rejects(
    guardar(2, datos, randomUUID(), 0),
    /PROPUESTA_VIGENCIA/,
  );
  await assert.rejects(
    db.exec("update public.propuestas_comerciales set detalle='{}'"),
    /permission denied/,
  );
  await como(otro);
  assert.equal(
    (await db.query("select * from public.propuestas_comerciales")).rows.length,
    0,
  );
  await assert.rejects(guardar(2), /PROPUESTA_ACCESO/);
  await como(vendedor);
  const dos = { ...datos, conceptos: [...datos.conceptos, ...datos.conceptos] };
  await guardar(2, dos);
  const codigos = (
    await db.query("select codigo_interno from public.propuestas_comerciales")
  ).rows.map((p) => p.codigo_interno);
  assert.equal(new Set(codigos).size, codigos.length);
  for (const c of codigos) assert.match(c, patronCodigo);
  const conjunto = (
    await db.query(
      "select detalle from public.propuestas_comerciales order by creado_en desc",
    )
  ).rows[0].detalle;
  assert.equal(conjunto.total, "699997.98");
  assert.equal(conjunto.ajuste_redondeo, "0.02");
  assert.equal(conjunto.pago.cuota, conjunto.pago.ultima_cuota);
  assert.equal(conjunto.abono, "140000.00");
  await como(admin);
  const conf = (await db.query("select public.leer_condiciones() c")).rows[0].c;
  await db.query("select public.guardar_condiciones(0,$1,$2)", [
    randomUUID(),
    { ...conf.datos, congelamiento_vendedor: false },
  ]);
  await como(vendedor);
  await assert.rejects(
    guardar(3, datos, randomUUID(), 1, 1),
    /PROPUESTA_CONGELAMIENTO/,
  );
  await como(admin);
  await db.exec("reset role");
  await db.query(
    "update public.oportunidades set estado='recuperacion',responsable_id=$1 where id=$2",
    [agente, oportunidad],
  );
  await como(agente);
  const tel = generarAlternativas({
    catalogo,
    familiaId: f,
    kitId: k,
    nivel: "telefonico",
    telefonico: true,
    subcategoria: "con_monitoreo",
    extras: [{ item_id: p, cantidad: 2 }],
  }).at(-1);
  await guardar(
    3,
    {
      conceptos: [
        {
          seleccion: tel.seleccion,
          ordinal: tel.ordinal,
          nivel_abono: "telefonico",
          meses_congelamiento: 4,
        },
      ],
      pago: { base_efectivo: "0", medio_saldo: "debito", cuotas: 1 },
    },
    randomUUID(),
    1,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select detalle from public.propuestas_comerciales where restringida",
      )
    ).rows[0].detalle.total,
    "226998.00",
  );
  const aceptada = (
    await db.query(
      "select id from public.propuestas_comerciales where restringida",
    )
  ).rows[0].id;
  const cierre = {
    resumen: "El cliente confirmó la contratación",
    condiciones: "Condiciones de la propuesta aceptada",
    aceptacion_confirmada: "si",
    canal: "whatsapp",
    confirmado_en: new Date().toISOString(),
    propuesta_id: aceptada,
  };
  const cerrar = (d, op = randomUUID()) =>
    db.query("select public.gestionar_oportunidad($1,4,$2,'ganar',$3)", [
      oportunidad,
      op,
      d,
    ]);
  await assert.rejects(
    cerrar({ ...cierre, propuesta_id: "" }),
    /COMERCIAL_PROPUESTA/,
  );
  await assert.rejects(
    db.query(
      "select public.gestionar_oportunidad_base_v14($1,4,$2,'ganar',$3)",
      [oportunidad, randomUUID(), cierre],
    ),
    /permission denied/,
  );
  const eventoCierre = randomUUID();
  await cerrar(cierre, eventoCierre);
  await cerrar(cierre, eventoCierre);
  const ciclo = (
    await db.query(
      "select * from public.ciclos_comerciales where oportunidad_id=$1",
      [oportunidad],
    )
  ).rows[0];
  assert.equal(ciclo.propuesta_aceptada_id, aceptada);
  assert.equal(ciclo.cierre_evento_id, eventoCierre);
  assert.equal(
    (
      await db.query(
        "select cerrado_por from public.oportunidades where id=$1",
        [oportunidad],
      )
    ).rows[0].cerrado_por,
    agente,
  );
  await como(vendedor);
  assert.equal(
    (
      await db.query(
        "select * from public.propuestas_comerciales where restringida",
      )
    ).rows.length,
    0,
  );
  const otroCaso = randomUUID(),
    plazo = new Date(Date.now() + 86400000).toISOString();
  const gestionar = (version, accion, datos) =>
    db.query("select public.gestionar_oportunidad($1,$2,$3,$4,$5)", [
      otroCaso,
      version,
      randomUUID(),
      accion,
      datos,
    ]);
  await gestionar(0, "crear", {
    registro_id: registro,
    vendedor_id: vendedor,
    plazo,
    resumen: "Otra necesidad real",
    contacto_confirmado: "si",
    necesidad: "Segunda ubicación de prueba",
    origen_comercial: "propio",
  });
  assert.equal(
    (
      await db.query(
        "select origen from public.ciclos_comerciales where oportunidad_id=$1",
        [otroCaso],
      )
    ).rows[0].origen,
    "propio",
  );
  assert.equal(
    (
      await db.query(
        "select ciclo_comercial from public.actividades_agenda where oportunidad_id=$1",
        [otroCaso],
      )
    ).rows[0].ciclo_comercial,
    1,
  );
  await gestionar(1, "perder", {
    resumen: "Fuera de la zona de cobertura",
    motivo: "fuera_de_zona",
  });
  await assert.rejects(
    db.query("select public.corregir_perdida($1,2,$2,$3)", [
      otroCaso,
      randomUUID(),
      { resumen: "Error al seleccionar pérdida", plazo },
    ]),
    /COMERCIAL_ACCESO/,
  );
  await como(admin);
  await db.query("select public.corregir_perdida($1,2,$2,$3)", [
    otroCaso,
    randomUUID(),
    { resumen: "Error al seleccionar pérdida", plazo },
  ]);
  assert.equal(
    (
      await db.query("select ciclo from public.oportunidades where id=$1", [
        otroCaso,
      ])
    ).rows[0].ciclo,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select cierre_evento_id from public.ciclos_comerciales where oportunidad_id=$1",
        [otroCaso],
      )
    ).rows[0].cierre_evento_id,
    null,
  );
  await gestionar(3, "perder", {
    resumen: "Pérdida definitiva por cobertura",
    motivo: "fuera_de_zona",
  });
  await como(vendedor);
  await assert.rejects(
    db.query("select public.reactivar_oportunidad($1,4,$2,$3)", [
      otroCaso,
      randomUUID(),
      { resumen: "Solo llamada sin respuesta", plazo },
    ]),
    /COMERCIAL_NEGOCIACION/,
  );
  await db.query("select public.reactivar_oportunidad($1,4,$2,$3)", [
    otroCaso,
    randomUUID(),
    {
      resumen: "Nueva evaluación solicitada por cliente",
      plazo,
      negociacion_confirmada: "si",
      origen_comercial: "propio",
    },
  ]);
  const ciclos = (
    await db.query(
      "select * from public.ciclos_comerciales where oportunidad_id=$1 order by ciclo",
      [otroCaso],
    )
  ).rows;
  assert.equal(ciclos.length, 2);
  assert.ok(ciclos[0].cierre_evento_id);
  assert.equal(ciclos[1].cierre_evento_id, null);
  await assert.rejects(
    db.query("select public.detalle_venta($1)", [oportunidad]),
    /VENTAS_ACCESO/,
  );
  await assert.rejects(
    db.query("select public.guardar_activacion($1,0,$2,current_date,$3)", [
      oportunidad,
      randomUUID(),
      "Respaldo técnico de prueba",
    ]),
    /ACTIVACION_ACCESO/,
  );
  await como(admin);
  const hoy = (
    await db.query(
      "select (now() at time zone 'America/Argentina/Cordoba')::date::text fecha",
    )
  ).rows[0].fecha;
  const activar = (version, op = randomUUID(), fecha = hoy) =>
    db.query("select public.guardar_activacion($1,$2,$3,$4,$5)", [
      oportunidad,
      version,
      op,
      fecha,
      "Confirmado en Agenda Pignus · referencia prueba",
    ]);
  const actId = randomUUID();
  await activar(0, actId);
  await activar(0, actId);
  await assert.rejects(activar(0), /ACTIVACION_CONFLICTO/);
  await assert.rejects(
    activar(1, randomUUID(), "2099-01-01"),
    /ACTIVACION_FECHA/,
  );
  await activar(1);
  const venta = (
    await db.query("select public.detalle_venta($1) v", [oportunidad])
  ).rows[0].v;
  assert.equal(venta.activacion.fecha, hoy);
  assert.equal(venta.historial.length, 2);
  assert.equal(venta.propuesta.codigo, `PC-${aceptada}`);
  assert.match(venta.propuesta.codigo_interno, patronCodigo);
  assert.equal(venta.congelamientos[0].meses, "4");
  await como(agente);
  assert.equal(
    (await db.query("select public.detalle_venta($1) v", [oportunidad])).rows[0]
      .v.activacion.fecha,
    hoy,
  );
  await db.exec("reset role");
  for (const [fecha, meses, hasta] of [
    ["2026-10-15", 4, "2027-02-14"],
    ["2026-10-31", 4, "2027-02-28"],
    ["2027-10-31", 4, "2028-02-29"],
    ["2026-08-31", 6, "2027-02-28"],
    ["2026-10-15", 0, null],
  ])
    assert.equal(
      (
        await db.query("select privado.fin_congelamiento($1,$2)::text f", [
          fecha,
          meses,
        ])
      ).rows[0].f,
      hasta,
    );
  assert.equal(
    (
      await db.query(
        "select ciclo_comercial from public.actividades_agenda where oportunidad_id=$1",
        [otroCaso],
      )
    ).rows[0].ciclo_comercial,
    1,
  );
  // Métricas: fixtures exclusivamente en PostgreSQL local, nunca en producción.
  await db.exec("reset role");
  const mesCierre = (
    await db.query(
      "select date_trunc('month',now() at time zone 'America/Argentina/Cordoba')::date::text m",
    )
  ).rows[0].m;
  const mesVisita = "2025-01-01";
  for (const [persona, fecha] of [
    [vendedor, "2025-01-10"],
    [vendedor, "2025-01-12"],
    [otro, "2025-02-10"],
  ]) {
    await db.query(
      `insert into public.actividades_agenda(id,vendedor_id,oportunidad_id,origen,tipo,titulo,estado,inicio_real,fin_real,resultado,creado_por)
      values($1,$2,$3,'manual','visita','Visita prueba local','realizada',$4::date+interval '12 hours',$4::date+interval '13 hours','Relevamiento realizado',$2)`,
      [randomUUID(), persona, oportunidad, fecha],
    );
  }
  await como(admin);
  const resumen = async (mes, origen = null) =>
    (
      await db.query("select public.resumen_rendimiento($1,$2) r", [
        mes,
        origen,
      ])
    ).rows[0].r;
  let medicion = await resumen(mesVisita);
  assert.equal(medicion.empresa.visitados, 1);
  assert.equal(medicion.filas.find((f) => f.id === vendedor).visitados, 1);
  assert.equal(medicion.filas.find((f) => f.id === otro).visitados, 1);
  assert.equal(medicion.filas.find((f) => f.id === vendedor).recuperados, 1);
  assert.equal(
    Number(medicion.filas.find((f) => f.id === vendedor).conversion),
    0,
  );
  assert.equal((await resumen("2025-02-01")).empresa.visitados, 0);
  medicion = await resumen(mesCierre);
  assert.equal(medicion.empresa.ventas, 1);
  const rendimientoAgente = medicion.filas.find((f) => f.id === agente);
  assert.equal(rendimientoAgente.ventas, 1);
  assert.equal(Number(rendimientoAgente.volumen_inicial), 226998);
  assert.equal(Number(rendimientoAgente.ticket_instalacion), 53000);
  assert.equal(Number(rendimientoAgente.ticket_abono), 65000);
  assert.equal(rendimientoAgente.conversion, null);
  assert.equal(medicion.empresa.sin_visita, 0);
  assert.equal((await resumen(mesCierre, "propio")).empresa.ventas, 0);
  assert.equal((await resumen(mesCierre, "sin_identificar")).empresa.ventas, 1);
  const detalleMetricas = (
    await db.query(
      "select public.detalle_rendimiento($1,$2,'ventas',null,0) r",
      [mesCierre, agente],
    )
  ).rows[0].r;
  assert.equal(detalleMetricas.total, 1);
  assert.equal(detalleMetricas.filas[0].id, oportunidad);
  // Cambiar atribución solo en el fixture comprueba que no se duplica la venta.
  await db.exec("reset role");
  await db.query(
    "update public.eventos_oportunidades set nuevo=jsonb_set(nuevo,'{cerrado_por}',to_jsonb($1::text)) where id=$2",
    [vendedor, eventoCierre],
  );
  await como(admin);
  medicion = await resumen(mesVisita);
  assert.equal(
    Number(medicion.filas.find((f) => f.id === vendedor).conversion),
    100,
  );
  assert.equal(Number(medicion.filas.find((f) => f.id === otro).conversion), 0);
  await como(vendedor);
  medicion = await resumen(mesCierre);
  assert.equal(medicion.filas.length, 1);
  assert.equal(medicion.filas[0].id, vendedor);
  assert.equal(medicion.empresa.ventas, 0);
  await assert.rejects(
    db.query("select public.detalle_rendimiento($1,$2,'ventas')", [
      mesCierre,
      agente,
    ]),
    /INFORMES_ACCESO/,
  );
  await assert.rejects(
    db.query("select * from privado.ventas_medibles"),
    /permission denied/,
  );
  await como(agente);
  assert.equal((await resumen(mesCierre)).empresa.ventas, 1);
  await db.exec("reset role");
  // Un precio desconocido no se convierte en cero ni participa del promedio.
  await db.query(
    "update public.ciclos_comerciales set propuesta_aceptada_id=null where oportunidad_id=$1",
    [oportunidad],
  );
  await como(admin);
  medicion = await resumen(mesCierre);
  assert.equal(medicion.empresa.ventas, 1);
  assert.equal(medicion.empresa.sin_importes, 1);
  assert.equal(medicion.empresa.volumen_inicial, null);
  assert.equal(
    medicion.filas.find((f) => f.id === agente).ticket_inicial,
    null,
  );
  const ultima = (
    await db.query("select max(version) v from public.versiones_catalogo")
  ).rows[0].v;
  const nuevo = completarGrupos(prepararCatalogo(catalogo), randomUUID);
  // Tampoco se permite borrar equipos usados al saltar desde un formato sin servicio por ítem.
  await assert.rejects(
    db.query("select public.guardar_catalogo($1,$2,$3)", [
      ultima,
      randomUUID(),
      { esquema: 6, moneda_adicionales: "ARS", marcas: [], familias: [], items: [] },
    ]),
    /CATALOGO_USADO/,
  );
  await db.query("select public.guardar_catalogo($1,$2,$3)", [
    ultima,
    randomUUID(),
    nuevo,
  ]);
  await assert.rejects(
    db.query("select public.guardar_catalogo($1,$2,$3)", [
      ultima + 1,
      randomUUID(),
      { esquema: 6, moneda_adicionales: "ARS", marcas: [], familias: [], items: [] },
    ]),
    /CATALOGO_USADO/,
  );
});
