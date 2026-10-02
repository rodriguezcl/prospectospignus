import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FormularioOportunidad } from "./FormularioOportunidad.jsx";
import { CasosDelRegistro } from "./ContinuarRegistro.jsx";

export function CrearProspecto({
  gestion,
  perfil,
  equipo,
  registroId,
  guardar,
  ocupado,
}) {
  const [busqueda, buscar] = useState(""),
    [registros, listar] = useState([]);
  const [seleccion, seleccionar] = useState(registroId || ""),
    [contexto, establecer] = useState(null);
  const [error, fallar] = useState(""),
    [cargando, cargar] = useState(false),
    [otra, confirmarOtra] = useState(false);
  useEffect(() => {
    let vigente = true;
    listar([]);
    fallar("");
    if (seleccion) return;
    cargar(true);
    const tiempo = setTimeout(
      () =>
        gestion
          .registros(busqueda)
          .then((r) => {
            if (vigente)
              listar(
                r.filter(
                  (p) =>
                    perfil.rol === "administrador" ||
                    p.responsable_id === perfil.id,
                ),
              );
          })
          .catch((e) => {
            if (vigente) fallar(e.message);
          })
          .finally(() => {
            if (vigente) cargar(false);
          }),
      250,
    );
    return () => {
      vigente = false;
      clearTimeout(tiempo);
    };
  }, [gestion, busqueda, seleccion, perfil.id, perfil.rol]);
  useEffect(() => {
    let vigente = true;
    establecer(null);
    confirmarOtra(false);
    fallar("");
    if (!seleccion) return;
    cargar(true);
    gestion
      .contextoRegistro(seleccion)
      .then((r) => {
        if (vigente) establecer(r);
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
  }, [gestion, seleccion]);
  const r = contexto?.registro;
  const autorizado =
    r &&
    !r.lote_demostracion &&
    (perfil.rol === "administrador" || r.responsable_id === perfil.id);
  return (
    <>
      <h2 className="h4">Preparar cotización</h2>
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      {!seleccion && (
        <>
          <label className="d-block mb-3">
            Buscar contacto por nombre
            <input
              type="search"
              className="form-control"
              value={busqueda}
              onChange={(e) => buscar(e.target.value)}
            />
          </label>
          <p className="small">
            Hasta 100 coincidencias recientes de tu acceso. Afiná el nombre si
            no aparece.
          </p>
          <ul>
            {registros.map((r) => (
              <li key={r.id}>
                <button
                  className="btn btn-outline-primary mb-2"
                  onClick={() => seleccionar(r.id)}
                >
                  {r.nombre} · {r.telefono || "Sin teléfono"} ·{" "}
                  {r.ubicacion || "Sin dirección"}
                </button>
              </li>
            ))}
          </ul>
          {!cargando && !error && !registros.length && (
            <p>
              No encontramos contactos. Probá otro nombre o{" "}
              <Link to="/prospectos?nuevo=1">cargá un prospecto</Link>.
            </p>
          )}
        </>
      )}
      {cargando && <p role="status">Consultando prospecto y negociaciones…</p>}
      {seleccion && (
        <button
          className="btn btn-outline-secondary mb-3"
          disabled={ocupado}
          onClick={() => seleccionar("")}
        >
          Elegir otro contacto
        </button>
      )}
      {!cargando && r && (
        <>
          <p>
            <strong>{r.nombre}</strong> · {r.telefono || "Falta teléfono"} ·{" "}
            {r.ubicacion || "Falta dirección"}
          </p>
          <Link to={`/prospectos?registro=${r.id}`}>
            Revisar o completar datos del contacto
          </Link>
          {!!contexto.casos.length && (
            <div className="alert alert-info mt-3">
              <p>
                Este prospecto ya tiene negociaciones. Abrí la correspondiente
                para cotizar o continuar.
              </p>
              <CasosDelRegistro casos={contexto.casos} />
              {autorizado && (
                <label>
                  <input
                    type="checkbox"
                    disabled={ocupado}
                    checked={otra}
                    onChange={(e) => confirmarOtra(e.target.checked)}
                  />{" "}
                  Es otra necesidad comercial; quiero iniciar una negociación
                  distinta.
                </label>
              )}
            </div>
          )}
          {!autorizado ? (
            <p>
              Este prospecto no está disponible para que inicies una
              negociación. Consultá al responsable o a administración.
            </p>
          ) : (
            (!contexto.casos.length || otra) && (
              <FormularioOportunidad
                key={r.id}
                registroSeleccionado={r}
                iniciarSinVisita
                perfil={perfil}
                equipo={equipo}
                registros={[r]}
                guardar={(accion, datos) =>
                  guardar(accion, {
                    ...datos,
                    otra_necesidad: otra ? "si" : "no",
                  })
                }
                ocupado={ocupado}
              />
            )
          )}
        </>
      )}
    </>
  );
}
