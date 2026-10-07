export const ubicacionesAlarma = {
  docta: "Docta Urbanización",
  nobu: "Nobu Town",
  con_monitoreo: "Residencial con monitoreo",
  sin_monitoreo: "Residencial sin monitoreo",
};
export function ubicacionesMarca(marca) {
  return (
    marca?.ubicaciones_alarma ??
    (marca?.nombre?.trim().toUpperCase() === "HIKVISION"
      ? ["con_monitoreo", "sin_monitoreo"]
      : Object.keys(ubicacionesAlarma))
  );
}
export function ubicacionesOferta(catalogo, oferta) {
  const marca = catalogo.marcas?.find((m) => m.id === oferta?.marca_id);
  return oferta?.ubicaciones_alarma ?? ubicacionesMarca(marca);
}
export function ofertaEnUbicacion(catalogo, oferta, ubicacion) {
  if (oferta?.servicio !== "alarma") return true;
  const marca = catalogo.marcas?.find((m) => m.id === oferta.marca_id);
  return (
    ubicacionesMarca(marca).includes(ubicacion) &&
    ubicacionesOferta(catalogo, oferta).includes(ubicacion)
  );
}
export function prepararUbicaciones(datos) {
  const copia = structuredClone(datos);
  copia.ubicaciones_version = 1;
  copia.marcas = copia.marcas.map((m) => ({
    ...m,
    ubicaciones_alarma: ubicacionesMarca(m),
  }));
  copia.items = copia.items.map((i) =>
    i.tipo === "kit" && i.servicio === "alarma"
      ? { ...i, ubicaciones_alarma: ubicacionesOferta(copia, i) }
      : i,
  );
  return copia;
}
