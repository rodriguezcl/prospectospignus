import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { generarAlternativas } from "../../src/features/oportunidades/domain/alternativas.js";
import { calcularPago } from "../../src/features/oportunidades/domain/pago.js";

test("propuestas: servidor autoritativo, pago mixto, versiones y permisos", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
 create schema auth; grant usage on schema auth to authenticated;
 create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  const carpeta = new URL("../migrations/", import.meta.url);
  for (const a of (await readdir(carpeta))
    .filter((a) => a.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(new URL(a, carpeta), "utf8"));
  const reparto = (await db.query("select privado.repartir_descuento($1,20000) r", [[
    {clave:'kit',tipo:'instalacion',importe_exacto:'400000'},
    {clave:'pir',tipo:'adicional',importe_exacto:'100000'},
  ]])).rows[0].r;
  assert.deepEqual(reparto.map(x=>x.descuento),['16000.00','4000.00']);
  for (const valores of [['0','0'],['0.004','0.006'],['1.333333','2.777777','0.111111']]) {
    const resultado=(await db.query('select privado.repartir_descuento($1,$2) r',[
      valores.map((importe_exacto,i)=>({clave:String(i),tipo:'adicional',importe_exacto})),
      valores[0]==='0'?'0':'0.01',
    ])).rows[0].r;
    const cent=x=>BigInt(x.replace('.',''));
    assert.equal(resultado.reduce((s,x)=>s+cent(x.descuento),0n),valores[0]==='0'?0n:1n);
    assert.ok(resultado.every(x=>cent(x.neto)>=0n));
    assert.equal(resultado.reduce((s,x)=>s+cent(x.bruto)-cent(x.descuento)-cent(x.neto),0n),0n);
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
  const vista = (await db.query("select * from public.propuestas_comerciales"))
    .rows;
  assert.equal(vista.length, 1);
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
  const conjunto = (
    await db.query(
      "select detalle from public.propuestas_comerciales order by creado_en desc",
    )
  ).rows[0].detalle;
  assert.equal(conjunto.total, "699998.00");
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
  await como(vendedor);
  assert.equal(
    (
      await db.query(
        "select * from public.propuestas_comerciales where restringida",
      )
    ).rows.length,
    0,
  );
});
