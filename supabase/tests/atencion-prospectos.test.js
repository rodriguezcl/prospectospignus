import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("atención exclusiva: avisos por agente, toma, conflictos, liberación y protección de enlaces antiguos", async (t) => {
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
  const [admin, a, b, agente, inactivo, registro, otro, caso] = Array.from(
    { length: 8 },
    randomUUID,
  );
  for (const [id, rol] of [
    [admin, "administrador"],
    [a, "vendedor"],
    [b, "vendedor"],
    [agente, "agente"],
    [inactivo, "vendedor"],
  ])
    await db.query("insert into auth.users values($1,$2,$3)", [
      id,
      id + "@example.invalid",
      {
        pignus_autorizado: true,
        nombre: rol + id,
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
  const tomar = (version, liberar = false) =>
    db.query("select public.tomar_prospecto_039($1,$2,$3) dato", [
      registro,
      version,
      liberar,
    ]);
  const contexto = async () =>
    (
      await db.query("select public.atencion_prospecto_039($1) dato", [
        registro,
      ])
    ).rows[0].dato;
  const lista = async (filtro) =>
    (
      await db.query("select public.listar_contactos_039($1,0,$2) dato", [
        "",
        filtro,
      ])
    ).rows[0].dato;
  await como(agente);
  const datos = {
    nombre: "Nuevo contacto",
    origen: "whatsapp",
    telefono: "3510000000",
  };
  await db.query("select public.guardar_registro_inicial_032($1,0,$2)", [
    registro,
    datos,
  ]);
  await db.query("select public.guardar_registro_inicial_032($1,0,$2)", [
    registro,
    datos,
  ]);
  await assert.rejects(tomar(1), /COMERCIAL_ACCESO/);
  await como(a);
  assert.equal(
    (await db.query("select * from public.avisos_prospectos")).rows.length,
    1,
  );
  assert.equal((await lista("disponibles")).total, 1);
  const tomado = (await tomar(1)).rows[0].dato;
  assert.equal(tomado.vendedor_id, a);
  assert.equal((await tomar(1)).rows[0].dato.version, 2); // reintento no duplica
  assert.equal((await lista("mios")).total, 1);
  await assert.rejects(
    db.query("update public.atencion_prospectos set vendedor_id=$1", [b]),
    /permission denied/,
  );
  await como(b);
  assert.equal((await lista("disponibles")).total, 0);
  assert.equal((await contexto()).vendedor_id, a);
  assert.equal(
    (
      await db.query(
        "select * from public.avisos_prospectos where leida_en is null",
      )
    ).rows.length,
    0,
  );
  await assert.rejects(tomar(1), /PROSPECTO_OCUPADO/);
  await assert.rejects(tomar(2, true), /PROSPECTO_OCUPADO/);
  const iniciar = {
    registro_id: registro,
    interes_comercial: { servicios: ["camaras"], tipo_alarma: null },
  };
  await assert.rejects(
    db.query("select public.iniciar_cotizacion_032($1,0,$2,$3)", [
      caso,
      randomUUID(),
      iniciar,
    ]),
    /PROSPECTO_OCUPADO/,
  );
  await como(admin);
  await tomar(2, true);
  assert.equal((await contexto()).vendedor_id, null);
  await como(b);
  await assert.rejects(tomar(1), /COMERCIAL_CONFLICTO/);
  await tomar(3);
  await db.query("select public.iniciar_cotizacion_032($1,0,$2,$3)", [
    caso,
    randomUUID(),
    iniciar,
  ]);
  await como(a);
  await assert.rejects(
    db.query("select public.guardar_propuesta_030($1,$2,1,1,1,'{}')", [
      randomUUID(),
      caso,
    ]),
    /PROSPECTO_OCUPADO|PROPUESTA_VIGENCIA/,
  );
  await como(b);
  await tomar(4, true);
  assert.equal((await contexto()).vendedor_id, null);
  // Iniciar con un cliente anterior también reserva dentro de la transacción.
  await db.query("select public.guardar_registro_inicial_032($1,0,$2)", [
    otro,
    { ...datos, nombre: "Otra persona" },
  ]);
  await db.query("select public.iniciar_cotizacion_032($1,0,$2,$3)", [
    randomUUID(),
    randomUUID(),
    { ...iniciar, registro_id: otro },
  ]);
  assert.equal(
    (await db.query("select public.atencion_prospecto_039($1) dato", [otro]))
      .rows[0].dato.vendedor_id,
    b,
  );
  // Registrar la primera oferta mantiene al vendedor que tomó el contacto.
  await como(b);
  await tomar(5);
  await como(admin);
  const [marca, familia, producto, kit] = Array.from({ length: 4 }, randomUUID);
  const item = {
    familia_id: familia,
    marca_id: marca,
    servicio: "camaras",
    unidad: "unidad",
    estado: "activo",
    validado_tecnicamente: true,
    kits_compatibles: [],
    abonos: {},
  };
  const catalogo = {
    esquema: 7,
    moneda_adicionales: "ARS",
    marcas: [{ id: marca, nombre: "MARCA", estado: "activo" }],
    familias: [
      {
        id: familia,
        nombre: "MARCA",
        marca: "MARCA",
        marca_id: marca,
        servicio: "camaras",
        estado: "activo",
      },
    ],
    items: [
      {
        ...item,
        id: producto,
        nombre: "CAMARA",
        codigo: "C",
        tipo: "adicional",
        modalidad: null,
        adicional_habilitado: true,
        incluidos: [],
        precios: { telefonico: "10" },
      },
      {
        ...item,
        id: kit,
        nombre: "KIT",
        codigo: "K",
        tipo: "kit",
        modalidad: "kit",
        adicional_habilitado: false,
        incluidos: [{ item_id: producto, cantidad: 1 }],
        precios: { telefonico: "100" },
      },
    ],
  };
  await db.query("select public.guardar_catalogo_031(0,$1,$2)", [
    randomUUID(),
    catalogo,
  ]);
  const solicitud = {
    conceptos: [
      {
        seleccion: {
          familia_id: familia,
          kit_id: kit,
          nivel: "telefonico",
          extras: [],
        },
        ordinal: 1,
        nivel_abono: null,
        meses_congelamiento: 0,
      },
    ],
    pago: { base_efectivo: "0", medio_saldo: "debito", cuotas: 1 },
  };

  const propuesta = randomUUID();
  await assert.rejects(
    db.query("select public.guardar_propuesta_030($1,$2,1,1,0,$3)", [
      propuesta,
      caso,
      { ...solicitud, responsable_seguimiento_id: a },
    ]),
    /PROSPECTO_OCUPADO/,
  );
  await como(b);
  await assert.rejects(
    db.query("select public.guardar_propuesta_030($1,$2,1,1,0,$3)", [
      propuesta,
      caso,
      { ...solicitud, pago: { ...solicitud.pago, base_efectivo: "99999" } },
    ]),
    /PROPUESTA_PAGO/,
  );
  assert.equal((await contexto()).vendedor_id, b);
  await db.query("select public.guardar_propuesta_030($1,$2,1,1,0,$3)", [
    propuesta,
    caso,
    solicitud,
  ]);
  await db.query("select public.guardar_propuesta_030($1,$2,1,1,0,$3)", [
    propuesta,
    caso,
    solicitud,
  ]);
  assert.equal(
    (
      await db.query(
        "select responsable_id from public.oportunidades where id=$1",
        [caso],
      )
    ).rows[0].responsable_id,
    b,
  );
  await assert.rejects(tomar(6, true), /PROSPECTO_SEGUIMIENTO/);
  await como(a);
  await assert.rejects(
    db.query("select public.guardar_propuesta_030($1,$2,2,1,0,$3)", [
      randomUUID(),
      caso,
      solicitud,
    ]),
    /PROPUESTA_ACCESO/,
  );
  await como(admin);
  await db.query(
    "select public.gestionar_oportunidad($1,2,$2,'reasignar',$3)",
    [
      caso,
      randomUUID(),
      {
        responsable_id: a,
        resumen: "Reasignación administrativa del seguimiento",
      },
    ],
  );
  assert.equal((await contexto()).vendedor_id, a);
  await como(inactivo);
  await assert.rejects(tomar(5), /COMERCIAL_ACCESO/);
  await como(admin);
  const eventos = (
    await db.query(
      "select * from public.eventos_atencion_prospectos where registro_id=$1",
      [registro],
    )
  ).rows;
  assert.equal(eventos.length, 6);
  await t.test(
    "administración prepara un contacto disponible y asigna al registrar, sin efectos parciales",
    async () => {
      const [contactoAdmin, casoAdmin, operacionAdmin, ofertaAdmin] =
        Array.from({ length: 4 }, randomUUID);
      await como(admin);
      await db.query("select public.guardar_registro_inicial_041($1,0,$2)", [
        contactoAdmin,
        { ...datos, nombre: "Preparación administrativa" },
      ]);
      const preparar = () =>
        db.query("select public.iniciar_cotizacion_032($1,0,$2,$3)", [
          casoAdmin,
          operacionAdmin,
          { ...iniciar, registro_id: contactoAdmin },
        ]);
      const consultarReserva = async () =>
        (
          await db.query("select public.atencion_prospecto_039($1) dato", [
            contactoAdmin,
          ])
        ).rows[0].dato;
      const consultarCaso = async () =>
        (
          await db.query(
            "select responsable_id,preparacion_compartida,version from public.oportunidades where id=$1",
            [casoAdmin],
          )
        ).rows[0];
      const guardarOferta = (cambios = {}) =>
        db.query("select public.guardar_propuesta_030($1,$2,1,1,0,$3)", [
          ofertaAdmin,
          casoAdmin,
          { ...solicitud, ...cambios },
        ]);
      await preparar();
      await preparar();
      assert.deepEqual(await consultarCaso(), {
        responsable_id: null,
        preparacion_compartida: true,
        version: 1,
      });
      assert.equal((await consultarReserva()).vendedor_id, null);
      assert.equal((await consultarReserva()).version, 1);
      await assert.rejects(
        db.query("select public.tomar_prospecto_039($1,1,false)", [
          contactoAdmin,
        ]),
        /COMERCIAL_VENDEDOR/,
      );
      for (const responsable_seguimiento_id of [
        undefined,
        admin,
        agente,
        inactivo,
      ])
        await assert.rejects(
          guardarOferta({ responsable_seguimiento_id }),
          /COMERCIAL_VENDEDOR/,
        );
      await assert.rejects(
        guardarOferta({
          responsable_seguimiento_id: a,
          pago: { ...solicitud.pago, base_efectivo: "99999" },
        }),
        /PROPUESTA_PAGO/,
      );
      assert.equal((await consultarReserva()).vendedor_id, null);
      assert.equal((await consultarReserva()).version, 1);
      assert.equal((await consultarCaso()).responsable_id, null);
      assert.equal((await consultarCaso()).preparacion_compartida, true);
      assert.equal(
        (
          await db.query(
            "select * from public.eventos_atencion_prospectos where registro_id=$1",
            [contactoAdmin],
          )
        ).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query(
            "select * from public.eventos_oportunidades where oportunidad_id=$1 and tipo='primera_oferta_asignada'",
            [casoAdmin],
          )
        ).rows.length,
        0,
      );
      await guardarOferta({ responsable_seguimiento_id: a });
      await guardarOferta({ responsable_seguimiento_id: a });
      assert.equal((await consultarCaso()).responsable_id, a);
      assert.equal((await consultarCaso()).preparacion_compartida, false);
      assert.equal((await consultarReserva()).vendedor_id, a);
      assert.equal((await consultarReserva()).version, 2);
      const auditoria = (
        await db.query(
          "select actor_id,vendedor_anterior,vendedor_nuevo from public.eventos_atencion_prospectos where registro_id=$1",
          [contactoAdmin],
        )
      ).rows;
      assert.deepEqual(auditoria, [
        { actor_id: admin, vendedor_anterior: null, vendedor_nuevo: a },
      ]);
    },
  );
  await t.test(
    "administración respeta al vendedor que toma el contacto después de prepararlo",
    async () => {
      const [contactoAdmin, casoAdmin] = Array.from({ length: 2 }, randomUUID);
      await como(admin);
      await db.query("select public.guardar_registro_inicial_041($1,0,$2)", [
        contactoAdmin,
        { ...datos, nombre: "Reserva posterior a preparación" },
      ]);
      const parametros = [
        casoAdmin,
        randomUUID(),
        { ...iniciar, registro_id: contactoAdmin },
      ];
      await como(agente);
      await assert.rejects(
        db.query(
          "select public.iniciar_cotizacion_032($1,0,$2,$3)",
          parametros,
        ),
        /PROSPECTO_TOMAR/,
      );
      await como(admin);
      await db.query(
        "select public.iniciar_cotizacion_032($1,0,$2,$3)",
        parametros,
      );
      await como(b);
      await db.query("select public.tomar_prospecto_039($1,1,false)", [
        contactoAdmin,
      ]);
      await como(admin);
      const oferta = randomUUID();
      await assert.rejects(
        db.query("select public.guardar_propuesta_030($1,$2,1,1,0,$3)", [
          oferta,
          casoAdmin,
          { ...solicitud, responsable_seguimiento_id: a },
        ]),
        /PROSPECTO_OCUPADO/,
      );
      await db.query("select public.guardar_propuesta_030($1,$2,1,1,0,$3)", [
        oferta,
        casoAdmin,
        { ...solicitud, responsable_seguimiento_id: b },
      ]);
      assert.equal(
        (
          await db.query(
            "select responsable_id from public.oportunidades where id=$1",
            [casoAdmin],
          )
        ).rows[0].responsable_id,
        b,
      );
      assert.equal(
        (
          await db.query("select public.atencion_prospecto_039($1) dato", [
            contactoAdmin,
          ])
        ).rows[0].dato.vendedor_id,
        b,
      );
    },
  );
  await como(admin);
  await db.query(
    "select public.eliminar_prospecto_034($1,1,'Contacto de prueba')",
    [registro],
  );
  assert.equal(await contexto(), null);
  await assert.rejects(tomar(5), /PROSPECTO_NO_DISPONIBLE/);
  await db.exec("reset role; set role anon");
  await assert.rejects(
    db.query("select public.atencion_prospecto_039($1)", [otro]),
    /permission denied/,
  );
});
