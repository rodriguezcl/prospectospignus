export function crearRepositorioUsuarios(cliente) {
  return {
    async listar() {
      const { data, error } = await cliente
        .from("perfiles")
        .select("id,nombre,correo,rol,activo,creado_en")
        .order("creado_en", { ascending: false })
        .limit(200);
      if (error)
        throw new Error("No pudimos cargar las cuentas. Intentá nuevamente.");
      return data;
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
