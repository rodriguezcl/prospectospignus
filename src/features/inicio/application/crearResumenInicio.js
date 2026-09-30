import { validarMes, resumirMes } from "../domain/resumen.js";

export function crearResumenInicio(repositorio) {
  return {
    async cargar(mes) {
      validarMes(mes);
      const { registros, perfiles, origenes } = await repositorio.cargar(mes);
      return {
        registros,
        perfiles,
        origenes,
        resumen: resumirMes(mes, registros),
      };
    },
  };
}
