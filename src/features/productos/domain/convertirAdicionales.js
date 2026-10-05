function exacto(valor) {
  if (
    typeof valor !== "string" ||
    !/^(0|[1-9]\d{0,11})(\.\d{1,6})?$/.test(valor)
  )
    throw new Error("Falta un precio válido en dólares.");
  const [entero, decimal = ""] = valor.split(".");
  return BigInt(entero) * 1000000n + BigInt(decimal.padEnd(6, "0"));
}
export function convertirAdicionales(catalogo, cambio) {
  if (catalogo.moneda_adicionales !== "USD") return catalogo;
  if (!cambio?.id || exacto(cambio.venta) <= 0n)
    throw new Error(
      "No hay cotización del dólar validada. Volvé a actualizar.",
    );
  const factor = exacto(cambio.venta);
  return {
    ...catalogo,
    tipo_cambio: cambio,
    items: catalogo.items.map((i) => {
      if (
        i.tipo !== "adicional" ||
        !i.adicional_habilitado ||
        i.estado === "inactivo" ||
        i.estado === "borrador"
      )
        return i;
      const precios = Object.fromEntries(
        Object.entries(i.precios_usd || {}).map(([nivel, valor]) => {
          const convertido = (exacto(valor) * factor + 500000n) / 1000000n;
          if (convertido >= 1000000000000000000n)
            throw new Error(
              "El importe convertido excede el máximo permitido.",
            );
          return [
            nivel,
            `${convertido / 1000000n}.${String(convertido % 1000000n).padStart(6, "0")}`,
          ];
        }),
      );
      const requeridos =
        i.servicio === "camaras"
          ? ["telefonico"]
          : ["alto", "bajo", "telefonico"];
      if (requeridos.some((n) => precios[n] === undefined))
        throw new Error(`Completá la lista USD de ${i.nombre}.`);
      return { ...i, precios };
    }),
  };
}
