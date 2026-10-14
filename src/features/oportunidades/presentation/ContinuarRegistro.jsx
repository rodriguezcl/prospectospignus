import { AtencionProspecto } from "./AtencionProspecto.jsx";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { estados, puedeAtender } from "../domain/circuito.js";

export function CasosDelRegistro({ casos }) {
  return (
    <ul className="negociaciones-selector">
      {casos.map((c) => (
        <li key={c.id}>
          {c.accesible !== false ? (
            <Link to={`/cotizaciones?id=${c.id}`}>
              Abrir negociación: {c.necesidad}
            </Link>
          ) : (
            <span>{c.necesidad}</span>
          )}{" "}
          · {estados[c.estado]} ·{" "}
          {c.preparacion_compartida
            ? "Primera oferta pendiente"
            : c.responsable_nombre || "Seguimiento asignado"}
        </li>
      ))}
    </ul>
  );
}
export function ContinuarRegistro({ registro, gestion, perfil, presentar }) {
  const [revisionAtencion, revisarAtencion] = useState(0);
  const [contexto, setContexto] = useState(null),
    [error, setError] = useState("");
  useEffect(() => {
    let vigente = true;
    setContexto(null);
    setError("");
    gestion
      .contextoRegistro(registro.id)
      .then((r) => {
        if (vigente) setContexto(r);
      })
      .catch((e) => {
        if (vigente) setError(e.message);
      });
    return () => {
      vigente = false;
    };
  }, [gestion, registro.id, registro.version, revisionAtencion]);
  const contenido = error
    ? {
        atencion: (
          <p role="alert">
            No pudimos consultar las negociaciones asociadas. {error}
          </p>
        ),
      }
    : !contexto
      ? {
          atencion: <p role="status">Buscando negociaciones asociadas…</p>,
        }
      : {
          atencion: (
            <AtencionProspecto
              atencion={contexto.atencion}
              perfil={perfil}
              gestion={gestion}
              actualizada={() => revisarAtencion((n) => n + 1)}
            />
          ),
          acciones: (
            <AccionesNegociaciones
              registro={registro}
              contexto={contexto}
              perfil={perfil}
            />
          ),
        };
  return presentar ? (
    presentar(contenido)
  ) : (
    <div className="seguimiento-prospecto">
      {contenido.atencion}
      {contenido.acciones}
    </div>
  );
}

export function AccionesNegociaciones({ registro, contexto, perfil }) {
  const selector = useRef(null);
  const accesibles = contexto.casos.filter((c) => c.accesible !== false);
  return (
    <div className="acciones-registro acciones-comerciales">
      {accesibles.length === 1 && (
        <Link
          className="btn btn-sm btn-primary"
          to={`/cotizaciones?id=${accesibles[0].id}`}
          title={`${accesibles[0].necesidad} · ${estados[accesibles[0].estado]}`}
        >
          {["ganada", "perdida", "anulada"].includes(accesibles[0].estado)
            ? "Ver negociación"
            : "Abrir negociación"}
        </Link>
      )}
      {accesibles.length > 1 && (
        <>
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => selector.current.showModal()}
          >
            Ver negociaciones ({accesibles.length})
          </button>
          <dialog
            ref={selector}
            aria-label={`Negociaciones de ${registro.nombre}`}
            className="border rounded p-4"
            style={{ maxWidth: "min(720px, 95vw)", maxHeight: "80vh" }}
          >
            <h2 className="h5">Negociaciones de {registro.nombre}</h2>
            <CasosDelRegistro casos={accesibles} />
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => selector.current.close()}
            >
              Cerrar
            </button>
          </dialog>
        </>
      )}
      {!registro.lote_demostracion &&
        puedeAtender(contexto.atencion, perfil) && (
          <Link
            className={`btn btn-sm ${accesibles.length ? "btn-outline-primary" : "btn-primary"}`}
            to={`/cotizaciones?nueva=si&registro=${registro.id}`}
          >
            {contexto.casos.length ? "Cotizar otra necesidad" : "Cotizar"}
          </Link>
        )}
    </div>
  );
}
