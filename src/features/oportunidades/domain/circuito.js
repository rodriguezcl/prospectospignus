import { validarInteres } from "./interesComercial.js";

export const estados = {
  cotizacion: "Cotización en preparación",
  anulada: "Anulada por error de carga",
  visita: "Visita coordinada",
  seguimiento: "Seguimiento del vendedor",
  recuperacion: "Recuperación comercial",
  ganada: "Ganada",
  perdida: "Perdida",
};
export const acciones = {
  iniciar_cotizacion: "Preparar cotización",
  anular: "Anular por error de carga",
  crear: "Crear prospecto y coordinar visita",
  reprogramar: "Coordinar o reprogramar visita",
  seguimiento: "Registrar seguimiento",
  derivar: "Derivar a recuperación",
  asignar: "Asignar equilibradamente",
  reasignar: "Reasignar responsable",
  ganar: "Registrar venta concretada · Ganada",
  perder: "Cerrar como Perdida",
  reactivar: "Reactivar oportunidad perdida",
  corregir_perdida: "Corregir pérdida cargada por error (mismo ciclo)",
};
export function puedeCotizar(oportunidad, perfil) {
  if (
    !oportunidad ||
    ["ganada", "perdida", "anulada"].includes(oportunidad.estado)
  )
    return false;
  if (oportunidad.preparacion_compartida)
    return (
      oportunidad.estado === "cotizacion" &&
      ["vendedor", "administrador"].includes(perfil.rol)
    );
  return Boolean(
    oportunidad.responsable_id &&
    (perfil.rol === "administrador" ||
      (oportunidad.responsable_id === perfil.id &&
        (perfil.rol === "agente"
          ? oportunidad.estado === "recuperacion"
          : oportunidad.estado !== "recuperacion"))),
  );
}
export function accionesPermitidas(oportunidad, perfil) {
  if (!oportunidad || ["ganada", "anulada"].includes(oportunidad.estado))
    return [];
  if (oportunidad.preparacion_compartida) return [];
  const admin = perfil.rol === "administrador";
  if (oportunidad.estado === "perdida")
    return admin || oportunidad.responsable_id === perfil.id
      ? ["reactivar", ...(admin ? ["corregir_perdida"] : [])]
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
  if (
    ["crear", "iniciar_cotizacion"].includes(entrada.accion) &&
    entrada.datos.interes_comercial
  ) {
    const interes = validarInteres(entrada.datos.interes_comercial);
    const observaciones = entrada.datos.observaciones?.trim() || "";
    if (observaciones.length > 2000)
      throw new Error("Las observaciones admiten hasta 2000 caracteres.");
    if (entrada.accion === "crear" && !entrada.datos.plazo)
      throw new Error("Indicá fecha y hora de la visita.");
    return {
      ...entrada,
      datos: { ...entrada.datos, interes_comercial: interes, observaciones },
    };
  }
  if (entrada.accion === "anular" && entrada.datos.confirmar_anulacion !== "si")
    throw new Error("Confirmá la anulación por error de carga.");
  if (resumen.length < 5 || resumen.length > 2000)
    throw new Error("El resumen debe tener entre 5 y 2000 caracteres.");
  if (
    [
      "crear",
      "reprogramar",
      "seguimiento",
      "derivar",
      "reactivar",
      "corregir_perdida",
    ].includes(entrada.accion) &&
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
