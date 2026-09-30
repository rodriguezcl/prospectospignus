import { validarActividad } from "../domain/actividad.js";
export function crearGestionAgenda(repositorio) {
  return {
    ...repositorio,
    guardar: (entrada) =>
      repositorio.guardar({
        ...entrada,
        datos: validarActividad(entrada.datos, entrada.accion),
      }),
  };
}
