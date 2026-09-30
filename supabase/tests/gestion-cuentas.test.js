import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

test("gestión de cuentas: permisos, versiones, historial, eliminación y último administrador", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  for (const archivo of [
    "202609290001_acceso_y_usuarios.sql",
    "202609290002_alta_diferida.sql",
    "202609290003_registros_iniciales.sql",
    "202609300004_demostracion_y_resumen.sql",
    "202609300005_gestion_cuentas.sql",
  ])
    await db.exec(
      await readFile(
        new URL(`../migrations/${archivo}`, import.meta.url),
        "utf8",
      ),
    );
  const ids = Array.from(
    { length: 6 },
    (_, i) => `00000000-0000-0000-0000-00000000000${i + 1}`,
  );
  const [admin, vendedor, segundo, vacio, historico, demo] = ids;
  for (const id of ids)
    await db.query("insert into auth.users values($1,$2,$3)", [
      id,
      `${id}@example.invalid`,
      {
        pignus_autorizado: true,
        nombre: "Persona prueba",
        rol: id === admin ? "administrador" : "vendedor",
        ...(id === admin ? {} : { creado_por: admin }),
      },
    ]);
  await db.query(
    "update public.perfiles set lote_demostracion='prueba',activo=false where id=$1",
    [demo],
  );
  async function como(id) {
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  }
  const gestionar = (id, version, accion, datos = {}) =>
    db.query("select public.gestionar_cuenta($1,$2,$3,$4)", [
      id,
      version,
      accion,
      { motivo: "Prueba autorizada", ...datos },
    ]);
  await como(vendedor);
  await assert.rejects(gestionar(admin, 1, "desactivar"), /CUENTA_ACCESO/);
  await assert.rejects(
    db.exec("update public.perfiles set rol='administrador'"),
    /permission denied/,
  );
  await como(admin);
  for (const accion of ["desactivar", "eliminar"])
    await assert.rejects(gestionar(admin, 1, accion), /CUENTA_ULTIMO_ADMIN/);
  await assert.rejects(
    gestionar(admin, 1, "editar", { nombre: "Admin", rol: "vendedor" }),
    /CUENTA_ULTIMO_ADMIN/,
  );
  await assert.rejects(
    gestionar(vendedor, 1, "editar", { nombre: "X", rol: "administrador" }),
    /CUENTA_DATOS/,
  );
  await assert.rejects(
    gestionar(vendedor, 1, "editar", { nombre: "Persona", rol: "supervisor" }),
    /CUENTA_DATOS/,
  );
  await assert.rejects(
    gestionar(vendedor, 1, "desactivar", { motivo: "" }),
    /CUENTA_MOTIVO/,
  );
  for (const accion of ["editar", "reactivar", "eliminar"])
    await assert.rejects(gestionar(demo, 1, accion), /CUENTA_DEMO/);
  await gestionar(segundo, 1, "editar", {
    nombre: "Segunda administración",
    rol: "administrador",
    actor_id: vendedor,
  });
  await assert.rejects(gestionar(segundo, 1, "desactivar"), /CUENTA_CONFLICTO/);
  await assert.rejects(gestionar(admin, 1, "desactivar"), /CUENTA_PROPIA/);
  const evento = (
    await db.query(
      "select * from public.eventos_cuentas where usuario_id=$1 and tipo='cuenta_editada'",
      [segundo],
    )
  ).rows[0];
  assert.equal(evento.actor_id, admin);
  assert.equal(evento.anterior.rol, "vendedor");
  assert.equal(evento.nuevo.rol, "administrador");
  await gestionar(vendedor, 1, "desactivar");
  await como(vendedor);
  assert.equal(
    (await db.query("select * from public.perfiles")).rows.length,
    0,
  );
  await assert.rejects(gestionar(vacio, 1, "eliminar"), /CUENTA_ACCESO/);
  await como(admin);
  await gestionar(vendedor, 2, "reactivar");
  await como(vendedor);
  assert.equal(
    (await db.query("select * from public.perfiles")).rows.length,
    1,
  );
  const registro = "10000000-0000-0000-0000-000000000001";
  const datos = { nombre: "Contacto", origen: "oficina" };
  await db.query("select public.guardar_registro_inicial($1,0,$2)", [
    registro,
    datos,
  ]);
  await como(admin);
  await assert.rejects(
    gestionar(vendedor, 3, "eliminar", {
      confirmacion: `${vendedor}@example.invalid`,
    }),
    /CUENTA_VINCULADA/,
  );
  // Responsable histórico no es creador ni responsable actual: tampoco debe borrarse.
  await db.query("select public.guardar_registro_inicial($1,1,$2)", [
    registro,
    { ...datos, responsable_id: historico, motivo: "Primera asignación" },
  ]);
  await db.query("select public.guardar_registro_inicial($1,2,$2)", [
    registro,
    { ...datos, responsable_id: vendedor, motivo: "Segunda asignación" },
  ]);
  await assert.rejects(
    gestionar(historico, 1, "eliminar", {
      confirmacion: `${historico}@example.invalid`,
    }),
    /CUENTA_VINCULADA/,
  );
  await assert.rejects(
    gestionar(vacio, 1, "eliminar", { confirmacion: "otro@example.invalid" }),
    /CUENTA_CONFIRMACION/,
  );
  await gestionar(vacio, 1, "eliminar", {
    confirmacion: `${vacio}@example.invalid`,
  });
  assert.equal(
    (await db.query("select * from public.perfiles where id=$1", [vacio])).rows
      .length,
    0,
  );
  assert.equal(
    (
      await db.query(
        "select * from public.eventos_cuentas where usuario_id=$1",
        [vacio],
      )
    ).rows.length,
    2,
  );
  await assert.rejects(gestionar(vacio, 1, "eliminar"), /CUENTA_NO_EXISTE/);
  // Dos cambios con la misma versión: solo uno puede confirmarse.
  const resultados = await Promise.allSettled([
    gestionar(segundo, 2, "editar", {
      nombre: "Cambio A",
      rol: "administrador",
    }),
    gestionar(segundo, 2, "editar", {
      nombre: "Cambio B",
      rol: "administrador",
    }),
  ]);
  assert.equal(resultados.filter((r) => r.status === "fulfilled").length, 1);
  await gestionar(segundo, 3, "editar", {
    nombre: "Vendedor ahora",
    rol: "vendedor",
  });
  await assert.rejects(
    gestionar(admin, 1, "desactivar"),
    /CUENTA_ULTIMO_ADMIN/,
  );
  await como(segundo);
  await assert.rejects(gestionar(vendedor, 3, "desactivar"), /CUENTA_ACCESO/);
  await db.exec("reset role");
  assert.equal(
    (await db.query("select * from auth.users where id=$1", [vacio])).rows
      .length,
    0,
  );
  await db.exec("set role anon");
  await assert.rejects(
    gestionar(vendedor, 3, "desactivar"),
    /permission denied/,
  );
});
