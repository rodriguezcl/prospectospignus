import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const leer = (ruta) => readFile(new URL(ruta, import.meta.url), "utf8");
test("demostración: carga idempotente, mes Córdoba, RLS, limpieza acotada", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key, email text, raw_app_meta_data jsonb default '{}',
      instance_id uuid,aud text,role text,encrypted_password text,banned_until timestamptz,raw_user_meta_data jsonb,created_at timestamptz,updated_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  for (const archivo of [
    "202609290001_acceso_y_usuarios.sql",
    "202609290002_alta_diferida.sql",
    "202609290003_registros_iniciales.sql",
    "202609300004_demostracion_y_resumen.sql",
    "202609300005_gestion_cuentas.sql",
  ])
    await db.exec(await leer(`../migrations/${archivo}`));
  const admin = "00000000-0000-0000-0000-000000000001",
    real = "00000000-0000-0000-0000-000000000002";
  for (const id of [admin, real])
    await db.query(
      "insert into auth.users(id,email,raw_app_meta_data) values($1,$2,$3)",
      [
        id,
        `${id}@example.invalid`,
        {
          pignus_autorizado: true,
          nombre: "Cuenta real",
          rol: id === admin ? "administrador" : "vendedor",
          ...(id === admin ? {} : { creado_por: admin }),
        },
      ],
    );
  const carga = await leer("../demostracion/cargar_septiembre_2026.sql");
  const limpieza = await leer("../demostracion/eliminar_septiembre_2026.sql");
  await db.exec(carga);
  await db.exec(carga);
  assert.equal(
    (await db.query("select count(*)::int n from public.registros_iniciales"))
      .rows[0].n,
    90,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.perfiles where not activo",
      )
    ).rows[0].n,
    2,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from auth.users where banned_until='2099-12-31T23:59:59Z'::timestamptz and encrypted_password=''",
      )
    ).rows[0].n,
    2,
  );
  for (const [i, fecha] of [
    "2026-09-01T02:59:59Z",
    "2026-09-01T03:00:00Z",
    "2026-10-01T02:59:59Z",
    "2026-10-01T03:00:00Z",
  ].entries())
    await db.query(
      "insert into public.registros_iniciales(id,nombre,origen,creado_por,responsable_id,creado_en) values($1,'Real','oficina',$2,$2,$3)",
      [`10000000-0000-0000-0000-00000000000${i}`, real, fecha],
    );
  async function como(id) {
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  }
  await como(admin);
  assert.equal(
    (
      await db.query(
        "select * from public.listar_resumen_mensual('2026-09-01')",
      )
    ).rows.length,
    92,
  );
  await como(real);
  const visibles = (
    await db.query("select * from public.listar_resumen_mensual('2026-09-01')")
  ).rows;
  assert.equal(visibles.length, 2);
  assert.ok(visibles.every((r) => r.creado_por === real));
  await como("d3a02026-0900-4000-8000-000000000001");
  assert.equal(
    (
      await db.query(
        "select * from public.listar_resumen_mensual('2026-09-01')",
      )
    ).rows.length,
    0,
  );
  await db.exec("reset role; set role anon");
  await assert.rejects(
    db.query("select * from public.listar_resumen_mensual('2026-09-01')"),
    /permission denied/,
  );
  await db.exec("reset role");
  const ampliacion = await leer("../demostracion/ampliar_septiembre_2026.sql");
  await db.exec(ampliacion);
  await db.exec(ampliacion);
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.registros_iniciales where lote_demostracion is not null",
      )
    ).rows[0].n,
    134,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.eventos_registros e join public.registros_iniciales r on r.id=e.registro_id where r.lote_demostracion is not null",
      )
    ).rows[0].n,
    224,
  );
  const dias = (
    await db.query(
      "select (creado_en at time zone 'America/Argentina/Cordoba')::date dia,count(*)::int n from public.registros_iniciales where lote_demostracion is not null group by 1",
    )
  ).rows;
  assert.equal(dias.length, 26);
  assert.equal(Math.max(...dias.map((d) => d.n)), 11);
  assert.equal(Math.min(...dias.map((d) => d.n)), 1);
  assert.ok(
    (
      await db.query(
        "select count(distinct (creado_en at time zone 'America/Argentina/Cordoba')::time)::int n from public.registros_iniciales where lote_demostracion is not null",
      )
    ).rows[0].n > 90,
  );
  assert.equal(
    (
      await db.query(
        "select count(*)::int n from public.registros_iniciales where lote_demostracion is null",
      )
    ).rows[0].n,
    4,
  );
  await assert.rejects(db.exec(limpieza), /Falta confirmación/);
  await db.exec("rollback");
  await db.exec(
    "set pignus.confirmar_limpieza = 'pignus-demo-septiembre-2026-v1'",
  );
  await db.exec(
    "update public.registros_iniciales set version=version+1 where lote_demostracion is not null",
  );
  await assert.rejects(db.exec(limpieza), /El lote cambió/);
  await db.exec("rollback");
  await db.exec(
    "update public.registros_iniciales set version=version-1 where lote_demostracion is not null",
  );
  await db.exec(limpieza);
  assert.equal(
    (await db.query("select count(*)::int n from public.registros_iniciales"))
      .rows[0].n,
    4,
  );
  assert.equal(
    (await db.query("select count(*)::int n from public.perfiles")).rows[0].n,
    2,
  );
  assert.equal(
    (await db.query("select count(*)::int n from auth.users")).rows[0].n,
    2,
  );
});
