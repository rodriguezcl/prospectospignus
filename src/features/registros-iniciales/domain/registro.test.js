import { test } from "node:test";
import assert from "node:assert/strict";
test("nombres en mayúsculas preservan Ñ, tildes y observaciones", () => {
  const datos = validarRegistro({
    nombre: "  José peña  ",
    origen: "otro",
    observaciones: "Prefiere WhatsApp",
    correo: "Correo@Ejemplo.com",
  });
  assert.equal(datos.nombre, "JOSÉ PEÑA");
  assert.equal(datos.observaciones, "Prefiere WhatsApp");
  assert.equal(datos.correo, "correo@ejemplo.com");
});
import { validarRegistro } from "./registro.js";
import { crearGestionRegistros } from "../application/crearGestionRegistros.js";
test("registro preliminar admite datos incompletos y no confía en autor del cliente", () => {
  const datos = validarRegistro({
    nombre: "  Empresa  ",
    origen: "oficina",
    creado_por: "falso",
    correo: " HOLA@EXAMPLE.COM ",
  });
  assert.equal(datos.nombre, "EMPRESA");
  assert.equal(datos.correo, "hola@example.com");
  assert.equal(datos.telefono, "");
  assert.equal(datos.creado_por, undefined);
});
test("valida nombre, origen, correo y límites antes de persistir", () => {
  let llamadas = 0;
  const gestion = crearGestionRegistros({
    guardar() {
      llamadas++;
    },
  });
  for (const datos of [
    { nombre: " " },
    { nombre: "Nombre" },
    { nombre: "Nombre", origen: "otro", correo: "invalido" },
    { nombre: "Nombre", origen: "otro", observaciones: "x".repeat(2001) },
  ]) {
    assert.throws(() => gestion.guardar("id", 0, datos));
  }
  assert.equal(llamadas, 0);
});

test("ubicación independiente del origen, opcional y validada", () => {
  for (const ubicacion_comercial of ["", "docta", "nobu", "residencial"])
    assert.equal(
      validarRegistro({
        nombre: "Persona",
        origen: "instagram",
        ubicacion_comercial,
      }).ubicacion_comercial,
      ubicacion_comercial,
    );
  for (const ubicacion_comercial of ["otro", 4, {}])
    assert.throws(() =>
      validarRegistro({
        nombre: "Persona",
        origen: "instagram",
        ubicacion_comercial,
      }),
    );
});

import { ubicacionInicialAlarma } from "../../../shared/domain/ubicacionComercial.js";
test("sugerencia de ubicación no inventa condición de monitoreo", () => {
  assert.equal(ubicacionInicialAlarma("docta"), "docta");
  assert.equal(ubicacionInicialAlarma("nobu"), "nobu");
  assert.equal(ubicacionInicialAlarma("residencial"), "");
  assert.equal(ubicacionInicialAlarma(""), "a_definir");
});
