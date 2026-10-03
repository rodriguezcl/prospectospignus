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

test("cotización: comienza desde el contacto sin exigir ni simular una visita", () => {
  const html = dibujar({
    iniciarSinVisita: true,
    registroSeleccionado: { id: "contacto" },
  });
  assert.match(html, /Preparar cotización/);
  assert.match(html, /Servicio de interés/);
  assert.match(html, /name="vendedor_id"/);
  assert.doesNotMatch(
    html,
    /name="plazo"|name="contacto_confirmado"|name="telefono"/,
  );
});

test("formularios: calificación exige respuesta humana, vendedor y horario de Córdoba", () => {
  const html = dibujar({});
  for (const campo of [
    "registro_id",
    "contacto_confirmado",
    "canal_contacto",
    "vendedor_id",
    "plazo",
    "observaciones",
  ])
    assert.ok(html.includes(`name="${campo}"`));
  assert.ok(html.includes("Córdoba"));
});

test("alta: servicios desplegables y observaciones opcionales, sin pedir evidencia", () => {
  const html = dibujar({});
  assert.match(html, /Servicio de interés/);
  assert.match(html, /Instalación de Alarma/);
  assert.match(html, /Agregar otro servicio/);
  assert.doesNotMatch(
    html,
    /Evidencia del contacto|name="necesidad"|name="resumen"/,
  );
  const nota = html.match(/<textarea[^>]*name="observaciones"[^>]*>/)[0];
  assert.doesNotMatch(nota, /required|minLength/);
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
  for (const campo of [
    "objecion",
    "contacto_preferido",
    "decision_pendiente",
    "plazo",
  ])
    assert.match(html, new RegExp(`name="${campo}"`));
  assert.match(html, /24 horas/);
  assert.match(html, /48 horas si así lo acordaron/);
});
test("derivación preselecciona solo ofertas del ciclo actual y adjunta sus importes", () => {
  const html = dibujar({
    oportunidad: {
      estado: "seguimiento",
      ciclo: 2,
      propuestas: [
        {
          id: "vieja",
          ciclo: 1,
          detalle: { codigo: "VIEJA", total: "999", abono: null },
        },
        {
          id: "ofrecida",
          ciclo: 2,
          detalle: {
            codigo: "PC-OFRECIDA",
            total: "120",
            abono: "30",
            pago: { medio_saldo: "credito" },
          },
        },
      ],
    },
    opciones: ["derivar"],
  });
  assert.doesNotMatch(html, /VIEJA/);
  assert.match(html, /value="ofrecida" selected/);
  assert.match(html, /Propuesta ofrecida PC-OFRECIDA/);
  assert.match(html, /Pago: credito/);
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
