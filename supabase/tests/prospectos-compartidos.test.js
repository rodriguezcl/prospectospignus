import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("base compartida: edición auditada y primera oferta asignada atómicamente", async (t) => {
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
  async function ficha() {
    return (
      await db.query("select * from public.oportunidades where id=$1", [caso])
    ).rows[0];
  }
  await como(a);
  const datos = {
    nombre: "Contacto Compartido",
    origen: "whatsapp",
    telefono: "3510000000",
  };
  await db.query("select public.guardar_registro_inicial_032($1,0,$2)", [
    registro,
    { ...datos, creado_por: b, responsable_id: b },
  ]);
  await db.query("select public.guardar_registro_inicial_032($1,0,$2)", [
    registro,
    datos,
  ]); // reintento con mayúsculas normalizadas
  let r = (
    await db.query("select * from public.registros_iniciales where id=$1", [
      registro,
    ])
  ).rows[0];
  assert.equal(r.creado_por, a);
  assert.equal(r.responsable_id, null);
  for (const id of [b, c, agente]) {
    await como(id);
    assert.equal(
      (
        await db.query(
          "select id from public.registros_iniciales where id=$1",
          [registro],
        )
      ).rows.length,
      1,
    );
  }
  await como(b);
  await db.query("select public.guardar_registro_inicial_032($1,1,$2)", [
    registro,
    { ...datos, telefono: "3511111111", creado_por: b },
  ]);
  await assert.rejects(
    db.query("select public.guardar_registro_inicial_032($1,1,$2)", [
      registro,
      datos,
    ]),
    /Recargá/,
  );
  r = (
    await db.query("select * from public.registros_iniciales where id=$1", [
      registro,
    ])
  ).rows[0];
  assert.equal(r.creado_por, a);
  const eventos = (
    await db.query(
      "select * from public.eventos_registros where registro_id=$1 order by id",
      [registro],
    )
  ).rows;
  assert.equal(eventos.length, 2);
  assert.equal(eventos[1].actor_id, b);
  assert.equal(eventos[1].anterior.telefono, datos.telefono);
  assert.equal(eventos[1].nuevo.telefono, "3511111111");
  assert.ok(
    (await db.query("select * from public.autores_prospectos_032()")).rows.some(
      (x) => x.id === a,
    ),
  );
  await como(inactivo);
  assert.equal(
    (await db.query("select id from public.registros_iniciales")).rows.length,
    0,
  );
  await assert.rejects(
    db.query("select public.guardar_registro_inicial_032($1,2,$2)", [
      registro,
      datos,
    ]),
    /habilitada/,
  );
  await db.exec("reset role; set role anon");
  await assert.rejects(
    db.query("select * from public.registros_iniciales"),
    /permission denied/,
  );
  await como(a);
  const iniciar = {
    registro_id: registro,
    interes_comercial: { servicios: ["camaras"], tipo_alarma: null },
  };
  await db.query("select public.iniciar_cotizacion_032($1,0,$2,$3)", [
    caso,
    randomUUID(),
    iniciar,
  ]);
  for (const id of [a, b, c, agente]) {
    await como(id);
    const f = await ficha();
    assert.equal(f.responsable_id, null);
    assert.equal(f.vendedor_visita_id, null);
    assert.equal(f.preparacion_compartida, true);
  }
  await assert.rejects(
    db.query("select public.iniciar_cotizacion_032($1,0,$2,$3)", [
      randomUUID(),
      randomUUID(),
      iniciar,
    ]),
    /COMERCIAL_EXISTENTE/,
  );
  await como(admin);
  const item = {
    familia_id: familia,
    marca_id: marca,
    servicio: "camaras",
    unidad: "unidad",
    estado: "activo",
    validado_tecnicamente: true,
    kits_compatibles: [],
    abonos: {},
  };
  const catalogo = {
    esquema: 7,
    moneda_adicionales: "ARS",
    marcas: [{ id: marca, nombre: "MARCA", estado: "activo" }],
    familias: [
      {
        id: familia,
        nombre: "MARCA",
        marca: "MARCA",
        marca_id: marca,
        servicio: "camaras",
        estado: "activo",
      },
    ],
    items: [
      {
        ...item,
        id: producto,
        nombre: "CAMARA",
        codigo: "C",
        tipo: "adicional",
        modalidad: null,
        adicional_habilitado: true,
        incluidos: [],
        precios: { telefonico: "10" },
      },
      {
        ...item,
        id: kit,
        nombre: "KIT",
        codigo: "K",
        tipo: "kit",
        modalidad: "kit",
        adicional_habilitado: false,
        incluidos: [{ item_id: producto, cantidad: 1 }],
        precios: { telefonico: "100" },
      },
    ],
  };
  await db.query("select public.guardar_catalogo_031(0,$1,$2)", [
    randomUUID(),
    catalogo,
  ]);
  const solicitud = {
    conceptos: [
      {
        seleccion: {
          familia_id: familia,
          kit_id: kit,
          nivel: "telefonico",
          extras: [],
        },
        ordinal: 1,
        nivel_abono: null,
        meses_congelamiento: 0,
      },
    ],
    pago: { base_efectivo: "0", medio_saldo: "debito", cuotas: 1 },
  };
  const propuesta = randomUUID();
  async function ofrecer(id, version = 1, datos = solicitud) {
    return db.query("select public.guardar_propuesta_030($1,$2,$3,1,0,$4)", [
      id,
      caso,
      version,
      datos,
    ]);
  }
  await como(b);
  await assert.rejects(
    ofrecer(propuesta, 1, {
      ...solicitud,
      pago: { ...solicitud.pago, base_efectivo: "99999" },
    }),
    /PROPUESTA_PAGO/,
  );
  assert.equal((await ficha()).preparacion_compartida, true);
  assert.equal((await ficha()).responsable_id, null);
  assert.equal(
    (
      await db.query(
        "select id from public.eventos_oportunidades where tipo='primera_oferta_asignada'",
      )
    ).rows.length,
    0,
  );
  await ofrecer(propuesta, 1, { ...solicitud, responsable_seguimiento_id: a });
  let f = await ficha();
  assert.equal(f.responsable_id, b);
  assert.equal(f.vendedor_visita_id, b);
  assert.equal(f.preparacion_compartida, false);
  assert.equal(f.version, 2);
  await ofrecer(propuesta, 1, { ...solicitud, responsable_seguimiento_id: a }); // idempotente
  assert.equal(
    (
      await db.query(
        "select id from public.eventos_oportunidades where tipo='primera_oferta_asignada'",
      )
    ).rows.length,
    1,
  );
  await como(a);
  await assert.rejects(
    ofrecer(randomUUID()),
    /PROPUESTA_ACCESO|PROPUESTA_CONFLICTO/,
  );
  await como(c);
  assert.equal(await ficha(), undefined);
  assert.equal(
    (
      await db.query(
        "select * from public.propuestas_comerciales where oportunidad_id=$1",
        [caso],
      )
    ).rows.length,
    0,
  );
  const resumen = (
    await db.query("select public.negociaciones_contacto_032($1) r", [registro])
  ).rows[0].r;
  assert.equal(resumen[0].accesible, false);
  assert.equal(resumen[0].preparacion_compartida, false);
  assert.ok(resumen[0].responsable_nombre);
  assert.equal(resumen[0].detalle, undefined);
  const bandeja = (
    await db.query("select public.listar_contactos_cotizaciones('',0) r")
  ).rows[0].r;
  assert.equal(bandeja.filas.find((x) => x.id === registro).casos.length, 1);
  await db.query("select public.guardar_registro_inicial_032($1,2,$2)", [
    registro,
    { ...datos, telefono: "3512222222" },
  ]);
  await como(b);
  await ofrecer(randomUUID(), 2);
  assert.equal((await ficha()).responsable_id, b);
  // La visita posterior queda a cargo del vendedor que hizo la primera oferta.
  await db.query(
    "select public.gestionar_oportunidad($1,3,$2,'reprogramar',$3)",
    [
      caso,
      randomUUID(),
      {
        plazo: new Date(Date.now() + 86400000).toISOString(),
        resumen: "Visita acordada con el cliente",
      },
    ],
  );
  assert.equal((await ficha()).estado, "visita");
  // Administración elige explícitamente al vendedor; agentes no toman la preparación.
  await como(admin);
  const segundo = randomUUID();
  await db.query("select public.iniciar_cotizacion_032($1,0,$2,$3)", [
    segundo,
    randomUUID(),
    { ...iniciar, otra_necesidad: "si" },
  ]);
  await assert.rejects(
    db.query("select public.gestionar_oportunidad($1,1,$2,'reasignar',$3)", [
      segundo,
      randomUUID(),
      { responsable_id: a, resumen: "Intento de asignación anticipada" },
    ]),
    /COMERCIAL_PRIMERA_OFERTA/,
  );
  await assert.rejects(
    db.query("select public.gestionar_oportunidad($1,0,$2,'crear',$3)", [
      randomUUID(),
      randomUUID(),
      {},
    ]),
    /COMERCIAL_PRIMERA_OFERTA/,
  );
  await como(agente);
  await assert.rejects(
    db.query("select public.guardar_propuesta_030($1,$2,1,1,0,$3)", [
      randomUUID(),
      segundo,
      solicitud,
    ]),
    /PROPUESTA_ACCESO/,
  );
  await como(admin);
  await assert.rejects(
    db.query("select public.guardar_propuesta_030($1,$2,1,1,0,$3)", [
      randomUUID(),
      segundo,
      solicitud,
    ]),
    /COMERCIAL_VENDEDOR/,
  );
  await assert.rejects(
    db.query("select public.guardar_propuesta_030($1,$2,1,1,0,$3)", [
      randomUUID(),
      segundo,
      { ...solicitud, responsable_seguimiento_id: inactivo },
    ]),
    /COMERCIAL_VENDEDOR/,
  );
  await db.query("select public.guardar_propuesta_030($1,$2,1,1,0,$3)", [
    randomUUID(),
    segundo,
    { ...solicitud, responsable_seguimiento_id: a },
  ]);
  assert.equal(
    (
      await db.query(
        "select responsable_id from public.oportunidades where id=$1",
        [segundo],
      )
    ).rows[0].responsable_id,
    a,
  );
  // El creador todavía puede anular su preparación sin actividad.
  await como(c);
  const anulable = randomUUID();
  await db.query("select public.iniciar_cotizacion_032($1,0,$2,$3)", [
    anulable,
    randomUUID(),
    { ...iniciar, otra_necesidad: "si" },
  ]);
  assert.equal(
    (await db.query("select public.puede_anular_cotizacion($1) r", [anulable]))
      .rows[0].r,
    true,
  );
  await db.query("select public.anular_cotizacion($1,1,$2,$3)", [
    anulable,
    randomUUID(),
    { resumen: "Error de carga confirmado", confirmar_anulacion: "si" },
  ]);
});
