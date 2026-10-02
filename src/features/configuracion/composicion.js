export function componerCondiciones(cliente) {
  async function rpc(nombre, parametros) {
    const { data, error } = await cliente.rpc(nombre, parametros);
    if (error)
      throw new Error(
        error.message === "CATALOGO_CONFLICTO"
          ? "Las condiciones cambiaron. Actualizá antes de guardar."
          : "No se pudo confirmar la operación. Revisá los plazos y la conexión; requiere migración 013 y administración activa.",
      );
    return data;
  }
  return {
    leer: () => rpc("leer_condiciones"),
    guardar: ({ version, operacion, datos }) =>
      rpc("guardar_condiciones", {
        p_version: version,
        p_operacion: operacion,
        p_datos: datos,
      }),
  };
}
