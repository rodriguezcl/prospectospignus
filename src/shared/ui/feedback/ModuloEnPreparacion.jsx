import { Link } from "react-router-dom";
import { EncabezadoPagina } from "../contenido/EncabezadoPagina.jsx";

export function ModuloEnPreparacion({ titulo, descripcion, icono, funciones }) {
  return (
    <>
      <EncabezadoPagina titulo={titulo} descripcion={descripcion} />
      <section className="card">
        <div className="card-body estado-vacio">
          <span className="icono-acceso">
            <i className={"bi " + icono} aria-hidden="true" />
          </span>
          <h2>Sección en preparación</h2>
          <p>Esta sección todavía no está disponible.</p>
          <details className="detalle-secundario">
            <summary>Funciones previstas</summary>
            <div className="funciones">
              {funciones.map((funcion) => (
                <span key={funcion} className="badge bg-light-primary">
                  {funcion}
                </span>
              ))}
            </div>
          </details>
          <Link className="btn btn-outline-primary mt-4" to="/inicio">
            Volver al inicio
          </Link>
        </div>
      </section>
    </>
  );
}
