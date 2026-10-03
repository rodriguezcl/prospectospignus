import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("Cotizaciones: cartera automática, preparación sin visita, permisos y anulación auditada", async (t) => {
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
        nombre: `Persona ${rol}`,
        rol,
        ...(id === admin ? {} : { creado_por: admin }),
      },
    ]);
  async function como(id) {
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  }
  const cartera = async () =>
    (await db.query("select public.listar_contactos_cotizaciones() as datos"))
      .rows[0].datos;
  await como(vendedor);
  await db.exec("begin");
  for (let n = 24; n >= 0; n--) {
    await db.query("select public.guardar_registro_inicial($1,0,$2)", [
      randomUUID(),
      { nombre: `CONTACTO ${String(n).padStart(2, "0")}`, origen: "whatsapp" },
    ]);
  }
  const primera = await cartera();
  const segunda = (
    await db.query("select public.listar_contactos_cotizaciones('',1) as datos")
  ).rows[0].datos;
  assert.equal(primera.total, 25);
  assert.deepEqual(
    [...primera.filas, ...segunda.filas].map((f) => f.nombre),
    Array.from(
      { length: 25 },
      (_, n) => `CONTACTO ${String(n).padStart(2, "0")}`,
    ),
  );
  await db.exec("rollback");
  const registro = randomUUID(),
    id = randomUUID(),
    operacion = randomUUID();
  await como(vendedor);
  await db.query("select public.guardar_registro_inicial($1,0,$2)", [
    registro,
    { nombre: "Contacto sin relevar", origen: "whatsapp" },
  ]);
  assert.equal((await cartera()).filas[0].casos.length, 0);
  assert.equal(
    (await db.query("select * from public.oportunidades")).rows.length,
    0,
  );
  const datos = {
    registro_id: registro,
    vendedor_id: vendedor,
    origen_comercial: "propio",
    interes_comercial: { servicios: ["alarma"], tipo_alarma: "a_definir" },
  };
  const iniciar = (caso = id, oper = operacion, d = datos) =>
    db.query("select public.iniciar_cotizacion($1,0,$2,$3)", [caso, oper, d]);
  await iniciar();
  await iniciar();
  const o = (
    await db.query("select * from public.oportunidades where id=$1", [id])
  ).rows[0];
  assert.equal(o.estado, "cotizacion");
  assert.equal(o.visita_en, null);
  assert.equal(o.proxima_accion_en, null);
  assert.equal(
    (await db.query("select * from public.actividades_agenda")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select contacto_efectivo from public.prospectos")).rows[0]
      .contacto_efectivo,
    null,
  );
  assert.equal((await cartera()).filas[0].casos.length, 1);
  await db.query("select public.guardar_registro_inicial($1,1,$2)", [
    registro,
    {
      nombre: "Contacto corregido",
      telefono: "0351 ficticio",
      ubicacion: "Dirección corregida",
      origen: "whatsapp",
      motivo: "Corrección del contacto",
    },
  ]);
  assert.equal(
    (await db.query("select nombre from public.prospectos")).rows[0].nombre,
    "CONTACTO CORREGIDO",
  );
  await assert.rejects(
    iniciar(randomUUID(), randomUUID()),
    /COMERCIAL_EXISTENTE/,
  );
  await assert.rejects(
    iniciar(id, operacion, { ...datos, observaciones: "Cambio" }),
    /COMERCIAL_CONFLICTO/,
  );
  await como(otro);
  assert.equal((await cartera()).total, 0);
  await assert.rejects(iniciar(randomUUID(), randomUUID()), /COMERCIAL_ACCESO/);
  const anulacion = randomUUID(),
    motivo = {
      resumen: "Se cargó una necesidad equivocada",
      confirmar_anulacion: "si",
    };
  const anular = (caso, version, oper = anulacion) =>
    db.query("select public.anular_cotizacion($1,$2,$3,$4)", [
      caso,
      version,
      oper,
      motivo,
    ]);
  await assert.rejects(anular(id, 1), /COMERCIAL_ANULACION/);
  await como(vendedor);
  await anular(id, 1);
  await anular(id, 1);
  assert.equal((await cartera()).total, 1);
  assert.equal((await cartera()).filas[0].casos.length, 0);
  assert.equal(
    (
      await db.query(
        "select * from public.eventos_oportunidades where oportunidad_id=$1",
        [id],
      )
    ).rows.length,
    2,
  );
  await assert.rejects(
    db.query("select public.gestionar_oportunidad($1,2,$2,'seguimiento',$3)", [
      id,
      randomUUID(),
      {
        resumen: "No debe reabrirse",
        plazo: new Date(Date.now() + 86400000).toISOString(),
      },
    ]),
    /COMERCIAL_ANULADA/,
  );
  const otroCaso = randomUUID();
  await iniciar(otroCaso, randomUUID());
  await db.query(
    "select public.gestionar_oportunidad($1,1,$2,'reprogramar',$3)",
    [
      otroCaso,
      randomUUID(),
      {
        resumen: "Visita acordada con el contacto",
        plazo: new Date(Date.now() + 86400000).toISOString(),
      },
    ],
  );
  await assert.rejects(
    anular(otroCaso, 2, randomUUID()),
    /COMERCIAL_ANULACION/,
  );
  await como(admin);
  await anular(otroCaso, 2, randomUUID());
  assert.equal(
    (
      await db.query(
        "select estado from public.actividades_agenda where oportunidad_id=$1",
        [otroCaso],
      )
    ).rows[0].estado,
    "cancelada",
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.eventos_agenda where tipo='negociacion_anulada'",
      )
    ).rows[0].n,
    1,
  );
  const realizado = randomUUID();
  await como(vendedor);
  await iniciar(realizado, randomUUID());
  const actividad = randomUUID();
  await db.query("select public.gestionar_actividad($1,0,$2,'crear',$3)", [
    actividad,
    randomUUID(),
    {
      oportunidad_id: realizado,
      tipo: "visita",
      titulo: "Visita realizada",
      estado: "realizada",
      inicio_real: new Date(Date.now() - 7200000).toISOString(),
      fin_real: new Date(Date.now() - 3600000).toISOString(),
      resultado: "Relevamiento realizado",
    },
  ]);
  await assert.rejects(
    anular(realizado, 1, randomUUID()),
    /COMERCIAL_ANULACION/,
  );
  await db.exec("reset role");
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from privado.visitas_medibles where oportunidad_id=$1",
        [realizado],
      )
    ).rows[0].n,
    1,
  );
  await como(admin);
  await anular(realizado, 1, randomUUID());
  await db.exec("reset role");
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from privado.visitas_medibles where oportunidad_id=$1",
        [realizado],
      )
    ).rows[0].n,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select estado from public.actividades_agenda where id=$1",
        [actividad],
      )
    ).rows[0].estado,
    "realizada",
  );
  // Los contactos asignados por agentes se ven sin habilitar escrituras sobre datos ajenos.
  const rAgente = randomUUID(),
    casoAgente = randomUUID();
  await como(agente);
  await db.query("select public.guardar_registro_inicial($1,0,$2)", [
    rAgente,
    { nombre: "Contacto del agente", origen: "whatsapp" },
  ]);
  await iniciar(casoAgente, randomUUID(), {
    ...datos,
    registro_id: rAgente,
    origen_comercial: "asignado_agente",
  });
  await como(vendedor);
  assert.ok(
    (await cartera()).filas.some(
      (r) => r.id === rAgente && r.casos[0].id === casoAgente,
    ),
  );
  await assert.rejects(
    iniciar(randomUUID(), randomUUID(), {
      ...datos,
      registro_id: rAgente,
      otra_necesidad: "si",
    }),
    /COMERCIAL_ACCESO/,
  );
  await como(otro);
  assert.equal((await cartera()).total, 0);
  await db.exec("reset role; set role anon");
  await assert.rejects(cartera(), /permission denied/);
});

test("Agente: calificación, visitas, recuperación equilibrada, RLS, cierre e idempotencia", async (t) => {
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
  const [admin, vendedor, otro, agente, agente2] = Array.from(
    { length: 5 },
    randomUUID,
  );
  for (const [id, rol] of [
    [admin, "administrador"],
    [vendedor, "vendedor"],
    [otro, "vendedor"],
    [agente, "agente"],
    [agente2, "agente"],
  ]) {
    await db.query("insert into auth.users values($1,$2,$3)", [
      id,
      `${id}@example.invalid`,
      {
        pignus_autorizado: true,
        nombre: `Persona ${rol}`,
        rol,
        ...(id === admin ? {} : { creado_por: admin }),
      },
    ]);
  }
  async function como(id) {
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  }
  const gestionar = (id, version, accion, datos, operacion = randomUUID()) =>
    db.query("select public.gestionar_oportunidad($1,$2,$3,$4,$5)", [
      id,
      version,
      operacion,
      accion,
      datos,
    ]);
  const plazo = new Date(Date.now() + 86400000).toISOString();
  const registro = randomUUID();
  await como(vendedor);
  await db.query("select public.guardar_registro_inicial($1,0,$2)", [
    registro,
    {
      nombre: "Contacto prueba",
      telefono: "0351 ficticio",
      ubicacion: "Dirección prueba",
      origen: "whatsapp",
    },
  ]);
  const datos = {
    registro_id: registro,
    vendedor_id: vendedor,
    plazo,
    resumen: "Conversación con respuesta humana",
    contacto_confirmado: "si",
    necesidad: "Protección de vivienda",
  };
  const id = randomUUID();
  const operacion = randomUUID();
  await assert.rejects(
    gestionar(id, 0, "crear", { ...datos, contacto_confirmado: "no" }),
    /COMERCIAL_CALIFICACION/,
  );
  await assert.rejects(
    gestionar(id, 0, "crear", { ...datos, vendedor_id: otro }),
    /COMERCIAL_ACCESO/,
  );
  await gestionar(id, 0, "crear", datos, operacion);
  await gestionar(id, 0, "crear", datos, operacion);
  assert.equal(
    (await db.query("select * from public.oportunidades")).rows.length,
    1,
  );
  assert.equal(
    (await db.query("select * from public.prospectos")).rows.length,
    1,
  );
  assert.equal(
    (await db.query("select * from public.notificaciones")).rows.length,
    1,
  );
  await assert.rejects(
    gestionar(
      id,
      0,
      "crear",
      { ...datos, resumen: "Otra conversación" },
      operacion,
    ),
    /COMERCIAL_CONFLICTO/,
  );
  await assert.rejects(
    db.exec("update public.oportunidades set estado='ganada'"),
    /permission denied/,
  );
  await como(otro);
  assert.equal(
    (await db.query("select * from public.oportunidades")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.prospectos")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.eventos_oportunidades")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.notificaciones")).rows.length,
    0,
  );
  await assert.rejects(
    gestionar(id, 1, "seguimiento", { resumen: "Intento ajeno", plazo }),
    /COMERCIAL_ACCESO/,
  );
  await como(agente);
  assert.equal(
    (await db.query("select * from public.oportunidades")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.perfiles")).rows.length,
    1,
  );
  await db.query("select public.disponibilidad_agente(true)");
  await como(agente2);
  await db.query("select public.disponibilidad_agente(true)");
  await como(vendedor);
  await assert.rejects(
    gestionar(id, 1, "perder", {
      resumen: "No acepta precio",
      motivo: "precio",
    }),
    /COMERCIAL_RECUPERAR/,
  );
  await assert.rejects(
    gestionar(id, 1, "ganar", {
      resumen: "Solo se envió propuesta",
      condiciones: "Precio propuesto",
      canal: "whatsapp",
    }),
    /COMERCIAL_CONFIRMACION/,
  );
  const derivacion = {
    resumen: "Visita realizada, objeción de precio",
    condiciones: "Bonificación de periféricos",
    plazo,
  };
  const opDerivar = randomUUID();
  await gestionar(id, 1, "derivar", derivacion, opDerivar);
  await gestionar(id, 1, "derivar", derivacion, opDerivar);
  await assert.rejects(
    gestionar(id, 2, "ganar", { resumen: "No soy responsable" }),
    /COMERCIAL_ACCESO/,
  );
  const recuperada = (
    await db.query("select * from public.oportunidades where id=$1", [id])
  ).rows[0];
  assert.equal(recuperada.estado, "recuperacion");
  assert.equal(recuperada.vendedor_visita_id, vendedor);
  for (let n = 0; n < 3; n++) {
    const nuevo = randomUUID();
    await gestionar(nuevo, 0, "crear", {
      ...datos,
      necesidad: `Necesidad diferente ${n}`,
    });
    await gestionar(nuevo, 1, "derivar", derivacion);
  }
  await como(admin);
  const cargas = (
    await db.query(
      "select responsable_id,count(*)::int cantidad from public.oportunidades group by responsable_id",
    )
  ).rows;
  assert.deepEqual(
    cargas.map((c) => c.cantidad),
    [2, 2],
  );
  await assert.rejects(
    db.query("select public.gestionar_cuenta($1,2,'desactivar',$2)", [
      agente,
      { motivo: "Cambio de equipo" },
    ]),
    /CUENTA_TRABAJO_PENDIENTE/,
  );
  const responsable = recuperada.responsable_id;
  await como(responsable);
  const notificaciones = (
    await db.query(
      "select * from public.notificaciones where oportunidad_id=$1",
      [id],
    )
  ).rows;
  assert.equal(notificaciones.length, 1);
  await db.query("select public.leer_notificacion($1)", [notificaciones[0].id]);
  assert.equal(
    (
      await db.query("select estado from public.oportunidades where id=$1", [
        id,
      ])
    ).rows[0].estado,
    "recuperacion",
  );
  await assert.rejects(
    gestionar(id, 1, "seguimiento", { resumen: "Nueva llamada", plazo }),
    /COMERCIAL_CONFLICTO/,
  );
  const ganar = {
    resumen: "Aceptación explícita por llamada",
    condiciones: "Propuesta final aceptada",
    canal: "llamada",
    aceptacion_confirmada: "si",
    confirmado_en: new Date().toISOString(),
  };
  // Administración puede registrar el resultado sin atribuirse el cierre.
  await como(admin);
  await gestionar(id, 2, "ganar", ganar);
  await como(responsable);
  const ganada = (
    await db.query("select * from public.oportunidades where id=$1", [id])
  ).rows[0];
  assert.equal(ganada.estado, "ganada");
  assert.equal(ganada.cerrado_por, responsable);
  const ventas = async (filtro = null) =>
    (
      await db.query(
        "select public.listar_ventas_concretadas(null,$1,0) as datos",
        [filtro],
      )
    ).rows[0].datos;
  assert.equal((await ventas()).total, 1);
  assert.equal((await ventas()).filas[0].cerrado_por, responsable);
  assert.equal((await ventas(vendedor)).total, 0);
  await como(vendedor);
  // Conserva consulta de la ficha visitada, pero no recibe crédito por la venta.
  assert.equal(
    (await db.query("select id from public.oportunidades where id=$1", [id]))
      .rows.length,
    1,
  );
  assert.equal((await ventas()).total, 0);
  assert.deepEqual((await ventas(responsable)).responsables, []);
  await como(admin);
  assert.equal((await ventas()).total, 1);
  assert.equal(
    (await ventas()).filas[0].vendedor_visita_nombre,
    "PERSONA VENDEDOR",
  );
  await como(responsable);
  await assert.rejects(
    gestionar(id, 3, "seguimiento", {
      resumen: "Reabrir sin autorización",
      plazo,
    }),
    /COMERCIAL_CERRADA/,
  );
  // Sin agentes: permanece abierta, avisa a administración y se puede distribuir después.
  await como(agente);
  await db.query("select public.disponibilidad_agente(false)");
  await como(agente2);
  await db.query("select public.disponibilidad_agente(false)");
  await como(vendedor);
  const pendiente = randomUUID();
  await gestionar(pendiente, 0, "crear", datos);
  await gestionar(pendiente, 1, "derivar", derivacion);
  assert.equal(
    (
      await db.query(
        "select responsable_id from public.oportunidades where id=$1",
        [pendiente],
      )
    ).rows[0].responsable_id,
    null,
  );
  await como(admin);
  assert.equal(
    (
      await db.query(
        "select * from public.notificaciones where oportunidad_id=$1",
        [pendiente],
      )
    ).rows.length,
    1,
  );
  await assert.rejects(
    gestionar(pendiente, 2, "asignar", { resumen: "Distribuir pendiente" }),
    /COMERCIAL_SIN_AGENTE/,
  );
  await como(agente);
  await db.query("select public.disponibilidad_agente(true)");
  await gestionar(pendiente, 2, "asignar", { resumen: "Distribuir pendiente" });
  await assert.rejects(
    gestionar(pendiente, 3, "perder", {
      resumen: "No responde al llamado",
      condiciones: "Propuesta final",
      motivo: "no_responde",
      rechazo_confirmado: "si",
    }),
    /COMERCIAL_MOTIVO/,
  );
  await gestionar(pendiente, 3, "perder", {
    resumen: "Rechazó definitivamente por precio",
    condiciones: "Propuesta final con bonificaciones",
    motivo: "precio",
    rechazo_confirmado: "si",
  });
  await como(admin);
  assert.equal(
    (await db.query("select * from public.oportunidades where estado='ganada'"))
      .rows.length,
    1,
  );
  assert.equal(
    (await db.query("select * from public.prospectos")).rows.length,
    1,
  );
  // El catálogo Agente también debe funcionar al editar cuentas existentes.
  await db.query("select public.gestionar_cuenta($1,1,'editar',$2)", [
    otro,
    {
      nombre: "Nuevo agente",
      rol: "agente",
      motivo: "Cambio de función autorizado",
    },
  ]);
  assert.equal(
    (await db.query("select rol from public.perfiles where id=$1", [otro]))
      .rows[0].rol,
    "agente",
  );
  await como(otro);
  assert.equal(
    (await db.query("select * from public.oportunidades where id=$1", [id]))
      .rows.length,
    0,
  );
  await assert.rejects(
    db.query("select public.gestionar_cuenta($1,1,'desactivar',$2)", [
      vendedor,
      { motivo: "Intento sin privilegio" },
    ]),
    /CUENTA_ACCESO/,
  );
  await como(vendedor);
  const altaGuiada = {
    ...datos,
    interes_comercial: {
      servicios: ["alarma", "camaras"],
      tipo_alarma: "a_definir",
    },
    canal_contacto: "whatsapp",
    observaciones: "",
  };
  delete altaGuiada.resumen;
  delete altaGuiada.necesidad;
  for (const interes of [
    null,
    {},
    { servicios: [] },
    { servicios: ["otro"] },
    { servicios: ["alarma", "alarma"], tipo_alarma: "docta" },
    { servicios: ["alarma"], tipo_alarma: "invalida" },
  ]) {
    await assert.rejects(
      gestionar(randomUUID(), 0, "crear", {
        ...altaGuiada,
        interes_comercial: interes,
      }),
      /COMERCIAL_INTERES/,
    );
  }
  await assert.rejects(
    gestionar(randomUUID(), 0, "crear", {
      ...altaGuiada,
      observaciones: "x".repeat(2001),
    }),
    /COMERCIAL_DATOS/,
  );
  await assert.rejects(
    gestionar(randomUUID(), 0, "crear", {
      ...altaGuiada,
      contacto_confirmado: "no",
    }),
    /COMERCIAL_CALIFICACION/,
  );
  await assert.rejects(
    db.query(
      "select public.gestionar_oportunidad_base_v17($1,0,$2,'crear',$3)",
      [randomUUID(), randomUUID(), altaGuiada],
    ),
    /permission denied/,
  );
  const nueva = randomUUID(),
    op = randomUUID();
  await gestionar(nueva, 0, "crear", altaGuiada, op);
  await gestionar(nueva, 0, "crear", altaGuiada, op);
  const fichaGuiada = (
    await db.query("select * from public.oportunidades where id=$1", [nueva])
  ).rows[0];
  assert.deepEqual(fichaGuiada.interes_comercial, altaGuiada.interes_comercial);
  assert.match(fichaGuiada.necesidad, /Alarma.*A definir.*Cámaras/);
  assert.match(fichaGuiada.resumen, /Visita coordinada/);
  assert.equal(fichaGuiada.observaciones_visita, "");
  assert.equal(fichaGuiada.canal_contacto, "whatsapp");
  assert.equal(
    (
      await db.query(
        "select * from public.actividades_agenda where oportunidad_id=$1",
        [nueva],
      )
    ).rows.length,
    1,
  );
  const corta = randomUUID();
  await gestionar(corta, 0, "crear", {
    ...altaGuiada,
    observaciones: "OK",
    interes_comercial: { servicios: ["camaras"], tipo_alarma: null },
  });
  assert.equal(
    (
      await db.query(
        "select observaciones_visita from public.oportunidades where id=$1",
        [corta],
      )
    ).rows[0].observaciones_visita,
    "OK",
  );
  assert.equal(
    (
      await db.query(
        "select * from public.eventos_oportunidades where oportunidad_id=$1",
        [nueva],
      )
    ).rows.length,
    1,
  );
  assert.equal(
    (
      await db.query(
        "select solicitud->'datos'->>'observaciones' as nota from public.eventos_oportunidades where id=$1",
        [op],
      )
    ).rows[0].nota,
    "",
  );
  await assert.rejects(
    gestionar(
      nueva,
      0,
      "crear",
      { ...altaGuiada, observaciones: "Otra nota" },
      op,
    ),
    /COMERCIAL_CONFLICTO/,
  );
  await como(otro);
  assert.equal(
    (await db.query("select * from public.oportunidades where id=$1", [nueva]))
      .rows.length,
    0,
  );
  await db.exec("reset role; set role anon");
  await assert.rejects(
    db.query("select public.listar_ventas_concretadas()"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("select public.equipo_comercial()"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("select * from public.oportunidades"),
    /permission denied/,
  );
});
