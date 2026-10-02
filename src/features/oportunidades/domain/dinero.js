// Precisión fuente: seis decimales. No utilizar Number para operar importes.
const ESCALA = 1000000n;
export function importeExacto(valor) {
  if (
    typeof valor !== "string" ||
    !/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(valor)
  )
    throw new Error(
      "Importe inválido: usá un decimal no negativo con hasta seis decimales.",
    );
  const [entero, fraccion = ""] = valor.split(".");
  return BigInt(entero) * ESCALA + BigInt(fraccion.padEnd(6, "0"));
}
export function centavos(importe) {
  if (typeof importe !== "bigint" || importe < 0n)
    throw new Error("Importe inválido.");
  return (importe + 5000n) / 10000n;
}
export function decimalCentavos(valor) {
  if (typeof valor !== "bigint" || valor < 0n)
    throw new Error("Centavos inválidos.");
  return `${valor / 100n}.${String(valor % 100n).padStart(2, "0")}`;
}
export function cuotasSinInteres(totalCentavos, cantidad) {
  if (
    typeof totalCentavos !== "bigint" ||
    totalCentavos < 0n ||
    ![1, 3, 6].includes(cantidad)
  )
    throw new Error("Cuotas inválidas.");
  const n = BigInt(cantidad),
    base = totalCentavos / n;
  return Array.from({ length: cantidad }, (_, i) =>
    decimalCentavos(base + (i === cantidad - 1 ? totalCentavos % n : 0n)),
  );
}
