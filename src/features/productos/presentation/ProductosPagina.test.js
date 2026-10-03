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
  assert.equal(llamadas[1][0], "guardar_catalogo_025");
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
    "Productos incluidos",
    "Guardar",
  ])
    assert.ok(html.includes(texto));
  assert.doesNotMatch(html, /Familia|Plantilla|Tipo comercial/);
  for (const configuracion of [
    { grupo: "marcas" },
    { grupo: "items" },
    { grupo: "items", oferta: true },
    { grupo: "items", adicional: true },
  ]) {
    const nuevo = renderToStaticMarkup(
      createElement(modulo.exports.EditorCatalogo, {
        datos: { marcas: [], tipos: [], items: [] },
        ...configuracion,
      }),
    );
    assert.match(nuevo, /<option selected="">activo<\/option>/);
  }
  const entidades = (prefijo) =>
    ["activo", "inactivo", "borrador"].map((estado) => ({
      id: `${prefijo}-${estado}`,
      nombre: `${prefijo}-${estado}`,
      estado,
    }));
  const datos = {
    marcas: entidades("marca"),
    tipos: entidades("tipo").map((t) => ({
      ...t,
      marca_id: "marca-activo",
      servicio: "alarma",
      variante: "INALÁMBRICO",
      incluidos: [{ item_id: "adicional-activo", cantidad: 1 }],
    })),
    items: ["adicional", "kit"].flatMap((tipo) =>
      entidades(tipo).map((i) => ({
        ...i,
        codigo: i.id,
        tipo,
        marca_id: "marca-activo",
        servicio: "alarma",
        modalidad: "plan",
      })),
    ),
  };
  const valor = {
    id: "nuevo",
    nombre: "OFERTA",
    codigo: "N",
    marca_id: "marca-activo",
    tipo_comercial_id: "tipo-activo",
    servicio: "alarma",
    tipo: "kit",
    modalidad: "plan",
    estado: "borrador",
    precios: {},
    abonos: {},
    incluidos: [],
    kits_compatibles: [],
  };
  const render = (v, oferta = true) =>
    renderToStaticMarkup(
      createElement(modulo.exports.EditorCatalogo, {
        datos,
        grupo: "items",
        oferta,
        valor: v,
      }),
    );
  const alta = render(valor);
  for (const estado of ["borrador", "inactivo", "activo"]) {
    assert.match(
      render({ ...valor, estado }),
      new RegExp(`<option selected="">${estado}</option>`),
    );
  }
  assert.match(alta, /adicional-activo/);
  for (const prefijo of ["marca", "tipo", "adicional"]) {
    assert.doesNotMatch(
      alta,
      new RegExp(`${prefijo}-inactivo|${prefijo}-borrador`),
    );
  }
  const editado = render({
    ...valor,
    tipo_comercial_id: "tipo-inactivo",
    incluidos: [{ item_id: "adicional-inactivo", cantidad: 2 }],
  });
  assert.match(editado, /Hay vínculos no activos/);
  assert.doesNotMatch(editado, /tipo-inactivo/);
  assert.match(editado, /adicional-inactivo/);
  assert.match(editado, /max="2"/);
  const extra = render({ ...valor, tipo: "adicional" }, false);
  assert.doesNotMatch(extra, /Clase de producto|Mano de obra|Cerco/);
  assert.match(extra, /Precio alto/);
  assert.match(extra, /Precio bajo/);
  assert.match(extra, /Precio telefonico/);
  assert.doesNotMatch(extra, /Precio catalogo|Precio medio/);
  for (const servicio of ["alarma", "camaras"]) {
    const venta = render({ ...valor, servicio, modalidad: "kit" });
    assert.match(venta, /Precio telefonico/);
    assert.doesNotMatch(
      venta,
      /Precio alto|Precio bajo|Precio medio|Precio catalogo/,
    );
  }
  const componenteCamara = render(
    { ...valor, servicio: "camaras", tipo: "adicional", modalidad: null },
    false,
  );
  assert.match(componenteCamara, /Precio telefonico/);
  assert.doesNotMatch(
    componenteCamara,
    /Precio alto|Precio bajo|Precio medio|Precio catalogo/,
  );
  assert.match(extra, /Se vende por/);
  assert.doesNotMatch(extra, /Unidad comercial/);
  assert.match(extra, /value="unidad">Unidad<\/option>/);
  assert.match(extra, /value="pack">Paquete \(pack\)<\/option>/);
  assert.match(extra, /kit-activo/);
  assert.doesNotMatch(extra, /kit-inactivo|kit-borrador/);
  const extraAnterior = render(
    { ...valor, tipo: "adicional", kits_compatibles: ["kit-inactivo"] },
    false,
  );
  assert.match(extraAnterior, /kit-inactivo/);
  assert.match(extraAnterior, /Hay vínculos no activos/);
});
