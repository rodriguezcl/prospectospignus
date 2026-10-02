import { decimalCentavos } from "./dinero.js";
export function totalConceptos(conceptos) {
  if (!conceptos.length || conceptos.length > 10)
    throw new Error("Agregá entre uno y diez conceptos.");
  let total = 0n;
  for (const concepto of conceptos) {
    const valor = concepto.importe_exacto;
    if (typeof valor !== "string" || !/^\d+\.\d{9}$/.test(valor))
      throw new Error("Confirmá las alternativas antes de continuar.");
    total += BigInt(valor.replace(".", ""));
  }
  return decimalCentavos((total + 5000000n) / 10000000n);
}
