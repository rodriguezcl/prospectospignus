import { test } from "node:test";
import assert from "node:assert/strict";
import { leerImporteArgentino, numeroImporte, monedaArgentina } from "./importe.js";

test("moneda argentina diferencia cero de desconocido y muestra centavos", () => {
  assert.equal(monedaArgentina("1092412.55").replace(/\s/g, " "), "$ 1.092.412,55");
  assert.equal(monedaArgentina(0).replace(/\s/g, " "), "$ 0,00");
  assert.equal(monedaArgentina(null, "No informado"), "No informado");
});

test("importes argentinos: carga, pegado y precisión sin alterar valores", () => {
  for (const [entrada, esperado] of [
    ["449999", "449999"],
    ["$ 1.092.412,55", "1092412.55"],
    ["90.000", "90000"],
    ["0,10", "0.10"],
    ["", ""],
    ["92.914,932", "92914.932"],
  ]) {
    assert.equal(leerImporteArgentino(entrada), esperado);
    assert.equal(
      leerImporteArgentino(numeroImporte(esperado)),
      esperado === ""
        ? ""
        : esperado.includes(".")
          ? esperado
          : `${esperado}.00`,
    );
  }
  assert.equal(numeroImporte("449999"), "449.999,00");
  assert.equal(numeroImporte("92914.932"), "92.914,932");
  for (const invalido of ["12.34", "1,234.56", "-1", "abc", "1e3"])
    assert.throws(() => leerImporteArgentino(invalido));
  assert.throws(() => leerImporteArgentino("10,123", 2));
});
