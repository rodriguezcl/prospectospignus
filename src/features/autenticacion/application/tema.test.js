import test from "node:test";
import assert from "node:assert/strict";
import { crearAcceso } from "./crearAcceso.js";
import { crearRepositorioAutenticacion } from "../infrastructure/crearRepositorioAutenticacion.js";

test("apariencia independiente por cuenta, persistente y sin cambiar otros metadatos", async () => {
  const cuentas = {
    a: { id: "a", user_metadata: { nombre: "Ana" } },
    b: { id: "b", user_metadata: {} },
  };
  let actual = "a";
  const acceso = crearAcceso(
    crearRepositorioAutenticacion({
      auth: {
        getUser: async () => ({ data: { user: cuentas[actual] } }),
        updateUser: async ({ data }) => {
          Object.assign(cuentas[actual].user_metadata, data);
          return { data: { user: cuentas[actual] } };
        },
      },
    }),
  );
  assert.equal(await acceso.obtenerTema("a"), "light");
  await acceso.guardarTema("a", "dark");
  assert.equal(await acceso.obtenerTema("a"), "dark");
  assert.equal(cuentas.a.user_metadata.nombre, "Ana");
  actual = "b";
  assert.equal(await acceso.obtenerTema("b"), "light");
  await assert.rejects(acceso.guardarTema("a", "dark"), /sesión cambió/);
  await assert.rejects(acceso.obtenerTema("a"), /recuperar/);
  await assert.rejects(acceso.guardarTema("b", "inventado"), /no es válida/);
  actual = "a";
  assert.equal(await acceso.obtenerTema("a"), "dark");
});

test("los fallos de persistencia se informan sin detalles del proveedor", async () => {
  const acceso = crearAcceso(
    crearRepositorioAutenticacion({
      auth: {
        getUser: async () => ({ data: { user: { id: "a" } } }),
        updateUser: async () => ({ error: { message: "detalle privado" } }),
      },
    }),
  );
  await assert.rejects(acceso.guardarTema("a", "dark"), {
    message: "No pudimos guardar la apariencia. Volvé a intentarlo.",
  });
});
