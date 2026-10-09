import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
const compilado = buildSync({
  entryPoints: [fileURLToPath(new URL("./AgendaPagina.jsx", import.meta.url))],
  bundle: true,
  write: false,
  platform: "node",
  format: "cjs",
  jsx: "automatic",
  loader: { ".css": "empty" },
  external: ["react", "react/jsx-runtime", "react-router-dom"],
});
const modulo = { exports: {} };
new Function("require", "module", "exports", compilado.outputFiles[0].text)(
  createRequire(import.meta.url),
  modulo,
  modulo.exports,
);
const { AgendaPagina, FormularioActividad, TimelineDia } = modulo.exports;
const render = (componente) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, componente));

test("agenda: contexto, resultado y asociación opcional sin duplicar prospectos", () => {
  const formulario = (accion, actividad) =>
    render(
      createElement(FormularioActividad, {
        seleccion: { accion, actividad },
        gestion: {},
      }),
    );
  const nueva = formulario("crear");
  assert.match(nueva, /Lugar y detalle de la actividad/);
  assert.match(nueva, /Actividad general sin contacto/);
  assert.ok(!nueva.includes('name="resultado"'));
  assert.ok(nueva.includes("Buscar prospecto por nombre o teléfono"));
  assert.match(nueva, /no requiere cotización/);
  const directo = formulario("editar", {
    estado: "programada",
    registro_id: "contacto-interno",
  });
  assert.match(directo, /Prospecto asociado a esta actividad/);
  assert.ok(!directo.includes("contacto-interno"));
  for (const accion of ["finalizar", "corregir"]) {
    const html = formulario(accion, { estado: "realizada" });
    assert.match(html, /Resultado de la actividad/);
    assert.match(html, /name="resultado"/);
    assert.match(html, /Para registrar una venta/);
  }
  const existente = formulario("editar", {
    estado: "programada",
    oportunidad_id: "identificador-interno",
  });
  assert.match(existente, /Negociación asociada a esta actividad/);
  assert.match(existente, />Cambiar</);
  assert.match(existente, />Quitar</);
  assert.ok(!existente.includes("identificador-interno"));
  assert.match(
    existente,
    /No crea una cotización ni cambia su estado comercial/,
  );
});
test("agenda: roles, formulario accesible y planificación no equivale a ejecución", () => {
  for (const rol of ["administrador", "vendedor", "agente"]) {
    const html = render(
      createElement(AgendaPagina, {
        gestion: {},
        perfil: { id: "1", rol, activo: true },
      }),
    );
    assert.equal(html.includes("Registrar actividad"), rol === "vendedor");
    assert.equal(html.includes("Timeline del equipo"), rol === "administrador");
    assert.equal(
      html.includes("Actualización cada 30 segundos"),
      rol !== "agente",
    );
  }
  const form = render(
    createElement(FormularioActividad, {
      seleccion: { accion: "crear" },
      gestion: {},
    }),
  );
  for (const nombre of [
    "titulo",
    "tipo",
    "nota",
    "inicio_previsto",
    "fin_previsto",
  ])
    assert.ok(form.includes(`name="${nombre}"`));
  const html = render(
    createElement(TimelineDia, {
      dia: "2026-09-30",
      ahora: new Date("2026-09-30T20:00:00Z"),
      vendedor: false,
      filas: [
        {
          id: "1",
          titulo: "Visita cliente",
          tipo: "visita",
          estado: "programada",
          origen: "manual",
          inicio_previsto: "2026-09-30T12:00:00Z",
          creado_en: "2026-09-29T12:00:00Z",
          actualizado_en: "2026-09-29T12:00:00Z",
        },
      ],
    }),
  );
  assert.ok(html.includes("Pendiente de actualizar"));
  assert.ok(html.includes("0 realizadas"));
  assert.ok(!html.includes(">Iniciar<"));
  assert.ok(!html.includes(">Finalizar<"));
});
