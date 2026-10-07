import { test } from "node:test";
import assert from "node:assert/strict";
import { disponibilidadAdicional } from "./disponibilidadAdicional.js";
const catalogo = {
  esquema: 7,
  familias: [{ id: "f", servicio: "alarma" }],
  items: [
    {
      id: "k",
      familia_id: "f",
      tipo: "kit",
      modalidad: "plan",
      precios: { catalogo: "150", bajo: "100", telefonico: "80" },
    },
    ...["p", "m"].map((id) => ({
      id,
      familia_id: "f",
      tipo: "adicional",
      adicional_habilitado: true,
      unidad: "unidad",
      kits_compatibles: [],
      precios: { alto: "40", bajo: "30", telefonico: "20" },
    })),
  ],
};
const parametros = {
  catalogo,
  familiaId: "f",
  kitId: "k",
  nivel: "catalogo",
  subcategoria: "sin_monitoreo",
};
const extra = (...unidades) => ({
  activo: true,
  cantidad: unidades.length,
  unidades,
});
test("bonificar recalcula otros productos; liberar margen vuelve a habilitarlos", () => {
  const extras = { p: extra("altos"), m: extra("altos") };
  assert.equal(
    disponibilidadAdicional(parametros, extras).motivo("m", 0, "bonificados"),
    null,
  );
  extras.p = extra("bonificados");
  const d = disponibilidadAdicional(parametros, extras);
  assert.match(d.motivo("m", 0, "bonificados"), /margen/);
  assert.equal(d.motivo("m", 0, "bajos"), null);
  assert.equal(d.motivo("p", 0, "bonificados"), null);
  extras.p = extra("altos");
  assert.equal(
    disponibilidadAdicional(parametros, extras).motivo("m", 0, "bonificados"),
    null,
  );
});
test("packs y piso se evalúan sin sumar unidades bonificadas a packs", () => {
  const c = structuredClone(catalogo);
  c.items[0].precios.catalogo = "130";
  c.items[1].precios_pack_2 = { alto: "40", bajo: "40" };
  const d = disponibilidadAdicional(
    { ...parametros, catalogo: c },
    { p: extra("bonificados", "altos", "altos", "altos") },
  );
  assert.equal(d.errorActual, null);
  // Piso 100 + 2 packs Bajo = 180. Alto tiene pack + individual: 190.
  // Cambiar una a Bajo: 130 + pack Alto 40 + Bajo 30 = 200, permitido.
  assert.equal(d.motivo("p", 1, "bajos"), null);
  assert.match(d.motivo("p", 1, "bonificados"), /margen/);
});
test("permisos, cantidades, cambios de nivel y reparación de borradores", () => {
  const extras = { p: extra("bonificados", "bonificados", "bonificados") };
  const d = disponibilidadAdicional(parametros, extras);
  assert.match(d.errorActual, /margen/);
  assert.equal(d.motivo("p", 0, "altos"), null);
  assert.match(d.motivo("p", 0, "bajos"), /margen/);
  assert.match(
    disponibilidadAdicional(
      { ...parametros, subcategoria: "docta" },
      { p: extra("altos") },
    ).motivo("p", 0, "bonificados"),
    /habilitadas/,
  );
  assert.match(
    disponibilidadAdicional(parametros, { p: extra("altos") }).motivo(
      "p",
      0,
      "telefonicos",
    ),
    /habilitadas/,
  );
  assert.equal(
    disponibilidadAdicional(
      { ...parametros, nivel: "telefonico", telefonico: true },
      { p: extra("altos") },
    ).motivo("p", 0, "telefonicos"),
    null,
  );
});

test("pendientes no bloquean la primera elección ni se convierten en precios elegidos", () => {
  const extras = { p: extra("", "") };
  const d = disponibilidadAdicional(parametros, extras);
  assert.equal(d.motivo("p", 0, "bonificados"), null);
  assert.deepEqual(extras.p.unidades, ["", ""]);
  extras.p = extra("bonificados", "");
  assert.match(
    disponibilidadAdicional(parametros, extras).motivo("p", 1, "bonificados"),
    /margen/,
  );
  assert.equal(
    disponibilidadAdicional(parametros, extras).motivo("p", 1, "bajos"),
    null,
  );
});
