import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("PostgreSQL: RLS, altas autorizadas y bloqueo de escalamiento", async (t) => {
  const base = new PGlite();
  t.after(() => base.close());
  // Simula únicamente las tablas/roles externos de Auth; se ejecuta la migración real.
  await base.exec(`
    create role anon;
    create role authenticated;
    create role service_role bypassrls;
    create schema auth;
    grant usage on schema auth to authenticated;
    create table auth.users (
      id uuid primary key, email text,
      raw_app_meta_data jsonb default '{}'::jsonb,
      raw_user_meta_data jsonb default '{}'::jsonb
    );
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
  `);
  await base.exec(
    await readFile(
      new URL(
        "../migrations/202609290001_acceso_y_usuarios.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  const admin = "00000000-0000-0000-0000-000000000001";
  const vendedor = "00000000-0000-0000-0000-000000000002";
  const otro = "00000000-0000-0000-0000-000000000003";
  async function alta(id, rol, actor) {
    return base.query(
      "insert into auth.users(id,email,raw_app_meta_data) values ($1,$2,$3::jsonb)",
      [
        id,
        `${id}@example.com`,
        JSON.stringify({
          pignus_autorizado: true,
          nombre: "Persona Prueba",
          rol,
          ...(actor ? { creado_por: actor } : {}),
        }),
      ],
    );
  }
  await alta(admin, "administrador");
  await alta(vendedor, "vendedor", admin);
  await alta(otro, "vendedor", admin);
  assert.equal(
    (
      await base.query(
        "select count(*)::int as cantidad from public.eventos_cuentas",
      )
    ).rows[0].cantidad,
    3,
  );

  // Metadatos editables por usuario nunca permiten autorregistro ni rol administrador.
  await assert.rejects(
    base.query(
      `insert into auth.users(id,email,raw_user_meta_data) values ($1,'intruso@example.com','{"rol":"administrador","pignus_autorizado":true}')`,
      ["00000000-0000-0000-0000-000000000004"],
    ),
    /Alta no autorizada/,
  );
  await assert.rejects(
    alta("00000000-0000-0000-0000-000000000005", "administrador"),
    /responsable/,
  );
  await assert.rejects(
    alta("00000000-0000-0000-0000-000000000006", "vendedor", vendedor),
    /no habilitado/,
  );

  await base.exec("set role authenticated");
  await base.query("select set_config('request.jwt.claim.sub', $1, false)", [
    vendedor,
  ]);
  assert.deepEqual((await base.query("select id from public.perfiles")).rows, [
    { id: vendedor },
  ]);
  assert.equal(
    (await base.query("select * from public.eventos_cuentas")).rows.length,
    0,
  );
  await assert.rejects(
    base.query("update public.perfiles set rol='administrador' where id=$1", [
      vendedor,
    ]),
    /permission denied/,
  );
  await assert.rejects(
    base.query("delete from public.perfiles where id=$1", [vendedor]),
    /permission denied/,
  );

  await base.query("select set_config('request.jwt.claim.sub', $1, false)", [
    admin,
  ]);
  assert.equal(
    (await base.query("select * from public.perfiles")).rows.length,
    3,
  );
  assert.equal(
    (await base.query("select * from public.eventos_cuentas")).rows.length,
    3,
  );
  await assert.rejects(
    base.query("update public.perfiles set rol='administrador' where id=$1", [
      vendedor,
    ]),
    /permission denied/,
  );

  await base.exec("reset role");
  await base.query("update public.perfiles set activo=false where id=$1", [
    admin,
  ]);
  await base.exec("set role authenticated");
  assert.equal(
    (await base.query("select * from public.perfiles")).rows.length,
    0,
  );
  await base.exec("reset role; set role anon");
  await assert.rejects(
    base.query("select * from public.perfiles"),
    /permission denied/,
  );
});
