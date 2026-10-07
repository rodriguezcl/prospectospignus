import { test } from "node:test";
import assert from "node:assert/strict";
import { unidadesAdicional, condicionesExtra } from "./unidadesAdicional.js";
test("una condición por unidad, conservación, crecimiento y reducción", () => {
  const extra = { cantidad: "2", unidades: ["bonificados", "bajos"] };
  assert.deepEqual(condicionesExtra(extra), {
    altos: 0,
    bajos: 1,
    bonificados: 1,
    telefonicos: 0,
  });
  assert.deepEqual(unidadesAdicional(extra, 3), ["bonificados", "bajos", ""]);
  const reducido = {
    ...extra,
    cantidad: 1,
    unidades: unidadesAdicional(extra, 1),
  };
  assert.deepEqual(condicionesExtra(reducido), {
    altos: 0,
    bajos: 0,
    bonificados: 1,
    telefonicos: 0,
  });
  assert.deepEqual(unidadesAdicional(reducido, 2), ["bonificados", ""]);
});
test("borradores anteriores válidos conservan condiciones y los inconsistentes exigen selección", () => {
  assert.deepEqual(
    unidadesAdicional({ cantidad: 2, bajos: 1, bonificados: 1 }),
    ["bajos", "bonificados"],
  );
  assert.deepEqual(unidadesAdicional({ cantidad: 2 }), ["", ""]);
  const unidades = unidadesAdicional({ cantidad: 1, bajos: 1, bonificados: 1 });
  assert.deepEqual(unidades, [""]);
  assert.throws(() => condicionesExtra({ cantidad: 1, unidades }), /Elegí/);
  assert.throws(
    () => condicionesExtra({ cantidad: 2, unidades: ["bajos"] }),
    /Elegí/,
  );
  assert.deepEqual(unidadesAdicional({ cantidad: 10000 }), []);
});
