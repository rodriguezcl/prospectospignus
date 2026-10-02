import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("histórico: importación atómica, RLS, reintentos y reactivación sin reescribir cierres", async (t) => {
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
  const [admin, vendedor, otro] = Array.from({ length: 3 }, randomUUID);
  for (const [id, rol, nombre] of [
    [admin, "administrador", "Administrador"],
    [vendedor, "vendedor", "Vendedor Uno"],
    [otro, "vendedor", "Vendedor Dos"],
  ]) {
    await db.query("insert into auth.users values($1,$2,$3)", [
      id,
      `${id}@example.invalid`,
      {
        pignus_autorizado: true,
        nombre,
        rol,
        ...(id === admin ? {} : { creado_por: admin }),
      },
    ]);
  }
  const plantilla = await readFile(
    new URL("../importacion/importar-historico.sql", import.meta.url),
    "utf8",
  );
  const entrada = {
    administrador: admin,
    mes: "2026-09-01",
    lote: "PRUEBA-HISTORICO",
    total: 2,
    ganadas: 1,
    sha256: "a".repeat(64),
    vendedores: { "Vendedor Uno": vendedor, "Vendedor Dos": otro },
    filas: ["perdida", "ganada"].map((estado, i) => ({
      fila: `${i}`,
      vendedor: i ? "Vendedor Dos" : "Vendedor Uno",
      nombre: `Contacto ${i}`,
      telefono: `ficticio ${i}`,
      correo: `contacto${i}@example.invalid`,
      direccion: "Dirección de prueba",
      observaciones: "Prueba local",
      fecha_estimada: i ? "2026-09-30 23:59:59" : "2026-09-01 10:00:00",
      estado,
    })),
  };
  const sql = plantilla.replace(
    "__ENTRADA_JSON__",
    `'${JSON.stringify(entrada).replaceAll("'", "''")}'`,
  );
  await db.exec(sql);
  await db.exec(sql);
  const antesFechas = (
    await db.query(
      "select id,creado_en,importacion_historica from public.registros_iniciales order by id",
    )
  ).rows;
  assert.equal(
    (
      await db.query(
        "select * from public.listar_cargas_mensuales('2026-09-01')",
      )
    ).rows.length,
    0,
  );
  const confirmar = (huella = entrada.sha256) =>
    db.query("select privado.confirmar_fechas_lote($1,$2,$3,$4) as cantidad", [
      entrada.lote,
      huella,
      admin,
      2,
    ]);
  await assert.rejects(confirmar("b".repeat(64)), /FECHAS_LOTE/);
  assert.equal((await confirmar()).rows[0].cantidad, 2);
  assert.equal((await confirmar()).rows[0].cantidad, 0);
  assert.deepEqual(
    (
      await db.query(
        "select id,creado_en,importacion_historica from public.registros_iniciales order by id",
      )
    ).rows,
    antesFechas,
  );
  const cargas = (
    await db.query("select * from public.listar_cargas_mensuales('2026-09-01')")
  ).rows;
  assert.equal(cargas.length, 2);
  assert.equal(
    new Date(cargas[1].fecha_carga).toISOString(),
    "2026-10-01T02:59:59.000Z",
  );
  assert.equal(
    new Date(cargas[1].dia).toISOString().slice(0, 10),
    "2026-09-30",
  );
  assert.equal(
    (
      await db.query(
        "select * from public.listar_cargas_mensuales('2026-10-01')",
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select * from public.eventos_registros where tipo='registro_actualizado'",
      )
    ).rows.length,
    2,
  );
  assert.equal(
    (await db.query("select * from public.oportunidades")).rows.length,
    2,
  );
  assert.equal(
    (await db.query("select * from public.notificaciones")).rows.length,
    0,
  );
  const perdida = (
    await db.query("select * from public.oportunidades where estado='perdida'")
  ).rows[0];
  assert.equal(perdida.visita_en, null);
  assert.equal(perdida.cerrado_en, null);
  assert.equal(perdida.motivo_perdida, "no_informado_historico");
  async function como(id) {
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  }
  const datos = {
    resumen: "El prospecto vuelve a consultar",
    negociacion_confirmada: "si",
    plazo: new Date(Date.now() + 86400000).toISOString(),
  };
  const op = randomUUID();
  const reactivar = (id, version, operacion, d = datos) =>
    db.query("select public.reactivar_oportunidad($1,$2,$3,$4)", [
      id,
      version,
      operacion,
      d,
    ]);
  await como(otro);
  assert.equal(
    (
      await db.query(
        "select * from public.listar_cargas_mensuales('2026-09-01')",
      )
    ).rows.length,
    1,
  );
  await assert.rejects(confirmar(), /permission denied/);
  assert.equal(
    (
      await db.query(
        "select * from public.listar_historico_mensual('2026-09-01')",
      )
    ).rows.length,
    1,
  );
  await assert.rejects(reactivar(perdida.id, 1, op), /COMERCIAL_ACCESO/);
  const ganada = (await db.query("select * from public.oportunidades")).rows[0];
  await assert.rejects(
    reactivar(ganada.id, 1, randomUUID()),
    /COMERCIAL_TRANSICION/,
  );
  await como(vendedor);
  await assert.rejects(
    reactivar(perdida.id, 1, op, { ...datos, plazo: "2000-01-01" }),
    /COMERCIAL_PLAZO/,
  );
  await reactivar(perdida.id, 1, op);
  await reactivar(perdida.id, 1, op);
  await assert.rejects(
    reactivar(perdida.id, 1, randomUUID()),
    /COMERCIAL_CONFLICTO/,
  );
  const abierta = (await db.query("select * from public.oportunidades"))
    .rows[0];
  assert.equal(abierta.ciclo, 2);
  assert.equal(abierta.estado, "seguimiento");
  assert.equal(abierta.motivo_perdida, null);
  const historico = (
    await db.query(
      "select * from public.listar_historico_mensual('2026-09-01')",
    )
  ).rows;
  assert.equal(historico[0].resultado, "perdida");
  assert.equal(historico[0].estado_actual, "seguimiento");
  const evento = (
    await db.query(
      "select * from public.eventos_oportunidades where tipo='reactivar'",
    )
  ).rows[0];
  assert.equal(evento.anterior.estado, "perdida");
  assert.equal(evento.anterior.ciclo, 1);
  assert.equal(
    (await db.query("select * from public.notificaciones")).rows.length,
    1,
  );
  await como(admin);
  assert.equal(
    (
      await db.query(
        "select * from public.listar_resumen_mensual('2026-09-01')",
      )
    ).rows.length,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select * from public.listar_historico_mensual('2026-09-01')",
      )
    ).rows.length,
    2,
  );
  await assert.rejects(
    db.exec("update public.registros_iniciales set importacion_historica=null"),
    /permission denied/,
  );
  await db.exec("reset role");
  await db.exec(sql);
  assert.equal(
    (
      await db.query("select ciclo from public.oportunidades where id=$1", [
        perdida.id,
      ])
    ).rows[0].ciclo,
    2,
  );
  await assert.rejects(
    db.exec(sql.replace("a".repeat(64), "b".repeat(64))),
    /IMPORTACION_ARCHIVO_CAMBIADO/,
  );
  await db.exec("rollback");
  const ventas = async (mes = null, responsable = null, pagina = 0) =>
    (
      await db.query(
        "select public.listar_ventas_concretadas($1,$2,$3) as datos",
        [mes, responsable, pagina],
      )
    ).rows[0].datos;
  await como(admin);
  const septiembre = await ventas("2026-09-01");
  assert.equal(septiembre.total, 1);
  assert.equal(septiembre.filas[0].cerrado_en, null);
  assert.equal(septiembre.filas[0].mes_cierre, "2026-09-01");
  assert.equal(septiembre.filas[0].vendedor_visita_nombre, null);
  assert.equal((await ventas("2026-10-01")).total, 0);
  await assert.rejects(ventas("2026-09-02"), /VENTAS_FILTROS/);
  await assert.rejects(ventas(null, null, -1), /VENTAS_FILTROS/);
  await como(vendedor);
  assert.equal((await ventas()).total, 0);
  assert.equal((await ventas(null, otro)).total, 0);
  await como(otro);
  assert.equal((await ventas()).total, 1);
  // Fixture local: otro ciclo ganado en octubre conserva el mes de procedencia.
  await db.exec("reset role");
  await db.query(
    "update public.oportunidades set estado='ganada',cerrado_por=$1,cerrado_en='2026-10-01T03:00:00Z',proxima_accion_en=null where id=$2",
    [vendedor, perdida.id],
  );
  await como(admin);
  assert.equal((await ventas("2026-09-01")).total, 1);
  assert.equal((await ventas("2026-10-01")).total, 1);
  await db.exec("reset role");
  await db.query(
    "update public.oportunidades set cerrado_en='2026-10-01T02:59:59Z' where id=$1",
    [perdida.id],
  );
  await como(admin);
  assert.equal((await ventas("2026-09-01")).total, 2);
  assert.equal((await ventas("2026-10-01")).total, 0);
  await db.exec("reset role");
  await db.query(
    `insert into public.oportunidades(id,prospecto_id,necesidad,estado,responsable_id,creado_por,cerrado_por,periodo_historico)
    select gen_random_uuid(),prospecto_id,'Otra necesidad de prueba','ganada',$1,$1,$1,'2026-09-01'
    from public.oportunidades cross join generate_series(1,21) where id=$2`,
    [otro, ganada.id],
  );
  await como(otro);
  const primera = await ventas(),
    segunda = await ventas(null, null, 1);
  assert.equal(primera.total, 22);
  assert.equal(primera.filas.length, 20);
  assert.equal(segunda.filas.length, 2);
  assert.equal(
    new Set([...primera.filas, ...segunda.filas].map((v) => v.id)).size,
    22,
  );
  await db.exec("reset role");
  await db.query("update public.perfiles set activo=false where id=$1", [otro]);
  await como(admin);
  assert.equal(
    (await ventas()).responsables.some((r) => r.id === otro),
    true,
  );
  await como(otro);
  await assert.rejects(ventas(), /VENTAS_ACCESO/);
  await db.exec("reset role; set role anon");
  await assert.rejects(
    db.query("select * from public.listar_historico_mensual('2026-09-01')"),
    /permission denied/,
  );
});
