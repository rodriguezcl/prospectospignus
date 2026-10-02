import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { crearRepositorioCatalogo } from "../infrastructure/crearRepositorioCatalogo.js";
import { menu } from "../../../app/navegacion/menu.js";
import {
  prepararCatalogo,
  completarGrupos,
  modificarCatalogo,
} from "../domain/catalogo.js";
test("productos: ruta administrativa y carga real sin catálogo ficticio", () => {
  const resultado = buildSync({
    entryPoints: [
      fileURLToPath(new URL("./ProductosPagina.jsx", import.meta.url)),
    ],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    external: ["react", "react/jsx-runtime"],
  });
  const modulo = { exports: {} };
  new Function("require", "module", "exports", resultado.outputFiles[0].text)(
    createRequire(import.meta.url),
    modulo,
    modulo.exports,
  );
  const html = renderToStaticMarkup(
    createElement(modulo.exports.ProductosPagina, { gestion: {} }),
  );
  assert.match(html, /Catálogo comercial/);
  assert.match(html, /Cargar catálogo/);
  assert.doesNotMatch(html, /449999|AXPRO/);
  const grupo = menu.find((g) =>
    g.elementos.some((e) => e.ruta === "/productos"),
  );
  assert.equal(grupo.soloAdministrador, true);
  assert.equal(Boolean(grupo.plegable), false);
  assert.equal(
    grupo.elementos.find((e) => e.ruta === "/productos").titulo,
    "Catálogo comercial",
  );
});
test("productos: puerto envía versión e idempotencia, no identidad de actor", async () => {
  const llamadas = [];
  const repo = crearRepositorioCatalogo({
    rpc: async (...args) => {
      llamadas.push(args);
      return { data: { version: 0, datos: { familias: [], items: [] } } };
    },
  });
  await repo.leer();
  await repo.guardar({
    version: 0,
    operacion: "op",
    datos: { familias: [], items: [] },
  });
  assert.deepEqual(llamadas[0], ["leer_catalogo", { p_oportunidad: null }]);
  assert.equal(llamadas[1][0], "guardar_catalogo_020");
  assert.deepEqual(Object.keys(llamadas[1][1]), [
    "p_version",
    "p_operacion",
    "p_datos",
  ]);
  await assert.rejects(
    crearRepositorioCatalogo({
      rpc: async () => ({ error: { message: "CATALOGO_CONFLICTO" } }),
    }).leer(),
    /cambió/,
  );
});

test("catálogo: adaptación no inventa planes y bajas preservan dependencias", () => {
  const antiguo = {
    familias: [
      {
        id: "m",
        marca: "Hikvision",
        nombre: "COMODATO INICIAL",
        servicio: "alarma",
        estado: "activo",
      },
    ],
    items: [
      {
        id: "p",
        familia_id: "m",
        nombre: "PIR",
        codigo: "P",
        tipo: "adicional",
        estado: "activo",
        incluidos: [],
        kits_compatibles: [],
      },
      {
        id: "k",
        familia_id: "m",
        nombre: "Inicial",
        codigo: "K",
        tipo: "kit",
        estado: "activo",
        incluidos: [{ item_id: "p", cantidad: 1 }],
        kits_compatibles: [],
      },
    ],
  };
  const datos = prepararCatalogo(antiguo);
  assert.equal(datos.items[1].modalidad, "pendiente");
  assert.equal(datos.items[1].estado, "borrador");
  assert.equal(antiguo.items[1].estado, "activo");
  assert.throws(
    () => modificarCatalogo(datos, "marcas", datos.marcas[0], "eliminar"),
    /vínculos/,
  );
  assert.throws(
    () => modificarCatalogo(datos, "items", datos.items[0], "eliminar"),
    /vínculos/,
  );
  const sinKit = modificarCatalogo(datos, "items", datos.items[1], "eliminar");
  const sinProductos = modificarCatalogo(
    sinKit,
    "items",
    sinKit.items[0],
    "eliminar",
  );
  const vacio = completarGrupos(
    modificarCatalogo(sinProductos, "marcas", datos.marcas[0], "eliminar"),
    () => "nuevo",
  );
  assert.equal(vacio.familias.length, 0);
  assert.equal(vacio.marcas.length, 0);
  const activo = structuredClone(datos);
  activo.items[1].estado = "activo";
  assert.throws(
    () =>
      modificarCatalogo(activo, "items", {
        ...activo.items[0],
        estado: "inactivo",
      }),
    /vínculos/,
  );
});

test("catálogo: editor ofrece modalidad, marca, tipo y componentes sin campo familia", () => {
  const resultado = buildSync({
    entryPoints: [
      fileURLToPath(new URL("./EditorCatalogo.jsx", import.meta.url)),
    ],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    external: ["react", "react/jsx-runtime"],
  });
  const modulo = { exports: {} };
  new Function("require", "module", "exports", resultado.outputFiles[0].text)(
    createRequire(import.meta.url),
    modulo,
    modulo.exports,
  );
  const html = renderToStaticMarkup(
    createElement(modulo.exports.EditorCatalogo, {
      datos: { marcas: [], tipos: [], items: [] },
      grupo: "items",
      oferta: true,
    }),
  );
  for (const texto of [
    "Plan · comodato",
    "Kit · venta directa",
    "Marca",
    "Tipo comercial",
    "Productos incluidos",
    "Guardar",
  ])
    assert.ok(html.includes(texto));
  assert.doesNotMatch(html, /Familia/);
});
