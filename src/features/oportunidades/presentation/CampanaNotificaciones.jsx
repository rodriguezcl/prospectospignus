import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { mostrarFecha } from "../domain/circuito.js";
export function CampanaNotificaciones({ gestion }) {
  const [abierta, abrir] = useState(false);
  const [filas, guardar] = useState([]);
  const [error, fallar] = useState("");
  useEffect(() => {
    let vigente = true;
    async function cargar() {
      try {
        const datos = await gestion.notificaciones();
        if (vigente) {
          guardar(datos);
          fallar("");
        }
      } catch (e) {
        if (vigente) fallar(e.message);
      }
    }
    cargar();
    const intervalo = setInterval(cargar, 30000);
    window.addEventListener("focus", cargar);
    return () => {
      vigente = false;
      clearInterval(intervalo);
      window.removeEventListener("focus", cargar);
    };
  }, [gestion]);
  async function leer(id) {
    try {
      await gestion.leer(id);
      guardar((lista) => lista.filter((n) => n.id !== id));
    } catch (e) {
      fallar(e.message);
    }
  }
  return (
    <div className="notificaciones">
      <button
        type="button"
        className="btn btn-outline-primary"
        aria-expanded={abierta}
        aria-controls="panel-notificaciones"
        onClick={() => abrir(!abierta)}
        aria-label={`Notificaciones: ${filas.length}${filas.length === 50 ? " o más" : ""} sin leer`}
      >
        <i aria-hidden="true" className="bi bi-bell" /> {filas.length || ""}
      </button>
      {abierta && (
        <section
          id="panel-notificaciones"
          className="notificaciones-panel card shadow"
          aria-label="Notificaciones"
        >
          <div className="card-body">
            <h2 className="h5">Notificaciones</h2>
            <p>
              Leer un aviso no resuelve la oportunidad. Actualización cada 30
              segundos.
            </p>
            {error && <p role="alert">{error}</p>}
            {!error && !filas.length && <p>No tenés avisos sin leer.</p>}
            {filas.map((n) => (
              <div className="border-bottom py-2" key={n.id}>
                <Link
                  to={`/oportunidades?id=${n.oportunidad_id}`}
                  onClick={() => abrir(false)}
                >
                  {n.mensaje}
                </Link>
                <small className="d-block">{mostrarFecha(n.creado_en)}</small>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={() => leer(n.id)}
                >
                  Marcar leída
                </button>
              </div>
            ))}
            {filas.length === 50 && (
              <p>Se muestran los primeros 50 avisos sin leer.</p>
            )}
            <button
              type="button"
              className="btn btn-link"
              onClick={() => abrir(false)}
            >
              Cerrar
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
