export function crearConsultaVentas(cliente) {
  return {
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
