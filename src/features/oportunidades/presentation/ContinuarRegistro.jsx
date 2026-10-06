import { useEffect, useState } from "react";
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
            ? "Compartida · sin responsable"
            : c.responsable_nombre || "Seguimiento asignado"}
        </li>
      ))}
    </ul>
  );
}
export function ContinuarRegistro({ registro, gestion, perfil }) {
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
  }, [gestion, registro.id, registro.version]);
  if (error)
    return (
      <p role="alert">
        No pudimos consultar las negociaciones asociadas. {error}
      </p>
    );
  if (!contexto) return <p role="status">Buscando negociaciones asociadas…</p>;
  return (
    <section
      className="card card-body"
      aria-label="Continuar con este contacto"
    >
      <h2 className="h5">Siguiente paso</h2>
      {contexto.casos.length ? (
        <>
          <CasosDelRegistro casos={contexto.casos} />
          <p>Abrí la negociación para cotizar o continuar el seguimiento.</p>
        </>
      ) : (
        <p>
          Este prospecto ya está disponible en Cotizaciones. Podés preparar su
          propuesta sin volver a cargar sus datos.
        </p>
      )}
      {!registro.lote_demostracion && (
        <Link
          className="btn btn-primary align-self-start"
          to={`/cotizaciones?nueva=si&registro=${registro.id}`}
        >
          {contexto.casos.length ? "Cotizar otra necesidad" : "Cotizar"}
        </Link>
      )}
    </section>
  );
}
