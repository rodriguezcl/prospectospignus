export function crearRepositorioCatalogo(cliente) {
  async function llamar(nombre, datos) {
    const { data, error } = await cliente.rpc(nombre, datos);
    if (error) {
      const mensajes = {
        CATALOGO_ACCESO: "No tenés permiso para administrar el catálogo.",
        CATALOGO_CONFLICTO:
          "El catálogo cambió. Actualizá antes de volver a guardar.",
        CATALOGO_DUPLICADO: "Hay marcas, códigos o componentes repetidos.",
        CATALOGO_INCOMPLETO:
          "Completá los precios antes de activar el producto.",
        CATALOGO_ESCALA:
          "Los precios deben ir de mayor a menor: Catálogo, Alto, Medio, Bajo y Telefónico.",
        CATALOGO_VALIDACION:
          "Activá la marca y confirmá la validación técnica del producto.",
        CATALOGO_COMPATIBILIDAD:
          "Revisá marca, servicio, componentes activos y compatibilidades del plan o kit.",
        CATALOGO_CONSERVAR:
          "El registro debe conservarse en el historial. Podés darlo de baja.",
        CATALOGO_USADO:
          "Este registro tiene uso en cotizaciones. Podés deshabilitarlo, pero no eliminarlo.",
        CATALOGO_REFERENCIA:
          "Hay vínculos pendientes: revisá marca, servicio y registros asociados antes de eliminar.",
        CATALOGO_DEPENDENCIAS:
          "Primero deshabilitá los registros activos que dependen de este elemento.",
        CATALOGO_CLASIFICACION:
          "Seleccioná la modalidad Plan o Kit antes de activar.",
        CATALOGO_MODALIDAD:
          "Revisá la modalidad. Solo Alarma admite planes en comodato.",
        CATALOGO_ESQUEMA:
          "Actualizá la aplicación para administrar el nuevo catálogo.",
      };
      throw new Error(
        mensajes[error.message] ||
          (["PGRST202", "42P01"].includes(error.code)
            ? "Falta aplicar la actualización del catálogo comercial (026)."
            : "No se pudo guardar o consultar el catálogo. Revisá campos, precios y conexión."),
      );
    }
    return data;
  }
  return {
    leer: (oportunidad = null) =>
      llamar("leer_catalogo", { p_oportunidad: oportunidad }),
    guardar: ({ version, operacion, datos }) =>
      llamar("guardar_catalogo_026", {
        p_version: version,
        p_operacion: operacion,
        p_datos: datos,
      }),
  };
}
