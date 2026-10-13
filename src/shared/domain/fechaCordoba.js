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
  // Córdoba usa UTC-03; la entrada no depende de la zona del dispositivo.
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
