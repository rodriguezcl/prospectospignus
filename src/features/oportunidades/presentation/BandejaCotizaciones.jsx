import { AccionesNegociaciones } from "./ContinuarRegistro.jsx";
import { FiltroUbicacionComercial } from "../../../shared/ui/UbicacionComercial.jsx";
import { nombreUbicacionComercial } from "../../../shared/domain/ubicacionComercial.js";
import { AtencionProspecto } from "./AtencionProspecto.jsx";
import { useSearchParams } from "react-router-dom";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { estados } from "../domain/circuito.js";

export function BandejaCotizaciones({ gestion, perfil, revision }) {
  const [parametros] = useSearchParams();
  const [atencion, filtrarAtencion] = useState(
    parametros.get("atencion") || "",
  );
  useEffect(() => {
    filtrarAtencion(parametros.get("atencion") || "");
    paginar(0);
  }, [parametros]);
  const [actualizacion, actualizar] = useState(0);
  useEffect(() => {
    const t = setInterval(() => actualizar((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);
  const [busqueda, buscar] = useState("");
  const [ubicacionComercial, filtrarUbicacion] = useState("");
  const [pagina, paginar] = useState(0);
  const [lista, listar] = useState({ filas: [], total: 0 });
  const [error, fallar] = useState("");
  const [cargando, cargar] = useState(true);
  useEffect(() => {
    let vigente = true;
    cargar(true);
    fallar("");
    gestion
      .contactos({
        pagina,
        busqueda,
        atencion,
        ubicacion_comercial: ubicacionComercial,
      })
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
  }, [
    gestion,
    pagina,
    busqueda,
    revision,
    atencion,
    actualizacion,
    ubicacionComercial,
  ]);
  return (
    <div className="card card-body">
      <h2 className="h5">Prospectos para contactar</h2>
      <p className="small">
        Tomá el prospecto antes de contactarlo. La reserva es exclusiva y se
        mantiene hasta liberarla. El listado se actualiza cada 30 segundos.
      </p>
      <FiltroUbicacionComercial
        valor={ubicacionComercial}
        cambiar={(valor) => {
          filtrarUbicacion(valor);
          paginar(0);
        }}
      />
      <label className="mb-3">
        Atención
        <select
          className="form-select"
          value={atencion}
          onChange={(e) => {
            filtrarAtencion(e.target.value);
            paginar(0);
          }}
        >
          <option value="">Todos los prospectos</option>
          <option value="disponibles">Disponibles para contactar</option>
          <option value="mios">Tomados por mí</option>
          <option value="tomados">Todos los tomados</option>
        </select>
      </label>
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
              <table className="table tabla-adaptable bandeja-cotizaciones">
                <thead>
                  <tr>
                    <th>Prospecto</th>
                    <th>Atención</th>
                    <th>Cotizaciones y seguimiento</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.filas.map((r) => (
                    <tr key={r.id}>
                      <td data-label="Prospecto">
                        <Link to={`/prospectos?registro=${r.id}`}>
                          {r.nombre}
                        </Link>
                        <small className="d-block">
                          {r.telefono || "Sin teléfono"} ·{" "}
                          {nombreUbicacionComercial(r.ubicacion_comercial)}
                        </small>
                      </td>
                      <td data-label="Atención">
                        <AtencionProspecto
                          atencion={r.atencion}
                          perfil={perfil}
                          gestion={gestion}
                          actualizada={() => actualizar((n) => n + 1)}
                        />
                      </td>
                      <td data-label="Cotizaciones y seguimiento">
                        {r.casos.length ? (
                          <ul className="list-unstyled mb-0">
                            {r.casos.map((c) => (
                              <li className="mb-2" key={c.id}>
                                <strong>{c.necesidad}</strong>
                                <small className="d-block">
                                  {estados[c.estado]} ·{" "}
                                  {c.preparacion_compartida
                                    ? "Primera oferta pendiente"
                                    : c.responsable_nombre ||
                                      "Seguimiento asignado"}
                                </small>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <span className="badge bg-secondary">
                            Sin cotización
                          </span>
                        )}
                      </td>
                      <td data-label="Acciones" className="celda-acciones">
                        <AccionesNegociaciones
                          registro={r}
                          contexto={r}
                          perfil={perfil}
                        />
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
            <div className="d-flex flex-wrap gap-3 align-items-center">
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
