import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("alta de prospecto con visita: atomicidad, permisos y reintentos", async (t) => {
  const db = new PGlite();
  t.after(() => db.close());
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to authenticated;
    create table auth.users(id uuid primary key,email text,raw_app_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
  const carpeta = new URL("../migrations/", import.meta.url);
  for (const f of (await readdir(carpeta))
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(await readFile(new URL(f, carpeta), "utf8"));
  const [admin, vendedor, otroVendedor, agente, inactivo] = Array.from(
    { length: 5 },
    randomUUID,
  );
  for (const [id, rol] of [
    [admin, "administrador"],
    [vendedor, "vendedor"],
    [otroVendedor, "vendedor"],
    [agente, "agente"],
    [inactivo, "vendedor"],
  ])
    await db.query("insert into auth.users values($1,$2,$3)", [
      id,
      `${id}@example.invalid`,
      {
        pignus_autorizado: true,
        nombre: `Prueba ${rol}`,
        rol,
        ...(id === admin ? {} : { creado_por: admin }),
      },
    ]);
  await db.query("update public.perfiles set activo=false where id=$1", [
    inactivo,
  ]);
  const como = async (id) => {
    await db.exec("reset role; set role authenticated");
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  };
  const datos = {
    nombre: "Mario prueba",
    telefono: "+54 9 3513 00-0000",
    correo: "mario@example.invalid",
    ubicacion: "Dirección de prueba",
    ubicacion_comercial: "docta",
    origen: "referido",
    observaciones: "Relevamiento inicial",
  };
  const visita = {
    inicio_previsto: new Date(Date.now() + 3 * 86400000).toISOString(),
    fin_previsto: null,
    nota: "Avisar al llegar",
  };
  const guardar = async (id, contacto = datos, cita = visita) =>
    (
      await db.query(
        "select public.guardar_prospecto_con_visita_042($1,$2,$3) r",
        [id, contacto, cita],
      )
    ).rows[0].r;
  const registro = randomUUID();

  await t.test(
    "guarda contacto y visita, reserva al vendedor y no crea negociación",
    async () => {
      await como(vendedor);
      assert.deepEqual(await guardar(registro), {
        id: registro,
        visita_id: registro,
      });
      const contacto = (
        await db.query("select * from public.registros_iniciales where id=$1", [
          registro,
        ])
      ).rows[0];
      const cita = (
        await db.query("select * from public.actividades_agenda where id=$1", [
          registro,
        ])
      ).rows[0];
      assert.equal(contacto.creado_por, vendedor);
      assert.equal(contacto.ubicacion_comercial, "docta");
      assert.equal(contacto.responsable_id, null);
      assert.equal(cita.registro_id, registro);
      assert.equal(cita.oportunidad_id, null);
      assert.equal(cita.vendedor_id, vendedor);
      assert.equal(cita.tipo, "visita");
      assert.equal(cita.estado, "programada");
      assert.equal(cita.inicio_real, null);
      assert.equal(cita.nota, visita.nota);
      assert.equal(
        (await db.query("select * from public.oportunidades")).rows.length,
        0,
      );
      const atencion = (
        await db.query("select public.atencion_prospecto_039($1) r", [registro])
      ).rows[0].r;
      assert.equal(atencion.vendedor_id, vendedor);
      await assert.rejects(
        db.query("select public.tomar_prospecto_039($1,$2,true)", [
          registro,
          atencion.version,
        ]),
        /AGENDA_CONTACTO_PENDIENTE/,
      );
    },
  );

  await t.test(
    "reintento exacto no duplica y rechaza cambios de contacto o visita",
    async () => {
      assert.deepEqual(await guardar(registro), {
        id: registro,
        visita_id: registro,
      });
      assert.equal(
        (await db.query("select * from public.actividades_agenda")).rows.length,
        1,
      );
      assert.equal(
        (await db.query("select * from public.eventos_agenda")).rows.length,
        1,
      );
      assert.equal(
        (await db.query("select * from public.eventos_registros")).rows.length,
        1,
      );
      await assert.rejects(
        guardar(registro, { ...datos, nombre: "Nombre diferente" }),
        /ALTA_VISITA_CONFLICTO/,
      );
      await assert.rejects(
        guardar(registro, datos, { ...visita, nota: "Otro acuerdo" }),
        /AGENDA_CONFLICTO/,
      );
      await db.query("select public.guardar_registro_inicial_041($1,1,$2)", [
        registro,
        { ...datos, nombre: "Nombre corregido" },
      ]);
      assert.deepEqual(await guardar(registro), {
        id: registro,
        visita_id: registro,
      });
      assert.equal(
        (
          await db.query(
            "select nombre from public.registros_iniciales where id=$1",
            [registro],
          )
        ).rows[0].nombre,
        "NOMBRE CORREGIDO",
      );
      const reprogramada = new Date(Date.now() + 4 * 86400000).toISOString();
      await db.query(
        "select public.gestionar_actividad_040($1,1,$2,'editar',$3)",
        [
          registro,
          randomUUID(),
          {
            registro_id: registro,
            titulo: "Visita comercial reprogramada",
            tipo: "visita",
            inicio_previsto: reprogramada,
            motivo: "El cliente pidió otra fecha",
          },
        ],
      );
      await guardar(registro);
      const actividadActual = (
        await db.query("select * from public.actividades_agenda where id=$1", [
          registro,
        ])
      ).rows[0];
      assert.equal(
        new Date(actividadActual.inicio_previsto).toISOString(),
        reprogramada,
      );
      assert.equal(actividadActual.version, 2);
    },
  );

  await t.test(
    "una visita inválida revierte contacto, atención y auditoría completos",
    async () => {
      for (const cita of [
        { ...visita, inicio_previsto: "2020-01-01T12:00:00Z" },
        { ...visita, fin_previsto: "2020-01-01T12:00:00Z" },
        { ...visita, nota: "x".repeat(2001) },
      ]) {
        const id = randomUUID();
        await assert.rejects(
          guardar(id, datos, cita),
          /AGENDA_FECHA|check constraint/,
        );
        assert.equal(
          (
            await db.query(
              "select * from public.registros_iniciales where id=$1",
              [id],
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "select * from public.atencion_prospectos where registro_id=$1",
              [id],
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "select * from public.eventos_registros where registro_id=$1",
              [id],
            )
          ).rows.length,
          0,
        );
        assert.equal(
          (
            await db.query(
              "select * from public.actividades_agenda where id=$1",
              [id],
            )
          ).rows.length,
          0,
        );
      }
      await assert.rejects(
        guardar(randomUUID(), { ...datos, origen: "inexistente" }),
        /Origen no habilitado/,
      );
      await assert.rejects(
        guardar(randomUUID(), datos, { ...visita, vendedor_id: otroVendedor }),
        /AGENDA_DATOS/,
      );
      await assert.rejects(
        guardar(randomUUID(), datos, { ...visita, estado: "realizada" }),
        /AGENDA_DATOS/,
      );
    },
  );

  await t.test(
    "solo vendedor activo; no permite usar el alta sobre contactos ya existentes",
    async () => {
      for (const actor of [admin, agente, inactivo]) {
        await como(actor);
        await assert.rejects(guardar(randomUUID()), /AGENDA_ACCESO/);
      }
      await como(otroVendedor);
      await assert.rejects(guardar(registro), /ALTA_VISITA_CONFLICTO/);
      assert.equal(
        (await db.query("select * from public.actividades_agenda")).rows.length,
        0,
      );
      await como(vendedor);
      const previo = randomUUID();
      await db.query("select public.guardar_registro_inicial_041($1,0,$2)", [
        previo,
        datos,
      ]);
      await assert.rejects(guardar(previo), /ALTA_VISITA_CONFLICTO/);
      assert.equal(
        (
          await db.query(
            "select * from public.actividades_agenda where registro_id=$1",
            [previo],
          )
        ).rows.length,
        0,
      );
      const largo = randomUUID();
      await guardar(largo, { ...datos, nombre: "A".repeat(150) });
      assert.equal(
        (
          await db.query(
            "select length(titulo) n from public.actividades_agenda where id=$1",
            [largo],
          )
        ).rows[0].n,
        160,
      );
      await db.exec("reset role; set role anon");
      await assert.rejects(guardar(randomUUID()), /permission denied/);
    },
  );
});
