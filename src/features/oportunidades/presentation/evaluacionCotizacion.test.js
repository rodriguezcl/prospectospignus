import { test } from "node:test";
import assert from "node:assert/strict";
import {
  alternativaEvaluada,
  evaluarLotes,
  prepararEvaluacionDisponibilidad,
  seleccionParaEvaluar,
} from "./evaluacionCotizacion.js";
import {
  nivelesCotizacion,
  requiereEvaluacionRemota,
} from "../domain/nivelesCotizacion.js";
import { generarAlternativas } from "../domain/alternativas.js";
import { precioUnitarioAdicional } from "./precioUnitarioAdicional.js";
import { totalConceptos } from "../domain/propuesta.js";
const catalogo = {
  esquema: 7,
  permisos_precios_version: 1,
  niveles_habilitados: ["catalogo", "alto"],
  familias: [{ id: "f", servicio: "alarma" }],
  items: [
    {
      id: "k",
      familia_id: "f",
      tipo: "kit",
      modalidad: "plan",
      precios: { catalogo: "150", alto: "140" },
      abonos: { alto: "90" },
    },
    {
      id: "p",
      familia_id: "f",
      tipo: "adicional",
      adicional_habilitado: true,
      unidad: "unidad",
      kits_compatibles: [],
      precios: { alto: "40" },
    },
  ],
};
const parametros = {
  catalogo,
  familiaId: "f",
  kitId: "k",
  nivel: "catalogo",
  nivelAbono: "alto",
  subcategoria: "con_monitoreo",
};
const extra = (...unidades) => ({
  activo: true,
  cantidad: unidades.length,
  unidades,
});
const simular = (seleccion) => {
  if (seleccion.extras.some((e) => e.bajos > 0))
    return { valida: false, error: "PROPUESTA_NIVEL" };
  return seleccion.extras.reduce((sum, e) => sum + e.bonificados, 0) > 2
    ? { valida: false, error: "PROPUESTA_BONIFICACION" }
    : { valida: true, detalle: { total_exacto: "150" } };
};

test("catálogo proyectado controla niveles y no usa Bajo oculto para calcular", () => {
  assert.deepEqual(nivelesCotizacion(catalogo, true), ["catalogo", "alto"]);
  assert.equal(requiereEvaluacionRemota(catalogo, "k"), true);
  assert.throws(
    () => generarAlternativas({ ...parametros, distribucionManual: true }),
    /Calculá nuevamente/,
  );
  assert.throws(
    () => seleccionParaEvaluar({ ...parametros, nivel: "bajo" }, {}),
    /habilitado/,
  );
  assert.throws(
    () => seleccionParaEvaluar({ ...parametros, nivelAbono: "medio" }, {}),
    /abono/,
  );
  assert.throws(
    () => seleccionParaEvaluar(parametros, { p: extra("bajos") }),
    /ya no está habilitado/,
  );
});
test("disponibilidad remota deduplica 999 unidades y recalcula bonificaciones sin tarifas ocultas", () => {
  const extras = { p: extra(...Array(999).fill("")) };
  const preparada = prepararEvaluacionDisponibilidad(parametros, extras);
  assert.equal(preparada.selecciones.length, 2);
  assert.deepEqual(extras.p.unidades, Array(999).fill(""));
  const segunda = prepararEvaluacionDisponibilidad(parametros, {
    p: extra("bonificados", "bonificados", ""),
  });
  const resultado = segunda.resolver(segunda.selecciones.map(simular));
  assert.equal(resultado.errorActual, null);
  assert.match(resultado.motivo("p", 2, "bonificados"), /margen/);
  assert.equal(resultado.motivo("p", 2, "altos"), null);
  assert.match(resultado.motivo("p", 2, "bajos"), /no habilitada/);
});
test("una selección revocada permite reparar cada unidad y confirmar exige corregir todas", () => {
  const extras = { p: extra("bajos", "bajos") };
  const preparada = prepararEvaluacionDisponibilidad(parametros, extras);
  const resultado = preparada.resolver(preparada.selecciones.map(simular));
  assert.match(resultado.errorActual, /rol/);
  assert.equal(resultado.motivo("p", 0, "altos"), null);
  assert.throws(
    () => seleccionParaEvaluar(parametros, extras),
    /ya no está habilitado/,
  );
  assert.doesNotThrow(() =>
    seleccionParaEvaluar(parametros, { p: extra("altos", "altos") }),
  );
});
test("catálogo con solo bonificación no inventa precio Alto para pendientes", () => {
  const soloCatalogo = {
    ...parametros,
    catalogo: { ...catalogo, niveles_habilitados: ["catalogo"] },
    subcategoria: "sin_monitoreo",
  };
  const preparada = prepararEvaluacionDisponibilidad(soloCatalogo, {
    p: extra(""),
  });
  assert.equal(preparada.selecciones[0].extras[0].bonificados, 1);
  assert.equal(preparada.selecciones[0].extras[0].altos, 0);
});
test("catálogo con Bajo local respeta revocación de Alto y permite Telefónico explícito", () => {
  const datos = structuredClone(catalogo);
  datos.niveles_habilitados = ["catalogo", "bajo", "telefonico"];
  datos.items[0].precios = { catalogo: "150", bajo: "100", telefonico: "80" };
  datos.items[1].precios = { bajo: "30", telefonico: "20" };
  assert.throws(
    () =>
      generarAlternativas({
        ...parametros,
        catalogo: datos,
        distribucionManual: true,
        extras: [{ item_id: "p", cantidad: 1, altos: 1 }],
      }),
    /habilitadas/,
  );
  const opcion = generarAlternativas({
    ...parametros,
    catalogo: datos,
    nivel: "telefonico",
    distribucionManual: true,
    extras: [{ item_id: "p", cantidad: 1, telefonicos: 1 }],
  })[0];
  assert.equal(opcion.total, "100.00");
  assert.equal(
    precioUnitarioAdicional(opcion.seleccion.extras[0], datos),
    "20.00",
  );
});
test("evaluación convierte exactos y packs a alternativa sin recalcular tarifas", () => {
  const seleccion = seleccionParaEvaluar(parametros, {
    p: extra("altos", "altos"),
  });
  const alternativa = alternativaEvaluada(
    {
      valida: true,
      detalle: {
        total_exacto: "221.123456789",
        extras: [
          {
            item_id: "p",
            packs: [
              { nivel: "alto", packs: 1, individuales: 0, ahorro: "9.00" },
            ],
          },
        ],
      },
    },
    seleccion,
  );
  assert.equal(alternativa.total, "221.12");
  assert.equal(totalConceptos([alternativa]), "221.12");
  assert.equal(alternativa.importe_exacto, "221.123456789");
  assert.equal(alternativa.packs[0].item_id, "p");
  assert.equal(alternativa.seleccion.nivel_abono, undefined);
});
test("evaluaciones se parten en lotes y rechazan respuestas de otra versión", async () => {
  const llamadas = [];
  const gestion = {
    evaluarSelecciones: async (entrada) => {
      llamadas.push(entrada);
      return {
        version: 9,
        resultados: entrada.selecciones.map(() => ({ valida: true })),
      };
    },
  };
  assert.equal(
    (await evaluarLotes(gestion, "o", 9, Array(501).fill({}))).length,
    501,
  );
  assert.deepEqual(
    llamadas.map((c) => c.selecciones.length),
    [500, 1],
  );
  await assert.rejects(
    () => evaluarLotes(gestion, "o", 10, [{}]),
    /Cambió el catálogo/,
  );
});
test("evaluaciones limitan bytes UTF-8 sin esperar llegar a 500 candidatas", async () => {
  const bytes = [];
  const gestion = {
    evaluarSelecciones: async (entrada) => {
      bytes.push(
        new TextEncoder().encode(JSON.stringify(entrada.selecciones))
          .byteLength,
      );
      return {
        version: 9,
        resultados: entrada.selecciones.map(() => ({ valida: true })),
      };
    },
  };
  const seleccion = { nombre: "á".repeat(400000) };
  assert.equal(
    (await evaluarLotes(gestion, "o", 9, [seleccion, seleccion])).length,
    2,
  );
  assert.equal(bytes.length, 2);
  assert.ok(bytes.every((peso) => peso < 1500000));
  await assert.rejects(
    () => evaluarLotes(gestion, "o", 9, [{ nombre: "á".repeat(800000) }]),
    /demasiados adicionales/,
  );
});
