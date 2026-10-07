import { test } from "node:test";
import assert from "node:assert/strict";
import { prepararUbicaciones, ofertaEnUbicacion } from "./ubicaciones.js";
import { generarAlternativas } from "../../oportunidades/domain/alternativas.js";
test("ubicaciones: herencia inicial, intersección y arrays vacíos conservados", () => {
  const datos = {
    esquema: 7,
    marcas: [
      { id: "h", nombre: "HIKVISION" },
      { id: "g", nombre: "GARNET HIBRIDO" },
    ],
    familias: [{ id: "f", servicio: "alarma", marca_id: "h" }],
    items: [
      {
        id: "k",
        marca_id: "h",
        familia_id: "f",
        servicio: "alarma",
        tipo: "kit",
        modalidad: "kit",
        precios: { telefonico: "100" },
      },
    ],
  };
  const d = prepararUbicaciones(datos);
  assert.deepEqual(d.marcas[0].ubicaciones_alarma, [
    "con_monitoreo",
    "sin_monitoreo",
  ]);
  assert.equal(d.marcas[1].ubicaciones_alarma.length, 4);
  assert.equal(ofertaEnUbicacion(d, d.items[0], "docta"), false);
  assert.throws(
    () =>
      generarAlternativas({
        catalogo: d,
        familiaId: "f",
        kitId: "k",
        subcategoria: "docta",
      }),
    /ubicación/,
  );
  const opcion = generarAlternativas({
    catalogo: d,
    familiaId: "f",
    kitId: "k",
    subcategoria: "con_monitoreo",
  })[0];
  assert.equal(opcion.seleccion.subcategoria, null);
  assert.equal(opcion.seleccion.ubicacion_alarma, "con_monitoreo");
  d.items[0].ubicaciones_alarma = ["sin_monitoreo"];
  assert.equal(ofertaEnUbicacion(d, d.items[0], "con_monitoreo"), false);
  d.marcas[0].ubicaciones_alarma = [];
  assert.equal(
    ofertaEnUbicacion(prepararUbicaciones(d), d.items[0], "sin_monitoreo"),
    false,
  );
  assert.equal(datos.marcas[0].ubicaciones_alarma, undefined);
});
