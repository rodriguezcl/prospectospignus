export function crearRepositorioUsuarios(cliente) {
  return {
    async listar() {
      const { data, error } = await cliente
        .from("perfiles")
        .select(
          "id,nombre,correo,rol,activo,creado_en,version,lote_demostracion",
        )
        .order("creado_en", { ascending: false })
        .limit(200);
      if (error)
        throw new Error("No pudimos cargar las cuentas. Intentá nuevamente.");
      return data;
    },
    async gestionar({ id, version, accion, datos }) {
      const { error } = await cliente.rpc("gestionar_cuenta", {
        p_id: id,
        p_version: version,
        p_accion: accion,
        p_datos: datos,
      });
      if (!error) return;
      const mensajes = {
        CUENTA_TRABAJO_PENDIENTE:
          "Reasigná sus oportunidades abiertas antes de cambiar el rol o desactivar la cuenta.",
        CUENTA_ACCESO: "Solo un administrador activo puede gestionar cuentas.",
        CUENTA_DATOS: "Revisá los datos de la cuenta.",
        CUENTA_MOTIVO: "Ingresá un motivo de entre 5 y 500 caracteres.",
        CUENTA_NO_EXISTE: "La cuenta ya no existe. Recargá la lista.",
        CUENTA_CONFLICTO:
          "Otra persona modificó esta cuenta. Cancelá y recargá la lista antes de continuar.",
        CUENTA_DEMO:
          "Las cuentas DEMO se retiran mediante la limpieza de su lote.",
        CUENTA_ULTIMO_ADMIN:
          "No se puede quitar el acceso al último administrador activo.",
        CUENTA_PROPIA:
          "Pedile a otro administrador que cambie tu rol o retire tu acceso.",
        CUENTA_VINCULADA:
          "La cuenta tiene registros o historial asociado. Podés desactivarla, pero no eliminarla.",
        CUENTA_CONFIRMACION:
          "El correo de confirmación no coincide con la cuenta.",
      };
      throw new Error(
        mensajes[error.message] ||
          "No pudimos confirmar el cambio. Recargá la lista antes de volver a intentar.",
      );
    },
    async crear(datos) {
      const { data, error } = await cliente.functions.invoke("crear-usuario", {
        body: datos,
      });
      if (error) {
        const codigo = error.context?.status;
        if (codigo === 403)
          throw new Error("No tenés autorización para crear cuentas.");
        if (codigo === 401)
          throw new Error("Tu sesión venció. Volvé a ingresar.");
        if (codigo === 409)
          throw new Error("Ya existe una cuenta con ese correo.");
        if (codigo === 429)
          throw new Error(
            "Se alcanzó el límite de solicitudes. Intentá más tarde.",
          );
        throw new Error(
          "No pudimos confirmar la creación. Recargá la lista antes de volver a intentar.",
        );
      }
      if (!data?.usuario?.id)
        throw new Error(
          "El servidor no confirmó la creación. Recargá la lista antes de volver a intentar.",
        );
      return data.usuario;
    },
  };
}
