export function monedaReferencia(catalogo, producto) {
  return producto?.moneda_referencia || catalogo.moneda_adicionales || "ARS";
}
export function tieneAdicionalesUSD(catalogo) {
  return catalogo.items.some(
    (i) =>
      i.tipo === "adicional" &&
      i.adicional_habilitado &&
      !["inactivo", "borrador"].includes(i.estado) &&
      monedaReferencia(catalogo, i) === "USD",
  );
}
