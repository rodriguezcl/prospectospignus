import { test } from "node:test";
import assert from "node:assert/strict";
import { consultarDolar } from "./consultarDolar.js";

const dato = {
  moneda: "USD",
  casa: "oficial",
  venta: 1540,
  fechaActualizacion: "2026-10-05T14:00:00.000Z",
};
test("consulta pública sin credenciales y conserva la actualización de la fuente", async () => {
  const signal = new AbortController().signal;
  const resultado = await consultarDolar(
    "oficial",
    signal,
    async (url, opciones) => {
      assert.equal(url, "https://dolarapi.com/v1/dolares/oficial");
      assert.equal(opciones.signal, signal);
      assert.equal(opciones.credentials, "omit");
      assert.equal(opciones.referrerPolicy, "no-referrer");
      return { ok: true, json: async () => dato };
    },
  );
  assert.deepEqual(resultado, {
    venta: 1540,
    fechaActualizacion: dato.fechaActualizacion,
  });
});
test("rechaza errores y datos incompletos en lugar de mostrar un precio inventado", async () => {
  await assert.rejects(
    consultarDolar("oficial", undefined, async () => ({ ok: false })),
  );
  for (const cambio of [
    { venta: null },
    { venta: "1540" },
    { venta: 0 },
    { venta: -1 },
    { venta: Infinity },
    { moneda: "EUR" },
    { casa: "blue" },
    { fechaActualizacion: "inválida" },
  ]) {
    await assert.rejects(
      consultarDolar("oficial", undefined, async () => ({
        ok: true,
        json: async () => ({ ...dato, ...cambio }),
      })),
    );
  }
  await assert.rejects(consultarDolar("desconocido", undefined));
});
test("propaga cancelación y fallos de red para conservar el último dato en presentación", async () => {
  await assert.rejects(
    consultarDolar("oficial", undefined, async () => {
      throw new Error("offline");
    }),
    /offline/,
  );
});
