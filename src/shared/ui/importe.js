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
  // Conserva el pegado argentino con miles. Un punto aislado que no forma
  // grupos de miles también puede separar decimales (por ejemplo, 127.80).
  const argentino = /^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d*)?$/.test(valor);
  const decimalConPunto = /^\d+\.\d*$/.test(valor);
  if (!argentino && !decimalConPunto)
    throw new Error("Usá coma o punto para decimales; por ejemplo, 127,80 o 127.80.");
  const [entero, fraccion = ""] = argentino
    ? valor.replaceAll(".", "").split(",")
    : valor.split(".");
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
