// Adaptador HTTP compartido por navegador y Edge Function (sin credenciales).
export async function consultarDolar(
  tipo,
  signal,
  solicitar = fetch,
  ahora = Date.now,
) {
  if (!["oficial", "blue"].includes(tipo))
    throw new Error("Tipo de dólar inválido");
  const origenPrincipal = tipo === "oficial" ? "bna" : tipo;
  let ultimoError;
  for (const proveedor of ["monedapi", "dolarapi"]) {
    signal?.throwIfAborted();
    const timeout = AbortSignal.timeout(4000);
    const combinado = signal ? AbortSignal.any([signal, timeout]) : timeout;
    try {
      const url =
        proveedor === "monedapi"
          ? "https://monedapi.ar/api/v2/usd/" + origenPrincipal
          : "https://dolarapi.com/v1/dolares/" + tipo;
      const respuesta = await solicitar(url, {
        signal: combinado,
        credentials: "omit",
        referrerPolicy: "no-referrer",
      });
      if (!respuesta.ok) throw new Error("Fuente no disponible");
      const d = await respuesta.json();
      const principal = proveedor === "monedapi";
      const venta = principal ? d.sell : d.venta;
      // MonedAPI distingue último cambio de última confirmación de la cotización.
      const fechaActualizacion = principal
        ? d.lastScrapedAt
        : d.fechaActualizacion;
      const fecha = Date.parse(fechaActualizacion);
      if (
        (principal
          ? d.currency !== "USD" ||
            d.origin !== origenPrincipal.toUpperCase() ||
            d.valueType !== "money"
          : d.moneda !== "USD" || d.casa !== tipo) ||
        typeof venta !== "number" ||
        !Number.isFinite(venta) ||
        venta <= 0 ||
        typeof fechaActualizacion !== "string" ||
        !Number.isFinite(fecha) ||
        fecha > ahora() + 300000 ||
        (principal && ahora() - fecha > 20 * 60 * 1000)
      )
        throw new Error("Cotización inválida o desactualizada");
      return { venta, fechaActualizacion, proveedor };
    } catch (error) {
      signal?.throwIfAborted();
      ultimoError = error;
    }
  }
  throw ultimoError;
}
