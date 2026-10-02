import { crearGestionOportunidades } from "./application/crearGestionOportunidades.js";
import { crearRepositorioOportunidades } from "./infrastructure/crearRepositorioOportunidades.js";
export const componerOportunidades = (cliente, referencias) =>
  crearGestionOportunidades(crearRepositorioOportunidades(cliente), referencias);
