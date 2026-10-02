import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const compilado = buildSync({
  entryPoints: [
    fileURLToPath(new URL("./GraficoRegistros.jsx", import.meta.url)),
  ],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  external: ["react", "react/jsx-runtime"],
  loader: { ".css": "empty" },
});
const modulo = { exports: {} };
new Function("require", "module", "exports", compilado.outputFiles[0].text)(
  createRequire(import.meta.url),
  modulo,
  modulo.exports,
);
const { GraficoRegistros } = modulo.exports;
const tableroCompilado = buildSync({
  entryPoints: [fileURLToPath(new URL("./TableroInicio.jsx", import.meta.url))],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  external: ["react", "react/jsx-runtime", "react-router-dom"],
  loader: { ".css": "empty" },
});
const tableroModulo = { exports: {} };
new Function(
  "require",
  "module",
  "exports",
  tableroCompilado.outputFiles[0].text,
)(createRequire(import.meta.url), tableroModulo, tableroModulo.exports);
test("Inicio: gráficos con etiquetas, colores semánticos y comparación solo administrativa", () => {
  const tablero = {
    cohorte: [{ id: "1" }],
    porEstado: [
      { valor: "ganada", nombre: "Ganadas", color: "verde", cantidad: 1 },
    ],
    equipo: [
      {
        id: "v",
        nombre: "Vendedor",
        total: 1,
        estados: [
          { valor: "ganada", nombre: "Ganadas", color: "verde", cantidad: 1 },
        ],
      },
    ],
  };
  for (const administrador of [true, false]) {
    const html = renderToStaticMarkup(
      createElement(tableroModulo.exports.GraficosResultados, {
        tablero,
        administrador,
        seleccionar: () => {},
      }),
    );
    assert.match(html, /Distribución por estado/);
    assert.match(html, /tono-verde/);
    assert.match(html, /Ganadas/);
    assert.equal(html.includes("Resultados por responsable"), administrador);
    assert.doesNotMatch(html, /NaN|Infinity/);
  }
});
test("Inicio: un período vacío no fabrica porcentajes ni gráficos", () => {
  const html = renderToStaticMarkup(
    createElement(tableroModulo.exports.GraficosResultados, {
      tablero: { cohorte: [] },
      administrador: true,
      seleccionar: () => {},
    }),
  );
  assert.match(html, /Sin negociaciones/);
  assert.doesNotMatch(html, /<svg|NaN|Infinity/);
});
const dibujar = (campo, valores, filtro = null) =>
  renderToStaticMarkup(
    createElement(GraficoRegistros, {
      grupo: { titulo: "Registros", campo, valores, nombre: (v) => v },
      filtro,
      seleccionar: () => {},
    }),
  );

test("barras diarias incluyen ceros, cifras y selección accesible", () => {
  const html = dibujar(
    "dia",
    [
      { valor: "01", cantidad: 0 },
      { valor: "02", cantidad: 8 },
    ],
    { campo: "dia", valor: "02" },
  );
  assert.match(html, /height:0%/);
  assert.match(html, /height:100%/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /Día 01: 0 registros/);
  assert.doesNotMatch(html, /NaN|Infinity/);
});
test("barras horizontales conservan proporciones y escapan nombres", () => {
  const html = dibujar("origen", [
    { valor: "<origen>", cantidad: 4 },
    { valor: "Otro", cantidad: 2 },
  ]);
  assert.match(html, /width:100%/);
  assert.match(html, /width:50%/);
  assert.match(html, /&lt;origen&gt;/);
  assert.match(dibujar("creado_por", []), /Sin registros para graficar/);
  assert.doesNotMatch(
    dibujar("dia", [{ valor: "01", cantidad: 0 }]),
    /NaN|Infinity/,
  );
});
