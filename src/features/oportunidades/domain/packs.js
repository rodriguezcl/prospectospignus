import { importeExacto, centavos, decimalCentavos } from "./dinero.js";
// Cada pack reúne unidades pagadas del mismo producto y nivel. No incluye bonificados.
export function precioPorCantidad(item, nivel, cantidad, habilitado = true) {
  const n = BigInt(cantidad);
  if (!n) return 0n;
  const individual = importeExacto(item.precios[nivel]);
  const especial = habilitado ? item.precios_pack_2?.[nivel] : undefined;
  return especial === undefined
    ? n * individual
    : (n / 2n) * importeExacto(especial) + (n % 2n) * individual;
}
export function detallePacks(item, extra, habilitado = true) {
  if (!habilitado) return [];
  return [
    ["alto", "altos"],
    ["bajo", "bajos"],
    ["telefonico", "telefonicos"],
  ].flatMap(([nivel, campo]) => {
    const cantidad = Number(extra[campo] || 0);
    const packs = Math.floor(cantidad / 2);
    if (!packs || item.precios_pack_2?.[nivel] === undefined) return [];
    const ahorro =
      BigInt(cantidad) * importeExacto(item.precios[nivel]) -
      precioPorCantidad(item, nivel, cantidad);
    return [
      {
        nivel,
        packs,
        individuales: cantidad % 2,
        ahorro: decimalCentavos(centavos(ahorro)),
      },
    ];
  });
}
