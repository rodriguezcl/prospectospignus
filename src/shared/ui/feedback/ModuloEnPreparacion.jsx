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
          <p>
            Este módulo todavía no está conectado a datos. Estas son sus
            funciones previstas:
          </p>
          <div className="funciones">
            {funciones.map((funcion) => (
              <span key={funcion} className="badge bg-light-primary">
                {funcion}
              </span>
            ))}
          </div>
          <Link className="btn btn-outline-primary mt-4" to="/inicio">
            Volver al inicio
          </Link>
        </div>
      </section>
    </>
  );
}
