import { test } from "node:test";
import assert from "node:assert/strict";
import { ofertaOfrecida } from "./ofertaOfrecida.js";

test("Ofrecida requiere una propuesta persistida con composición, ciclo y condiciones coincidentes", () => {
  const seleccion = {
    familia_id: "f",
    kit_id: "k",
    subcategoria: "con_monitoreo",
    nivel: "alto",
    extras: [{ item_id: "p", cantidad: "1", altos: 1 }],
  };
  const alternativa = { seleccion };
  const contexto = {
    ciclo: 2,
    catalogo: 4,
    condiciones: 1,
    nivelAbono: "alto",
    meses: 4,
  };
  const p = {
    ciclo: 2,
    catalogo_version: 4,
    condiciones_version: 1,
    detalle: {
      conceptos: [{ seleccion, nivel_abono: "alto", meses_congelamiento: 4 }],
    },
  };
  assert.equal(ofertaOfrecida(alternativa, [], contexto), false);
  assert.equal(ofertaOfrecida(alternativa, [p], contexto), true);
  for (const cambio of [
    { ciclo: 3 },
    { catalogo: 5 },
    { condiciones: 2 },
    { nivelAbono: "bajo" },
    { meses: 6 },
  ])
    assert.equal(
      ofertaOfrecida(alternativa, [p], { ...contexto, ...cambio }),
      false,
    );
  const otra = structuredClone(alternativa);
  otra.seleccion.extras[0].altos = 0;
  otra.seleccion.extras[0].bajos = 1;
  assert.equal(ofertaOfrecida(otra, [p], contexto), false);
});
