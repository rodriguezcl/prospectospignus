export function crearConsultaVentas(cliente) {
  async function consultar(nombre, parametros) {
    const { data, error } = await cliente.rpc(nombre, parametros);
    if (error) {
      const mensajes = {
        ACTIVACION_ACCESO:
          "Solo administración puede confirmar la instalación.",
        VENTAS_ACCESO: "No tenés acceso al detalle de esta venta.",
        ACTIVACION_CONFLICTO:
          "La instalación cambió. Actualizá antes de corregirla.",
        ACTIVACION_FECHA:
          "La fecha no puede ser futura ni anterior a la aceptación conocida.",
        ACTIVACION_DATOS:
          "Completá fecha y referencia de respaldo (entre 5 y 2000 caracteres).",
        ACTIVACION_VENTA: "Solo se activa una venta ganada.",
      };
      throw new Error(
        mensajes[error.message] ||
          "No pudimos confirmar la operación. Revisá la conexión y la migración 016.",
      );
    }
    return data;
  }
  return {
    detalle: (id) => consultar("detalle_venta", { p_id: id }),
    activar: ({ id, version, operacion, fecha, respaldo }) =>
      consultar("guardar_activacion", {
        p_id: id,
        p_version: version,
        p_operacion: operacion,
        p_fecha: fecha,
        p_respaldo: respaldo,
      }),
    async listar({ mes = "", responsable = "", pagina = 0 } = {}) {
      const { data, error } = await cliente.rpc("listar_ventas_concretadas", {
        p_mes: mes ? `${mes}-01` : null,
        p_responsable: responsable || null,
        p_pagina: pagina,
      });
      if (error) {
        if (["PGRST202", "42883"].includes(error.code))
          throw new Error(
            "Falta aplicar la migración 010 de Ventas concretadas en Supabase.",
          );
        if (error.code === "42501")
          throw new Error(
            "Tu cuenta no tiene acceso a las ventas. Volvé a iniciar sesión.",
          );
        throw new Error(
          "No pudimos consultar las ventas. Revisá la conexión y reintentá.",
        );
      }
      return data;
    },
  };
}
