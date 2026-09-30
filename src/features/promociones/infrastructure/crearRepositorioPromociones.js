import { hoyCordoba } from "../domain/promocion.js";
function comprobar(error) {
  if (!error) return;
  if (["PGRST202", "PGRST205", "42P01", "42883"].includes(error.code))
    throw new Error(
      "Falta activar Promociones: migración 011 y configuración privada de Storage.",
    );
  const mensajes = {
    PROMO_ACCESO: "No tenés permiso para modificar promociones.",
    PROMO_CONFLICTO:
      "La promoción cambió. Actualizá la ficha antes de continuar.",
    PROMO_PENDIENTE:
      "Hay archivos pendientes: confirmá su carga o retiralos antes de publicar.",
    PROMO_ARCHIVO:
      "La carga del archivo no está completa o no coincide. Retiralo y volvé a subirlo.",
    PROMO_TRANSICION:
      "Pasá la promoción a borrador antes de editarla o cambiar sus archivos.",
    PROMO_VENCIDA: "Actualizá la vigencia antes de publicar.",
    PROMO_LIMITE: "Máximo 10 adjuntos por promoción.",
  };
  throw new Error(
    mensajes[error.message] ||
      "No pudimos completar la operación. Revisá los datos y la conexión; si estabas subiendo un archivo, revisá los adjuntos pendientes.",
  );
}
export function crearRepositorioPromociones(cliente) {
  async function rpc(nombre, datos) {
    const { data, error } = await cliente.rpc(nombre, datos);
    comprobar(error);
    return data;
  }
  return {
    async listar({ pagina = 0, filtro = "vigentes" } = {}) {
      let consulta = cliente
        .from("promociones")
        .select("*", { count: "exact" })
        .order("actualizado_en", { ascending: false })
        .order("id")
        .range(pagina * 20, pagina * 20 + 19);
      const hoy = hoyCordoba();
      if (filtro === "vigentes")
        consulta = consulta
          .eq("estado", "publicada")
          .lte("desde", hoy)
          .gte("hasta", hoy);
      else if (filtro === "vencidas")
        consulta = consulta.eq("estado", "publicada").lt("hasta", hoy);
      else if (filtro === "proximas")
        consulta = consulta.eq("estado", "publicada").gt("desde", hoy);
      else if (["borrador", "archivada"].includes(filtro))
        consulta = consulta.eq("estado", filtro);
      const { data, error, count } = await consulta;
      comprobar(error);
      return { filas: data, total: count };
    },
    async detalle(id) {
      const { data, error } = await cliente
        .from("promociones")
        .select("*,archivos_promociones(*)")
        .eq("id", id)
        .single();
      comprobar(error);
      return data;
    },
    guardar: ({ id, version, operacion, accion, datos = {} }) =>
      rpc("gestionar_promocion", {
        p_id: id,
        p_version: version,
        p_operacion: operacion,
        p_accion: accion,
        p_datos: datos,
      }),
    async subir(ruta, archivo) {
      const { error } = await cliente.storage
        .from("promociones")
        .upload(ruta, archivo, {
          contentType: archivo.type,
          upsert: false,
          cacheControl: "0",
        });
      comprobar(error);
    },
    confirmar: (id) => rpc("confirmar_archivo_promocion", { p_id: id }),
    async descargar(ruta) {
      const { data, error } = await cliente.storage
        .from("promociones")
        .download(ruta);
      comprobar(error);
      return data;
    },
    async notificaciones() {
      const { data, error } = await cliente
        .from("avisos_promociones")
        .select("*")
        .is("leida_en", null)
        .order("creado_en", { ascending: false })
        .limit(50);
      comprobar(error);
      return data;
    },
    leer: (id) => rpc("leer_aviso_promocion", { p_id: id }),
  };
}
