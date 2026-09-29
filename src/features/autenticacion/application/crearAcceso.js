import { tieneAcceso } from "../domain/acceso.js";

// Puerto: iniciarSesion, cerrarSesion, obtenerPerfil, observarSesion, cambiarClave.
export function crearAcceso(repositorio) {
  return {
    async ingresar(correo, clave) {
      if (!correo.trim() || !clave)
        throw new Error("Ingresá tu correo y contraseña.");
      await repositorio.iniciarSesion(correo.trim().toLowerCase(), clave);
    },
    async resolverPerfil(id) {
      if (!id) return null;
      const perfil = await repositorio.obtenerPerfil(id);
      if (!tieneAcceso(perfil))
        throw new Error(
          "Tu cuenta no tiene acceso habilitado. Contactá al administrador.",
        );
      return perfil;
    },
    salir: () => repositorio.cerrarSesion(),
    observar: (notificar) => repositorio.observarSesion(notificar),
    async cambiarClave(clave) {
      if (clave.length < 12 || clave.length > 128)
        throw new Error("Usá una contraseña de entre 12 y 128 caracteres.");
      await repositorio.cambiarClave(clave);
    },
  };
}
