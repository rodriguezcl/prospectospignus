import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { buildSync } from "esbuild";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { menu } from "../src/app/navegacion/menu.js";

function cargar(ruta) {
  const resultado = buildSync({
    entryPoints: [fileURLToPath(new URL(ruta, import.meta.url))],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    jsx: "automatic",
    loader: { ".css": "empty" },
    external: ["react", "react/jsx-runtime", "react-router-dom"],
  });
  const modulo = { exports: {} };
  new Function("require", "module", "exports", resultado.outputFiles[0].text)(
    createRequire(import.meta.url),
    modulo,
    modulo.exports,
  );
  return modulo.exports;
}
const dibujar = (Componente, props) =>
  renderToStaticMarkup(h(MemoryRouter, null, h(Componente, props)));
const { MenuLateral } = cargar("../src/shared/ui/navegacion/MenuLateral.jsx");
const { UsuariosPagina } = cargar(
  "../src/features/usuarios/presentation/UsuariosPagina.jsx",
);
const { OportunidadesPagina } = cargar(
  "../src/features/oportunidades/presentation/OportunidadesPagina.jsx",
);
const { FilasVentas } = cargar(
  "../src/features/ventas/presentation/VentasPagina.jsx",
);
const { CasosDelRegistro } = cargar(
  "../src/features/oportunidades/presentation/ContinuarRegistro.jsx",
);
const { CrearProspecto } = cargar(
  "../src/features/oportunidades/presentation/CrearProspecto.jsx",
);

test("recorrido: abrir un prospecto existente conserva identidad y necesidad", () => {
  const html = dibujar(CasosDelRegistro, {
    casos: [
      { id: "caso-1", necesidad: "Alarma vivienda", estado: "ganada" },
      { id: "caso-2", necesidad: "Cámaras comercio", estado: "visita" },
    ],
  });
  assert.match(html, /href="\/prospectos\?id=caso-1"/);
  assert.match(html, /Abrir prospecto: Alarma vivienda/);
  assert.match(html, /Ganada/);
  assert.match(html, /href="\/prospectos\?id=caso-2"/);
});
test("recorrido: alta desde Prospectos ofrece búsqueda, no duplicación de contacto", () => {
  const html = dibujar(CrearProspecto, {
    gestion: {},
    perfil: { id: "v", rol: "vendedor" },
    equipo: [],
    guardar: () => {},
  });
  assert.match(html, /Crear prospecto desde un registro inicial/);
  assert.match(html, /Buscar contacto por nombre/);
  assert.doesNotMatch(html, /name="telefono"/);
});

test("simpleza: menú conserva rutas y límites por rol; solo pendientes se pliegan", () => {
  for (const rol of ["administrador", "vendedor", "agente"]) {
    const grupos = menu
      .filter((g) => !g.soloAdministrador || rol === "administrador")
      .map((g) => ({
        ...g,
        elementos: g.elementos.filter((e) => !e.roles || e.roles.includes(rol)),
      }));
    const html = dibujar(MenuLateral, { grupos, abierto: true });
    assert.equal(html.includes('href="/usuarios"'), rol === "administrador");
    assert.equal(html.includes('href="/agenda"'), rol !== "agente");
    assert.equal(html.includes('href="/recuperacion"'), rol !== "vendedor");
    assert.equal(
      html.includes('class="menu-secundario"'),
      rol === "administrador",
    );
    assert.ok(!html.includes("<details open"));
    assert.ok(html.includes('href="/prospectos"'));
  }
});
test("simpleza: alta de cuenta a demanda sin perder validación ni gestión", () => {
  const html = dibujar(UsuariosPagina, { gestion: {} });
  assert.match(
    html,
    /<details class="detalle-secundario"><summary>Crear cuenta<\/summary>/,
  );
  assert.match(html, /minLength="10"/);
  assert.match(html, /Cuentas del equipo/);
  assert.match(html, /Permisos y eliminación/);
});
test("simpleza: todos los roles conservan alta directa y ayuda accesible en Prospectos", () => {
  for (const rol of ["administrador", "vendedor", "agente"]) {
    const html = dibujar(OportunidadesPagina, {
      gestion: {},
      perfil: { id: rol, rol },
    });
    assert.match(html, /href="\/registros\?nuevo=1"/);
    assert.match(html, /<summary>Cómo funciona esta bandeja<\/summary>/);
    assert.equal(
      html.includes("Disponible para recibir recuperaciones"),
      rol === "agente",
    );
  }
});
test("simpleza: venta compacta preserva condiciones, atribución y confirmación", () => {
  const html = dibujar(FilasVentas, {
    filas: [
      {
        id: "venta",
        nombre: "Contacto",
        necesidad: "Vivienda",
        condiciones: "Condición acordada",
        vendedor_visita_nombre: "Vendedor",
        canal_confirmacion: "Presencial",
      },
    ],
  });
  assert.equal((html.match(/<td/g) || []).length, 5);
  assert.match(html, /<summary>Condiciones y confirmación<\/summary>/);
  assert.match(html, /Condición acordada/);
  assert.match(html, /Vendedor de visita: Vendedor/);
  assert.match(html, /Presencial/);
  assert.match(html, /\/prospectos\?id=venta/);
});
