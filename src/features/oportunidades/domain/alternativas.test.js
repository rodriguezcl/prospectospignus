import { test } from "node:test";
import assert from "node:assert/strict";
import { generarAlternativas } from "./alternativas.js";
const catalogo = {
  familias: [{ id: "f", servicio: "alarma" }],
  items: [
    {
      id: "k",
      familia_id: "f",
      tipo: "kit",
      precios: {
        catalogo: "449999",
        alto: "359999",
        medio: "259999",
        bajo: "149999",
        telefonico: "53000",
      },
    },
    {
      id: "p",
      familia_id: "f",
      tipo: "adicional",
      unidad: "unidad",
      kits_compatibles: [],
      precios: { alto: "112228.71", bajo: "92914.932", telefonico: "86999" },
    },
  ],
};
const opciones = (nivel, extra = {}) =>
  generarAlternativas({
    catalogo,
    familiaId: "f",
    kitId: "k",
    nivel,
    extras: [{ item_id: "p", cantidad: 2 }],
    ...extra,
  });
test("alternativas AXPRO conservan bolsa, piso y efectivo acumulable", () => {
  assert.equal(opciones("catalogo")[0].total, "674456.42");
  for (const [nivel, total] of [
    ["catalogo", "449999.00"],
    ["alto", "359999.00"],
    ["medio", "352913.93"],
    ["bajo", "335828.86"],
  ])
    assert.equal(opciones(nivel).at(-1).total, total);
  assert.equal(opciones("alto").at(-1).efectivo, "323999.10");
  assert.throws(() => opciones("telefonico"), /habilitado/);
  assert.equal(
    opciones("telefonico", { telefonico: true }).at(-1).total,
    "226998.00",
  );
});
test("Docta no cobra kit, no libera bolsa; cantidades incompatibles se rechazan", () => {
  assert.equal(
    opciones("catalogo", { subcategoria: "docta", extras: [] })[0].total,
    "0.00",
  );
  assert.ok(
    opciones("catalogo", { subcategoria: "docta" }).every(
      (x) => x.seleccion.extras[0].bonificados === 0,
    ),
  );
  assert.throws(
    () => opciones("alto", { extras: [{ item_id: "p", cantidad: 1.5 }] }),
    /Cantidad/,
  );
  assert.throws(
    () => opciones("alto", { extras: [{ item_id: "p", cantidad: 9999 }] }),
    /parcial/,
  );
});
