import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { crearConsultaRendimiento } from "../infrastructure/crearConsultaRendimiento.js";
import { menu } from "../../../app/navegacion/menu.js";

test("informes: seis gráficos, desconocidos diferenciados y denominadores visibles", () => {
  const bundle = buildSync({
    entryPoints: [
      fileURLToPath(new URL("./InformesPagina.jsx", import.meta.url)),
    ],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    loader: { ".css": "empty" },
    external: ["react", "react/jsx-runtime", "react-router-dom"],
  });
  const modulo = { exports: {} };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(
    createRequire(import.meta.url),
    modulo,
    modulo.exports,
  );
  const html = renderToStaticMarkup(
    h(modulo.exports.GraficosRendimiento, {
      filas: [
        {
          id: "1",
          nombre: "Persona de prueba",
          ventas: 3,
          conversion: null,
          volumen_inicial: null,
          ticket_inicial: null,
          ticket_instalacion: null,
          ticket_abono: null,
          visitados: 0,
          directos: 0,
          con_importe: 0,
          sin_importe: 0,
          desconocidas: 3,
          con_abono: 0,
          con_instalacion: 0,
        },
      ],
      seleccionar: () => {},
    }),
  );
  assert.equal((html.match(/<section/g) || []).length, 6);
  assert.match(html, /3 sin datos de importe/);
  assert.match(html, /0 cierres propios \/ 0 casos visitados/);
  assert.match(html, />—<\/strong>/);
  assert.doesNotMatch(html, /NaN|Infinity/);
  const grupo = menu.find((g) =>
    g.elementos.some((e) => e.ruta === "/informes"),
  );
  assert.equal(grupo.soloAdministrador, true);
  assert.equal(Boolean(grupo.plegable), false);
});
test("informes: puerto agregado y detalle paginado sin identidad de sesión declarada", async () => {
  const llamadas = [];
  const repo = crearConsultaRendimiento({
    rpc: async (...args) => {
      llamadas.push(args);
      return { data: { filas: [] } };
    },
  });
  await repo.resumen({ mes: "2026-09" });
  await repo.detalle({
    mes: "2026-09",
    responsable: "persona",
    tipo: "visitas",
    origen: "propio",
    pagina: 1,
  });
  assert.deepEqual(llamadas[0], [
    "resumen_rendimiento",
    { p_mes: "2026-09-01", p_origen: null },
  ]);
  assert.deepEqual(llamadas[1], [
    "detalle_rendimiento",
    {
      p_mes: "2026-09-01",
      p_responsable: "persona",
      p_tipo: "visitas",
      p_origen: "propio",
      p_pagina: 1,
    },
  ]);
  await assert.rejects(
    crearConsultaRendimiento({
      rpc: async () => ({ error: { message: "INFORMES_ACCESO" } }),
    }).resumen({ mes: "2026-09" }),
    /permiso/,
  );
});
