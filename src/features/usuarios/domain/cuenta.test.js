import { test } from "node:test";
import assert from "node:assert/strict";
import { crearGestionUsuarios } from "../application/crearGestionUsuarios.js";

test("no llama al repositorio con rol arbitrario o contraseña corta", async () => {
  let llamadas = 0;
  const gestion = crearGestionUsuarios({
    crear: () => {
      llamadas++;
    },
  });
  const datos = {
    nombre: "Persona Prueba",
    correo: "prueba@example.com",
    clave: "contraseña-larga",
    rol: "vendedor",
  };
  assert.throws(
    () => gestion.crear({ ...datos, rol: "superusuario" }),
    /rol válido/,
  );
  assert.throws(() => gestion.crear({ ...datos, clave: "corta" }), /10 y 128/);
  assert.equal(llamadas, 0);
});

test("alta admite 10 a 128 caracteres y rechaza los límites externos", () => {
  let llamadas = 0;
  const gestion = crearGestionUsuarios({ crear: () => llamadas++ });
  const datos = { nombre: "Persona Prueba", correo: "prueba@example.com", rol: "vendedor" };
  for (const longitud of [9, 129]) {
    assert.throws(() => gestion.crear({ ...datos, clave: "a".repeat(longitud) }), /10 y 128/);
  }
  assert.equal(llamadas, 0);
  for (const longitud of [10, 11, 12, 128]) gestion.crear({ ...datos, clave: "a".repeat(longitud) });
  assert.equal(llamadas, 4);
});
