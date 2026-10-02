import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const compilado = buildSync({
  entryPoints: [
    fileURLToPath(new URL("./FormularioOportunidad.jsx", import.meta.url)),
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
const { FormularioOportunidad } = modulo.exports;
const dibujar = (props) =>
  renderToStaticMarkup(
    createElement(FormularioOportunidad, {
      perfil: { id: "vendedor", rol: "vendedor" },
      equipo: [{ id: "vendedor", nombre: "Persona prueba", rol: "vendedor" }],
      registros: [],
      guardar: () => {},
      buscar: () => {},
      ...props,
    }),
  );

test("formularios: calificación exige respuesta humana, vendedor y horario de Córdoba", () => {
  const html = dibujar({});
  for (const campo of [
    "registro_id",
    "contacto_confirmado",
    "necesidad",
    "vendedor_id",
    "plazo",
    "resumen",
  ])
    assert.ok(html.includes(`name="${campo}"`));
  assert.ok(html.includes("Córdoba"));
});

test("crear prospecto: conserva el registro elegido sin volver a pedir datos personales", () => {
  const html = dibujar({ registroSeleccionado: { id: "registro-elegido" } });
  assert.match(
    html,
    /type="hidden" name="registro_id" value="registro-elegido"/,
  );
  assert.doesNotMatch(
    html,
    /Buscar registro por nombre|name="telefono"|name="ubicacion"/,
  );
  assert.match(html, /Crear prospecto y coordinar visita/);
  assert.match(html, /preparar la cotización/);
});
test("derivación registra condiciones finales, sin secuencia de ofertas", () => {
  const html = dibujar({
    oportunidad: { estado: "visita" },
    opciones: ["derivar"],
  });
  assert.ok(html.includes('name="condiciones"'));
  assert.ok(html.includes('name="resumen"'));
  assert.ok(!html.includes("Oferta A"));
  assert.ok(!html.includes("Oferta B"));
});
test("recuperación exige aceptación/rechazo explícito y no representa instalación", () => {
  const ganada = dibujar({
    oportunidad: { estado: "recuperacion" },
    opciones: ["ganar"],
  });
  assert.ok(ganada.includes('name="aceptacion_confirmada"'));
  assert.ok(ganada.includes("No indica instalación realizada"));
  const perdida = dibujar({
    oportunidad: { estado: "recuperacion" },
    opciones: ["perder"],
  });
  assert.ok(perdida.includes('name="rechazo_confirmado"'));
  assert.ok(!perdida.includes('value="no_responde"'));
});
