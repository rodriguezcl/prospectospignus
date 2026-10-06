const campos =
  "id,nombre,telefono,correo,ubicacion,observaciones,origen,responsable_id,creado_por,creado_en,actualizado_en,version,lote_demostracion";
function comprobar(error) {
  if (!error) return;
  const mensajes = {
    PROSPECTO_ADMIN: "Solo administración puede eliminar prospectos.",
    PROSPECTO_MOTIVO: "Indicá un motivo de entre 5 y 500 caracteres.",
    PROSPECTO_VINCULADO:
      "No se puede eliminar: tiene cotizaciones o antecedentes vinculados, o pertenece a una carga histórica o de demostración. Se conserva su historial.",
    PROSPECTO_NO_DISPONIBLE:
      "El prospecto ya no está disponible. Recargá el listado.",
  };
  if (mensajes[error.message]) throw new Error(mensajes[error.message]);
  if (["42P01", "PGRST205", "PGRST202"].includes(error.code))
    throw new Error(
      "Falta activar la base de prospectos en Supabase. Aplicá la migración 202610060032.",
    );
  if (error.code === "42501")
    throw new Error(
      "No tenés acceso a esta operación. Revisá tu sesión y la asignación.",
    );
  if (error.code === "40001")
    throw new Error(
      "El registro cambió o la carga ya fue confirmada. Recargá el detalle antes de guardar.",
    );
  if (["22023", "23514", "23502", "22P02", "23503"].includes(error.code))
    throw new Error("Revisá los datos y el origen del prospecto.");
  throw new Error(
    "No pudimos confirmar la operación. Revisá tu conexión y reintentá sin cambiar los datos para evitar duplicados.",
  );
}
export function crearRepositorioRegistros(cliente) {
  return {
    async eliminar(id, version, motivo) {
      const { data, error } = await cliente.rpc("eliminar_prospecto_033", {
        p_id: id,
        p_version: version,
        p_motivo: motivo,
      });
      if (error?.code === "PGRST202")
        throw new Error(
          "Falta activar la eliminación de prospectos: migración 202610060033.",
        );
      comprobar(error);
      if (data !== id)
        throw new Error(
          "El servidor no confirmó la eliminación. Reintentá con el mismo motivo.",
        );
      return data;
    },
    async catalogos() {
      const [origenes, perfiles] = await Promise.all([
        cliente
          .from("origenes_registros")
          .select("codigo,nombre,activo")
          .order("nombre"),
        cliente.rpc("autores_prospectos_032"),
      ]);
      comprobar(origenes.error);
      comprobar(perfiles.error);
      return { origenes: origenes.data, perfiles: perfiles.data };
    },
    async listar({ pagina = 0, busqueda = "", origen = "", autor = "" } = {}) {
      let consulta = cliente
        .from("registros_iniciales")
        .select(campos, { count: "exact" });
      if (busqueda.trim())
        consulta = consulta.ilike(
          "nombre",
          `%${busqueda.trim().replace(/[\\%_]/g, "\\$&")}%`,
        );
      if (origen) consulta = consulta.eq("origen", origen);
      if (autor) consulta = consulta.eq("creado_por", autor);
      const { data, count, error } = await consulta
        .order("nombre")
        .order("id")
        .range(pagina * 20, pagina * 20 + 19);
      comprobar(error);
      return { registros: data, total: count };
    },
    async obtener(id) {
      const { data, error } = await cliente
        .from("registros_iniciales")
        .select(campos)
        .eq("id", id)
        .maybeSingle();
      comprobar(error);
      if (!data)
        throw new Error("Registro no disponible o sin permiso de acceso.");
      return data;
    },
    async historial(id) {
      const { data, error } = await cliente
        .from("eventos_registros")
        .select("id,actor_id,tipo,ocurrido_en,motivo,anterior,nuevo")
        .eq("registro_id", id)
        .order("id", { ascending: false })
        .limit(50);
      comprobar(error);
      return data;
    },
    async guardar(id, version, datos) {
      const { data, error } = await cliente.rpc(
        "guardar_registro_inicial_032",
        {
          p_id: id,
          p_version: version,
          p_datos: datos,
        },
      );
      comprobar(error);
      if (!data?.id)
        throw new Error(
          "El servidor no confirmó el registro. Reintentá sin cambiar los datos.",
        );
      return data;
    },
  };
}
