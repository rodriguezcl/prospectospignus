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

test("catálogo nuevo: cotiza sin plantillas y respeta modalidad y adicionales habilitados", () => {
  const nuevo = {
    ...structuredClone(catalogo),
    esquema: 3,
  };
  nuevo.items[0].modalidad = "plan";
  nuevo.items[1].adicional_habilitado = true;
  assert.equal(
    opciones("catalogo", { catalogo: nuevo }).at(-1).total,
    "449999.00",
  );
  nuevo.items[1].adicional_habilitado = false;
  assert.throws(
    () => opciones("catalogo", { catalogo: nuevo }),
    /incompatible/,
  );
  assert.ok(opciones("catalogo", { catalogo: nuevo, extras: [] }).length);
  nuevo.items[0].modalidad = "pendiente";
  assert.throws(
    () => opciones("catalogo", { catalogo: nuevo, extras: [] }),
    /modalidad/,
  );
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

test("distribución manual: PIR bonificado y Bajo, magnéticos Bajo, sin alternativas automáticas", () => {
  const c = structuredClone(catalogo);
  c.items.push({ ...structuredClone(c.items[1]), id: "m" });
  const extras = [
    { item_id: "p", cantidad: 2, bonificados: 1, bajos: 1 },
    { item_id: "m", cantidad: 2, bajos: 2 },
  ];
  const manual = opciones("catalogo", {
    catalogo: c,
    extras,
    distribucionManual: true,
  });
  assert.equal(manual.length, 1);
  assert.equal(manual[0].total, "728743.80");
  assert.deepEqual(
    manual[0].seleccion.extras.map(({ altos, bajos, bonificados }) => ({
      altos,
      bajos,
      bonificados,
    })),
    [
      { altos: 0, bajos: 1, bonificados: 1 },
      { altos: 0, bajos: 2, bonificados: 0 },
    ],
  );
  assert.throws(
    () => opciones("bajo", { extras, catalogo: c, distribucionManual: true }),
    /margen/,
  );
  for (const e of [
    { cantidad: 2, bajos: 3 },
    { cantidad: 2, bajos: -1 },
    { cantidad: 2, bajos: "" },
    { cantidad: 2, bonificados: 0.5 },
    { cantidad: 2, altos: 0, bajos: 1 },
    { cantidad: 2, telefonicos: 1 },
  ])
    assert.throws(() =>
      opciones("catalogo", {
        distribucionManual: true,
        extras: [{ item_id: "p", ...e }],
      }),
    );
  assert.throws(
    () =>
      opciones("catalogo", {
        distribucionManual: true,
        subcategoria: "docta",
        extras: [extras[0]],
      }),
    /habilitadas/,
  );
});

test("distribución manual conserva packs por tarifa, permisos y valores predeterminados", () => {
  const c = structuredClone(catalogo);
  c.esquema = 7;
  c.items[0].modalidad = "plan";
  c.items[1].adicional_habilitado = true;
  c.items[1].precios_pack_2 = { bajo: "170000" };
  const calcular = (extra, mas = {}) =>
    opciones("catalogo", {
      catalogo: c,
      distribucionManual: true,
      extras: [{ item_id: "p", ...extra }],
      ...mas,
    })[0];
  assert.equal(calcular({ cantidad: 3, bajos: 2 }).total, "732227.71");
  assert.equal(calcular({ cantidad: 3, bajos: 2 }).packs[0].packs, 1);
  assert.equal(calcular({ cantidad: 2 }).seleccion.extras[0].altos, 2);
  assert.equal(
    calcular(
      { cantidad: 2, telefonicos: 2 },
      { nivel: "telefonico", telefonico: true },
    ).total,
    "226998.00",
  );
  c.items[0].modalidad = "kit";
  assert.equal(calcular({ cantidad: 2 }).seleccion.extras[0].telefonicos, 2);
  assert.throws(
    () => calcular({ cantidad: 2, bajos: 1 }),
    /composición|habilitadas/,
  );
});
