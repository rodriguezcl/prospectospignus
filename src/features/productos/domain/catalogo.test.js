import { test } from "node:test";
import assert from "node:assert/strict";
import { prepararCatalogo, modificarCatalogo } from "./catalogo.js";

test("adaptar conserva composición e identidades y deja pendientes los precios incompletos sin mutar el histórico", () => {
  const previo = {
    esquema: 2,
    plantillas_version: 1,
    marcas: [{ id: "m", nombre: "GARNET", estado: "activo" }],
    familias: [],
    tipos: [
      {
        id: "t",
        nombre: "INICIAL",
        marca_id: "m",
        incluidos: [{ item_id: "p", cantidad: 99 }],
      },
    ],
    items: [
      {
        id: "p",
        codigo: "PIR",
        nombre: "PIR",
        marca_id: "m",
        tipo: "adicional",
        estado: "activo",
        precios: { bajo: "123.456" },
        incluidos: [],
        kits_compatibles: [],
      },
      {
        id: "k",
        codigo: "KIT",
        nombre: "INICIAL",
        marca_id: "m",
        tipo: "kit",
        tipo_comercial_id: "t",
        modalidad: "plan",
        estado: "activo",
        incluidos: [{ item_id: "p", cantidad: 1 }],
        precios: { bajo: "999" },
      },
    ],
  };
  const original = structuredClone(previo);
  const actual = prepararCatalogo(previo);
  assert.equal(actual.esquema, 5);
  assert.equal("tipos" in actual, false);
  assert.equal("plantillas_version" in actual, false);
  assert.equal("tipo_comercial_id" in actual.items[1], false);
  assert.deepEqual(actual.items[1].incluidos, original.items[1].incluidos);
  assert.deepEqual(actual.items[1].precios, original.items[1].precios);
  assert.equal(actual.items[1].estado, "borrador");
  assert.deepEqual(previo, original);
  assert.deepEqual(prepararCatalogo(actual), actual);
  assert.throws(
    () => modificarCatalogo(actual, "items", actual.items[0], "eliminar"),
    /KIT/,
  );
  const sinOferta = modificarCatalogo(
    actual,
    "items",
    actual.items[1],
    "eliminar",
  );
  assert.equal(
    modificarCatalogo(sinOferta, "items", sinOferta.items[0], "eliminar").items
      .length,
    0,
  );
});
