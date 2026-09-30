import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

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
  await gestionar(id, 2, "ganar", ganar);
  const ganada = (
    await db.query("select * from public.oportunidades where id=$1", [id])
  ).rows[0];
  assert.equal(ganada.estado, "ganada");
  assert.equal(ganada.cerrado_por, responsable);
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
  await db.exec("reset role; set role anon");
  await assert.rejects(
    db.query("select public.equipo_comercial()"),
    /permission denied/,
  );
  await assert.rejects(
    db.query("select * from public.oportunidades"),
    /permission denied/,
  );
});
