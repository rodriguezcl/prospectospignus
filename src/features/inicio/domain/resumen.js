export function validarMes(mes) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(mes))
    throw new Error("Elegí un mes válido entre 2000 y 2099.");
  return mes;
}

export function seleccionarRegistros(registros, filtro) {
  if (!filtro) return registros;
  if (filtro.campo === "demostracion")
    return registros.filter((r) => !!r.lote_demostracion);
  if (filtro.campo === "reales")
    return registros.filter((r) => !r.lote_demostracion);
  return registros.filter((r) => r[filtro.campo] === filtro.valor);
}

export function resumirMes(mes, registros) {
  validarMes(mes);
  const dias = new Date(
    Date.UTC(Number(mes.slice(0, 4)), Number(mes.slice(5)), 0),
  ).getUTCDate();
  const porDia = Array.from({ length: dias }, (_, i) => ({
    valor: `${mes}-${String(i + 1).padStart(2, "0")}`,
    cantidad: 0,
  }));
  const origenes = new Map(),
    creadores = new Map();
  for (const r of registros) {
    const dia = porDia.find((d) => d.valor === r.dia);
    if (!dia)
      throw new Error(
        "El servidor devolvió registros fuera del mes solicitado.",
      );
    dia.cantidad++;
    origenes.set(r.origen, (origenes.get(r.origen) || 0) + 1);
    creadores.set(r.creado_por, (creadores.get(r.creado_por) || 0) + 1);
  }
  const agrupar = (mapa) =>
    [...mapa]
      .map(([valor, cantidad]) => ({ valor, cantidad }))
      .sort(
        (a, b) => b.cantidad - a.cantidad || a.valor.localeCompare(b.valor),
      );
  return {
    total: registros.length,
    demostracion: registros.filter((r) => r.lote_demostracion).length,
    sinAsignar: registros.filter((r) => !r.responsable_id).length,
    porDia,
    porOrigen: agrupar(origenes),
    porCreador: agrupar(creadores),
  };
}
