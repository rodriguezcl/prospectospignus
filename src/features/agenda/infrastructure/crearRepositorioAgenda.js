function comprobar(error) {
  if (!error) return;
  if (["42P01", "PGRST202", "PGRST205"].includes(error.code))
    throw new Error("Falta activar la migración 012 de Agenda en Supabase.");
  const mensajes = {
    AGENDA_ACCESO: "No tenés permiso para acceder a esta actividad.",
    AGENDA_CONFLICTO:
      "La actividad cambió. Cerrá el formulario y actualizá antes de continuar.",
    AGENDA_TRANSICION:
      "La acción no corresponde al estado actual. Las visitas se reprograman desde Cotizaciones.",
    AGENDA_FECHA:
      "Revisá los horarios: una actividad realizada no puede tener fechas futuras.",
    AGENDA_DATOS: "Revisá los campos y el motivo del cambio.",
  };
  throw new Error(
    mensajes[error.message] ||
      (error.code === "23514"
        ? "Revisá los horarios, campos obligatorios y sus longitudes."
        : "No pudimos confirmar la operación. Reintentá sin cambiar los datos para evitar duplicados."),
  );
}
export function crearRepositorioAgenda(cliente) {
  async function rpc(nombre, parametros) {
    const { data, error } = await cliente.rpc(nombre, parametros);
    comprobar(error);
    return data;
  }
  return {
    equipo: () => rpc("equipo_agenda"),
    async listar({ vendedor, desde, hasta }) {
      const filas = [];
      for (let pagina = 0; ; pagina++) {
        const lote = await rpc("listar_agenda", {
          p_vendedor: vendedor,
          p_desde: desde,
          p_hasta: hasta,
          p_pagina: pagina,
        });
        filas.push(...lote);
        if (lote.length < 100) return filas;
      }
    },
    async actividad(id) {
      const { data, error } = await cliente
        .from("actividades_agenda")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      comprobar(error);
      return data;
    },
    async historial(id, pagina = 0) {
      const { data, error } = await cliente
        .from("eventos_agenda")
        .select("*")
        .eq("actividad_id", id)
        .order("ocurrido_en", { ascending: false })
        .order("id")
        .range(pagina * 20, pagina * 20 + 19);
      comprobar(error);
      return data;
    },
    async prospectos(busqueda) {
      const texto = busqueda.trim().replace(/[%_]/g, "");
      if (texto.length < 2) return [];
      const { data, error } = await cliente
        .from("oportunidades")
        .select("id,necesidad,prospectos!inner(nombre)")
        .neq("estado", "anulada")
        .ilike("prospectos.nombre", `%${texto}%`)
        .order("actualizado_en", { ascending: false })
        .limit(20);
      comprobar(error);
      return data;
    },
    guardar: ({ id, version, operacion, accion, datos }) =>
      rpc("gestionar_actividad", {
        p_id: id,
        p_version: version,
        p_operacion: operacion,
        p_accion: accion,
        p_datos: datos,
      }),
    notificaciones: () => rpc("recordatorios_agenda"),
    leer(id) {
      const [actividad, version] = id.split("/");
      return rpc("leer_recordatorio_agenda", {
        p_id: actividad,
        p_version: Number(version),
      });
    },
  };
}
