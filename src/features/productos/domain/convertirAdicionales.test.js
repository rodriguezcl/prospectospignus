import { test } from "node:test";
import assert from "node:assert/strict";
import { convertirAdicionales } from "./convertirAdicionales.js";
test("USD usa únicamente su pack; la conversión nunca encarece dos individuales por redondeo", () => {
  const catalogo = {
    esquema: 7,
    moneda_adicionales: "USD",
    items: [
      {
        precios_pack_2: { telefonico: "100" },
        tipo: "adicional",
        adicional_habilitado: true,
        servicio: "camaras",
        precios_usd: { telefonico: "0.000001" },
        precios_pack_2_usd: { telefonico: "0.000002" },
      },
    ],
  };
  const convertido = convertirAdicionales(catalogo, {
    id: "tipo-cambio",
    venta: "1.4",
  });
  assert.equal(convertido.items[0].precios_pack_2.telefonico, "0.000002");
  delete catalogo.items[0].precios_pack_2_usd;
  assert.deepEqual(
    convertirAdicionales(catalogo, { id: "cambio", venta: "1000" }).items[0]
      .precios_pack_2,
    {},
  );
  assert.equal(catalogo.items[0].precios_pack_2.telefonico, "100");
});
