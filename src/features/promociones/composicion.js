import { crearGestionPromociones } from "./application/crearGestionPromociones.js";
import { crearRepositorioPromociones } from "./infrastructure/crearRepositorioPromociones.js";
export const componerPromociones = (cliente) =>
  crearGestionPromociones(crearRepositorioPromociones(cliente));
