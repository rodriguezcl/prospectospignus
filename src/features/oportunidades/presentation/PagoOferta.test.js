import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { calcularPago } from "../domain/pago.js";
const compilado = buildSync({
  entryPoints: [fileURLToPath(new URL("./PagoOferta.jsx", import.meta.url))],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  external: ["react", "react/jsx-runtime"],
});
const modulo = { exports: {} };
new Function("require", "module", "exports", compilado.outputFiles[0].text)(
  createRequire(import.meta.url),
  modulo,
  modulo.exports,
);
function render(baseEfectivo = "0", medioSaldo = "debito", cuotas = 1) {
  const total = "100.00";
  return renderToStaticMarkup(
    createElement(modulo.exports.PagoOferta, {
      total,
      baseEfectivo,
      medioSaldo,
      cuotas,
      cambiar: () => {},
      pago: calcularPago({ total, baseEfectivo, medioSaldo, cuotas }),
    }),
  );
}
test("pago simple oculta campos mixtos y descuentos nulos; efectivo conserva descuento", () => {
  const debito = render();
  assert.doesNotMatch(
    debito,
    /Parte en efectivo|Resto a pagar con|Descuento por efectivo|Redondeo a favor/,
  );
  assert.match(debito, /Total inicial/);
  const efectivo = render("100");
  assert.match(efectivo, /90,00/);
  assert.match(efectivo, /Descuento por efectivo/);
  assert.doesNotMatch(efectivo, /Parte en efectivo|Resto a pagar con/);
});
test("pago combinado muestra efectivo y saldo; crédito conserva cuotas iguales", () => {
  const combinado = render("40", "credito", 3);
  assert.match(combinado, /Parte en efectivo/);
  assert.match(combinado, /Resto a pagar con/);
  assert.match(combinado, /36,00/);
  assert.match(combinado, /20,00/);
  assert.match(combinado, /96,00/);
  const credito = render("0", "credito", 6);
  assert.match(credito, /16,66/);
  assert.match(credito, /99,96/);
  assert.match(credito, /Redondeo a favor/);
});
