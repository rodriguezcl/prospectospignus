export function BarraSuperior({ abierto, alternar, referencia }) {
  return (
    <header className="barra-superior">
      <button
        ref={referencia}
        id="abrir-menu"
        className="btn btn-light"
        aria-label={abierto ? "Ocultar menú" : "Abrir menú"}
        aria-controls="sidebar"
        aria-expanded={abierto}
        onClick={alternar}
      >
        ☰
      </button>
      <span>Espacio comercial</span>
      <span className="badge bg-light-primary">Vista preliminar</span>
    </header>
  );
}
