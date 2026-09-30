import { crearResumenInicio } from "./application/crearResumenInicio.js";
import { crearRepositorioResumen } from "./infrastructure/crearRepositorioResumen.js";

export const componerResumenInicio = (cliente) =>
  cliente ? crearResumenInicio(crearRepositorioResumen(cliente)) : null;
