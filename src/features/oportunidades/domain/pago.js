import {
  importeExacto,
  centavos,
  decimalCentavos,
  cuotasSinInteres,
} from "./dinero.js";

// El importe asignado a efectivo es deuda cancelada ANTES del descuento,
// no billetes recibidos. El abono nunca forma parte de esta base.
export function calcularPago({
  total,
  baseEfectivo = "0",
  medioSaldo = "debito",
  cuotas = 1,
}) {
  const base = centavos(importeExacto(total));
  if (!/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(baseEfectivo))
    throw new Error(
      "La parte a cancelar en efectivo debe tener hasta dos decimales.",
    );
  const efectivo = centavos(importeExacto(baseEfectivo));
  if (efectivo > base)
    throw new Error("La parte en efectivo supera el total acordado.");
  if (
    !["debito", "transferencia", "credito"].includes(medioSaldo) ||
    ![1, 3, 6].includes(cuotas) ||
    (medioSaldo !== "credito" && cuotas !== 1)
  )
    throw new Error("Seleccioná un medio y cuotas válidos para el saldo.");
  const descuento = (efectivo + 5n) / 10n;
  const saldo = base - efectivo;
  return {
    base: decimalCentavos(base),
    base_efectivo: decimalCentavos(efectivo),
    descuento: decimalCentavos(descuento),
    efectivo_a_abonar: decimalCentavos(efectivo - descuento),
    saldo: decimalCentavos(saldo),
    medio_saldo: medioSaldo,
    cuotas: cuotasSinInteres(saldo, cuotas),
    total: decimalCentavos(base - descuento),
  };
}
