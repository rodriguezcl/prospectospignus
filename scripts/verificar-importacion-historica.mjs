// Ejecuta el lote completo en PostgreSQL local efímero, sin conexión a Supabase.
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
const [configuracion, archivoSql] = process.argv.slice(2);
if (!configuracion || !archivoSql)
  throw new Error("Indicá configuración y SQL local.");
const config = JSON.parse(await readFile(configuracion, "utf8"));
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  const carpeta = new URL("../supabase/migrations/", import.meta.url);
  for (const archivo of (await readdir(carpeta))
    .filter((a) => a.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(new URL(archivo, carpeta), "utf8"));
  await db.query("insert into auth.users values($1,$2,$3)", [
    config.administrador,
    "administrador@example.invalid",
    {
      pignus_autorizado: true,
      nombre: "Operador de importación",
      rol: "administrador",
    },
  ]);
  for (const [nombre, id] of Object.entries(config.vendedores))
    await db.query("insert into auth.users values($1,$2,$3)", [
      id,
      `${id}@example.invalid`,
      {
        pignus_autorizado: true,
        nombre,
        rol: "vendedor",
        creado_por: config.administrador,
      },
    ]);
  const sql = await readFile(archivoSql, "utf8");
  await db.exec(sql);
  await db.exec(sql);
  console.log(
    JSON.stringify(
      (
        await db.query(`select p.nombre,o.estado,count(*)::int cantidad
    from public.oportunidades o join public.perfiles p on p.id=o.cerrado_por group by p.nombre,o.estado order by p.nombre,o.estado`)
      ).rows,
    ),
  );
} catch (error) {
  // No volcar la consulta ni los datos personales incluidos en errores de PostgreSQL.
  console.error("La validación local falló:", error.message);
  process.exitCode = 1;
} finally {
  await db.close();
}
