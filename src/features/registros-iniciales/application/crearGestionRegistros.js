import { validarRegistro } from "../domain/registro.js";
// Puerto de persistencia: listar, catalogos, obtener, historial y guardar.
export function crearGestionRegistros(repositorio) {
  return {
    listar: (filtros) => repositorio.listar(filtros),
    catalogos: () => repositorio.catalogos(),
    obtener: (id) => repositorio.obtener(id),
    historial: (id) => repositorio.historial(id),
    guardar: (id, version, entrada) =>
      repositorio.guardar(id, version, validarRegistro(entrada)),
  };
}
