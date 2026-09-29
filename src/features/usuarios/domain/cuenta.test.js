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
  assert.throws(() => gestion.crear({ ...datos, clave: "corta" }), /12 y 128/);
  assert.equal(llamadas, 0);
});
