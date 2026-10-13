import { validarRegistro } from "../domain/registro.js";
import { prepararVisitaInicial } from "../domain/visitaInicial.js";
export function crearGestionRegistros(repositorio) {
  return {
    listar: (filtros) => repositorio.listar(filtros),
    catalogos: () => repositorio.catalogos(),
    obtener: (id) => repositorio.obtener(id),
    historial: (id) => repositorio.historial(id),
    eliminar: (id, version, motivo) =>
      repositorio.eliminar(id, version, motivo),
    guardar: (id, version, entrada) =>
      repositorio.guardar(id, version, validarRegistro(entrada)),
    guardarConVisita: (id, entrada) =>
      repositorio.guardarConVisita(
        id,
        validarRegistro(entrada),
        prepararVisitaInicial(entrada),
      ),
  };
}
