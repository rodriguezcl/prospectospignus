import { Link } from "react-router-dom";
import { EncabezadoPagina } from "../../../shared/ui/contenido/EncabezadoPagina.jsx";
import { EstadisticasMensuales } from "./EstadisticasMensuales.jsx";

export function InicioPagina({ accesos, gestion, perfil }) {
  return (
    <>
      <EncabezadoPagina
        etiqueta="TU ESPACIO DE TRABAJO"
        titulo={
          <>
            Un próximo paso para
            <br />
            cada oportunidad.
          </>
        }
        descripcion="Organizá tu cartera, registrá tus gestiones y mantené el seguimiento al día."
      />
      <EstadisticasMensuales gestion={gestion} perfil={perfil} />
      <section className="bienvenida">
        <div>
          <span className="badge bg-white text-primary mb-3">
            PROSPECTOS PIGNUS
          </span>
          <h2>
            Las relaciones empiezan
            <br />
            con una buena conversación.
          </h2>
          <p>Todo el recorrido comercial, en un mismo lugar.</p>
          <Link to={accesos[0].ruta} className="btn btn-light">
            Explorar registros iniciales →
          </Link>
        </div>
        <div className="figura" aria-hidden="true">
          <i className="bi bi-people-fill" />
        </div>
      </section>
      <div className="encabezado-seccion">
        <h2>Tu jornada comercial</h2>
        <span className="text-muted">Accesos directos</span>
      </div>
      <div className="accesos">
        {accesos.map((acceso) => (
          <Link key={acceso.ruta} className="card acceso" to={acceso.ruta}>
            <span className="icono-acceso">
              <i className={"bi " + acceso.icono} aria-hidden="true" />
            </span>
            <h3>{acceso.titulo}</h3>
            <span className="enlace-acceso">Abrir sección →</span>
          </Link>
        ))}
      </div>
      <div className="aviso">
        <i className="bi bi-info-circle" aria-hidden="true" />
        <div>
          <strong>Un recorrido comercial integrado</strong>
          <p>
            Calificá desde Registros iniciales, gestioná visitas y seguimiento
            en Prospectos y consultá los cierres en Ventas concretadas. Una
            venta concretada indica aceptación comercial, no instalación ni
            cobro.
          </p>
        </div>
      </div>
    </>
  );
}
