import { crearAcceso } from "./application/crearAcceso.js";
import { crearRepositorioAutenticacion } from "./infrastructure/crearRepositorioAutenticacion.js";

export function componerAcceso(cliente) {
  return cliente ? crearAcceso(crearRepositorioAutenticacion(cliente)) : null;
}
