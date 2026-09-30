import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { crearConsultaVentas } from "../infrastructure/crearConsultaVentas.js";
import { menu } from "../../../app/navegacion/menu.js";

function componente(ruta, observarRedireccion = false) {
  const compilado = buildSync({
    entryPoints: [fileURLToPath(new URL(ruta, import.meta.url))],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    external: ["react", "react/jsx-runtime", "react-router-dom"],
  });
  const modulo = { exports: {} };
  const cargar = createRequire(import.meta.url);
  new Function("require", "module", "exports", compilado.outputFiles[0].text)(
    (nombre) =>
      observarRedireccion && nombre === "react-router-dom"
        ? {
            ...cargar(nombre),
            Navigate: ({ to, replace }) =>
              createElement("span", {
                "data-destino": to.pathname + to.search,
                "data-reemplazar": String(replace),
              }),
          }
        : cargar(nombre),
    modulo,
    modulo.exports,
  );
  return modulo.exports;
}
const { VentasPagina, FilasVentas } = componente("./VentasPagina.jsx");
const { OportunidadesPagina } = componente("../../oportunidades/index.js");
const { RecuperacionComercial } = componente(
  "../../../app/router/RecuperacionComercial.jsx",
  true,
);

test("recuperación: menú y ruta exclusivos de agente/administrador; vendedor conserva Prospectos", () => {
  const entrada = menu
    .flatMap((g) => g.elementos)
    .find((e) => e.ruta === "/recuperacion");
  assert.deepEqual(entrada.roles, ["agente", "administrador"]);
  for (const rol of ["vendedor", "agente", "administrador"]) {
    const html = renderToStaticMarkup(
      createElement(
        MemoryRouter,
        { initialEntries: ["/recuperacion?id=caso"] },
        createElement(RecuperacionComercial, {
          gestion: {},
          perfil: { id: rol, rol, activo: true },
        }),
      ),
    );
    assert.equal(
      html.includes('data-destino="/prospectos?id=caso"'),
      rol === "vendedor",
    );
    assert.equal(html.includes('data-reemplazar="true"'), rol === "vendedor");
    assert.equal(html.includes("Recuperación comercial"), rol !== "vendedor");
  }
  const html = dibujar(
    createElement(OportunidadesPagina, {
      gestion: {},
      perfil: { id: "vendedor", rol: "vendedor", activo: true },
    }),
  );
  assert.ok(html.includes("Prospectos"));
  assert.ok(html.includes('value="recuperacion"'));
});
const dibujar = (elemento) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, elemento));

test("ventas: período histórico explícito, sin inventar cierre y enlace unificado", () => {
  const html = dibujar(
    createElement(
      "table",
      null,
      createElement(
        "tbody",
        null,
        createElement(FilasVentas, {
          filas: [
            {
              id: "caso",
              nombre: "Persona <prueba>",
              necesidad: "Vivienda",
              mes_cierre: "2026-09-01",
            },
          ],
        }),
      ),
    ),
  );
  assert.ok(html.includes("septiembre de 2026"));
  assert.ok(html.includes("Fecha exacta no informada"));
  assert.ok(html.includes("Canal no informado"));
  assert.ok(html.includes('href="/prospectos?id=caso"'));
  assert.ok(html.includes("Persona &lt;prueba&gt;"));
});
test("ventas: filtros por rol y advertencia de alcance comercial", () => {
  for (const rol of ["administrador", "vendedor", "agente"]) {
    const html = dibujar(
      createElement(VentasPagina, { gestion: {}, perfil: { rol } }),
    );
    assert.equal(html.includes("Todo el equipo"), rol === "administrador");
    assert.ok(html.includes("No acredita instalación, contrato ni cobro"));
  }
});
test("prospectos: un solo módulo y recuperación como filtro sin etapas ajenas", () => {
  const paginas = menu.flatMap((g) => g.elementos);
  assert.equal(
    paginas.some((p) => p.ruta === "/oportunidades"),
    false,
  );
  assert.ok(paginas.some((p) => p.ruta === "/ventas"));
  const html = dibujar(
    createElement(OportunidadesPagina, {
      gestion: {},
      perfil: { id: "agente", rol: "agente" },
      soloRecuperacion: true,
    }),
  );
  assert.ok(html.includes("Recuperación comercial"));
  assert.ok(html.includes('value="recuperacion"'));
  assert.ok(!html.includes('value="ganada"'));
  assert.ok(!html.includes('value="visita"'));
  assert.ok(html.includes("/prospectos?nueva=si"));
});
test("ventas: adaptador envía filtros sin identidad del actor y traduce migración pendiente", async () => {
  const gestion = crearConsultaVentas({
    rpc: async (nombre, datos) => {
      assert.equal(nombre, "listar_ventas_concretadas");
      assert.deepEqual(datos, {
        p_mes: "2026-09-01",
        p_responsable: null,
        p_pagina: 1,
      });
      return { data: { filas: [], total: 0, responsables: [] } };
    },
  });
  assert.equal(
    (await gestion.listar({ mes: "2026-09", pagina: 1, actor: "ignorado" }))
      .total,
    0,
  );
  await assert.rejects(
    crearConsultaVentas({
      rpc: async () => ({ error: { code: "PGRST202" } }),
    }).listar(),
    /migración 010/,
  );
});
