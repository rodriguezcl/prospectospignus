import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { menu } from "../../../app/navegacion/menu.js";
const compilado = buildSync({
  entryPoints: [
    fileURLToPath(new URL("./PromocionesPagina.jsx", import.meta.url)),
  ],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  external: ["react", "react/jsx-runtime", "react-router-dom"],
});
const modulo = { exports: {} };
new Function("require", "module", "exports", compilado.outputFiles[0].text)(
  createRequire(import.meta.url),
  modulo,
  modulo.exports,
);
const { FormularioPromocion, PromocionesPagina } = modulo.exports;
test("promociones: formulario accesible y acciones administrativas ausentes para lectores", () => {
  const formulario = renderToStaticMarkup(
    createElement(FormularioPromocion, { guardar: () => {}, ocupado: false }),
  );
  for (const campo of [
    "titulo",
    "descripcion",
    "condiciones",
    "destinatarios",
    "desde",
    "hasta",
  ])
    assert.ok(formulario.includes(`name="${campo}"`));
  for (const rol of ["administrador", "vendedor", "agente"]) {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        null,
        createElement(PromocionesPagina, { gestion: {}, perfil: { rol } }),
      ),
    );
    assert.equal(html.includes("Nueva promoción"), rol === "administrador");
    assert.equal(html.includes("Borradores"), rol === "administrador");
    assert.ok(html.includes("Vencidas"));
  }
  const rutas = menu.flatMap((g) => g.elementos.map((e) => e.ruta));
  assert.ok(rutas.includes("/promociones"));
  assert.ok(!rutas.includes("/gestiones"));
  assert.ok(!rutas.includes("/acciones"));
});
