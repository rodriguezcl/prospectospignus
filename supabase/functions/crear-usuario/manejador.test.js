import { test } from "node:test";
import assert from "node:assert/strict";
import { crearManejador } from "./manejador.js";

const cuenta = {
  nombre: "Persona Prueba",
  correo: "PRUEBA@example.com",
  clave: "clave-solo-para-test",
  rol: "vendedor",
};

test("administración puede crear Agente; Agente no puede crear cuentas", async () => {
  const { manejar, creadas } = preparar();
  assert.equal(
    (await manejar(solicitud({ ...cuenta, rol: "agente" }))).status,
    201,
  );
  assert.equal(creadas[0].rol, "agente");
  const restringido = preparar({ perfil: { activo: true, rol: "agente" } });
  assert.equal((await restringido.manejar(solicitud(cuenta))).status, 403);
});

test("servidor admite contraseñas de 10 a 128 caracteres", async () => {
  for (const longitud of [9, 10, 11, 12, 128, 129]) {
    const { manejar, creadas } = preparar();
    const valida = longitud >= 10 && longitud <= 128;
    const respuesta = await manejar(
      solicitud({ ...cuenta, clave: "a".repeat(longitud) }),
    );
    assert.equal(respuesta.status, valida ? 201 : 400);
    assert.equal(creadas.length, valida ? 1 : 0);
  }
});
function preparar({
  identidad = { id: "actor-real" },
  perfil = { activo: true, rol: "administrador" },
  fallo,
} = {}) {
  const creadas = [];
  const manejar = crearManejador({
    origenes: ["https://pignus.example"],
    verificarIdentidad: async (token) =>
      token === "valido" ? identidad : null,
    obtenerPerfil: async () => perfil,
    crearCuenta: async (datos) => {
      if (fallo) throw fallo;
      creadas.push(datos);
      return { id: "nuevo-id" };
    },
  });
  return { manejar, creadas };
}
function solicitud(
  datos = cuenta,
  token = "valido",
  origen = "https://pignus.example",
) {
  return new Request("https://funcion.example", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, origin: origen },
    body: JSON.stringify(datos),
  });
}

test("sesión inválida, vendedor e inactivo no pueden crear cuentas", async () => {
  for (const opciones of [
    { identidad: null },
    { perfil: { activo: true, rol: "vendedor" } },
    { perfil: { activo: false, rol: "administrador" } },
    { perfil: null },
  ]) {
    const { manejar, creadas } = preparar(opciones);
    const respuesta = await manejar(solicitud());
    assert.ok([401, 403].includes(respuesta.status));
    assert.equal(creadas.length, 0);
  }
});
test("ignora el actor propuesto por navegador y no devuelve secretos", async () => {
  const { manejar, creadas } = preparar();
  const respuesta = await manejar(
    solicitud({ ...cuenta, creadoPor: "falsificado" }),
  );
  assert.equal(respuesta.status, 201);
  assert.equal(creadas[0].creadoPor, "actor-real");
  assert.equal(creadas[0].correo, "prueba@example.com");
  const cuerpo = await respuesta.text();
  assert.ok(!cuerpo.includes(cuenta.clave));
});
test("rechaza elevación a roles no admitidos y origen desconocido", async () => {
  const { manejar, creadas } = preparar();
  assert.equal(
    (await manejar(solicitud({ ...cuenta, rol: "root" }))).status,
    400,
  );
  assert.equal(
    (await manejar(solicitud(cuenta, "valido", "https://otro.example"))).status,
    403,
  );
  assert.equal(creadas.length, 0);
});
test("errores internos no exponen trazas y duplicados tienen respuesta específica", async () => {
  const interno = preparar({ fallo: new Error("secreto-interno") });
  const respuesta = await interno.manejar(solicitud());
  assert.equal(respuesta.status, 500);
  assert.ok(!(await respuesta.text()).includes("secreto-interno"));
  const duplicado = preparar({ fallo: { code: "email_exists" } });
  assert.equal((await duplicado.manejar(solicitud())).status, 409);
});
test("rechaza métodos y JSON inválidos sin crear usuarios", async () => {
  const { manejar, creadas } = preparar();
  assert.equal(
    (await manejar(new Request("https://funcion.example"))).status,
    405,
  );
  assert.equal(
    (
      await manejar(
        new Request("https://funcion.example", {
          method: "POST",
          headers: { authorization: "Bearer valido" },
          body: "{",
        }),
      )
    ).status,
    400,
  );
  assert.equal(creadas.length, 0);
});
