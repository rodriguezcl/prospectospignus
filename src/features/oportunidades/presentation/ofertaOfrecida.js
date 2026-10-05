import { totalConceptos } from "../domain/propuesta.js";

export function referenciaOfrecida(historial, ciclo, seleccion) {
  const ultima = historial
    .filter((p) => p.ciclo === ciclo)
    .sort((a, b) =>
      String(b.creado_en || "").localeCompare(String(a.creado_en || "")),
    )[0];
  if (!ultima) return { hayOfrecida: false, referencia: null };
  const candidatos = ultima.detalle.conceptos.filter(
    (c) =>
      ["familia_id", "kit_id", "subcategoria"].every(
        (k) => c.seleccion[k] === seleccion[k],
      ) &&
      c.seleccion.extras.length === seleccion.extras.length &&
      c.seleccion.extras.every((e) =>
        seleccion.extras.some(
          (x) =>
            x.item_id === e.item_id &&
            Number(x.cantidad) === Number(e.cantidad),
        ),
      ),
  );
  if (candidatos.length !== 1) return { hayOfrecida: true, referencia: null };
  const c = candidatos[0];
  const valor = String(c.total_exacto);
  if (!/^\d+(\.\d{1,9})?$/.test(valor))
    return { hayOfrecida: true, referencia: null };
  const [entero, decimales = ""] = valor.split(".");
  return {
    hayOfrecida: true,
    referencia: {
      seleccion: c.seleccion,
      total: totalConceptos([
        { importe_exacto: `${entero}.${decimales.padEnd(9, "0")}` },
      ]),
      ordinal: c.ordinal_declarado,
      codigoOfrecida: ultima.codigo_interno || ultima.detalle.codigo,
    },
  };
}

export function mismaSeleccion(a, b) {
  return (
    a &&
    b &&
    (a.tipo_cambio_id || null) === (b.tipo_cambio_id || null) &&
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
  return historial
    .filter((p) => p.ciclo === ciclo)
    .sort((a, b) =>
      String(b.creado_en || "").localeCompare(String(a.creado_en || "")),
    )
    .slice(0, 1)
    .some(
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
