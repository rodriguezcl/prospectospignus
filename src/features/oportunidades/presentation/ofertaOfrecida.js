export function mismaSeleccion(a, b) {
  return (
    a &&
    b &&
    ["familia_id", "kit_id", "subcategoria", "nivel"].every(
      (k) => a[k] === b[k],
    ) &&
    a.extras.length === b.extras.length &&
    a.extras.every((e) => {
      const otro = b.extras.find((x) => x.item_id === e.item_id);
      return (
        otro &&
        ["cantidad", "altos", "bajos", "telefonicos", "bonificados"].every(
          (k) => Number(e[k] || 0) === Number(otro[k] || 0),
        )
      );
    })
  );
}
export function ofertaOfrecida(
  alternativa,
  historial,
  { ciclo, catalogo, condiciones, nivelAbono, meses },
) {
  return historial.some(
    (p) =>
      p.ciclo === ciclo &&
      p.catalogo_version === catalogo &&
      p.condiciones_version === condiciones &&
      p.detalle.conceptos.some(
        (c) =>
          mismaSeleccion(c.seleccion, alternativa.seleccion) &&
          (c.nivel_abono || null) === nivelAbono &&
          Number(c.meses_congelamiento) === meses,
      ),
  );
}
