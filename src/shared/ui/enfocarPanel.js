export function enfocarPanel(elemento) {
  if (!elemento) return;
  // Destino de navegación, no control interactivo: evita enmarcar todo el panel.
  if (
    elemento.matches("section, article, div, details, h1, h2, h3, h4, h5, h6")
  )
    elemento.setAttribute("data-foco-panel", "");
  elemento.focus({ preventScroll: true });
  elemento.scrollIntoView({
    block: "start",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
}
