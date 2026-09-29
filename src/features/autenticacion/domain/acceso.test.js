import { test } from "node:test";
import assert from "node:assert/strict";
import { tieneAcceso, esAdministrador } from "./acceso.js";
import { crearAcceso } from "../application/crearAcceso.js";

test("solo perfiles activos con rol conocido tienen acceso", () => {
  for (const perfil of [
    null,
    {},
    { rol: "administrador" },
    { activo: false, rol: "administrador" },
    { activo: true, rol: "desconocido" },
  ])
    assert.equal(tieneAcceso(perfil), false);
  assert.equal(tieneAcceso({ activo: true, rol: "vendedor" }), true);
  assert.equal(esAdministrador({ activo: true, rol: "vendedor" }), false);
  assert.equal(esAdministrador({ activo: true, rol: "administrador" }), true);
});

test("una sesión sin perfil autorizado no habilita la plataforma", async () => {
  const acceso = crearAcceso({ obtenerPerfil: async () => null });
  await assert.rejects(acceso.resolverPerfil("id"), /no tiene acceso/);
  assert.equal(await acceso.resolverPerfil(null), null);
});
