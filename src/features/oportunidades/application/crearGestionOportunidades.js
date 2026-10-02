import { validarOperacion } from "../domain/circuito.js";
export function crearGestionOportunidades(repositorio, referencias = {}) {
  return {
    listar: repositorio.listar,
    detalle: repositorio.detalle,
    equipo: repositorio.equipo,
    registros: repositorio.registros,
    disponibilidad: repositorio.disponibilidad,
    notificaciones: repositorio.notificaciones,
    leer: repositorio.leer,
    catalogo: referencias.catalogo,
    condiciones: referencias.condiciones,
    propuestas: repositorio.propuestas,
    guardarPropuesta: repositorio.guardarPropuesta,
    guardar: (entrada) => repositorio.guardar(validarOperacion(entrada)),
  };
}
