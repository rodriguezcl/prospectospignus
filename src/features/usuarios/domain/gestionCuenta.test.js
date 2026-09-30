import { test } from "node:test";
import assert from "node:assert/strict";
import { crearGestionUsuarios } from "../application/crearGestionUsuarios.js";
import { crearRepositorioUsuarios } from "../infrastructure/crearRepositorioUsuarios.js";

const entrada = {
  id: "00000000-0000-0000-0000-000000000001",
  version: 1,
  accion: "editar",
  nombre: " Persona ",
  rol: "vendedor",
  motivo: " Corrección de nombre ",
};
test("gestión valida antes del repositorio y no transmite actor ni campos ajenos", async () => {
  let recibido;
  const gestion = crearGestionUsuarios({
    gestionar: async (datos) => {
      recibido = datos;
    },
  });
  assert.throws(
    () => gestion.gestionar({ ...entrada, rol: "supervisor" }),
    /rol válido/,
  );
  assert.equal(recibido, undefined);
  for (const cambio of [
    { version: 0 },
    { accion: "inventada" },
    { motivo: "" },
    { nombre: "a" },
  ])
    assert.throws(() => gestion.gestionar({ ...entrada, ...cambio }));
  await gestion.gestionar({
    ...entrada,
    actor: "otro",
    correo: "otro@example.invalid",
    activo: false,
  });
  assert.deepEqual(recibido, {
    id: entrada.id,
    version: 1,
    accion: "editar",
    datos: {
      nombre: "Persona",
      rol: "vendedor",
      motivo: "Corrección de nombre",
    },
  });
  assert.throws(
    () => gestion.gestionar({ ...entrada, accion: "eliminar" }),
    /correo/,
  );
});
test("adaptador transmite versión y traduce errores sin exponer información interna", async () => {
  let recibido;
  const repo = crearRepositorioUsuarios({
    rpc: async (...args) => {
      recibido = args;
      return { error: { message: "CUENTA_CONFLICTO" } };
    },
  });
  await assert.rejects(
    repo.gestionar({ ...entrada, datos: { motivo: "Prueba" } }),
    /Otra persona/,
  );
  assert.equal(recibido[0], "gestionar_cuenta");
  assert.equal(recibido[1].p_version, 1);
  const fallo = crearRepositorioUsuarios({
    rpc: async () => ({ error: { message: "detalle SQL privado" } }),
  });
  await assert.rejects(
    fallo.gestionar(entrada),
    (error) => !error.message.includes("SQL"),
  );
});
