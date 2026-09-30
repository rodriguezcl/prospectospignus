import { test } from "node:test";
import assert from "node:assert/strict";
import { validarPromocion, validarArchivo, vigencia } from "./promocion.js";
import { crearGestionPromociones } from "../application/crearGestionPromociones.js";
import { combinarAvisos } from "../../../app/configuracion/combinarAvisos.js";
test("promociones: valida condiciones, destinatarios y fechas reales", () => {
  const datos = {
    titulo: "Oferta",
    descripcion: "Descripción",
    condiciones: "Con instalación",
    destinatarios: "agente",
    desde: "2026-09-01",
    hasta: "2026-09-30",
  };
  assert.equal(validarPromocion(datos).destinatarios, "agente");
  for (const cambio of [
    { hasta: "2026-02-30" },
    { hasta: "2025-09-01" },
    { condiciones: "" },
    { destinatarios: "todos" },
  ])
    assert.throws(() => validarPromocion({ ...datos, ...cambio }));
  assert.equal(
    vigencia({ ...datos, estado: "publicada" }, "2026-09-30"),
    "Vigente",
  );
  assert.equal(
    vigencia({ ...datos, estado: "publicada" }, "2026-10-01"),
    "Vencida",
  );
  assert.equal(
    vigencia({ ...datos, estado: "publicada" }, "2026-08-31"),
    "Próximamente",
  );
});
test("archivos: límites, MIME y firma; nunca admite SVG o ejecutables", () => {
  const pdf = { name: "oferta.pdf", type: "application/pdf", size: 40 },
    firma = new TextEncoder().encode("%PDF-1.7");
  validarArchivo(pdf, firma);
  for (const cambios of [
    { size: 0 },
    { size: 20971521 },
    { type: "image/svg+xml" },
    { name: "../oferta.pdf" },
  ])
    assert.throws(() => validarArchivo({ ...pdf, ...cambios }, firma));
  assert.throws(() => validarArchivo(pdf, new TextEncoder().encode("<html>")));
  validarArchivo(
    { name: "oferta.png", type: "image/png", size: 40 },
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
  );
});
test("archivos: reserva, sube y confirma; una falla no confirma ni publica", async () => {
  const llamadas = [];
  const repositorio = {
    guardar: async () => llamadas.push("reserva"),
    subir: async () => {
      llamadas.push("subida");
      throw new Error("sin red");
    },
    confirmar: async () => llamadas.push("confirmacion"),
  };
  const archivo = new File(["%PDF-1.7 contenido"], "oferta.pdf", {
    type: "application/pdf",
  });
  await assert.rejects(
    crearGestionPromociones(repositorio).subir(
      { id: "promo", version: 1 },
      archivo,
    ),
    /sin red/,
  );
  assert.deepEqual(llamadas, ["reserva", "subida"]);
});
test("campana: combina destinos sin colisiones y marca el aviso correcto", async () => {
  const leidos = [];
  const g = combinarAvisos(
    {
      notificaciones: async () => [
        { id: 1, oportunidad_id: "caso", creado_en: "2026-09-01" },
      ],
      leer: async (id) => leidos.push(`caso:${id}`),
    },
    {
      notificaciones: async () => [
        { id: 1, promocion_id: "promo", creado_en: "2026-09-02" },
      ],
      leer: async (id) => leidos.push(`promo:${id}`),
    },
  );
  const avisos = await g.notificaciones();
  assert.equal(avisos[0].destino, "/promociones?id=promo");
  assert.notEqual(avisos[0].id, avisos[1].id);
  await g.leer(avisos[0].id);
  assert.deepEqual(leidos, ["promo:1"]);
});
