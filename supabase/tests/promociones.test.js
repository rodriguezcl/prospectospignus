import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("promociones: roles, publicación idempotente, archivos privados, vigencia y auditoría", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;grant usage on schema auth to authenticated;
 create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create schema storage;grant usage on schema storage to authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text references storage.buckets(id),name text,metadata jsonb,unique(bucket_id,name));
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to authenticated;`);
  const carpeta = new URL("../migrations/", import.meta.url);
  for (const archivo of (await readdir(carpeta))
    .filter((a) => a.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(new URL(archivo, carpeta), "utf8"));
  await db.exec(
    await readFile(
      new URL("../storage/promociones.sql", import.meta.url),
      "utf8",
    ),
  );
  // Una política genérica preexistente no debe abrir el bucket protegido.
  await db.exec(
    "create policy politica_ajena on storage.objects for all to authenticated using(true) with check(true)",
  );
  const [admin, vendedor, agente, inactivo] = Array.from(
    { length: 4 },
    randomUUID,
  );
  for (const [id, rol] of [
    [admin, "administrador"],
    [vendedor, "vendedor"],
    [agente, "agente"],
    [inactivo, "vendedor"],
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
  await db.query("update public.perfiles set activo=false where id=$1", [
    inactivo,
  ]);
  const como = async (id) => {
    await db.exec("reset role;set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  };
  const id = randomUUID();
  const datos = {
    titulo: "Promoción exclusiva",
    descripcion: "Descripción comercial",
    condiciones: "Bonificación comercial",
    destinatarios: "agente",
    desde: "2099-01-01",
    hasta: "2099-12-31",
  };
  const guardar = (accion, version, entrada = {}, op = randomUUID()) =>
    db.query("select public.gestionar_promocion($1,$2,$3,$4,$5)", [
      id,
      version,
      op,
      accion,
      entrada,
    ]);
  const consultar = () => db.query("select * from public.promociones");
  await como(vendedor);
  await assert.rejects(guardar("crear", 0, datos), /PROMO_ACCESO/);
  await como(admin);
  const crear = randomUUID();
  await guardar("crear", 0, datos, crear);
  await guardar("crear", 0, datos, crear);
  assert.equal((await consultar()).rows.length, 1);
  await assert.rejects(guardar("editar", 0, datos), /PROMO_CONFLICTO/);
  await assert.rejects(
    db.exec("update public.promociones set destinatarios='ambos'"),
    /permission denied/,
  );
  await como(agente);
  assert.equal((await consultar()).rows.length, 0);
  await como(admin);
  const archivo = randomUUID(),
    ruta = `${id}/${archivo}`,
    meta = {
      id: archivo,
      nombre: "Oferta.pdf",
      tipo: "application/pdf",
      bytes: 15,
    };
  await assert.rejects(
    guardar("reservar_archivo", 1, { ...meta, tipo: "image/svg+xml" }),
    /check constraint/,
  );
  await guardar("reservar_archivo", 1, meta);
  await assert.rejects(guardar("publicar", 2), /PROMO_PENDIENTE/);
  await assert.rejects(
    db.query("select public.confirmar_archivo_promocion($1)", [archivo]),
    /PROMO_ARCHIVO/,
  );
  const subir = () =>
    db.query(
      "insert into storage.objects(bucket_id,name,metadata) values('promociones',$1,$2)",
      [ruta, { size: 15, mimetype: "application/pdf" }],
    );
  await como(vendedor);
  await assert.rejects(subir(), /row-level security/);
  await como(admin);
  await subir();
  await assert.rejects(
    db.exec(
      "insert into storage.objects(bucket_id,name) values('promociones','no-reservado')",
    ),
    /row-level security/,
  );
  await db.query("select public.confirmar_archivo_promocion($1)", [archivo]);
  await db.query("select public.confirmar_archivo_promocion($1)", [archivo]);
  assert.equal((await consultar()).rows[0].version, 3);
  const publicar = randomUUID();
  await guardar("publicar", 3, {}, publicar);
  await guardar("publicar", 3, {}, publicar);
  await como(agente);
  assert.equal((await consultar()).rows.length, 1);
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    1,
  );
  assert.equal(
    (await db.query("select * from public.archivos_promociones")).rows.length,
    1,
  );
  const avisos = (await db.query("select * from public.avisos_promociones"))
    .rows;
  assert.equal(avisos.length, 1);
  await db.query("select public.leer_aviso_promocion($1)", [avisos[0].id]);
  assert.ok(
    (await db.query("select leida_en from public.avisos_promociones")).rows[0]
      .leida_en,
  );
  assert.equal(
    (await db.exec("delete from storage.objects")).at(-1).affectedRows,
    0,
  );
  await como(vendedor);
  assert.equal((await consultar()).rows.length, 0);
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
  assert.equal(
    (await db.query("select * from public.avisos_promociones")).rows.length,
    0,
  );
  await como(inactivo);
  assert.equal((await consultar()).rows.length, 0);
  await como(admin);
  await assert.rejects(guardar("editar", 4, datos), /PROMO_TRANSICION/);
  await guardar("borrador", 4);
  await guardar("editar", 5, { ...datos, destinatarios: "ambos" });
  await guardar("publicar", 6);
  await como(vendedor);
  assert.equal((await consultar()).rows.length, 1);
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    1,
  );
  await como(admin);
  await guardar("archivar", 7);
  await como(vendedor);
  assert.equal((await consultar()).rows.length, 0);
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
  await como(admin);
  await guardar("borrador", 8);
  await guardar("retirar_archivo", 9, { id: archivo });
  assert.equal(
    (await db.query("select * from storage.objects")).rows.length,
    0,
  );
  await guardar("editar", 10, {
    ...datos,
    hasta: "2000-01-01",
    desde: "1999-01-01",
  });
  await assert.rejects(guardar("publicar", 11), /PROMO_VENCIDA/);
  assert.ok(
    (await db.query("select * from public.eventos_promociones")).rows.length >=
      10,
  );
  await db.exec("reset role");
  await assert.rejects(
    db.query("delete from public.perfiles where id=$1", [agente]),
    /CUENTA_VINCULADA/,
  );
  const bucket = (await db.query("select * from storage.buckets")).rows[0];
  assert.equal(bucket.public, false);
  assert.equal(Number(bucket.file_size_limit), 20971520);
  await db.exec("set role anon");
  await assert.rejects(guardar("archivar", 11), /permission denied/);
  await assert.rejects(
    db.query("select * from public.promociones"),
    /permission denied/,
  );
});
