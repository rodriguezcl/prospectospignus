export function crearManejadorDolar({
  autorizado,
  consultarCache,
  consultarFuente,
  registrar,
  origenes,
}) {
  return async (request) => {
    const origen = request.headers.get("origin");
    const headers = {
      "Content-Type": "application/json",
      Vary: "Origin",
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    if (origen && !origenes.includes(origen))
      return new Response("{}", { status: 403, headers });
    if (origen) headers["Access-Control-Allow-Origin"] = origen;
    const responder = (dato, status = 200) =>
      new Response(JSON.stringify(dato), { status, headers });
    if (request.method === "OPTIONS")
      return new Response(null, { status: 204, headers });
    if (request.method !== "POST")
      return responder({ error: "Método no permitido" }, 405);
    try {
      const token = request.headers
        .get("authorization")
        ?.match(/^Bearer (.+)$/i)?.[1];
      if (!token || !(await autorizado(token)))
        return responder({ error: "Acceso no autorizado" }, 401);
      const cache = await consultarCache();
      if (cache) return responder(cache);
      const dato = await consultarFuente();
      if (
        dato?.moneda !== "USD" ||
        dato.casa !== "oficial" ||
        typeof dato.venta !== "number" ||
        !Number.isFinite(dato.venta) ||
        dato.venta <= 0 ||
        !Number.isFinite(Date.parse(dato.fechaActualizacion))
      )
        throw new Error("Datos inválidos");
      return responder(
        await registrar(
          String(dato.venta),
          dato.fechaActualizacion,
          dato.proveedor || "dolarapi",
        ),
      );
    } catch {
      return responder(
        { error: "No se pudo verificar el dólar oficial. Intentá nuevamente." },
        503,
      );
    }
  };
}
