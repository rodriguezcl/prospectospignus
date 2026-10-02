export function crearRepositorioCatalogo(cliente) {
  async function llamar(nombre, datos) {
    const { data, error } = await cliente.rpc(nombre, datos);
    if (error) {
      const mensajes = {
        CATALOGO_ACCESO: "No tenés permiso para administrar el catálogo.",
        CATALOGO_CONFLICTO:
          "El catálogo cambió. Actualizá antes de volver a guardar.",
        CATALOGO_DUPLICADO: "Hay códigos o componentes repetidos.",
        CATALOGO_INCOMPLETO:
          "Completá los precios antes de activar el producto.",
        CATALOGO_ESCALA:
          "Los precios deben ir de mayor a menor: Catálogo, Alto, Medio, Bajo y Telefónico.",
        CATALOGO_VALIDACION:
          "Activá la familia y confirmá la validación técnica del producto.",
        CATALOGO_COMPATIBILIDAD:
          "Revisá la familia, componentes y compatibilidades del kit.",
        CATALOGO_CONSERVAR:
          "Los productos y familias se deshabilitan; no se eliminan del historial.",
      };
      throw new Error(
        mensajes[error.message] ||
          (["PGRST202", "42P01"].includes(error.code)
            ? "Falta aplicar la migración de Productos (013)."
            : "No se pudo guardar o consultar el catálogo. Revisá campos, precios y conexión."),
      );
    }
    return data;
  }
  return {
    leer: (oportunidad = null) =>
      llamar("leer_catalogo", { p_oportunidad: oportunidad }),
    guardar: ({ version, operacion, datos }) =>
      llamar("guardar_catalogo", {
        p_version: version,
        p_operacion: operacion,
        p_datos: datos,
      }),
  };
}
