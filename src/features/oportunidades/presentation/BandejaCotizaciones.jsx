import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CasosDelRegistro } from "./ContinuarRegistro.jsx";

export function BandejaCotizaciones({ gestion, perfil, revision }) {
  const [busqueda, buscar] = useState("");
  const [pagina, paginar] = useState(0);
  const [lista, listar] = useState({ filas: [], total: 0 });
  const [error, fallar] = useState("");
  const [cargando, cargar] = useState(true);
  useEffect(() => {
    let vigente = true;
    cargar(true);
    fallar("");
    gestion
      .contactos({ pagina, busqueda })
      .then((r) => {
        if (vigente) listar(r);
      })
      .catch((e) => {
        if (vigente) fallar(e.message);
      })
      .finally(() => {
        if (vigente) cargar(false);
      });
    return () => {
      vigente = false;
    };
  }, [gestion, pagina, busqueda, revision]);
  return (
    <div className="card card-body">
      <form
        className="d-flex flex-wrap gap-2 align-items-end mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          buscar(new FormData(e.currentTarget).get("nombre") || "");
          paginar(0);
        }}
      >
        <label>
          Buscar prospecto
          <input
            name="nombre"
            type="search"
            maxLength={150}
            className="form-control"
          />
        </label>
        <button className="btn btn-outline-primary">Buscar</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {cargando ? (
        <p role="status">Cargando prospectos y cotizaciones…</p>
      ) : (
        !error && (
          <>
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Prospecto</th>
                    <th>Cotizaciones y seguimiento</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.filas.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <Link to={`/prospectos?registro=${r.id}`}>
                          {r.nombre}
                        </Link>
                        <small className="d-block">
                          {r.telefono || "Sin teléfono"}
                        </small>
                      </td>
                      <td>
                        {r.casos.length ? (
                          <CasosDelRegistro casos={r.casos} />
                        ) : (
                          <span className="badge bg-secondary">
                            Sin cotización
                          </span>
                        )}
                      </td>
                      <td>
                        {(perfil.rol === "administrador" ||
                          r.responsable_id === perfil.id) && (
                          <Link
                            className="btn btn-outline-primary btn-sm"
                            to={`/cotizaciones?nueva=si&registro=${r.id}`}
                          >
                            {r.casos.length
                              ? "Cotizar otra necesidad"
                              : "Cotizar"}
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!lista.filas.length && (
              <p>
                No hay prospectos con este filtro. Cargalos en Prospectos y
                aparecerán aquí automáticamente.
              </p>
            )}
            <div className="d-flex gap-3 align-items-center">
              <button
                className="btn btn-outline-secondary"
                disabled={!pagina}
                onClick={() => paginar(pagina - 1)}
              >
                Anterior
              </button>
              <span>
                {lista.total} prospectos · página {pagina + 1}
              </span>
              <button
                className="btn btn-outline-secondary"
                disabled={(pagina + 1) * 20 >= lista.total}
                onClick={() => paginar(pagina + 1)}
              >
                Siguiente
              </button>
            </div>
          </>
        )
      )}
    </div>
  );
}
