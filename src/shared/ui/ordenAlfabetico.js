const comparador = new Intl.Collator("es-AR", { sensitivity: "base" });

// Orden visual sobre una copia: nunca modifica catálogos ni snapshots guardados.
export function ordenarAlfabeticamente(filas, nombre = (fila) => fila.nombre) {
  return [...filas].sort(
    (a, b) =>
      comparador.compare(nombre(a) ?? "", nombre(b) ?? "") ||
      comparador.compare(a.id ?? "", b.id ?? ""),
  );
}
