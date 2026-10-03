import { test } from "node:test";
import assert from "node:assert/strict";
import { compararOfertas } from "./compararOfertas.js";
const items = [
  { id: "pir", nombre: "PIR", codigo: "P1" },
  { id: "mag", nombre: "Magnético" },
];
const oferta = (total, extras, ordinal = 1) => ({
  total,
  ordinal,
  seleccion: { extras },
});
test("compara todas las condiciones, incluidos cambios que vuelven a cobrar un adicional", () => {
  const anterior = oferta(
    "200",
    [
      { item_id: "pir", bajos: 1 },
      { item_id: "mag", altos: 1 },
    ],
    10,
  );
  const actual = oferta(
    "190",
    [
      { item_id: "mag", bonificados: 1 },
      { item_id: "pir", altos: 1 },
    ],
    11,
  );
  const c = compararOfertas(actual, anterior, items);
  assert.equal(c.importe, "10.00");
  assert.equal(c.sentido, "ahorro");
  assert.deepEqual(c.cambios, [
    "PIR (P1): 1 a precio Bajo → 1 a precio Alto.",
    "Magnético: 1 a precio Alto → 1 sin cargo adicional (comodato).",
  ]);
  assert.equal(compararOfertas(anterior, actual, items).sentido, "aumento");
  assert.equal(compararOfertas(actual, null, items), null);
});
test("empates, cambio a Telefónico y cantidades mixtas sin confundir ausente con cambios", () => {
  const antes = oferta("100.01", [{ item_id: "pir", altos: 2, bajos: 1 }]);
  const ahora = oferta("100.01", [
    { item_id: "pir", altos: 1, bajos: 1, telefonicos: 1, bonificados: 0 },
  ]);
  const c = compararOfertas(ahora, antes, items);
  assert.equal(c.sentido, "igual");
  assert.match(c.cambios[0], /1 a precio Telefónico/);
  assert.equal(compararOfertas(antes, antes, items).cambios.length, 0);
});
