export const vencimientoPropuesta = (propuesta) => {
  const fecha = Date.parse(propuesta?.creado_en);
  return Number.isFinite(fecha) ? fecha + 5 * 24 * 60 * 60 * 1000 : null;
};
export const propuestaVencida = (propuesta, ahora = Date.now()) => {
  const vence = vencimientoPropuesta(propuesta);
  return vence === null || ahora >= vence;
};
