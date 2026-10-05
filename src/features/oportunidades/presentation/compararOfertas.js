import { centavos, importeExacto, decimalCentavos } from "../domain/dinero.js";

const condiciones = [
  ["altos", "a precio Alto"],
  ["bajos", "a precio Bajo"],
  ["telefonicos", "a precio Telefónico"],
  ["bonificados", "sin cargo adicional (comodato)"],
];
const resumen = (extra) =>
  condiciones
    .filter(([campo]) => Number(extra?.[campo]) > 0)
    .map(([campo, texto]) => `${extra[campo]} ${texto}`)
    .join(" + ") || "Sin adicionales";

export function compararOfertas(actual, anterior, items) {
  if (!anterior) return null;
  const cambios = [];
  if (
    (actual.seleccion.tipo_cambio_id || null) !==
    (anterior.seleccion.tipo_cambio_id || null)
  )
    cambios.push(
      "Cambió la referencia de conversión de los adicionales a pesos. La oferta anterior conserva su importe original.",
    );
  if (actual.seleccion.nivel !== anterior.seleccion.nivel)
    cambios.push(
      `Nivel del plan o kit: ${anterior.seleccion.nivel} → ${actual.seleccion.nivel}.`,
    );
  const previos = new Map(anterior.seleccion.extras.map((e) => [e.item_id, e]));
  const nuevos = new Map(actual.seleccion.extras.map((e) => [e.item_id, e]));
  for (const id of new Set([...previos.keys(), ...nuevos.keys()])) {
    const antes = previos.get(id),
      ahora = nuevos.get(id);
    if (
      condiciones.some(
        ([campo]) =>
          Number(antes?.[campo] || 0) !== Number(ahora?.[campo] || 0),
      )
    ) {
      const item = items.find((i) => i.id === id);
      const nombre = item
        ? `${item.nombre}${item.codigo ? ` (${item.codigo})` : ""}`
        : "Componente";
      cambios.push(`${nombre}: ${resumen(antes)} → ${resumen(ahora)}.`);
    }
  }
  const diferencia =
    centavos(importeExacto(anterior.total)) -
    centavos(importeExacto(actual.total));
  return {
    cambios,
    sentido: diferencia > 0n ? "ahorro" : diferencia < 0n ? "aumento" : "igual",
    importe: decimalCentavos(diferencia < 0n ? -diferencia : diferencia),
  };
}
