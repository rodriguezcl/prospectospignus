import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { calcularPago } from "../domain/pago.js";
const compilado = buildSync({
  entryPoints: [
    fileURLToPath(new URL("./OfertaComercial.jsx", import.meta.url)),
  ],
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
function resumen(baseEfectivo, medioSaldo, cuotas = 1) {
  return renderToStaticMarkup(
    createElement(modulo.exports.OfertaComercial, {
      alternativa: {
        total: "100.00",
        seleccion: { extras: [], nivel: "alto" },
      },
      catalogo: { items: [] },
      kit: {
        nombre: "Plan de prueba",
        incluidos: [],
        abonos: { alto: "50.00" },
      },
      conAbono: true,
      nivelAbono: "alto",
      meses: 0,
      revision: "test",
      medioSaldo,
      pagoFinal: calcularPago({
        total: "100.00",
        baseEfectivo,
        medioSaldo,
        cuotas,
      }),
    }),
  );
}
test("resumen final muestra efectivo con descuento y no ofrece otros pagos ni selección de oferta", () => {
  const html = resumen("100", "debito");
  assert.match(html, /90,00/);
  assert.match(html, /50,00 por mes/);
  assert.match(html, /Forma de pago elegida/);
  assert.doesNotMatch(
    html,
    /100,00|Formas de pago del|Revisar pago y registrar|Débito:/,
  );
});
test("resumen final conserva efectivo y cuotas del pago combinado", () => {
  const html = resumen("40", "credito", 3);
  assert.match(html, /96,00/);
  assert.match(html, /36,00/);
  assert.match(html, /20,00/);
  assert.match(html, /Crédito · 3 cuota/);
});
