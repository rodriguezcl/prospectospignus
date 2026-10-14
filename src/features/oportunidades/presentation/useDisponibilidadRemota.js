import { useEffect, useState } from "react";
import { requiereEvaluacionRemota } from "../domain/nivelesCotizacion.js";
import {
  evaluarLotes,
  prepararEvaluacionDisponibilidad,
} from "./evaluacionCotizacion.js";

export function useDisponibilidadRemota(
  gestion,
  oportunidad,
  referencia,
  parametros,
  extras,
) {
  const [estado, establecer] = useState(null);
  const activa = requiereEvaluacionRemota(referencia?.datos, parametros.kitId);
  const clave = activa
    ? JSON.stringify([
        referencia.version,
        referencia.datos.tipo_cambio?.id,
        parametros,
        extras,
      ])
    : "";
  useEffect(() => {
    if (!clave) return;
    let vigente = true;
    const temporizador = setTimeout(async () => {
      try {
        const preparada = prepararEvaluacionDisponibilidad(
          { ...parametros, catalogo: referencia.datos },
          extras,
        );
        const resultados = await evaluarLotes(
          gestion,
          oportunidad,
          referencia.version,
          preparada.selecciones,
        );
        if (vigente)
          establecer({ clave, disponibilidad: preparada.resolver(resultados) });
      } catch (error) {
        if (vigente) establecer({ clave, error: error.message });
      }
    }, 150);
    return () => {
      vigente = false;
      clearTimeout(temporizador);
    };
  }, [gestion, oportunidad, clave]);
  if (!activa) return null;
  if (estado?.clave !== clave)
    return {
      pendiente: true,
      errorActual: null,
      motivo: () => "Actualizando condiciones…",
    };
  return estado.error
    ? { errorActual: estado.error, motivo: () => estado.error }
    : estado.disponibilidad;
}
