// Conserva rutas, consultas y destinos desconocidos para que el router muestre 404.
export function normalizarHash(hash) {
  const destino = hash.replace(/^#/, "");
  if (!destino) return "#/inicio";
  return destino.startsWith("/") ? "#" + destino : "#/" + destino;
}

export function conservarEnlacesAnteriores() {
  const hash = normalizarHash(window.location.hash);
  if (hash !== window.location.hash) {
    window.history.replaceState(
      window.history.state,
      "",
      window.location.pathname + window.location.search + hash,
    );
  }
}
