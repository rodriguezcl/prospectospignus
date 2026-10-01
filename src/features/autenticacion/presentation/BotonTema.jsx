import { useEffect, useRef, useState } from "react";

// Se monta por identidad desde el layout; nunca conserva el tema de otra cuenta.
export function BotonTema({ id, acceso }) {
  const [tema, cambiarTema] = useState("light");
  const [ocupado, cambiarOcupado] = useState(true);
  const [error, cambiarError] = useState("");
  const vigente = useRef(false);

  useEffect(() => {
    let activo = true;
    vigente.current = true;
    acceso
      .obtenerTema(id)
      .then((valor) => {
        if (activo) cambiarTema(valor);
      })
      .catch((fallo) => {
        if (activo) cambiarError(fallo.message);
      })
      .finally(() => {
        if (activo) cambiarOcupado(false);
      });
    return () => {
      activo = false;
      vigente.current = false;
      document.documentElement.setAttribute("data-bs-theme", "light");
    };
  }, [id, acceso]);

  useEffect(() => {
    document.documentElement.setAttribute("data-bs-theme", tema);
  }, [tema]);

  async function alternar() {
    const siguiente = tema === "dark" ? "light" : "dark";
    cambiarOcupado(true);
    cambiarError("");
    try {
      await acceso.guardarTema(id, siguiente);
      if (vigente.current) cambiarTema(siguiente);
    } catch (fallo) {
      if (vigente.current) cambiarError(fallo.message);
    } finally {
      if (vigente.current) cambiarOcupado(false);
    }
  }

  return (
    <div className="control-tema">
      <button
        type="button"
        className="btn btn-outline-secondary btn-sm"
        aria-label="Modo noche"
        aria-pressed={tema === "dark"}
        title={
          ocupado
            ? "Cargando apariencia…"
            : tema === "dark"
              ? "Cambiar a modo día"
              : "Cambiar a modo noche"
        }
        disabled={ocupado}
        onClick={alternar}
      >
        <i
          className={`bi ${tema === "dark" ? "bi-sun" : "bi-moon-stars"}`}
          aria-hidden="true"
        />
        <span className="visually-hidden">Modo noche</span>
      </button>
      {error && (
        <span className="error-tema alert alert-danger" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
