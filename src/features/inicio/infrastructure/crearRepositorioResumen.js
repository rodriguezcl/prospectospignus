function comprobar(error) {
  if (!error) return;
  if (error.code === "PGRST202")
    throw new Error(
      "Falta aplicar la migración de estadísticas (202609300004).",
    );
  throw new Error(
    "No pudimos cargar las estadísticas. Revisá tu conexión y volvé a intentar.",
  );
}

export function crearRepositorioResumen(cliente) {
  return {
    async cargar(mes) {
      // Evitar el límite implícito de PostgREST: nunca mostrar totales truncados.
      const registros = [];
      const ids = new Set();
      for (let desde = 0; ; desde += 500) {
        const { data, error } = await cliente
          .rpc("listar_resumen_mensual", { p_mes: `${mes}-01` })
          .range(desde, desde + 499);
        comprobar(error);
        for (const r of data) {
          if (ids.has(r.id))
            throw new Error(
              "Los registros cambiaron durante la lectura. Recargá el tablero.",
            );
          ids.add(r.id);
          registros.push(r);
        }
        if (registros.length > 10000)
          throw new Error(
            "Este mes supera el límite de lectura del tablero (10.000). No se muestran totales parciales.",
          );
        if (data.length < 500) break;
      }
      const [perfiles, origenes] = await Promise.all([
        cliente.from("perfiles").select("id,nombre"),
        cliente.from("origenes_registros").select("codigo,nombre"),
      ]);
      comprobar(perfiles.error);
      comprobar(origenes.error);
      return { registros, perfiles: perfiles.data, origenes: origenes.data };
    },
  };
}
