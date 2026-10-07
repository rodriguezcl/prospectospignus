import { generarAlternativas } from "../domain/alternativas.js";
import { unidadesAdicional, condicionesExtra } from "./unidadesAdicional.js";
export function disponibilidadAdicional(parametros, extras) {
  const cache = new Map();
  function evaluar(estado) {
    try {
      generarAlternativas({
        ...parametros,
        distribucionManual: true,
        extras: Object.entries(estado)
          .filter(([, e]) => e.activo)
          .map(([item_id, e]) => ({
            item_id,
            cantidad: e.cantidad,
            ...condicionesExtra({
              ...e,
              unidades: unidadesAdicional(e).map((u) => u || "altos"),
            }),
          })),
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
        cache.set(clave, errorActual && condicion === "altos" ? null : error);
      }
      return cache.get(clave);
    },
  };
}
