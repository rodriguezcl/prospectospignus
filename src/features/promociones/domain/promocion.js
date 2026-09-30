export const TIPOS = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
};
export const MAX_ARCHIVO = 20 * 1024 * 1024;
export function validarArchivo(archivo, cabecera) {
  const extensiones = {
    "application/pdf": /\.pdf$/i,
    "image/jpeg": /\.jpe?g$/i,
    "image/png": /\.png$/i,
    "image/webp": /\.webp$/i,
  };
  if (!extensiones[archivo.type]?.test(archivo.name))
    throw new Error(
      "La extensión debe coincidir con el formato PDF, JPG, PNG o WebP.",
    );
  if (!TIPOS[archivo.type] || archivo.size < 1 || archivo.size > MAX_ARCHIVO)
    throw new Error(
      "Usá PDF, JPG, PNG o WebP de hasta 20 MB, sin archivos vacíos.",
    );
  if (
    !archivo.name ||
    archivo.name.length > 160 ||
    /[/\\\x00-\x1f]/.test(archivo.name)
  )
    throw new Error(
      "El nombre del archivo no es válido (máximo 160 caracteres).",
    );
  const b = Array.from(cabecera);
  const texto = String.fromCharCode(...b);
  const valido =
    archivo.type === "application/pdf"
      ? texto.startsWith("%PDF-")
      : archivo.type === "image/jpeg"
        ? b[0] === 255 && b[1] === 216 && b[2] === 255
        : archivo.type === "image/png"
          ? [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => b[i] === n)
          : texto.startsWith("RIFF") && texto.slice(8, 12) === "WEBP";
  if (!valido)
    throw new Error(
      "El contenido no coincide con el tipo de archivo indicado.",
    );
}
export function validarPromocion(datos) {
  const salida = {};
  for (const [campo, min, max] of [
    ["titulo", 3, 120],
    ["descripcion", 5, 10000],
    ["condiciones", 5, 10000],
  ]) {
    salida[campo] = String(datos[campo] || "").trim();
    if (salida[campo].length < min || salida[campo].length > max)
      throw new Error(`Revisá ${campo}: entre ${min} y ${max} caracteres.`);
  }
  if (!["vendedor", "agente", "ambos"].includes(datos.destinatarios))
    throw new Error("Elegí los destinatarios.");
  for (const campo of ["desde", "hasta"]) {
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(datos[campo] || "") ||
      !Number.isFinite(Date.parse(datos[campo])) ||
      new Date(datos[campo]).toISOString().slice(0, 10) !== datos[campo]
    )
      throw new Error("Revisá las fechas de vigencia.");
  }
  if (datos.hasta < datos.desde)
    throw new Error("El fin de vigencia debe ser igual o posterior al inicio.");
  return {
    ...salida,
    destinatarios: datos.destinatarios,
    desde: datos.desde,
    hasta: datos.hasta,
  };
}
export function hoyCordoba() {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Cordoba",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const dato = (tipo) => partes.find((p) => p.type === tipo).value;
  return `${dato("year")}-${dato("month")}-${dato("day")}`;
}
export function vigencia(promocion, hoy = hoyCordoba()) {
  if (promocion.estado !== "publicada")
    return promocion.estado === "archivada" ? "Archivada" : "Borrador";
  if (hoy < promocion.desde) return "Próximamente";
  return hoy > promocion.hasta ? "Vencida" : "Vigente";
}
