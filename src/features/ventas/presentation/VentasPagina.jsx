import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const fecha = (valor) =>
  valor
    ? new Intl.DateTimeFormat("es-AR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Argentina/Cordoba",
      }).format(new Date(valor))
    : "No informada";
const periodo = (valor) =>
  valor
    ? new Intl.DateTimeFormat("es-AR", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${valor.slice(0, 10)}T12:00:00Z`))
    : "Mes no informado";

export function FilasVentas({ filas }) {
  return filas.map((v) => (
    <tr key={v.id}>
      <td>
        {v.nombre}
        <small className="d-block">{v.necesidad}</small>
      </td>
      <td>{v.responsable_nombre || "No informado"}</td>
      <td>{v.vendedor_visita_nombre || "No informado"}</td>
      <td>
        {v.cerrado_en ? (
          fecha(v.cerrado_en)
        ) : (
          <>
            {periodo(v.mes_cierre)}
            <small className="d-block">Fecha exacta no informada</small>
          </>
        )}
      </td>
      <td className="texto-con-saltos">{v.condiciones || "No informadas"}</td>
      <td>
        {v.canal_confirmacion || "Canal no informado"}
        <small className="d-block">{fecha(v.confirmado_en)}</small>
      </td>
      <td>
        <Link to={`/prospectos?id=${v.id}`}>Ver ficha e historial</Link>
      </td>
    </tr>
  ));
}

export function VentasPagina({ gestion, perfil }) {
  const [mes, cambiarMes] = useState("");
  const [responsable, cambiarResponsable] = useState("");
  const [pagina, paginar] = useState(0);
  const [revision, revisar] = useState(0);
  const [resultado, guardarResultado] = useState({
    filas: [],
    total: 0,
    responsables: [],
  });
  const [cargando, cargar] = useState(true);
  const [error, fallar] = useState("");
  useEffect(() => {
    let vigente = true;
    cargar(true);
    fallar("");
    gestion
      .listar({ mes, responsable, pagina })
      .then((datos) => {
        if (vigente) guardarResultado(datos);
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
  }, [gestion, mes, responsable, pagina, revision]);
  return (
    <section aria-labelledby="titulo-ventas">
      <h1 id="titulo-ventas">Ventas concretadas</h1>
      <p>
        Casos ganados por aceptación comercial. No acredita instalación,
        contrato ni cobro.
      </p>
      <p>
        {perfil.rol === "administrador"
          ? "Ves los cierres de todo el equipo."
          : "Ves únicamente los cierres atribuidos a vos, aunque hayas participado en otros casos."}{" "}
        Cada caso se cuenta una sola vez.
      </p>
      <div className="card">
        <div className="card-body">
          <div className="d-flex flex-wrap gap-3 align-items-end mb-3">
            <label>
              Mes de cierre · Córdoba
              <input
                className="form-control"
                type="month"
                value={mes}
                onChange={(e) => {
                  cambiarMes(e.target.value);
                  paginar(0);
                }}
              />
            </label>
            {perfil.rol === "administrador" && (
              <label>
                Responsable al cierre
                <select
                  className="form-select"
                  value={responsable}
                  onChange={(e) => {
                    cambiarResponsable(e.target.value);
                    paginar(0);
                  }}
                >
                  <option value="">Todo el equipo</option>
                  {resultado.responsables.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              className="btn btn-outline-secondary"
              onClick={() => {
                cambiarMes("");
                cambiarResponsable("");
                paginar(0);
              }}
            >
              Limpiar filtros
            </button>
            <button
              className="btn btn-outline-primary"
              disabled={cargando}
              onClick={() => revisar((n) => n + 1)}
            >
              Actualizar
            </button>
          </div>
          <p className="text-muted">
            {mes ? `Período: ${periodo(`${mes}-01`)}` : "Todos los meses"}. En
            el histórico se muestra el mes informado cuando no hay fecha exacta
            de cierre.
          </p>
          {error && (
            <p role="alert" className="alert alert-danger">
              {error}
            </p>
          )}
          {cargando && <p role="status">Cargando ventas…</p>}
          {!cargando && !error && (
            <>
              <h2 className="h4">{resultado.total} ventas concretadas</h2>
              <div className="table-responsive">
                <table className="table align-middle">
                  <thead>
                    <tr>
                      <th>Prospecto / necesidad</th>
                      <th>Responsable al cierre</th>
                      <th>Vendedor de visita</th>
                      <th>Cierre · Córdoba</th>
                      <th>Condiciones aceptadas</th>
                      <th>Confirmación</th>
                      <th>Detalle</th>
                    </tr>
                  </thead>
                  <tbody>
                    <FilasVentas filas={resultado.filas} />
                  </tbody>
                </table>
              </div>
              {!resultado.filas.length && (
                <p>No hay ventas concretadas para estos filtros.</p>
              )}
              <div className="d-flex gap-3 align-items-center">
                <button
                  className="btn btn-outline-secondary"
                  disabled={!pagina}
                  onClick={() => paginar(pagina - 1)}
                >
                  Anterior
                </button>
                <span>Página {pagina + 1}</span>
                <button
                  className="btn btn-outline-secondary"
                  disabled={(pagina + 1) * 20 >= resultado.total}
                  onClick={() => paginar(pagina + 1)}
                >
                  Siguiente
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
