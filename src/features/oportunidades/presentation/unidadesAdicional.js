const campos = ["altos", "bajos", "bonificados", "telefonicos"];
export function unidadesAdicional(extra, cantidad = extra.cantidad) {
  const n = Number(cantidad);
  if (!Number.isInteger(n) || n < 1 || n > 9999) return [];
  let anteriores = extra.unidades;
  if (!Array.isArray(anteriores)) {
    const contadores = campos.map((campo) => Number(extra[campo] ?? 0));
    const total = contadores.reduce((a, b) => a + b, 0);
    const valido =
      contadores.every((v) => Number.isInteger(v) && v >= 0) &&
      total <= Number(extra.cantidad);
    anteriores = valido
      ? campos.flatMap((campo, j) => Array(contadores[j]).fill(campo))
      : Array(n).fill("");
  }
  return Array.from({ length: n }, (_, j) => anteriores[j] ?? "altos");
}
export function condicionesExtra(extra) {
  if (!Array.isArray(extra.unidades))
    return {
      bajos: extra.bajos,
      bonificados: extra.bonificados,
      telefonicos: extra.telefonicos,
    };
  if (
    extra.unidades.length !== Number(extra.cantidad) ||
    extra.unidades.some((u) => !campos.includes(u))
  )
    throw new Error(
      "Elegí la condición de cada unidad del adicional antes de calcular.",
    );
  return Object.fromEntries(
    campos.map((campo) => [
      campo,
      extra.unidades.filter((u) => u === campo).length,
    ]),
  );
}
