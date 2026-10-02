import { test } from "node:test";
import assert from "node:assert/strict";
import { calcularPago } from "./pago.js";
test("pago mixto descuenta solo deuda asignada a efectivo y conserva saldo", () => {
  assert.deepEqual(
    calcularPago({
      total: "500000",
      baseEfectivo: "200000",
      medioSaldo: "credito",
      cuotas: 6,
    }),
    {
      base: "500000.00",
      base_efectivo: "200000.00",
      descuento: "20000.00",
      efectivo_a_abonar: "180000.00",
      saldo: "300000.00",
      medio_saldo: "credito",
      cuotas: Array(6).fill("50000.00"),
      total: "480000.00",
    },
  );
});
test("pago cero, cuotas y validación de importes sin aritmética flotante", () => {
  assert.equal(calcularPago({ total: "0" }).total, "0.00");
  assert.equal(
    calcularPago({ total: "359999", baseEfectivo: "359999" }).total,
    "323999.10",
  );
  assert.deepEqual(
    calcularPago({ total: "100", medioSaldo: "credito", cuotas: 3 }).cuotas,
    ["33.33", "33.33", "33.34"],
  );
  assert.throws(
    () => calcularPago({ total: "10", baseEfectivo: "11" }),
    /supera/,
  );
  assert.throws(
    () => calcularPago({ total: "10", baseEfectivo: "0.001" }),
    /decimales/,
  );
  assert.throws(() => calcularPago({ total: "10", cuotas: 6 }), /válidos/);
  for (let n = 0; n < 1000; n++) {
    const p = calcularPago({
      total: "10",
      baseEfectivo: (n / 100).toFixed(2),
      medioSaldo: "credito",
      cuotas: 6,
    });
    const cents = (x) => BigInt(x.replace(".", ""));
    assert.equal(
      cents(p.efectivo_a_abonar) + p.cuotas.reduce((s, x) => s + cents(x), 0n),
      cents(p.total),
    );
  }
});
