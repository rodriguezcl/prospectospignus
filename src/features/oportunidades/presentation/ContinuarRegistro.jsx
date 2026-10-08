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
    <>
      {contexto.casos
        .filter((c) => c.accesible !== false)
        .map((c) => (
          <Link
            key={c.id}
            className="btn btn-outline-primary"
            to={`/cotizaciones?id=${c.id}`}
            title={`${c.necesidad} · ${estados[c.estado]} · ${c.responsable_nombre || "Sin responsable"}`}
          >
            {contexto.casos.length === 1
              ? "Abrir negociación"
              : `Abrir negociación: ${c.necesidad} · ${estados[c.estado]}`}
          </Link>
        ))}
      {!registro.lote_demostracion && (
        <Link
          className="btn btn-outline-primary"
          to={`/cotizaciones?nueva=si&registro=${registro.id}`}
        >
          {contexto.casos.length ? "Cotizar otra necesidad" : "Cotizar"}
        </Link>
      )}
    </>
  );
}
