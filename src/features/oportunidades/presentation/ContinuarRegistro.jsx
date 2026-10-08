import { AtencionProspecto, puedeAtender } from "./AtencionProspecto.jsx";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { estados } from "../domain/circuito.js";

export function CasosDelRegistro({ casos }) {
  return (
    <ul>
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
export function ContinuarRegistro({ registro, gestion, perfil }) {
  const [revisionAtencion, revisarAtencion] = useState(0);
  const selector = useRef(null);
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
  if (error)
    return (
      <p role="alert">
        No pudimos consultar las negociaciones asociadas. {error}
      </p>
    );
  if (!contexto) return <p role="status">Buscando negociaciones asociadas…</p>;
  return (
    <>
      <AtencionProspecto
        atencion={contexto.atencion}
        perfil={perfil}
        gestion={gestion}
        actualizada={() => revisarAtencion((n) => n + 1)}
      />
      {contexto.casos.filter((c) => c.accesible !== false).length === 1 && (
        <Link
          className="btn btn-sm btn-outline-primary"
          to={`/cotizaciones?id=${contexto.casos.find((c) => c.accesible !== false).id}`}
        >
          Abrir negociación
        </Link>
      )}
      {contexto.casos.filter((c) => c.accesible !== false).length > 1 && (
        <>
          <button
            type="button"
            className="btn btn-sm btn-outline-primary"
            onClick={() => selector.current.showModal()}
          >
            Ver negociaciones (
            {contexto.casos.filter((c) => c.accesible !== false).length})
          </button>
          <dialog
            ref={selector}
            aria-label={`Negociaciones de ${registro.nombre}`}
            className="border rounded p-4"
            style={{ maxWidth: "min(720px, 95vw)", maxHeight: "80vh" }}
          >
            <h2 className="h5">Negociaciones de {registro.nombre}</h2>
            <CasosDelRegistro
              casos={contexto.casos.filter((c) => c.accesible !== false)}
            />
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
            className="btn btn-sm btn-outline-primary"
            to={`/cotizaciones?nueva=si&registro=${registro.id}`}
          >
            {contexto.casos.length ? "Cotizar otra necesidad" : "Cotizar"}
          </Link>
        )}
    </>
  );
}
