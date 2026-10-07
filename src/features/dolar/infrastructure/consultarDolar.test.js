import { test } from "node:test";
import assert from "node:assert/strict";
import { consultarDolar } from "./consultarDolar.js";
const fecha = "2026-10-07T15:00:00Z";
const ahora = () => Date.parse(fecha);
const principal = {
  currency: "USD",
  origin: "BNA",
  sell: 1540,
  valueType: "money",
  lastScrapedAt: fecha,
  updatedAt: "2026-10-06T12:00:00Z",
};
const respaldo = {
  moneda: "USD",
  casa: "oficial",
  venta: 1540,
  fechaActualizacion: fecha,
};
const respuesta = (d) => ({ ok: true, json: async () => d });
test("MonedAPI Banco Nación venta: fecha confirmada, consulta sin credenciales", async () => {
  let consultas = 0;
  const r = await consultarDolar(
    "oficial",
    undefined,
    async (url, opciones) => {
      consultas++;
      assert.equal(url, "https://monedapi.ar/api/v2/usd/bna");
      assert.equal(opciones.credentials, "omit");
      assert.equal(opciones.referrerPolicy, "no-referrer");
      return respuesta(principal);
    },
    ahora,
  );
  assert.equal(consultas, 1);
  assert.deepEqual(r, {
    venta: 1540,
    fechaActualizacion: fecha,
    proveedor: "monedapi",
  });
});
test("respaldo oficial ante fallo, origen incorrecto, dato inválido o confirmación vencida", async () => {
  for (const dato of [
    null,
    { ...principal, origin: "OFICIAL" },
    { ...principal, sell: 0 },
    { ...principal, sell: "1540" },
    { ...principal, lastScrapedAt: "inválida" },
    { ...principal, lastScrapedAt: "2026-10-07T14:00:00Z" },
    { ...principal, lastScrapedAt: "2026-10-08T15:00:00Z" },
  ]) {
    const urls = [];
    const r = await consultarDolar(
      "oficial",
      undefined,
      async (url) => {
        urls.push(url);
        if (url.includes("monedapi")) {
          if (!dato) throw Error("offline");
          return respuesta(dato);
        }
        return respuesta(respaldo);
      },
      ahora,
    );
    assert.equal(r.proveedor, "dolarapi");
    assert.deepEqual(urls, [
      "https://monedapi.ar/api/v2/usd/bna",
      "https://dolarapi.com/v1/dolares/oficial",
    ]);
  }
});
test("rechaza fuentes fallidas o cotización incorrecta; cancelar no dispara respaldo", async () => {
  await assert.rejects(
    consultarDolar("oficial", undefined, async () => ({ ok: false }), ahora),
  );
  await assert.rejects(
    consultarDolar(
      "oficial",
      undefined,
      async () => respuesta({ ...respaldo, casa: "blue" }),
      ahora,
    ),
  );
  const c = new AbortController();
  let consultas = 0;
  await assert.rejects(
    consultarDolar(
      "oficial",
      c.signal,
      async () => {
        consultas++;
        c.abort();
        throw Error("cancelado");
      },
      ahora,
    ),
  );
  assert.equal(consultas, 1);
  await assert.rejects(consultarDolar("desconocido", undefined));
});
