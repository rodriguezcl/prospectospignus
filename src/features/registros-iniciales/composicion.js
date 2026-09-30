import { crearGestionRegistros } from "./application/crearGestionRegistros.js";
import { crearRepositorioRegistros } from "./infrastructure/crearRepositorioRegistros.js";
export function componerRegistros(cliente) {
  return cliente
    ? crearGestionRegistros(crearRepositorioRegistros(cliente))
    : null;
}
