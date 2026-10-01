import { tieneAcceso } from "../domain/acceso.js";

// Puerto: iniciarSesion, cerrarSesion, obtenerPerfil, observarSesion, cambiarClave.
export function crearAcceso(repositorio) {
  return {
    obtenerTema: (id) => repositorio.obtenerTema(id),
    async guardarTema(id, tema) {
      if (!id || !["light", "dark"].includes(tema))
        throw new Error("La preferencia de apariencia no es válida.");
      await repositorio.guardarTema(id, tema);
    },
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
      if (typeof clave !== "string" || clave.length < 10 || clave.length > 128)
        throw new Error("Usá una contraseña de entre 10 y 128 caracteres.");
      await repositorio.cambiarClave(clave);
    },
  };
}
