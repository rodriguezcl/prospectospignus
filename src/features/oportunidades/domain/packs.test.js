import { test } from "node:test";
import assert from "node:assert/strict";
import { precioPorCantidad, detallePacks } from "./packs.js";

const item = {
  precios: { alto: "100", bajo: "80", telefonico: "60" },
  precios_pack_2: { alto: "180", bajo: "150", telefonico: "100" },
};
test("packs completos y remanentes; no agrupa tarifas ni bonificados", () => {
  for (const [n, total] of [
    [1, 100],
    [2, 180],
    [3, 280],
    [4, 360],
    [5, 460],
  ])
    assert.equal(precioPorCantidad(item, "alto", n), BigInt(total) * 1000000n);
  assert.equal(precioPorCantidad(item, "alto", 4, false), 400000000n);
  assert.deepEqual(
    detallePacks(item, { altos: 1, bajos: 1, bonificados: 2 }),
    [],
  );
  assert.deepEqual(detallePacks(item, { altos: 3, bajos: 2, bonificados: 4 }), [
    { nivel: "alto", packs: 1, individuales: 1, ahorro: "20.00" },
    { nivel: "bajo", packs: 1, individuales: 0, ahorro: "10.00" },
  ]);
  assert.equal(
    precioPorCantidad({ precios: item.precios }, "alto", 4),
    400000000n,
  );
});
