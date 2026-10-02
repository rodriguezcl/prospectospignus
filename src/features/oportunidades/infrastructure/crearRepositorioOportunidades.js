function comprobar(error) {
  if (!error) return;
  const mensajes = {
    COMERCIAL_INTERES:
      "Revisá los servicios de interés, el tipo de alarma y el medio de contacto.",
    COMERCIAL_PROPUESTA:
      "Guardá y seleccioná la propuesta efectivamente ofrecida de este ciclo.",
    COMERCIAL_OBJECION:
      "Indicá la objeción concreta que debe trabajar el agente.",
    COMERCIAL_NEGOCIACION:
      "Confirmá que existe una nueva negociación real, no solo una llamada sin respuesta.",
    COMERCIAL_ORIGEN: "Revisá el origen comercial del caso.",
    PROPUESTA_ACCESO:
      "Solo el responsable autorizado puede preparar esta propuesta.",
    PROPUESTA_CONFLICTO:
      "La ficha cambió. Actualizá antes de guardar la propuesta.",
    PROPUESTA_VIGENCIA:
      "Cambió el catálogo o las condiciones. Volvé a preparar la propuesta con la versión actual.",
    PROPUESTA_COMPOSICION:
      "Revisá el kit, sus adicionales compatibles y la mano de obra del cerco.",
    PROPUESTA_PRECIO:
      "Administración debe completar los precios antes de ofrecer esta composición.",
    PROPUESTA_CANTIDAD: "Revisá las cantidades de los componentes.",
    PROPUESTA_NIVEL:
      "El nivel solicitado no está permitido para esta propuesta.",
    PROPUESTA_BONIFICACION: "La bonificación supera el margen autorizado.",
    PROPUESTA_PAGO: "Revisá la parte en efectivo y el medio de pago del saldo.",
    PROPUESTA_CONGELAMIENTO:
      "El plazo de congelamiento no está habilitado para este abono y rol.",
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
    async contextoRegistro(id) {
      const registro = await cliente
        .from("registros_iniciales")
        .select("id,nombre,telefono,ubicacion,responsable_id,lote_demostracion")
        .eq("id", id)
        .single();
      comprobar(registro.error);
      const casos = await cliente
        .from("oportunidades")
        .select("id,necesidad,estado,prospectos!inner(registro_id)")
        .eq("prospectos.registro_id", id)
        .order("actualizado_en", { ascending: false });
      comprobar(casos.error);
      return { registro: registro.data, casos: casos.data };
    },
    async propuestas(id) {
      const { data, error } = await cliente
        .from("propuestas_comerciales")
        .select(
          "id,ciclo,catalogo_version,condiciones_version,detalle,creado_en",
        )
        .eq("oportunidad_id", id)
        .order("creado_en", { ascending: false })
        .limit(20);
      comprobar(error);
      return data;
    },
    guardarPropuesta: ({
      id,
      oportunidad,
      version,
      catalogo,
      condiciones,
      datos,
    }) =>
      rpc("guardar_propuesta", {
        p_id: id,
        p_oportunidad: oportunidad,
        p_version: version,
        p_catalogo: catalogo,
        p_condiciones: condiciones,
        p_datos: datos,
      }),
    async listar({ pagina = 0, estado = "", busqueda = "" } = {}) {
      let consulta = cliente
        .from("oportunidades")
        .select("*,prospectos!inner(nombre,telefono,direccion,captado_por)", {
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
      if (busqueda.trim())
        consulta = consulta.ilike(
          "prospectos.nombre",
          `%${busqueda.trim().replace(/[%_]/g, "")}%`,
        );
      const { data, error, count } = await consulta;
      comprobar(error);
      return { filas: data, total: count };
    },
    async detalle(id) {
      const [ficha, eventos, propuestas] = await Promise.all([
        cliente
          .from("oportunidades")
          .select("*,prospectos(*)")
          .eq("id", id)
          .single(),
        cliente
          .from("eventos_oportunidades")
          .select("id,tipo,actor_id,ocurrido_en,anterior,nuevo,solicitud")
          .eq("oportunidad_id", id)
          .order("ocurrido_en", { ascending: false })
          .limit(100),
        cliente
          .from("propuestas_comerciales")
          .select("id,ciclo,detalle,catalogo_version,condiciones_version")
          .eq("oportunidad_id", id)
          .order("creado_en", { ascending: false })
          .limit(20),
      ]);
      comprobar(ficha.error);
      comprobar(eventos.error);
      comprobar(propuestas.error);
      return {
        ...ficha.data,
        eventos: eventos.data,
        propuestas: propuestas.data,
      };
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
        accion === "corregir_perdida"
          ? "corregir_perdida"
          : accion === "reactivar"
            ? "reactivar_oportunidad"
            : "gestionar_oportunidad",
        {
          p_id: id,
          p_version: version,
          p_operacion: operacion,
          ...(["reactivar", "corregir_perdida"].includes(accion)
            ? {}
            : { p_accion: accion }),
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
