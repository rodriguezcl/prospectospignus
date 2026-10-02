export function crearConsultaRendimiento(cliente) {
  async function consultar(nombre, parametros) {
    if (!cliente) throw new Error("No hay conexión configurada.");
    const { data, error } = await cliente.rpc(nombre, parametros);
    if (error)
      throw new Error(
        error.message?.includes("INFORMES_ACCESO")
          ? "No tenés permiso para consultar estos indicadores."
          : "No se pudieron cargar los indicadores. Actualizá e intentá nuevamente.",
      );
    return data;
  }
  return {
    resumen: ({ mes, origen = "" }) =>
      consultar("resumen_rendimiento", {
        p_mes: `${mes}-01`,
        p_origen: origen || null,
      }),
    detalle: ({ mes, responsable, tipo, origen = "", pagina = 0 }) =>
      consultar("detalle_rendimiento", {
        p_mes: `${mes}-01`,
        p_responsable: responsable,
        p_tipo: tipo,
        p_origen: origen || null,
        p_pagina: pagina,
      }),
  };
}
