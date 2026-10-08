import { validarOperacion } from "../domain/circuito.js";
export function crearGestionOportunidades(repositorio, referencias = {}) {
  return {
    contactos: repositorio.contactos,
    atencion: repositorio.atencion,
    tomarProspecto: repositorio.tomarProspecto,
    listar: repositorio.listar,
    detalle: repositorio.detalle,
    equipo: repositorio.equipo,
    registros: repositorio.registros,
    contextoRegistro: repositorio.contextoRegistro,
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
