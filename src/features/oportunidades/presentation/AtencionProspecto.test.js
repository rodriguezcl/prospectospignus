import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { puedeAtender, puedeCotizar } from "../domain/circuito.js";
const resultado = buildSync({
  entryPoints: [
    fileURLToPath(new URL("./AtencionProspecto.jsx", import.meta.url)),
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
const { AtencionProspecto } = modulo.exports;
const vendedor = { id: "a", rol: "vendedor" },
  otro = { id: "b", rol: "vendedor" },
  admin = { id: "c", rol: "administrador" };
const pendiente = { registro_id: "r", vendedor_id: null, version: 1 };
const tomada = {
  ...pendiente,
  vendedor_id: "a",
  vendedor_nombre: "Ana",
  version: 2,
};
const dibujar = (atencion, perfil) =>
  renderToStaticMarkup(
    h(AtencionProspecto, {
      atencion,
      perfil,
      gestion: {},
      actualizada: () => {},
    }),
  );
test("disponibles se toman antes de cotizar; solo titular y administración liberan", () => {
  assert.match(dibujar(pendiente, vendedor), /Tomar prospecto/);
  assert.equal(puedeAtender(pendiente, vendedor), false);
  assert.equal(puedeAtender(tomada, vendedor), true);
  assert.equal(puedeAtender(tomada, otro), false);
  assert.match(dibujar(tomada, vendedor), /Liberar prospecto/);
  assert.match(dibujar(tomada, admin), /Liberar prospecto/);
  const html = dibujar(tomada, admin);
  assert.match(html, /aria-haspopup="dialog"[^>]*>En atención por Ana<\/button>/);
  assert.doesNotMatch(html.split("<dialog")[0], /Liberar prospecto/);
  assert.match(html, /<dialog[\s\S]*Liberar prospecto[\s\S]*<\/dialog>/);
  assert.doesNotMatch(dibujar(tomada, otro), /<button/);
  assert.doesNotMatch(
    dibujar(pendiente, { id: "g", rol: "agente" }),
    /<button/,
  );
  assert.match(dibujar(tomada, otro), /En atención por Ana/);
});
test("preparación reservada impide cotizar a terceros y conserva permisos posteriores", () => {
  const caso = {
    estado: "cotizacion",
    preparacion_compartida: true,
    atencion: tomada,
  };
  assert.equal(puedeCotizar(caso, vendedor), true);
  assert.equal(puedeCotizar(caso, otro), false);
  assert.equal(puedeCotizar({ ...caso, atencion: pendiente }, vendedor), false);
  assert.equal(
    puedeCotizar(
      {
        ...caso,
        estado: "recuperacion",
        preparacion_compartida: false,
        responsable_id: "g",
      },
      { id: "g", rol: "agente" },
    ),
    true,
  );
});

test("administración puede preparar y calcular para un contacto disponible sin tomarlo como vendedor", () => {
  for (const atencion of [pendiente, tomada, null]) {
    assert.equal(puedeAtender(atencion, admin), true);
    assert.equal(
      puedeCotizar(
        { estado: "cotizacion", preparacion_compartida: true, atencion },
        admin,
      ),
      true,
    );
  }
  assert.doesNotMatch(
    dibujar(pendiente, admin),
    /Tomar prospecto|Liberar prospecto/,
  );
  assert.equal(puedeAtender(pendiente, { id: "g", rol: "agente" }), false);
  assert.equal(
    puedeCotizar(
      { estado: "ganada", preparacion_compartida: true, atencion: pendiente },
      admin,
    ),
    false,
  );
});

test("la campana dirige avisos de prospectos a disponibles y conserva lectura de avisos comerciales", async () => {
  const { combinarAvisos } =
    await import("../../../app/configuracion/combinarAvisos.js");
  const leidos = [];
  const avisos = combinarAvisos(
    {
      notificaciones: async () => [
        {
          id: "prospecto-12",
          destino: "/cotizaciones?atencion=disponibles",
          creado_en: "2026-10-08",
        },
        { id: 7, oportunidad_id: "o", creado_en: "2026-10-07" },
      ],
      leer: (id) => leidos.push(id),
    },
    { notificaciones: async () => [] },
  );
  const filas = await avisos.notificaciones();
  assert.equal(filas[0].destino, "/cotizaciones?atencion=disponibles");
  assert.equal(filas[1].destino, "/cotizaciones?id=o");
  avisos.leer(filas[0].id);
  avisos.leer(filas[1].id);
  assert.deepEqual(leidos, ["prospecto-12", "7"]);
});
