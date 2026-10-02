// Adaptación de presentación; el dominio sigue recibiendo decimales con punto.
export function monedaArgentina(valor, sinDato = "—") {
  return valor == null || valor === ""
    ? sinDato
    : new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(valor);
}
export function leerImporteArgentino(texto, decimales = 6) {
  const valor = texto.trim().replace(/^\$\s*/, "");
  if (!valor) return "";
  if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d*)?$/.test(valor))
    throw new Error("Usá puntos para miles y coma para decimales.");
  const [entero, fraccion = ""] = valor.replaceAll(".", "").split(",");
  if (fraccion.length > decimales)
    throw new Error(`Se admiten hasta ${decimales} decimales.`);
  return entero.replace(/^0+(?=\d)/, "") + (fraccion ? `.${fraccion}` : "");
}

export function numeroImporte(valor) {
  if (valor == null || valor === "") return "";
  const texto = String(valor);
  if (!/^\d+(?:\.\d+)?$/.test(texto)) return texto;
  const [entero, fraccion = ""] = texto.split(".");
  return `${entero.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraccion.padEnd(2, "0")}`;
}
