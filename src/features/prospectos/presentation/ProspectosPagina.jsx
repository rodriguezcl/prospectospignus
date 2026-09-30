import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

export function ProspectosPagina({ gestion }) {
  const [pagina, paginar] = useState(0);
  const [lista, listar] = useState({ filas: [], total: 0 });
  const [error, fallar] = useState("");
  const [cargando, cargar] = useState(true);
  useEffect(() => {
    let vigente = true;
    cargar(true);
    fallar("");
    gestion
      .prospectos(pagina)
      .then((datos) => {
        if (vigente) listar(datos);
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
  }, [gestion, pagina]);
  return (
    <section>
      <h1>Prospectos</h1>
      <p>
        Contactos calificados y sus oportunidades accesibles. El registro
        inicial y la atribución de captación se conservan.
      </p>
      <Link className="btn btn-primary mb-3" to="/oportunidades?nueva=si">
        Calificar registro y coordinar visita
      </Link>
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      {cargando && <p role="status">Cargando…</p>}
      {lista.filas.map((p) => (
        <article className="card" key={p.id}>
          <div className="card-body">
            <h2 className="h4">{p.nombre}</h2>
            <p>
              {p.telefono} · {p.direccion}
            </p>
            <p>{p.contacto_efectivo}</p>
            <ul>
              {p.oportunidades.map((o) => (
                <li key={o.id}>
                  <Link to={`/oportunidades?id=${o.id}`}>{o.necesidad}</Link>
                </li>
              ))}
            </ul>
          </div>
        </article>
      ))}
      {!cargando && !error && !lista.filas.length && (
        <p>Todavía no hay prospectos calificados en tu ámbito de acceso.</p>
      )}
      <div className="d-flex gap-3 align-items-center">
        <button
          className="btn btn-outline-secondary"
          disabled={!pagina || cargando}
          onClick={() => paginar(pagina - 1)}
        >
          Anterior
        </button>
        <span>
          {lista.total} prospectos · página {pagina + 1}
        </span>
        <button
          className="btn btn-outline-secondary"
          disabled={(pagina + 1) * 20 >= lista.total || cargando}
          onClick={() => paginar(pagina + 1)}
        >
          Siguiente
        </button>
      </div>
    </section>
  );
}
