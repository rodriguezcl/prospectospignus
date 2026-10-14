import { generarAlternativas } from "../domain/alternativas.js";
import { unidadesAdicional, condicionesExtra } from "./unidadesAdicional.js";
import { condicionesHabilitadas } from "../domain/nivelesCotizacion.js";
export function condicionPendiente(parametros) {
  const permitidas = condicionesHabilitadas(
    parametros.catalogo,
    parametros.nivel,
    parametros.subcategoria,
    parametros.telefonico,
  );
  return (
    ["altos", "bajos", "telefonicos", "bonificados"].find((c) =>
      permitidas.includes(c),
    ) || ""
  );
}
export function extrasParaCalculo(extras, pendiente) {
  return Object.entries(extras)
    .filter(([, e]) => e.activo)
    .map(([item_id, e]) => ({
      item_id,
      cantidad: e.cantidad,
      ...condicionesExtra(
        pendiente === undefined
          ? e
          : {
              ...e,
              unidades: unidadesAdicional(e).map((u) => u || pendiente),
            },
      ),
    }));
}
export function disponibilidadAdicional(parametros, extras) {
  const cache = new Map();
  function evaluar(estado) {
    try {
      generarAlternativas({
        ...parametros,
        distribucionManual: true,
        extras: extrasParaCalculo(estado, condicionPendiente(parametros)),
      });
      return null;
    } catch (error) {
      return error.message;
    }
  }
  const errorActual = evaluar(extras);
  return {
    errorActual,
    motivo(itemId, indice, condicion) {
      const unidades = unidadesAdicional(extras[itemId]);
      const clave = JSON.stringify([itemId, unidades[indice], condicion]);
      if (!cache.has(clave)) {
        unidades[indice] = condicion;
        const error = evaluar({
          ...extras,
          [itemId]: { ...extras[itemId], unidades },
        });
        // Permite reparar un borrador inválido de a una unidad. El cálculo final
        // continúa validando toda la composición antes de generar una propuesta.
        cache.set(
          clave,
          errorActual && condicion === condicionPendiente(parametros)
            ? null
            : error,
        );
      }
      return cache.get(clave);
    },
  };
}
