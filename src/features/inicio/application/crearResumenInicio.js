import { validarMes, resumirMes } from "../domain/resumen.js";

export function crearResumenInicio(repositorio) {
  return {
    async cargarTablero(mes, responsable = "") {
      validarMes(mes);
      const [datos, oportunidades, ventas] = await Promise.all([
        repositorio.cargar(mes),
        repositorio.oportunidades(),
        repositorio.ventas(mes, responsable),
      ]);
      return {
        ...datos,
        oportunidades,
        ventas,
        corte: new Date().toISOString(),
      };
    },
    async cargar(mes) {
      validarMes(mes);
      const {
        registros,
        perfiles,
        origenes,
        historico = [],
      } = await repositorio.cargar(mes);
      return {
        registros,
        perfiles,
        origenes,
        historico,
        resumen: resumirMes(mes, registros),
      };
    },
  };
}
