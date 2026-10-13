import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const compilado = buildSync({
  entryPoints: [fileURLToPath(new URL("./VisitaInicial.jsx", import.meta.url))],
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
const dibujar = (programar) =>
  renderToStaticMarkup(
    createElement(modulo.exports.VisitaInicial, { programar, cambiar() {} }),
  );

test("alta: agendar es opcional, solo exige fecha cuando está seleccionado", () => {
  assert.doesNotMatch(dibujar(false), /type="datetime-local"|required/);
  const html = dibujar(true);
  const inicio = html.match(/<input\b[^>]*name="visita_inicio"[^>]*>/)?.[0];
  assert.match(inicio, /\brequired=""/);
  assert.match(html, /name="visita_fin"/);
  assert.match(html, /Horarios de Córdoba/);
  assert.doesNotMatch(html, /name="(?:vendedor_id|oportunidad_id|estado)"/);
});
