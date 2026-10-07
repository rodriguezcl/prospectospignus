import { precioPorCantidad } from '../domain/packs.js';
import { importeExacto, decimalCentavos } from '../domain/dinero.js';

// Promedio informativo: incluye unidades bonificadas y respeta packs ya aplicados.
export function precioUnitarioAdicional(extra, catalogo) {
  const item = catalogo.items.find(i => i.id === extra.item_id);
  const cantidad = Number(extra.cantidad);
  if (!item || !Number.isFinite(cantidad) || cantidad <= 0) return undefined;
  const milesimas = BigInt(Math.round(cantidad * 1000));
  let total;
  if (extra.nivel) {
    total = importeExacto(item.precios[extra.nivel]) * milesimas;
  } else {
    total = [['alto','altos'],['bajo','bajos'],['telefonico','telefonicos']].reduce(
      (s,[nivel,campo]) => s + precioPorCantidad(item,nivel,extra[campo] || 0,catalogo.esquema >= 7) * 1000n, 0n);
  }
  const divisor = milesimas * 10000n;
  return decimalCentavos((total + divisor / 2n) / divisor);
}
