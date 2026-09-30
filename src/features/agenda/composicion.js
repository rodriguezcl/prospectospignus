import { crearGestionAgenda } from "./application/crearGestionAgenda.js";
import { crearRepositorioAgenda } from "./infrastructure/crearRepositorioAgenda.js";
export const componerAgenda = (cliente) =>
  crearGestionAgenda(crearRepositorioAgenda(cliente));
