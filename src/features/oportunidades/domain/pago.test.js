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
      ajuste_redondeo: "0.00",
      redondeo_manual: "0.00",
      efectivo_a_abonar: "180000.00",
      saldo: "300000.00",
      medio_saldo: "credito",
      cuotas: Array(6).fill("50000.00"),
      total: "480000.00",
    },
  );
});
test("redondeo comercial descuenta del final y concilia efectivo, saldo y cuotas", () => {
  assert.equal(
    calcularPago({ total: "642208.42", redondeoManual: "2208.42" }).total,
    "640000.00",
  );
  assert.equal(
    calcularPago({
      total: "1000",
      baseEfectivo: "1000",
      redondeoManual: "20",
      porcentajeRedondeo: "3",
    }).total,
    "880.00",
  );
  for (const baseEfectivo of ["0", "100", "1000"]) {
    for (const redondeoManual of ["0", "0.01", "50", "200"]) {
      const p = calcularPago({
        total: "1000",
        baseEfectivo,
        redondeoManual,
        porcentajeRedondeo: "25",
        medioSaldo: "credito",
        cuotas: 6,
      });
      const c = (x) => BigInt(x.replace(".", ""));
      assert.equal(
        c(p.efectivo_a_abonar) + p.cuotas.reduce((s, x) => s + c(x), 0n),
        c(p.total),
      );
      assert.equal(
        c(p.total) +
          c(p.descuento) +
          c(p.redondeo_manual) +
          c(p.ajuste_redondeo),
        100000n,
      );
    }
  }
  for (const redondeoManual of ["-1", "1.001", "1001"])
    assert.throws(() => calcularPago({ total: "1000", redondeoManual }));
});
test("pago cero, cuotas y validación de importes sin aritmética flotante", () => {
  assert.equal(calcularPago({ total: "0" }).total, "0.00");
  assert.equal(
    calcularPago({ total: "359999", baseEfectivo: "359999" }).total,
    "323999.10",
  );
  assert.deepEqual(
    calcularPago({ total: "100", medioSaldo: "credito", cuotas: 3 }).cuotas,
    ["33.33", "33.33", "33.33"],
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

test("límite predeterminado 1 %, porcentaje configurable y máximo truncado a centavos", () => {
  assert.equal(
    calcularPago({ total: "1000", redondeoManual: "10" }).total,
    "990.00",
  );
  assert.throws(
    () => calcularPago({ total: "1000", redondeoManual: "10.01" }),
    /límite/,
  );
  assert.throws(
    () =>
      calcularPago({
        total: "1000",
        baseEfectivo: "1000",
        redondeoManual: "9.01",
      }),
    /límite/,
  );
  assert.equal(
    calcularPago({
      total: "1000",
      redondeoManual: "12.50",
      porcentajeRedondeo: "1.25",
    }).total,
    "987.50",
  );
  assert.equal(
    calcularPago({ total: "1.99", redondeoManual: "0.01" }).total,
    "1.98",
  );
  assert.throws(
    () => calcularPago({ total: "1.99", redondeoManual: "0.02" }),
    /límite/,
  );
  assert.throws(
    () =>
      calcularPago({
        total: "1000",
        redondeoManual: "0.01",
        porcentajeRedondeo: "0",
      }),
    /límite/,
  );
  for (const porcentajeRedondeo of ["-1", "100.01", "1.001", ""])
    assert.throws(
      () => calcularPago({ total: "1000", porcentajeRedondeo }),
      /límite/,
    );
});
