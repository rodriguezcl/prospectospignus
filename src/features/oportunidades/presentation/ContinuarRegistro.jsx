import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { estados } from "../domain/circuito.js";

export function CasosDelRegistro({ casos }) {
  return (
    <ul>
      {casos.map((c) => (
        <li key={c.id}>
          <Link to={`/prospectos?id=${c.id}`}>
            Abrir prospecto: {c.necesidad}
          </Link>{" "}
          · {estados[c.estado]}
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
      <p role="alert">No pudimos consultar los prospectos asociados. {error}</p>
    );
  if (!contexto) return <p role="status">Buscando prospectos asociados…</p>;
  const autorizado =
    perfil.rol === "administrador" ||
    contexto.registro.responsable_id === perfil.id;
  return (
    <section
      className="card card-body"
      aria-label="Continuar con este contacto"
    >
      <h2 className="h5">Siguiente paso</h2>
      {contexto.casos.length ? (
        <>
          <CasosDelRegistro casos={contexto.casos} />
          <p>
            Para cotizar o continuar la misma necesidad, abrí su prospecto. No
            lo vuelvas a crear.
          </p>
        </>
      ) : (
        <p>
          Cuando hayas contactado a la persona y confirmado su necesidad, creá
          el prospecto para preparar la cotización.
        </p>
      )}
      {autorizado && !registro.lote_demostracion && (
        <Link
          className="btn btn-primary align-self-start"
          to={`/prospectos?nueva=si&registro=${registro.id}`}
        >
          {contexto.casos.length
            ? "Crear otra necesidad de este contacto"
            : "Crear prospecto"}
        </Link>
      )}
      {!autorizado && (
        <p>
          Solo el responsable del registro o administración puede crear una
          nueva necesidad.
        </p>
      )}
    </section>
  );
}
