export function enfocarPanel(elemento) {
  if (!elemento) return;
  elemento.focus({ preventScroll: true });
  elemento.scrollIntoView({
    block: "start",
    behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "instant"
      : "smooth",
  });
}
