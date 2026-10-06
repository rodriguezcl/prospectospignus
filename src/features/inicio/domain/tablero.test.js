import test from "node:test";
import assert from "node:assert/strict";
import { construirTablero, mesCordoba } from "./tablero.js";
import { crearResumenInicio } from "../application/crearResumenInicio.js";

const base = () => ({
  historico: [
    {
      id: "h",
      responsable_id: "v1",
      responsable_nombre: "Uno",
      resultado: "perdida",
    },
  ],
  registros: [
    { id: "r", dia: "2026-09-30", creado_por: "v1", responsable_id: null },
  ],
  perfiles: [
    { id: "v1", nombre: "Uno" },
    { id: "v2", nombre: "Dos" },
  ],
  oportunidades: [
    {
      id: "h",
      periodo_historico: "2026-09-01",
      estado: "recuperacion",
      responsable_id: "a1",
      creado_en: "2026-10-15T12:00:00Z",
    },
    {
      id: "1",
      creado_en: "2026-10-01T02:59:00Z",
      estado: "ganada",
      responsable_id: "v1",
    },
    {
      id: "2",
      creado_en: "2026-09-03T12:00:00Z",
      estado: "visita",
      responsable_id: "v2",
      visita_en: "2026-09-30T12:00:00Z",
    },
    {
      id: "3",
      creado_en: "2026-08-03T12:00:00Z",
      estado: "visita",
      responsable_id: "v1",
      visita_en: "2026-10-02T12:00:00Z",
    },
    {
      id: "4",
      creado_en: "2026-10-01T03:00:00Z",
      estado: "recuperacion",
      responsable_id: null,
    },
  ],
  ventas: 17,
});
const ahora = new Date("2026-10-01T12:00:00Z");
test("Inicio: anular excluye negociación y pendientes, no borra el contacto captado", () => {
  const datos = base();
  datos.oportunidades[0].estado = "anulada";
  datos.historico = [];
  const t = construirTablero(
    datos,
    "2026-09",
    { rol: "administrador" },
    "",
    ahora,
  );
  assert.equal(t.cohorte.length, 2);
  assert.equal(t.registros.length, 1);
  assert.ok(!t.abiertas.some((r) => r.id === "h"));
});
test("Inicio: cohorte, histórico inmutable y pendientes fuera del mes", () => {
  const t = construirTablero(
    base(),
    "2026-09",
    { rol: "administrador" },
    "",
    ahora,
  );
  assert.equal(t.cohorte.length, 3);
  assert.equal(t.ganadas.length, 1);
  assert.equal(t.conversion, 100 / 3);
  assert.equal(t.cohorte.find((r) => r.id === "h").estado, "perdida");
  assert.equal(
    t.cohorte.find((r) => r.id === "h").estado_actual,
    "recuperacion",
  );
  assert.equal(t.visitasVencidas.length, 1);
  assert.equal(t.visitasProximas[0].id, "3");
  assert.equal(t.sinAsignar.length, 1);
  assert.equal(
    t.porEstado.reduce((s, r) => s + r.cantidad, 0),
    3,
  );
  assert.equal(
    t.equipo.reduce((s, r) => s + r.total, 0),
    3,
  );
});
test("Inicio: un vendedor no hereda cartera por participar; agente conserva su recuperación", () => {
  const vendedor = construirTablero(
    base(),
    "2026-09",
    { rol: "vendedor", id: "v1" },
    "v2",
    ahora,
  );
  assert.equal(vendedor.cohorte.length, 2);
  assert.equal(vendedor.visitasVencidas.length, 0);
  assert.equal(vendedor.recuperaciones.length, 0);
  const agente = construirTablero(
    base(),
    "2026-09",
    { rol: "agente", id: "a1" },
    "",
    ahora,
  );
  assert.equal(agente.cohorte.length, 0);
  assert.equal(agente.conversion, null);
  assert.equal(agente.recuperaciones.length, 1);
  assert.equal(
    construirTablero(base(), "2026-09", { rol: "administrador" }, "v2", ahora)
      .cohorte.length,
    1,
  );
});
test("Inicio: corte Córdoba, histórico incompleto y errores no se convierten en cero", async () => {
  assert.equal(mesCordoba("2026-10-01T02:59:59Z"), "2026-09");
  assert.equal(mesCordoba("2026-10-01T03:00:00Z"), "2026-10");
  assert.throws(
    () =>
      construirTablero({ ...base(), historico: [] }, "2026-09", {
        rol: "administrador",
      }),
    /histórico/,
  );
  const servicio = crearResumenInicio({
    cargar: async () => base(),
    oportunidades: async () => [],
    ventas: async () => {
      throw new Error("sin conexión");
    },
  });
  await assert.rejects(servicio.cargarTablero("2026-09"), /sin conexión/);
  await assert.rejects(servicio.cargarTablero("2026-13"), /mes válido/);
});

test("captación: atribuye la carga al autor, no al responsable histórico del contacto", () => {
  const datos = base();
  datos.registros = [
    {
      id: "compartido",
      dia: "2026-09-30",
      creado_por: "v1",
      responsable_id: null,
    },
  ];
  assert.equal(
    construirTablero(datos, "2026-09", { id: "v1", rol: "vendedor" }, "", ahora)
      .registros.length,
    1,
  );
  assert.equal(
    construirTablero(datos, "2026-09", { id: "v2", rol: "vendedor" }, "", ahora)
      .registros.length,
    0,
  );
});
