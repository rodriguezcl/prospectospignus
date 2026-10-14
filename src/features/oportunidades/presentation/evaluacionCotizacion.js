import { monedaReferencia } from "../../productos/reglas.js";
import {
  condicionesHabilitadas,
  validarNivelesSeleccion,
} from "../domain/nivelesCotizacion.js";
import {
  importeExacto,
  centavos,
  decimalCentavos,
  cuotasSinInteres,
} from "../domain/dinero.js";
import {
  condicionPendiente,
  extrasParaCalculo,
} from "./disponibilidadAdicional.js";
import { unidadesAdicional } from "./unidadesAdicional.js";

export function seleccionParaEvaluar(parametros, extras, completar = false) {
  const { catalogo, familiaId, kitId, nivel, subcategoria, nivelAbono } =
    parametros;
  const adicionales = extrasParaCalculo(
    extras,
    completar ? condicionPendiente(parametros) : undefined,
  );
  const seleccion = {
    familia_id: familiaId,
    kit_id: kitId,
    nivel,
    subcategoria,
    extras: adicionales,
    ...(subcategoria === "con_monitoreo" ? { nivel_abono: nivelAbono } : {}),
    ...(adicionales.some(
      (e) =>
        monedaReferencia(
          catalogo,
          catalogo.items.find((i) => i.id === e.item_id),
        ) === "USD",
    )
      ? { tipo_cambio_id: catalogo.tipo_cambio?.id }
      : {}),
  };
  // Las candidatas pueden contener otras unidades revocadas: el servidor las
  // rechaza, pero la disponibilidad conserva la reparación de a una unidad.
  validarNivelesSeleccion(
    catalogo,
    completar ? { ...seleccion, extras: [] } : seleccion,
    parametros.telefonico,
  );
  return seleccion;
}

const mensajes = {
  PROPUESTA_NIVEL: "El nivel seleccionado ya no está habilitado para tu rol.",
  PROPUESTA_BONIFICACION:
    "La bonificación o los descuentos superan el margen permitido del plan.",
  PROPUESTA_PRECIO:
    "Administración debe completar los precios de esta composición.",
  PROPUESTA_COMPOSICION: "Revisá el plan o kit y sus adicionales compatibles.",
  PROPUESTA_CANTIDAD: "Revisá las cantidades de los adicionales.",
  PROPUESTA_UBICACION:
    "La marca o el plan/kit no está habilitado para esta ubicación.",
  PROPUESTA_DOLAR: "Actualizá la cotización del dólar y calculá nuevamente.",
};
export const errorEvaluacion = (resultado) =>
  resultado?.valida
    ? null
    : mensajes[resultado?.error] ||
      "No se pudieron validar estas condiciones. Volvé a calcular.";

// Sólo cambia condiciones, sin consultar ni reconstruir precios ocultos del catálogo.
export function prepararEvaluacionDisponibilidad(parametros, extras) {
  const selecciones = [],
    indices = new Map();
  const agregar = (estado) => {
    const seleccion = seleccionParaEvaluar(parametros, estado, true);
    const clave = JSON.stringify(seleccion);
    if (!indices.has(clave)) {
      indices.set(clave, selecciones.length);
      selecciones.push(seleccion);
    }
    return indices.get(clave);
  };
  const actual = agregar(extras),
    opciones = new Map();
  const condiciones = condicionesHabilitadas(
    parametros.catalogo,
    parametros.nivel,
    parametros.subcategoria,
    parametros.telefonico,
  );
  for (const [itemId, extra] of Object.entries(extras).filter(
    ([, e]) => e.activo,
  )) {
    const originales = unidadesAdicional(extra);
    for (const anterior of new Set(originales)) {
      const indice = originales.indexOf(anterior);
      for (const condicion of condiciones) {
        const unidades = [...originales];
        unidades[indice] = condicion;
        opciones.set(
          JSON.stringify([itemId, anterior, condicion]),
          agregar({
            ...extras,
            [itemId]: { ...extra, unidades },
          }),
        );
      }
    }
  }
  return {
    selecciones,
    resolver(resultados) {
      const errorActual = errorEvaluacion(resultados[actual]);
      return {
        errorActual,
        motivo(itemId, indice, condicion) {
          const anterior = unidadesAdicional(extras[itemId])[indice];
          const indiceResultado = opciones.get(
            JSON.stringify([itemId, anterior, condicion]),
          );
          if (indiceResultado === undefined)
            return "Condición no habilitada para tu rol.";
          // Mantiene la vía de reparación unidad a unidad del cotizador local.
          if (errorActual && condicion === condicionPendiente(parametros))
            return null;
          return errorEvaluacion(resultados[indiceResultado]);
        },
      };
    },
  };
}

export async function evaluarLotes(
  gestion,
  oportunidad,
  catalogo,
  selecciones,
) {
  const resultados = [];
  const lotes = [];
  let lote = [],
    bytes = 2;
  const codificador = new TextEncoder();
  for (const seleccion of selecciones) {
    const peso = codificador.encode(JSON.stringify(seleccion)).byteLength + 1;
    if (peso > 1500000)
      throw new Error(
        "La cotización tiene demasiados adicionales para evaluarse. Reducí la selección.",
      );
    if (lote.length && (lote.length === 500 || bytes + peso > 1500000)) {
      lotes.push(lote);
      lote = [];
      bytes = 2;
    }
    lote.push(seleccion);
    bytes += peso;
  }
  if (lote.length) lotes.push(lote);
  for (const seleccionesLote of lotes) {
    const respuesta = await gestion.evaluarSelecciones({
      oportunidad,
      catalogo,
      selecciones: seleccionesLote,
    });
    if (
      respuesta.version !== catalogo ||
      !Array.isArray(respuesta.resultados) ||
      respuesta.resultados.length !== seleccionesLote.length
    )
      throw new Error("Cambió el catálogo. Actualizá y calculá nuevamente.");
    resultados.push(...respuesta.resultados);
  }
  return resultados;
}

export function alternativaEvaluada(resultado, seleccion) {
  const error = errorEvaluacion(resultado);
  if (error) throw new Error(error);
  const detalle = resultado.detalle;
  if (
    typeof detalle?.total_exacto !== "string" ||
    !/^\d+(\.\d{1,9})?$/.test(detalle.total_exacto)
  )
    throw new Error("No se pudo validar el importe de esta cotización.");
  const [entero, decimales = ""] = detalle.total_exacto.split(".");
  const exacto = `${entero}.${decimales.padEnd(9, "0")}`;
  const total = decimalCentavos(
    (BigInt(exacto.replace(".", "")) + 5000000n) / 10000000n,
  );
  const importe = centavos(importeExacto(total));
  const { nivel_abono: _abono, ...seleccionPrecios } = seleccion;
  return {
    ordinal: 1,
    total,
    importe_exacto: exacto,
    efectivo: decimalCentavos(importe - (importe + 5n) / 10n),
    cuotas3: cuotasSinInteres(importe, 3),
    cuotas6: cuotasSinInteres(importe, 6),
    seleccion: seleccionPrecios,
    packs: (detalle.extras || []).flatMap((e) =>
      (e.packs || []).map((p) => ({ ...p, item_id: e.item_id })),
    ),
  };
}
