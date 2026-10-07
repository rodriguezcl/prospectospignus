import { test } from "node:test";
import assert from "node:assert/strict";
import { crearManejadorDolar } from "./manejador.js";
test("solo sesiones activas: ignora valores enviados por el navegador y registra la fuente", async () => {
  let registrado;
  const handler = crearManejadorDolar({
    origenes: ["https://app.test"],
    autorizado: async (t) => t === "valido",
    consultarCache: async () => null,
    consultarFuente: async () => ({
      moneda: "USD",
      casa: "oficial",
      venta: 1500,
      fechaActualizacion: "2026-10-05T14:00:00Z",
    }),
    registrar: async (...valores) => {
      registrado = valores;
      return { id: "servidor", venta: valores[0] };
    },
  });
  const req = (token, origin = "https://app.test") =>
    new Request("https://edge.test", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, origin },
      body: JSON.stringify({ venta: 1 }),
    });
  assert.equal((await handler(req("invalido"))).status, 401);
  assert.equal((await handler(req("valido", "https://otra.test"))).status, 403);
  const respuesta = await handler(req("valido"));
  assert.equal(respuesta.status, 200);
  assert.deepEqual(registrado, ["1500", "2026-10-05T14:00:00Z", "dolarapi"]);
  assert.equal((await respuesta.json()).venta, "1500");
});
test("cache vigente evita consultas repetidas; falla de fuente no inventa cotización", async () => {
  const puertos = {
    origenes: [],
    autorizado: async () => true,
    consultarCache: async () => ({ id: "cache", venta: "1500" }),
    consultarFuente: async () => {
      throw Error("offline");
    },
    registrar: async () => {
      throw Error("no debe ejecutarse");
    },
  };
  const req = () =>
    new Request("https://edge.test", {
      method: "POST",
      headers: { authorization: "Bearer valido" },
    });
  assert.equal(
    (await (await crearManejadorDolar(puertos)(req())).json()).id,
    "cache",
  );
  assert.equal(
    (
      await crearManejadorDolar({
        ...puertos,
        consultarCache: async () => null,
      })(req())
    ).status,
    503,
  );
});
