import { test } from "node:test";
import assert from "node:assert/strict";
import {
  accionesPermitidas,
  validarOperacion,
  fechaCordoba,
} from "./circuito.js";

test("participantes anteriores solo consultan y agente no se apropia de casos ajenos", () => {
  const perfil = { id: "agente", rol: "agente", activo: true };
  assert.deepEqual(
    accionesPermitidas(
      { estado: "recuperacion", responsable_id: "otro" },
      perfil,
    ),
    [],
  );
  assert.deepEqual(
    accionesPermitidas(
      { estado: "recuperacion", responsable_id: null },
      perfil,
    ),
    ["asignar"],
  );
  assert.deepEqual(
    accionesPermitidas({ estado: "ganada", responsable_id: "agente" }, perfil),
    [],
  );
  assert.ok(
    !accionesPermitidas(
      { estado: "recuperacion", responsable_id: "agente" },
      perfil,
    ).includes("derivar"),
  );
});
test("resumen obligatorio y fechas de Córdoba independientes del navegador", () => {
  assert.throws(() =>
    validarOperacion({ accion: "derivar", datos: { resumen: "" } }),
  );
  assert.throws(() =>
    validarOperacion({
      accion: "derivar",
      datos: { resumen: "Visita realizada" },
    }),
  );
  assert.equal(fechaCordoba("2026-09-30T09:30"), "2026-09-30T12:30:00.000Z");
});

test("solo responsable o administración pueden reactivar perdidas, nunca ganadas", () => {
  const oportunidad = { estado: "perdida", responsable_id: "vendedor" };
  assert.deepEqual(
    accionesPermitidas(oportunidad, { id: "vendedor", rol: "vendedor" }),
    ["reactivar"],
  );
  assert.deepEqual(
    accionesPermitidas(oportunidad, { id: "otro", rol: "vendedor" }),
    [],
  );
  assert.deepEqual(
    accionesPermitidas(oportunidad, { id: "admin", rol: "administrador" }),
    ["reactivar", "corregir_perdida"],
  );
  assert.throws(() =>
    validarOperacion({
      accion: "reactivar",
      datos: { resumen: "Nuevo interés" },
    }),
  );
});
