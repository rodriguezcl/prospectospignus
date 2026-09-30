function comprobar(error) {
  if (!error) return;
  const mensajes = {
    COMERCIAL_ACCESO: "No tenés permiso para gestionar esta oportunidad.",
    COMERCIAL_CONFLICTO: "La ficha cambió. Recargala antes de continuar.",
    COMERCIAL_CALIFICACION:
      "Completá teléfono y dirección en el registro, confirmá el contacto efectivo y detallá la necesidad.",
    COMERCIAL_PLAZO: "La próxima acción debe tener una fecha futura.",
    COMERCIAL_SIN_AGENTE:
      "No hay agentes disponibles. La oportunidad queda pendiente de asignación.",
    COMERCIAL_VENDEDOR: "Seleccioná un vendedor activo.",
    COMERCIAL_DESTINO:
      "El responsable debe estar activo y tener el rol adecuado. El agente debe estar disponible.",
    COMERCIAL_CERRADA: "La oportunidad ya está cerrada.",
    COMERCIAL_CONFIRMACION:
      "Registrá condiciones, canal y fecha válida de la aceptación expresa del prospecto.",
    COMERCIAL_RECUPERAR:
      "Derivá a recuperación antes de cerrar por razones comerciales. Solo fuera de zona o incumplimiento de requisitos permite pérdida directa.",
    COMERCIAL_RECHAZO:
      "Registrá la propuesta final y confirmá que el prospecto la rechazó.",
    COMERCIAL_MOTIVO: "Seleccioná un motivo de pérdida válido.",
    COMERCIAL_TRANSICION:
      "La acción no corresponde a la etapa actual. Revisá también las condiciones ofrecidas.",
    COMERCIAL_DATOS: "Revisá los campos obligatorios y sus longitudes.",
  };
  if (["42P01", "PGRST202", "PGRST205"].includes(error.code))
    throw new Error(
      "Falta activar una migración del circuito comercial en Supabase (006/007).",
    );
  throw new Error(
    mensajes[error.message] ||
      "No pudimos confirmar la operación. Revisá la conexión y reintentá sin modificar los datos.",
  );
}
export function crearRepositorioOportunidades(cliente) {
  async function rpc(nombre, parametros) {
    const { data, error } = await cliente.rpc(nombre, parametros);
    comprobar(error);
    return data;
  }
  return {
    async prospectos(pagina = 0) {
      const { data, error, count } = await cliente
        .from("prospectos")
        .select("*,oportunidades(id,necesidad,estado)", { count: "exact" })
        .order("creado_en", { ascending: false })
        .order("id")
        .range(pagina * 20, pagina * 20 + 19);
      comprobar(error);
      return { filas: data, total: count };
    },
    async listar({ pagina = 0, estado = "" } = {}) {
      let consulta = cliente
        .from("oportunidades")
        .select("*,prospectos(nombre,telefono,direccion,captado_por)", {
          count: "exact",
        })
        .order("actualizado_en", { ascending: false })
        .order("id")
        .range(pagina * 20, pagina * 20 + 19);
      if (estado === "sin_asignar")
        consulta = consulta
          .eq("estado", "recuperacion")
          .is("responsable_id", null);
      else if (estado) consulta = consulta.eq("estado", estado);
      const { data, error, count } = await consulta;
      comprobar(error);
      return { filas: data, total: count };
    },
    async detalle(id) {
      const [ficha, eventos] = await Promise.all([
        cliente
          .from("oportunidades")
          .select("*,prospectos(*)")
          .eq("id", id)
          .single(),
        cliente
          .from("eventos_oportunidades")
          .select("id,tipo,actor_id,ocurrido_en,anterior,nuevo")
          .eq("oportunidad_id", id)
          .order("ocurrido_en", { ascending: false })
          .limit(100),
      ]);
      comprobar(ficha.error);
      comprobar(eventos.error);
      return { ...ficha.data, eventos: eventos.data };
    },
    equipo: () => rpc("equipo_comercial"),
    async registros(busqueda = "") {
      let consulta = cliente
        .from("registros_iniciales")
        .select("id,nombre,telefono,ubicacion,responsable_id")
        .is("lote_demostracion", null)
        .order("creado_en", { ascending: false })
        .limit(100);
      if (busqueda.trim())
        consulta = consulta.ilike(
          "nombre",
          `%${busqueda.trim().replace(/[%_]/g, "")}%`,
        );
      const { data, error } = await consulta;
      comprobar(error);
      return data;
    },
    disponibilidad: (valor) =>
      rpc("disponibilidad_agente", { p_disponible: valor }),
    guardar: ({ id, version, operacion, accion, datos }) =>
      rpc(
        accion === "reactivar"
          ? "reactivar_oportunidad"
          : "gestionar_oportunidad",
        {
          p_id: id,
          p_version: version,
          p_operacion: operacion,
          ...(accion === "reactivar" ? {} : { p_accion: accion }),
          p_datos: datos,
        },
      ),
    async notificaciones() {
      const { data, error } = await cliente
        .from("notificaciones")
        .select("*")
        .is("leida_en", null)
        .order("creado_en", { ascending: false })
        .limit(50);
      comprobar(error);
      return data;
    },
    leer: (id) => rpc("leer_notificacion", { p_id: id }),
  };
}
