import { crearConsultaVentas } from "./infrastructure/crearConsultaVentas.js";

export function componerVentas(cliente) {
  return crearConsultaVentas(cliente);
}
