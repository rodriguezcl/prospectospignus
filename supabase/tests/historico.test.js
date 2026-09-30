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
      fecha_estimada: "2026-09-01 10:00:00",
      estado,
    })),
  };
  const sql = plantilla.replace(
    "__ENTRADA_JSON__",
    `'${JSON.stringify(entrada).replaceAll("'", "''")}'`,
  );
  await db.exec(sql);
  await db.exec(sql);
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
  await db.exec("rollback; set role anon");
  await assert.rejects(
    db.query("select * from public.listar_historico_mensual('2026-09-01')"),
    /permission denied/,
  );
});
