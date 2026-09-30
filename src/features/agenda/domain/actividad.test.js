import { test } from "node:test";
import assert from "node:assert/strict";
import {
  actividadesDelDia,
  diasVista,
  fechaCordoba,
  fechaHoraLocal,
  franjaActividad,
  instanteCordoba,
  estadoVisible,
  validarActividad,
} from "./actividad.js";
import { crearGestionAgenda } from "../application/crearGestionAgenda.js";
import { combinarAvisos } from "../../../app/configuracion/combinarAvisos.js";
test("agenda: Córdoba, semana y horarios fuera de referencia", () => {
  assert.equal(fechaCordoba("2026-10-01T01:00:00Z"), "2026-09-30");
  assert.equal(fechaHoraLocal("2026-10-01T01:00:00Z"), "2026-09-30T22:00");
  assert.equal(instanteCordoba("2026-09-30T19:30"), "2026-09-30T22:30:00.000Z");
  assert.throws(() => instanteCordoba("2026-02-30T10:00"));
  assert.deepEqual(diasVista("2026-10-04", true), [
    "2026-09-28",
    "2026-09-29",
    "2026-09-30",
    "2026-10-01",
    "2026-10-02",
    "2026-10-03",
    "2026-10-04",
  ]);
  const a = (inicio, fin) => ({
    id: "1",
    estado: "programada",
    inicio_previsto: instanteCordoba(`2026-09-30T${inicio}`),
    fin_previsto: fin ? instanteCordoba(`2026-09-30T${fin}`) : null,
  });
  assert.equal(
    franjaActividad(a("08:00", "17:00"), "2026-09-30"),
    "Dentro de referencia",
  );
  assert.equal(
    franjaActividad(a("16:30", "17:30"), "2026-09-30"),
    "Abarca ambos períodos",
  );
  assert.equal(
    franjaActividad(a("19:30", "20:00"), "2026-09-30"),
    "Fuera de referencia",
  );
  assert.equal(
    franjaActividad(a("17:00"), "2026-09-30"),
    "Fuera de referencia",
  );
  assert.equal(
    estadoVisible(a("09:00"), new Date("2026-09-30T20:00:00Z")),
    "Pendiente de actualizar",
  );
  assert.equal(
    actividadesDelDia([a("16:30", "17:30")], "2026-09-30").length,
    1,
  );
  const nocturna = {
    ...a("23:30"),
    fin_previsto: instanteCordoba("2026-10-01T00:00"),
  };
  assert.equal(actividadesDelDia([nocturna], "2026-10-01").length, 0);
  nocturna.fin_previsto = instanteCordoba("2026-10-01T01:00");
  assert.equal(actividadesDelDia([nocturna], "2026-10-01").length, 1);
});
test("agenda: validación permite excepciones y rechaza realización futura", async () => {
  const ahora = new Date("2026-09-30T12:00:00Z");
  const datos = {
    titulo: "Visita nocturna",
    tipo: "visita",
    estado: "programada",
    inicio_previsto: "2026-10-02T22:30:00Z",
  };
  assert.equal(validarActividad(datos, "crear", ahora).titulo, datos.titulo);
  assert.throws(() =>
    validarActividad(
      {
        ...datos,
        estado: "realizada",
        inicio_real: datos.inicio_previsto,
        fin_real: "2026-10-02T23:00:00Z",
        resultado: "Conversación",
      },
      "crear",
      ahora,
    ),
  );
  assert.throws(() => validarActividad(datos, "editar", ahora), /motivo/);
  let envio = null;
  const gestion = crearGestionAgenda({
    guardar: async (e) => {
      envio = e;
    },
  });
  const entrada = {
    id: "id",
    operacion: "operacion",
    version: 0,
    accion: "crear",
    datos: { ...datos, inicio_previsto: "2099-01-01T22:30:00Z" },
  };
  await gestion.guardar(entrada);
  assert.equal(envio.operacion, "operacion");
});
test("agenda: avisos usan destinos propios y marcar leído no realiza actividad", async () => {
  let leido;
  const vacio = { notificaciones: async () => [] };
  const combinado = combinarAvisos(vacio, vacio, {
    notificaciones: async () => [
      { id: "uuid/2", actividad_id: "uuid", creado_en: "2026-09-30T15:00:00Z" },
    ],
    leer: async (id) => {
      leido = id;
    },
  });
  const [aviso] = await combinado.notificaciones();
  assert.equal(aviso.destino, "/agenda?id=uuid");
  await combinado.leer(aviso.id);
  assert.equal(leido, "uuid/2");
});
