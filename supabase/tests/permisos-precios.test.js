import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";

test("listas por rol: lectura, cálculo privado, uso autorizado e historial", async (t) => {
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
  const [
    admin,
    vendedor,
    otro,
    agente,
    inactivo,
    marca,
    familia,
    sensor,
    plan,
    kit,
  ] = Array.from({ length: 10 }, randomUUID);
  for (const [id, rol] of [
    [admin, "administrador"],
    [vendedor, "vendedor"],
    [otro, "vendedor"],
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
  const ubicaciones = ["docta", "nobu", "con_monitoreo", "sin_monitoreo"];
  const item = {
    marca_id: marca,
    familia_id: familia,
    servicio: "alarma",
    unidad: "unidad",
    estado: "activo",
    validado_tecnicamente: true,
    kits_compatibles: [],
    marcas_compatibles: [],
    moneda_referencia: "ARS",
    precios_usd: {},
    precios_pack_2: {},
    precios_pack_2_usd: {},
    abonos: {},
  };
  const catalogo = {
    esquema: 7,
    ubicaciones_version: 1,
    moneda_productos_version: 1,
    moneda_adicionales: "ARS",
    marcas: [
      {
        id: marca,
        nombre: "PRUEBA",
        estado: "activo",
        ubicaciones_alarma: ubicaciones,
      },
    ],
    familias: [
      {
        id: familia,
        marca_id: marca,
        nombre: "PRUEBA",
        marca: "PRUEBA",
        servicio: "alarma",
        estado: "activo",
      },
    ],
    items: [
      {
        ...item,
        id: sensor,
        codigo: "S",
        nombre: "SENSOR",
        tipo: "adicional",
        modalidad: null,
        adicional_habilitado: true,
        incluidos: [],
        precios: { alto: "30", bajo: "20", telefonico: "10" },
        precios_usd: { alto: "3", bajo: "2", telefonico: "1" },
        precios_pack_2: { alto: "55", bajo: "35", telefonico: "18" },
        precios_pack_2_usd: { alto: "5.5", bajo: "3.5", telefonico: "1.8" },
      },
      {
        ...item,
        id: plan,
        codigo: "P",
        nombre: "PLAN",
        tipo: "kit",
        modalidad: "plan",
        adicional_habilitado: false,
        ubicaciones_alarma: ubicaciones,
        incluidos: [{ item_id: sensor, cantidad: 1 }],
        precios: {
          catalogo: "500",
          alto: "400",
          medio: "300",
          bajo: "200",
          telefonico: "100",
        },
        abonos: { alto: "90", medio: "80", bajo: "70", telefonico: "60" },
      },
      {
        ...item,
        id: kit,
        codigo: "K",
        nombre: "KIT",
        tipo: "kit",
        modalidad: "kit",
        adicional_habilitado: false,
        ubicaciones_alarma: ubicaciones,
        incluidos: [{ item_id: sensor, cantidad: 1 }],
        precios: { telefonico: "150" },
      },
    ],
  };
  const todos = ["catalogo", "alto", "medio", "bajo", "telefonico"];
  let version = 1;
  await como(admin);
  const operacionAntigua = randomUUID();
  await db.query("select public.guardar_catalogo_038(0,$1,$2)", [
    operacionAntigua,
    catalogo,
  ]);
  const leer = async (caso = null) =>
    (await db.query("select public.leer_catalogo_044($1) r", [caso])).rows[0].r;
  let lectura = await leer();
  assert.deepEqual(lectura.datos.niveles_habilitados, todos);
  assert.deepEqual(lectura.datos.permisos_precios.vendedor, todos.slice(0, 4));
  assert.equal(lectura.datos.permisos_precios_version, 1);
  await como(vendedor);
  lectura = await leer();
  assert.deepEqual(lectura.datos.niveles_habilitados, todos.slice(0, 4));
  assert.equal(
    lectura.datos.items.find((i) => i.id === plan).precios.telefonico,
    undefined,
  );
  assert.equal(
    lectura.datos.items.find((i) => i.id === sensor).precios.telefonico,
    "10",
  );
  assert.equal(lectura.datos.permisos_precios, undefined);
  async function iniciar(actor) {
    const [registro, caso] = [randomUUID(), randomUUID()];
    await como(actor);
    await db.query("select public.guardar_registro_inicial_041($1,0,$2)", [
      registro,
      { nombre: "CONTACTO", telefono: "3510000000", origen: "whatsapp" },
    ]);
    await db.query("select public.iniciar_cotizacion_032($1,0,$2,$3)", [
      caso,
      randomUUID(),
      {
        registro_id: registro,
        interes_comercial: {
          servicios: ["alarma"],
          tipo_alarma: "con_monitoreo",
        },
      },
    ]);
    return { registro, caso };
  }
  const propia = await iniciar(vendedor);
  const compartida = await iniciar(admin);
  const evaluar = async (selecciones, caso = propia.caso, v = version) =>
    (
      await db.query("select public.evaluar_selecciones_044($1,$2,$3) r", [
        caso,
        v,
        selecciones,
      ])
    ).rows[0].r;
  const seleccion = {
    familia_id: familia,
    kit_id: plan,
    subcategoria: "con_monitoreo",
    nivel: "catalogo",
    nivel_abono: "alto",
    extras: [
      {
        item_id: sensor,
        cantidad: 3,
        bonificados: 1,
        altos: 2,
        bajos: 0,
        telefonicos: 0,
      },
    ],
  };
  const solicitud = (s) => ({
    conceptos: [
      {
        seleccion: Object.fromEntries(
          Object.entries(s).filter(([k]) => k !== "nivel_abono"),
        ),
        nivel_abono: s.nivel_abono ?? null,
        meses_congelamiento: 0,
        ordinal: 1,
      },
    ],
    pago: { base_efectivo: "0", medio_saldo: "debito", cuotas: 1 },
  });
  const guardar = (s, id = randomUUID(), v = version, versionCaso = 1) =>
    db.query("select public.guardar_propuesta_030($1,$2,$3,$4,0,$5) r", [
      id,
      propia.caso,
      versionCaso,
      v,
      solicitud(s),
    ]);
  let publicado;
  const publicar = async (vendedorNiveles, agenteNiveles = todos) => {
    await como(admin);
    publicado = {
      ...catalogo,
      permisos_precios_version: 1,
      permisos_precios: { vendedor: vendedorNiveles, agente: agenteNiveles },
    };
    const operacion = randomUUID();
    const r = (
      await db.query("select public.guardar_catalogo_044($1,$2,$3) r", [
        version,
        operacion,
        publicado,
      ])
    ).rows[0].r;
    assert.equal(
      (
        await db.query("select public.guardar_catalogo_044($1,$2,$3) r", [
          version,
          operacion,
          publicado,
        ])
      ).rows[0].r,
      r,
    );
    version = r;
  };

  await t.test(
    "edición solo administrativa, validación estricta y clientes anteriores",
    async () => {
      await como(vendedor);
      await assert.rejects(
        db.query("select public.guardar_catalogo_044(1,$1,$2)", [
          randomUUID(),
          {
            ...catalogo,
            permisos_precios_version: 1,
            permisos_precios: { vendedor: todos, agente: todos },
          },
        ]),
        /CATALOGO_ACCESO/,
      );
      await como(admin);
      for (const permisos of [
        { vendedor: todos },
        { vendedor: ["alto", "alto"], agente: [] },
        { vendedor: ["secreto"], agente: [] },
        { vendedor: [], agente: [], administrador: [] },
        { vendedor: null, agente: [] },
      ])
        await assert.rejects(
          db.query("select public.guardar_catalogo_044(1,$1,$2)", [
            randomUUID(),
            {
              ...catalogo,
              permisos_precios_version: 1,
              permisos_precios: permisos,
            },
          ]),
          /CATALOGO_PERMISOS/,
        );
      await publicar(["catalogo", "alto"], ["alto", "bajo"]);
      await assert.rejects(
        db.query("select public.guardar_catalogo_038($1,$2,$3)", [
          version,
          randomUUID(),
          catalogo,
        ]),
        /CATALOGO_ESQUEMA/,
      );
      assert.equal(
        (
          await db.query("select public.guardar_catalogo_038(0,$1,$2) r", [
            operacionAntigua,
            catalogo,
          ])
        ).rows[0].r,
        1,
      );
      await assert.rejects(
        db.query("select public.guardar_catalogo_038(0,$1,$2)", [
          operacionAntigua,
          { ...catalogo, moneda_adicionales: "USD" },
        ]),
        /CATALOGO_CONFLICTO|CATALOGO_ESQUEMA/,
      );
    },
  );
  await t.test(
    "oculta mapas denegados sin impedir simular bolsa, piso y packs",
    async () => {
      await como(vendedor);
      const r = await leer(propia.caso);
      assert.equal(r.datos.calculo_remoto, true);
      assert.deepEqual(r.datos.niveles_habilitados, ["catalogo", "alto"]);
      const oferta = r.datos.items.find((i) => i.id === plan);
      assert.deepEqual(oferta.precios, { catalogo: "500", alto: "400" });
      assert.deepEqual(oferta.abonos, { alto: "90" });
      const adicional = r.datos.items.find((i) => i.id === sensor);
      for (const campo of [
        "precios",
        "precios_usd",
        "precios_pack_2",
        "precios_pack_2_usd",
      ])
        assert.deepEqual(Object.keys(adicional[campo]).sort(), [
          "alto",
          "telefonico",
        ]);
      const viejo = (
        await db.query("select public.leer_catalogo($1) r", [propia.caso])
      ).rows[0].r;
      assert.deepEqual(viejo, r);
      await assert.rejects(
        db.query("select public.leer_catalogo_base_044($1)", [propia.caso]),
        /permission denied/,
      );
      assert.equal(
        (await db.query("select * from public.versiones_catalogo")).rows.length,
        0,
      );
      const evaluacion = await evaluar([
        seleccion,
        { ...seleccion, nivel: "bajo" },
        { ...seleccion, nivel_abono: "bajo" },
        {
          ...seleccion,
          extras: [
            { ...seleccion.extras[0], bonificados: 0, altos: 2, bajos: 1 },
          ],
        },
        {
          ...seleccion,
          extras: [{ ...seleccion.extras[0], bonificados: 3, altos: 0 }],
        },
        {
          ...seleccion,
          extras: [
            { ...seleccion.extras[0], cantidad: 30, bonificados: 30, altos: 0 },
          ],
        },
      ]);
      assert.equal(evaluacion.version, version);
      assert.equal(evaluacion.resultados[0].valida, true);
      assert.equal(evaluacion.resultados[0].detalle.total_exacto, "555");
      assert.equal(evaluacion.resultados[0].detalle.abono, "90");
      assert.equal(
        evaluacion.resultados[0].detalle.extras[0].packs[0].precio_pack,
        "55",
      );
      assert.deepEqual(
        evaluacion.resultados.slice(1, 4).map((r) => r.error),
        Array(3).fill("PROPUESTA_NIVEL"),
      );
      assert.equal(evaluacion.resultados[4].valida, true);
      assert.equal(evaluacion.resultados[5].error, "PROPUESTA_BONIFICACION");
      assert.equal(JSON.stringify(evaluacion).includes('"bajo":"20"'), false);
      for (const s of [
        { ...seleccion, nivel: "bajo" },
        { ...seleccion, nivel_abono: "bajo" },
      ])
        await assert.rejects(guardar(s), /PROPUESTA_NIVEL/);
      assert.deepEqual(
        (
          await db.query(
            "select version,preparacion_compartida,responsable_id from public.oportunidades where id=$1",
            [propia.caso],
          )
        ).rows[0],
        { version: 1, preparacion_compartida: true, responsable_id: null },
      );
      await assert.rejects(
        evaluar([seleccion], propia.caso, version - 1),
        /PROPUESTA_VIGENCIA/,
      );
      await assert.rejects(
        evaluar(Array(501).fill(seleccion)),
        /PROPUESTA_COMPOSICION/,
      );
      await assert.rejects(evaluar([]), /PROPUESTA_COMPOSICION/);
      for (const actor of [otro, agente, inactivo]) {
        await como(actor);
        await assert.rejects(evaluar([seleccion]), /PROPUESTA_ACCESO/);
      }
      await como(admin);
      const reservaAntes = (
        await db.query("select public.atencion_prospecto_039($1) r", [
          compartida.registro,
        ])
      ).rows[0].r;
      assert.equal(
        (await evaluar([seleccion], compartida.caso)).resultados[0].valida,
        true,
      );
      assert.deepEqual(
        (
          await db.query("select public.atencion_prospecto_039($1) r", [
            compartida.registro,
          ])
        ).rows[0].r,
        reservaAntes,
      );
    },
  );
  await t.test(
    "Telefónico ordinario sigue disponible en venta de kits",
    async () => {
      await como(vendedor);
      const venta = {
        familia_id: familia,
        kit_id: kit,
        ubicacion_alarma: "con_monitoreo",
        subcategoria: null,
        nivel: "telefonico",
        extras: [
          {
            item_id: sensor,
            cantidad: 2,
            bonificados: 0,
            altos: 0,
            bajos: 0,
            telefonicos: 2,
          },
        ],
      };
      const evaluacion = await evaluar([
        venta,
        { ...seleccion, nivel: "telefonico", nivel_abono: "alto" },
        { ...seleccion, extras: [{ ...venta.extras[0], cantidad: 2 }] },
      ]);
      assert.equal(evaluacion.resultados[0].valida, true);
      assert.equal(evaluacion.resultados[0].detalle.total_exacto, "168");
      assert.equal(evaluacion.resultados[1].error, "PROPUESTA_NIVEL");
      assert.equal(evaluacion.resultados[2].error, "PROPUESTA_NIVEL");
    },
  );
  await t.test(
    "habilitar Telefónico permite ofrecerlo; revocar conserva la oferta autorizada",
    async () => {
      await publicar(todos);
      await como(vendedor);
      lectura = await leer();
      assert.equal(
        lectura.datos.items.find((i) => i.id === plan).precios.telefonico,
        "100",
      );
      assert.equal(lectura.datos.calculo_remoto, false);
      const telefono = {
        ...seleccion,
        nivel: "telefonico",
        nivel_abono: "telefonico",
        extras: [
          {
            item_id: sensor,
            cantidad: 2,
            bonificados: 0,
            altos: 0,
            bajos: 0,
            telefonicos: 2,
          },
        ],
      };
      const id = randomUUID();
      const versionEmitida = version;
      await guardar(telefono, id);
      let propuesta = (
        await db.query(
          "select * from public.propuestas_comerciales where id=$1",
          [id],
        )
      ).rows[0];
      assert.equal(propuesta.restringida, true);
      assert.equal(propuesta.detalle.total, "118.00");
      assert.equal(propuesta.detalle.abono, "60.00");
      assert.equal(propuesta.detalle.permisos_precios_version, 1);
      assert.deepEqual(propuesta.detalle.permisos_precios.vendedor, todos);
      const historica = {
        ...propuesta,
        id: randomUUID(),
        detalle: { ...propuesta.detalle },
      };
      delete historica.detalle.permisos_precios_version;
      delete historica.detalle.permisos_precios;
      await db.exec("reset role");
      await db.query(
        "insert into public.propuestas_comerciales select * from jsonb_populate_record(null::public.propuestas_comerciales,$1)",
        [historica],
      );
      await como(vendedor);
      assert.equal(
        (
          await db.query(
            "select id from public.propuestas_comerciales where id=$1",
            [historica.id],
          )
        ).rows.length,
        0,
      );
      await assert.rejects(
        db.query("select public.gestionar_oportunidad($1,2,$2,'ganar',$3)", [
          propia.caso,
          randomUUID(),
          {
            propuesta_id: historica.id,
            aceptacion_confirmada: "si",
            canal: "whatsapp",
            confirmado_en: new Date().toISOString(),
            condiciones: "Confirmación comercial",
            resumen: "Cliente confirma contratación",
          },
        ]),
        /COMERCIAL_ACCESO/,
      );
      await como(otro);
      assert.equal(
        (
          await db.query(
            "select id from public.propuestas_comerciales where id=$1",
            [id],
          )
        ).rows.length,
        0,
      );
      await publicar(["catalogo", "alto"]);
      await como(vendedor);
      await assert.rejects(
        guardar(telefono, randomUUID(), version, 2),
        /PROPUESTA_NIVEL/,
      );
      await guardar(telefono, id, versionEmitida);
      assert.deepEqual(
        (
          await db.query(
            "select * from public.propuestas_comerciales where id=$1",
            [id],
          )
        ).rows[0],
        propuesta,
      );
      await db.query(
        "select public.gestionar_oportunidad($1,2,$2,'ganar',$3)",
        [
          propia.caso,
          randomUUID(),
          {
            propuesta_id: id,
            aceptacion_confirmada: "si",
            canal: "whatsapp",
            confirmado_en: new Date().toISOString(),
            condiciones: "Aceptación de oferta autorizada",
            resumen: "Cliente confirma contratación",
          },
        ],
      );
      assert.equal(
        (
          await db.query(
            "select estado from public.oportunidades where id=$1",
            [propia.caso],
          )
        ).rows[0].estado,
        "ganada",
      );
      await assert.rejects(evaluar([seleccion]), /PROPUESTA_ACCESO/);
    },
  );
  await t.test(
    "agente sigue limitado a recuperación, con sus propios permisos",
    async () => {
      await como(admin);
      await db.exec("reset role");
      await db.query(
        "update public.oportunidades set preparacion_compartida=false,responsable_id=$1,vendedor_visita_id=$2,estado='recuperacion',proxima_accion_en=now()+interval '1 day' where id=$3",
        [agente, vendedor, compartida.caso],
      );
      await publicar(["catalogo", "alto"], ["alto"]);
      await como(agente);
      assert.deepEqual(
        (await leer(compartida.caso)).datos.niveles_habilitados,
        ["alto"],
      );
      const r = await evaluar(
        [
          { ...seleccion, nivel: "alto" },
          { ...seleccion, nivel: "telefonico" },
        ],
        compartida.caso,
      );
      assert.equal(r.resultados[0].valida, true);
      assert.equal(r.resultados[1].error, "PROPUESTA_NIVEL");
      await db.exec("reset role; set role anon");
      await assert.rejects(
        db.query("select public.leer_catalogo_044(null)"),
        /permission denied/,
      );
      await assert.rejects(
        evaluar([seleccion], compartida.caso),
        /permission denied/,
      );
    },
  );
});
