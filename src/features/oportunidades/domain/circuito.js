export const estados = {
  visita: "Visita coordinada",
  seguimiento: "Seguimiento del vendedor",
  recuperacion: "Recuperación comercial",
  ganada: "Ganada",
  perdida: "Perdida",
};
export const acciones = {
  crear: "Calificar y coordinar visita",
  reprogramar: "Reprogramar visita",
  seguimiento: "Registrar seguimiento",
  derivar: "Derivar a recuperación",
  asignar: "Asignar equilibradamente",
  reasignar: "Reasignar responsable",
  ganar: "Registrar aceptación · Ganada",
  perder: "Cerrar como Perdida",
  reactivar: "Reactivar oportunidad perdida",
};
export function accionesPermitidas(oportunidad, perfil) {
  if (!oportunidad || oportunidad.estado === "ganada") return [];
  const admin = perfil.rol === "administrador";
  if (oportunidad.estado === "perdida")
    return admin || oportunidad.responsable_id === perfil.id
      ? ["reactivar"]
      : [];
  if (!oportunidad.responsable_id)
    return admin
      ? ["asignar", "reasignar"]
      : perfil.rol === "agente"
        ? ["asignar"]
        : [];
  if (!admin && oportunidad.responsable_id !== perfil.id) return [];
  return [
    "seguimiento",
    ...(oportunidad.estado === "recuperacion"
      ? []
      : ["reprogramar", "derivar"]),
    "ganar",
    "perder",
    ...(admin ? ["reasignar"] : []),
  ];
}
export function validarOperacion(entrada) {
  if (!acciones[entrada.accion])
    throw new Error("Seleccioná una acción válida.");
  const resumen = entrada.datos.resumen?.trim() || "";
  if (resumen.length < 5 || resumen.length > 2000)
    throw new Error("El resumen debe tener entre 5 y 2000 caracteres.");
  if (
    ["crear", "reprogramar", "seguimiento", "derivar", "reactivar"].includes(
      entrada.accion,
    ) &&
    !entrada.datos.plazo
  )
    throw new Error("Indicá fecha y hora de la próxima acción.");
  return { ...entrada, datos: { ...entrada.datos, resumen } };
}
// La fecha de los formularios se interpreta siempre en Córdoba, no en la zona del navegador.
export function fechaCordoba(valor) {
  return valor ? new Date(`${valor}:00-03:00`).toISOString() : null;
}
export function mostrarFecha(valor) {
  return valor
    ? new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Argentina/Cordoba",
      }).format(new Date(valor))
    : "—";
}
