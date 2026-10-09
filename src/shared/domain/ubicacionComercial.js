export const ubicacionesComerciales = {
  docta: "Docta",
  nobu: "Nobu",
  residencial: "Residencial",
};
export const nombreUbicacionComercial = (valor) =>
  ubicacionesComerciales[valor] || "Sin clasificar";

export function ubicacionInicialAlarma(ubicacion) {
  if (ubicacion === "docta" || ubicacion === "nobu") return ubicacion;
  return ubicacion === "residencial" ? "" : "a_definir";
}
