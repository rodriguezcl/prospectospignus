import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("agenda: aislamiento, concurrencia, historial, recordatorios e integración transaccional de visitas", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  const carpeta = new URL("../migrations/", import.meta.url);
  for (const archivo of (await readdir(carpeta))
    .filter(
      (a) =>
        a.endsWith(".sql") &&
        !a.includes("041_") &&
        !a.includes("040_") &&
        !a.includes("039_") &&
        !a.includes("034_") &&
        !a.includes("033_") &&
        !a.includes("032_"),
    )
    .sort())
    await db.exec(await readFile(new URL(archivo, carpeta), "utf8"));
  const [admin, vendedor, otro, agente, inactivo] = Array.from(
    { length: 5 },
    randomUUID,
  );
  for (const [id, rol] of [
    [admin, "administrador"],
    [vendedor, "vendedor"],
    [otro, "vendedor"],
    [agente, "agente"],
    [inactivo, "vendedor"],
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
  await db.query("update public.perfiles set activo=false where id=$1", [
    inactivo,
  ]);
  const como = async (id) => {
    await db.exec("reset role;set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  };
  const guardar = (id, version, accion, datos = {}, op = randomUUID()) =>
    db.query("select public.gestionar_actividad($1,$2,$3,$4,$5)", [
      id,
      version,
      op,
      accion,
      datos,
    ]);
  const filas = async () =>
    (
      await db.query(
        "select * from public.actividades_agenda order by creado_en,id",
      )
    ).rows;
  const proximo = new Date(Date.now() + 15 * 60000).toISOString();
  const id = randomUUID(),
    op = randomUUID();
  const datos = {
    estado: "programada",
    tipo: "puerta_a_puerta",
    titulo: "Recorrido comercial",
    inicio_previsto: proximo,
    nota: "Zona comercial",
  };
  await como(vendedor);
  await guardar(id, 0, "crear", datos, op);
  await guardar(id, 0, "crear", datos, op);
  assert.equal((await filas()).length, 1);
  await assert.rejects(
    guardar(id, 0, "crear", { ...datos, titulo: "Otro título" }, op),
    /AGENDA_CONFLICTO/,
  );
  await assert.rejects(
    guardar(id, 0, "editar", { ...datos, motivo: "Corrección" }),
    /AGENDA_CONFLICTO/,
  );
  await assert.rejects(
    db.exec("update public.actividades_agenda set titulo='Manipulado'"),
    /permission denied/,
  );
  await assert.rejects(
    db.exec("delete from public.eventos_agenda"),
    /permission denied/,
  );
  let avisos = (await db.query("select * from public.recordatorios_agenda()"))
    .rows;
  assert.equal(avisos.length, 1);
  await db.query("select public.leer_recordatorio_agenda($1,1)", [id]);
  assert.equal(
    (await db.query("select * from public.recordatorios_agenda()")).rows.length,
    0,
  );
  assert.equal((await filas())[0].estado, "programada");
  for (const persona of [otro, agente, inactivo]) {
    await como(persona);
    assert.equal((await filas()).length, 0);
    assert.equal(
      (await db.query("select * from public.eventos_agenda")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("select * from public.recordatorios_agenda()")).rows
        .length,
      0,
    );
    await assert.rejects(guardar(id, 1, "iniciar"), /AGENDA_ACCESO/);
  }
  await como(admin);
  assert.equal((await filas()).length, 1);
  await assert.rejects(guardar(id, 1, "iniciar"), /AGENDA_ACCESO/);
  await como(vendedor);
  await guardar(id, 1, "editar", {
    ...datos,
    titulo: "Recorrido reprogramado",
    motivo: "Cambio solicitado",
  });
  assert.equal(
    (await db.query("select * from public.recordatorios_agenda()")).rows.length,
    1,
  );
  await guardar(id, 2, "iniciar");
  assert.equal((await filas())[0].estado, "en_curso");
  await assert.rejects(
    guardar(id, 3, "finalizar", {
      fin_real: "2099-01-01T12:00:00Z",
      resultado: "Terminado",
    }),
    /AGENDA_FECHA/,
  );
  await guardar(id, 3, "cancelar", { motivo: "Interrumpido por lluvia" });
  await assert.rejects(guardar(id, 4, "iniciar"), /AGENDA_TRANSICION/);
  const realizado = randomUUID(),
    inicio = new Date(Date.now() - 7200000).toISOString(),
    fin = new Date(Date.now() - 3600000).toISOString();
  await guardar(realizado, 0, "crear", {
    tipo: "llamada",
    titulo: "Llamada de seguimiento",
    estado: "realizada",
    inicio_real: inicio,
    fin_real: fin,
    resultado: "Cliente solicita una visita",
  });
  await guardar(realizado, 1, "corregir", {
    inicio_real: inicio,
    fin_real: fin,
    resultado: "Cliente solicita llamada posterior",
    motivo: "Corrección de la anotación",
  });
  const eventos = (
    await db.query(
      "select * from public.eventos_agenda where actividad_id=$1 order by ocurrido_en",
      [realizado],
    )
  ).rows;
  assert.equal(eventos.length, 2);
  assert.equal(eventos[1].anterior.resultado, "Cliente solicita una visita");
  const fecha = (
    await db.query(
      "select (now() at time zone 'America/Argentina/Cordoba')::date as dia",
    )
  ).rows[0].dia;
  assert.ok(
    (
      await db.query(
        "select * from public.listar_agenda($1,$2::date-1,$2::date,0)",
        [vendedor, fecha],
      )
    ).rows.length >= 1,
  );
  await assert.rejects(
    db.query("select * from public.listar_agenda($1,$2::date,$2::date+7,0)", [
      vendedor,
      fecha,
    ]),
    /AGENDA_DATOS/,
  );

  // El agente coordina desde Prospectos; no adquiere acceso a notas de Agenda.
  await como(agente);
  const registro = randomUUID(),
    oportunidad = randomUUID();
  await db.query("select public.guardar_registro_inicial($1,0,$2)", [
    registro,
    {
      nombre: "Contacto de integración",
      telefono: "Ficticio",
      ubicacion: "Zona ficticia",
      origen: "whatsapp",
    },
  ]);
  const comercial = (version, accion, datos, operacion = randomUUID()) =>
    db.query("select public.gestionar_oportunidad($1,$2,$3,$4,$5)", [
      oportunidad,
      version,
      operacion,
      accion,
      datos,
    ]);
  const opComercial = randomUUID();
  const visita = {
    registro_id: registro,
    vendedor_id: vendedor,
    plazo: proximo,
    resumen: "Contacto efectivo confirmado",
    contacto_confirmado: "si",
    necesidad: "Consulta comercial",
  };
  await comercial(0, "crear", visita, opComercial);
  // La visita anterior al cambio conserva su seguimiento tras migrar la base compartida.
  await db.exec("reset role");
  await db.exec(
    await readFile(
      new URL("202610060032_prospectos_compartidos.sql", carpeta),
      "utf8",
    ),
  );
  await como(agente);
  await comercial(0, "crear", visita, opComercial);
  assert.equal((await filas()).length, 0);
  await como(vendedor);
  let visitas = (await filas()).filter((a) => a.origen === "visita");
  assert.equal(visitas.length, 1);
  await assert.rejects(
    guardar(visitas[0].id, 1, "editar", { ...datos, motivo: "Cambio manual" }),
    /AGENDA_TRANSICION/,
  );
  await comercial(1, "reprogramar", {
    resumen: "Cliente cambia el horario",
    plazo: new Date(Date.now() + 86400000).toISOString(),
  });
  visitas = (await filas()).filter((a) => a.origen === "visita");
  assert.equal(visitas.length, 2);
  assert.equal(visitas.filter((a) => a.estado === "cancelada").length, 1);
  assert.equal(visitas.filter((a) => a.estado === "realizada").length, 0);
  await como(admin);
  await comercial(2, "reasignar", {
    resumen: "Reasignación de la visita",
    responsable_id: otro,
  });
  await como(otro);
  assert.equal((await filas()).length, 1);
  assert.equal((await filas())[0].estado, "programada");
  await como(vendedor);
  assert.equal(
    (await filas()).filter(
      (a) => a.origen === "visita" && a.estado === "programada",
    ).length,
    0,
  );
  await db.exec("reset role");
  await assert.rejects(
    db.query("delete from public.perfiles where id=$1", [vendedor]),
    /CUENTA_VINCULADA/,
  );
  await assert.rejects(
    db.query("update public.perfiles set activo=false where id=$1", [otro]),
    /CUENTA_TRABAJO_PENDIENTE/,
  );
  await db.exec("set role anon");
  await assert.rejects(
    db.query("select * from public.actividades_agenda"),
    /permission denied/,
  );
  await assert.rejects(
    guardar(randomUUID(), 0, "crear", datos),
    /permission denied/,
  );
});
