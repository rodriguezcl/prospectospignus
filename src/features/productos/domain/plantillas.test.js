import { test } from "node:test";
import assert from "node:assert/strict";
import { aplicarPlantilla, modificarCatalogo } from "./catalogo.js";

test("plantillas: copia independiente, conserva precios y rechaza mezclas de marca/servicio", () => {
  const producto = {
    id: "pir",
    marca_id: "garnet",
    servicio: "alarma",
    tipo: "adicional",
    estado: "activo",
  };
  const plantilla = {
    id: "esencial",
    nombre: "ESENCIAL",
    marca_id: "garnet",
    servicio: "alarma",
    variante: "CABLEADO",
    estado: "activo",
    incluidos: [{ item_id: "pir", cantidad: 2 }],
  };
  const datos = { items: [producto], tipos: [plantilla] };
  const oferta = {
    marca_id: "garnet",
    servicio: "alarma",
    modalidad: "kit",
    precios: { bajo: "100" },
    validado_tecnicamente: true,
  };
  const resultado = aplicarPlantilla(oferta, plantilla, datos);
  assert.deepEqual(resultado.incluidos, plantilla.incluidos);
  assert.equal(resultado.validado_tecnicamente, false);
  assert.deepEqual(resultado.precios, oferta.precios);
  assert.equal(resultado.modalidad, "kit");
  resultado.incluidos[0].cantidad = 3;
  assert.equal(plantilla.incluidos[0].cantidad, 2);
  for (const cambio of [
    { marca_id: "ajax" },
    { servicio: "camaras" },
    { estado: "inactivo" },
    { incluidos: [] },
  ])
    assert.throws(() =>
      aplicarPlantilla(oferta, { ...plantilla, ...cambio }, datos),
    );
  for (const cantidad of [0, -1, 1.5, 10000])
    assert.throws(() =>
      aplicarPlantilla(
        oferta,
        { ...plantilla, incluidos: [{ item_id: "pir", cantidad }] },
        datos,
      ),
    );
  assert.throws(() =>
    aplicarPlantilla(oferta, plantilla, {
      items: [{ ...producto, estado: "inactivo" }],
    }),
  );
  assert.throws(
    () => modificarCatalogo(datos, "items", producto, "eliminar"),
    /Plantilla/,
  );
});
