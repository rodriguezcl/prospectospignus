import { test } from "node:test";
import assert from "node:assert/strict";
import { ofertaOfrecida, referenciaOfrecida } from "./ofertaOfrecida.js";
import { compararOfertas } from "./compararOfertas.js";

test("saltar de 1 a 4 compara con la ofrecida; al ofrecer 4 se reemplaza la referencia", () => {
  const seleccion = {
    familia_id: "f",
    kit_id: "k",
    subcategoria: "sin_monitoreo",
    nivel: "alto",
    extras: [{ item_id: "p", cantidad: "1", altos: 1 }],
  };
  const propuesta = (ordinal, total, fecha) => ({
    ciclo: 1,
    creado_en: fecha,
    detalle: {
      codigo: `PC-${ordinal}`,
      conceptos: [
        { seleccion, total_exacto: total, ordinal_declarado: ordinal },
      ],
    },
  });
  const primera = propuesta(1, "100.005", "2026-10-03T10:00:00Z");
  const cuarta = {
    ordinal: 4,
    seleccion: {
      ...seleccion,
      extras: [{ item_id: "p", cantidad: 1, bajos: 1 }],
    },
    total: "80.00",
  };
  const base = referenciaOfrecida([primera], 1, cuarta.seleccion);
  assert.equal(base.referencia.total, "100.01");
  assert.equal(compararOfertas(cuarta, base.referencia, []).importe, "20.01");
  const siguiente = propuesta(4, "80", "2026-10-03T11:00:00Z");
  assert.equal(
    referenciaOfrecida([primera, siguiente], 1, seleccion).referencia
      .codigoOfrecida,
    "PC-4",
  );
  assert.equal(referenciaOfrecida([primera], 2, seleccion).hayOfrecida, false);
  const distinta = { ...seleccion, extras: [] };
  assert.deepEqual(referenciaOfrecida([primera], 1, distinta), {
    hayOfrecida: true,
    referencia: null,
  });
  siguiente.detalle.conceptos.push({ ...siguiente.detalle.conceptos[0] });
  assert.equal(
    referenciaOfrecida([primera, siguiente], 1, seleccion).referencia,
    null,
  );
});

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
