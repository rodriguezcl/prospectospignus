export const tiposActividad = Object.freeze({
  visita: "Visita comercial",
  llamada: "Llamada",
  puerta_a_puerta: "Puerta a puerta",
  reunion: "Reunión",
  traslado: "Traslado",
  administrativa: "Tarea administrativa",
  otra: "Otra actividad",
});
export const estadosActividad = Object.freeze({
  programada: "Programada",
  en_curso: "En curso",
  realizada: "Realizada",
  cancelada: "Cancelada",
});
export const zonaAgenda = "America/Argentina/Cordoba";
export function fechaCordoba(valor = new Date()) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: zonaAgenda,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(valor));
  return ["year", "month", "day"]
    .map((tipo) => partes.find((p) => p.type === tipo).value)
    .join("-");
}
export function fechaHoraLocal(valor) {
  if (!valor) return "";
  const hora = new Intl.DateTimeFormat("es-AR", {
    timeZone: zonaAgenda,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(valor));
  return `${fechaCordoba(valor)}T${hora}`;
}
export function instanteCordoba(valor) {
  if (!valor) return null;
  // Los horarios actuales de Córdoba son UTC-03; no dependen de la zona del dispositivo.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor))
    throw new Error("Indicá una fecha y hora válida.");
  const instante = new Date(`${valor}:00-03:00`);
  if (
    !Number.isFinite(instante.getTime()) ||
    fechaHoraLocal(instante) !== valor
  )
    throw new Error("Indicá una fecha y hora válida de Córdoba.");
  return instante.toISOString();
}
export function sumarDias(fecha, cantidad) {
  const d = new Date(`${fecha}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + cantidad);
  return d.toISOString().slice(0, 10);
}
export function diasVista(fecha, semanal) {
  const dia = new Date(`${fecha}T12:00:00Z`).getUTCDay();
  const inicio = semanal ? sumarDias(fecha, -((dia + 6) % 7)) : fecha;
  return Array.from({ length: semanal ? 7 : 1 }, (_, i) =>
    sumarDias(inicio, i),
  );
}
export function inicioActividad(a) {
  return a.inicio_real || a.inicio_previsto;
}
export function finActividad(a, ahora = new Date()) {
  return (
    a.fin_real ||
    (a.estado === "en_curso"
      ? new Date(ahora).toISOString()
      : a.inicio_real || a.fin_previsto) ||
    inicioActividad(a)
  );
}
export function actividadesDelDia(filas, dia, ahora = new Date()) {
  const desde = new Date(`${dia}T00:00:00-03:00`).getTime(),
    hasta = new Date(`${sumarDias(dia, 1)}T00:00:00-03:00`).getTime();
  return filas
    .filter(
      (a) =>
        new Date(inicioActividad(a)).getTime() < hasta &&
        (new Date(finActividad(a, ahora)).getTime() > desde ||
          new Date(inicioActividad(a)).getTime() >= desde),
    )
    .sort(
      (a, b) =>
        new Date(inicioActividad(a)) - new Date(inicioActividad(b)) ||
        a.id.localeCompare(b.id),
    );
}
export function franjaActividad(a, dia, ahora = new Date()) {
  const desde = new Date(`${dia}T00:00:00-03:00`).getTime(),
    hasta = new Date(`${sumarDias(dia, 1)}T00:00:00-03:00`).getTime();
  const inicio = Math.max(new Date(inicioActividad(a)).getTime(), desde),
    fin = Math.min(new Date(finActividad(a, ahora)).getTime(), hasta);
  const ocho = new Date(`${dia}T08:00:00-03:00`).getTime(),
    diecisiete = new Date(`${dia}T17:00:00-03:00`).getTime();
  if (inicio === fin)
    return inicio >= ocho && inicio < diecisiete
      ? "Dentro de referencia"
      : "Fuera de referencia";
  if (inicio >= ocho && fin <= diecisiete) return "Dentro de referencia";
  if (fin <= ocho || inicio >= diecisiete) return "Fuera de referencia";
  return "Abarca ambos períodos";
}
export function estadoVisible(a, ahora = new Date()) {
  return a.estado === "programada" &&
    new Date(a.fin_previsto || a.inicio_previsto) < ahora
    ? "Pendiente de actualizar"
    : estadosActividad[a.estado];
}
export function validarActividad(datos, accion, ahora = new Date()) {
  const d = { ...datos };
  if (["crear", "editar"].includes(accion)) {
    d.titulo = (d.titulo || "").trim();
    d.nota = (d.nota || "").trim();
    if (
      d.titulo.length < 3 ||
      d.titulo.length > 160 ||
      !tiposActividad[d.tipo] ||
      d.nota.length > 2000
    )
      throw new Error(
        "Completá tipo y título (3 a 160 caracteres). La nota admite hasta 2000.",
      );
    if (
      d.estado !== "realizada" &&
      (!d.inicio_previsto || new Date(d.inicio_previsto) <= ahora)
    )
      throw new Error(
        "Para programar, elegí una fecha futura. Para una actividad pasada, elegí registrar realizada.",
      );
  }
  for (const sufijo of ["previsto", "real"]) {
    const inicio = d[`inicio_${sufijo}`],
      fin = d[`fin_${sufijo}`];
    if (
      (inicio && !Number.isFinite(Date.parse(inicio))) ||
      (fin &&
        (!inicio ||
          !Number.isFinite(Date.parse(fin)) ||
          new Date(fin) <= new Date(inicio)))
    )
      throw new Error("La finalización debe ser posterior al inicio.");
  }
  if (d.estado === "realizada" || ["finalizar", "corregir"].includes(accion)) {
    if (
      !d.inicio_real ||
      !d.fin_real ||
      new Date(d.inicio_real) > ahora ||
      new Date(d.fin_real) > ahora ||
      (d.resultado || "").trim().length < 3
    )
      throw new Error(
        "Indicá inicio, fin no futuros y un resultado de al menos 3 caracteres.",
      );
  }
  if (
    ["editar", "corregir", "cancelar"].includes(accion) &&
    (d.motivo || "").trim().length < 3
  )
    throw new Error("Indicá el motivo del cambio (al menos 3 caracteres).");
  return d;
}
