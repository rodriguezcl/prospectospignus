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

test("referencias independientes: USD convierte y ARS conserva sus precios sin lista USD", () => {
  const catalogo = {
    moneda_adicionales: "ARS",
    moneda_productos_version: 1,
    items: [
      {
        id: "hik",
        nombre: "Hikvision",
        tipo: "adicional",
        adicional_habilitado: true,
        estado: "activo",
        servicio: "alarma",
        moneda_referencia: "USD",
        precios: { alto: "10", bajo: "9", telefonico: "8" },
        precios_usd: { alto: "3", bajo: "2", telefonico: "1" },
      },
      {
        id: "gar",
        tipo: "adicional",
        adicional_habilitado: true,
        estado: "activo",
        servicio: "alarma",
        moneda_referencia: "ARS",
        precios: { alto: "30", bajo: "20", telefonico: "10" },
        precios_usd: {},
      },
    ],
  };
  const resultado = convertirAdicionales(catalogo, {
    id: "cambio",
    venta: "1500",
  });
  assert.equal(resultado.items[0].precios.alto, "4500.000000");
  assert.deepEqual(resultado.items[1], catalogo.items[1]);
  assert.equal(catalogo.items[0].precios.alto, "10");
  assert.throws(() => convertirAdicionales(catalogo, null), /dólar validada/);
  const soloARS = { ...catalogo, items: [catalogo.items[1]] };
  assert.equal(convertirAdicionales(soloARS, null), soloARS);
});
