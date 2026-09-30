export const roles = Object.freeze({
  agente: "agente",
  administrador: "administrador",
  vendedor: "vendedor",
});

export function tieneAcceso(perfil) {
  return perfil?.activo === true && Object.values(roles).includes(perfil.rol);
}

export function esAdministrador(perfil) {
  return tieneAcceso(perfil) && perfil.rol === roles.administrador;
}
