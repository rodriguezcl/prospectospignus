import { test } from "node:test";
import assert from "node:assert/strict";
import { crearAcceso } from "./crearAcceso.js";

test("cambio de contraseña admite 10 a 128 caracteres", async () => {
  const claves = [];
  const acceso = crearAcceso({ cambiarClave: async (clave) => claves.push(clave) });
  for (const clave of [undefined, null, "a".repeat(9), "a".repeat(129)]) {
    await assert.rejects(acceso.cambiarClave(clave), /10 y 128/);
  }
  assert.equal(claves.length, 0);
  for (const longitud of [10, 11, 12, 128]) await acceso.cambiarClave("a".repeat(longitud));
  assert.deepEqual(claves.map((clave) => clave.length), [10, 11, 12, 128]);
});
