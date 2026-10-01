export function crearRepositorioAutenticacion(cliente) {
  return {
    async obtenerTema(id) {
      const { data, error } = await cliente.auth.getUser();
      if (error || data.user?.id !== id)
        throw new Error("No pudimos recuperar tu preferencia de apariencia.");
      return data.user.user_metadata?.pignus_tema === "dark" ? "dark" : "light";
    },
    async guardarTema(id, tema) {
      const { data, error } = await cliente.auth.getUser();
      if (error || data.user?.id !== id)
        throw new Error(
          "Tu sesión cambió. Volvé a ingresar para guardar la apariencia.",
        );
      const resultado = await cliente.auth.updateUser({
        data: { pignus_tema: tema },
      });
      if (resultado.error || resultado.data.user?.id !== id)
        throw new Error(
          "No pudimos guardar la apariencia. Volvé a intentarlo.",
        );
    },
    async iniciarSesion(correo, clave) {
      const { error } = await cliente.auth.signInWithPassword({
        email: correo,
        password: clave,
      });
      if (error)
        throw new Error(
          error.status === 429
            ? "Demasiados intentos. Esperá unos minutos."
            : "No pudimos iniciar sesión. Revisá tus datos y la conexión.",
        );
    },
    async cerrarSesion() {
      const { error } = await cliente.auth.signOut({ scope: "local" });
      if (error)
        throw new Error("No pudimos cerrar la sesión. Volvé a intentarlo.");
    },
    async obtenerPerfil(id) {
      const { data, error } = await cliente
        .from("perfiles")
        .select("id,nombre,correo,rol,activo")
        .eq("id", id)
        .maybeSingle();
      if (error)
        throw new Error(
          "No pudimos verificar tu acceso. Revisá la conexión e intentá nuevamente.",
        );
      return data;
    },
    observarSesion(notificar) {
      // No ejecutar consultas Supabase dentro del callback síncrono del SDK.
      const { data } = cliente.auth.onAuthStateChange((_evento, sesion) =>
        notificar(sesion?.user?.id ?? null),
      );
      return () => data.subscription.unsubscribe();
    },
    async cambiarClave(clave) {
      const { error } = await cliente.auth.updateUser({ password: clave });
      if (error)
        throw new Error(
          "No pudimos actualizar la contraseña. Puede ser necesario volver a iniciar sesión.",
        );
    },
  };
}
