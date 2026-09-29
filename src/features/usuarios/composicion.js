import { crearGestionUsuarios } from "./application/crearGestionUsuarios.js";
import { crearRepositorioUsuarios } from "./infrastructure/crearRepositorioUsuarios.js";
export function componerUsuarios(cliente) {
  return cliente
    ? crearGestionUsuarios(crearRepositorioUsuarios(cliente))
    : null;
}
