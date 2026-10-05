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
  redondeoManual = "0",
  porcentajeRedondeo = "1",
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
  if (
    typeof redondeoManual !== "string" ||
    !/^(0|[1-9]\d{0,11})(\.\d{1,2})?$/.test(redondeoManual)
  )
    throw new Error(
      "El redondeo debe ser un importe positivo con hasta dos decimales.",
    );
  const manual = centavos(importeExacto(redondeoManual));
  const porcentaje = String(porcentajeRedondeo);
  if (
    !/^(0|[1-9]\d{0,2})(\.\d{1,2})?$/.test(porcentaje) ||
    Number(porcentaje) > 100
  )
    throw new Error("El límite de redondeo debe estar entre 0 y 100 %.");
  const puntos = centavos(importeExacto(porcentaje));
  const limite = ((base - descuento) * puntos) / 10000n;
  if (manual > limite)
    throw new Error(
      `El redondeo supera el límite de ${porcentaje} % ($ ${decimalCentavos(limite)}).`,
    );
  // En pago combinado se resta primero del efectivo neto y luego del saldo.
  const rebajaEfectivo =
    manual < efectivo - descuento ? manual : efectivo - descuento;
  const saldoOriginal = base - efectivo - (manual - rebajaEfectivo);
  const redondeo = saldoOriginal % BigInt(cuotas);
  const saldo = saldoOriginal - redondeo;
  return {
    base: decimalCentavos(base),
    base_efectivo: decimalCentavos(efectivo),
    descuento: decimalCentavos(descuento),
    ajuste_redondeo: decimalCentavos(redondeo),
    redondeo_manual: decimalCentavos(manual),
    efectivo_a_abonar: decimalCentavos(efectivo - descuento - rebajaEfectivo),
    saldo: decimalCentavos(saldo),
    medio_saldo: medioSaldo,
    cuotas: cuotasSinInteres(saldo, cuotas),
    total: decimalCentavos(base - descuento - manual - redondeo),
  };
}
