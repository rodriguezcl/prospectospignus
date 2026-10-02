import { test } from "node:test";
import assert from "node:assert/strict";
import { importeExacto, centavos, decimalCentavos, cuotasSinInteres } from "./dinero.js";

test("conserva precio fuente al multiplicar, sin perder centavos", () => {
  const total = importeExacto("149999") + 2n * importeExacto("92914.932");
  assert.equal(decimalCentavos(centavos(total)), "335828.86");
  assert.equal(decimalCentavos(centavos(importeExacto("0.005"))), "0.01");
  assert.equal(decimalCentavos(centavos(importeExacto("0.004999"))), "0.00");
});
test("distingue ausente de cero y rechaza tarifas no válidas", () => {
  assert.equal(importeExacto("0"), 0n);
  for (const dato of [null, undefined, "", 12, "NaN", "-1", "1e5", "1.0000001", "1,5", "1000000000000"])
    assert.throws(() => importeExacto(dato));
});
test("última cuota concilia cada centavo, sin interés", () => {
  assert.deepEqual(cuotasSinInteres(10000n, 3), ["33.33", "33.33", "33.34"]);
  for (const cantidad of [1, 3, 6]) for (let total = 0n; total < 601n; total++) {
    const cuotas = cuotasSinInteres(total, cantidad);
    assert.equal(cuotas.reduce((s, v) => s + centavos(importeExacto(v)), 0n), total);
  }
  assert.throws(() => cuotasSinInteres(100n, 2));
});
