import { validarOperacion } from "../domain/circuito.js";
export function crearGestionOportunidades(repositorio) {
  return {
    listar: repositorio.listar,
    prospectos: repositorio.prospectos,
    detalle: repositorio.detalle,
    equipo: repositorio.equipo,
    registros: repositorio.registros,
    disponibilidad: repositorio.disponibilidad,
    notificaciones: repositorio.notificaciones,
    leer: repositorio.leer,
    guardar: (entrada) => repositorio.guardar(validarOperacion(entrada)),
  };
}
