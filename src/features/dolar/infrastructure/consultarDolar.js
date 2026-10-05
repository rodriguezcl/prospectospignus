export async function consultarDolar(tipo, signal, solicitar = fetch) {
  if (!["oficial", "blue"].includes(tipo))
    throw new Error("Tipo de dólar inválido");
  const respuesta = await solicitar(`https://dolarapi.com/v1/dolares/${tipo}`, {
    signal,
    credentials: "omit",
    referrerPolicy: "no-referrer",
  });
  if (!respuesta.ok) throw new Error("No se pudo consultar el dólar");
  const dato = await respuesta.json();
  if (
    dato.moneda !== "USD" ||
    dato.casa !== tipo ||
    typeof dato.venta !== "number" ||
    !Number.isFinite(dato.venta) ||
    dato.venta <= 0 ||
    typeof dato.fechaActualizacion !== "string" ||
    !Number.isFinite(Date.parse(dato.fechaActualizacion))
  )
    throw new Error("Cotización inválida");
  return { venta: dato.venta, fechaActualizacion: dato.fechaActualizacion };
}
