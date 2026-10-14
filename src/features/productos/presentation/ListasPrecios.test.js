import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { permisosPreciosIniciales } from "../domain/permisosPrecios.js";
const compilado = buildSync({
  entryPoints: [fileURLToPath(new URL("./ListasPrecios.jsx", import.meta.url))],
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
const dibujar = (permisos, ocupado = false) =>
  renderToStaticMarkup(
    createElement(modulo.exports.ListasPrecios, {
      permisos,
      ocupado,
      guardar: () => {},
    }),
  );
test("listas: matriz accesible por rol, sin conceder Telefónico al vendedor inicialmente", () => {
  const html = dibujar(permisosPreciosIniciales());
  assert.equal((html.match(/type="checkbox"/g) || []).length, 10);
  assert.match(html, /aria-label="Telefónico para Agente" checked/);
  assert.doesNotMatch(html, /aria-label="Telefónico para Vendedor" checked/);
  assert.match(html, /kits de venta/);
  assert.match(html, /Guardar permisos/);
});
test("listas: revocación total queda explícita y guardar no restaura permisos implícitos", () => {
  const html = dibujar({ vendedor: [], agente: [] });
  assert.doesNotMatch(html, / checked/);
  assert.match(html, /Vendedor: sin niveles habilitados/);
  assert.match(html, /Agente: sin niveles habilitados/);
  assert.match(html, /type="submit" disabled/);
});
