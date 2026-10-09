import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { vigencia } from "../domain/promocion.js";

export function FormularioPromocion({ promocion, guardar, ocupado }) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        guardar(Object.fromEntries(new FormData(e.currentTarget)));
      }}
    >
      <fieldset disabled={ocupado}>
        <label className="d-block mb-3">
          Título
          <input
            name="titulo"
            className="form-control"
            required
            minLength={3}
            maxLength={120}
            defaultValue={promocion?.titulo}
          />
        </label>
        <label className="d-block mb-3">
          Descripción
          <textarea
            name="descripcion"
            className="form-control"
            required
            minLength={5}
            maxLength={10000}
            rows={3}
            defaultValue={promocion?.descripcion}
          />
        </label>
        <label className="d-block mb-3">
          Condiciones, precios y bonificaciones
          <textarea
            name="condiciones"
            className="form-control"
            required
            minLength={5}
            maxLength={10000}
            rows={4}
            defaultValue={promocion?.condiciones}
          />
        </label>
        <div className="d-flex flex-wrap gap-3 mb-3">
          <label>
            Destinatarios
            <select
              name="destinatarios"
              className="form-select"
              defaultValue={promocion?.destinatarios || "ambos"}
            >
              <option value="ambos">Vendedores y agentes</option>
              <option value="vendedor">Solo vendedores</option>
              <option value="agente">Solo agentes</option>
            </select>
          </label>
          <label>
            Desde
            <input
              name="desde"
              type="date"
              className="form-control"
              required
              defaultValue={promocion?.desde}
            />
          </label>
          <label>
            Hasta (inclusive)
            <input
              name="hasta"
              type="date"
              className="form-control"
              required
              defaultValue={promocion?.hasta}
            />
          </label>
        </div>
        <button className="btn btn-primary">Guardar borrador</button>
      </fieldset>
    </form>
  );
}

export function PromocionesPagina({ gestion, perfil }) {
  const [parametros, navegar] = useSearchParams();
  const id = parametros.get("id"),
    nueva = parametros.has("nueva"),
    admin = perfil.rol === "administrador";
  const [filtro, filtrar] = useState("vigentes"),
    [pagina, paginar] = useState(0),
    [revision, revisar] = useState(0);
  const [lista, listar] = useState({ filas: [], total: 0 }),
    [detalle, detallar] = useState(null);
  const [cargando, cargar] = useState(true),
    [ocupado, ocupar] = useState(false),
    [error, fallar] = useState(""),
    [mensaje, informar] = useState("");
  const nuevoId = useRef(crypto.randomUUID()),
    intento = useRef(null);
  useEffect(() => {
    let vigente = true;
    cargar(true);
    detallar(null);
    fallar("");
    Promise.all([
      gestion.listar({ pagina, filtro }),
      id ? gestion.detalle(id) : null,
    ])
      .then(([l, d]) => {
        if (vigente) {
          listar(l);
          detallar(d);
        }
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
  }, [gestion, pagina, filtro, id, revision]);
  async function guardar(accion, datos = {}) {
    ocupar(true);
    fallar("");
    informar("");
    const entrada = {
      id: detalle?.id || nuevoId.current,
      version: detalle?.version || 0,
      accion,
      datos,
    };
    const clave = JSON.stringify(entrada);
    if (intento.current?.clave !== clave)
      intento.current = { clave, operacion: crypto.randomUUID() };
    try {
      const resultado = await gestion.guardar({
        ...entrada,
        operacion: intento.current.operacion,
      });
      intento.current = null;
      nuevoId.current = crypto.randomUUID();
      navegar({ id: resultado });
      revisar((n) => n + 1);
      informar(
        accion === "publicar"
          ? "Promoción publicada y avisos enviados al equipo destinatario."
          : "Cambio guardado.",
      );
    } catch (e) {
      fallar(e.message);
    } finally {
      ocupar(false);
    }
  }
  async function archivo(operacion) {
    ocupar(true);
    fallar("");
    informar("");
    try {
      await operacion();
      informar("Archivo confirmado.");
    } catch (e) {
      informar(e.message);
    } finally {
      ocupar(false);
      revisar((n) => n + 1);
    }
  }
  async function descargar(a) {
    ocupar(true);
    fallar("");
    try {
      const blob = await gestion.descargar(a.ruta);
      const url = URL.createObjectURL(blob);
      const enlace = document.createElement("a");
      enlace.href = url;
      enlace.download = a.nombre;
      document.body.appendChild(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      fallar(e.message);
    } finally {
      ocupar(false);
    }
  }
  return (
    <section aria-labelledby="titulo-promociones">
      <h1 id="titulo-promociones">Promociones</h1>
      <p>
        {admin
          ? "Publicá condiciones y material para el equipo."
          : "Consultá y descargá el material vigente."}{" "}
        Revisá la vigencia y las condiciones antes de ofrecerlo.
      </p>
      <div className="d-flex flex-wrap gap-2 mb-3">
        {admin && !nueva && !detalle && (
          <Link to="/promociones?nueva=si" className="btn btn-primary">
            Nueva promoción
          </Link>
        )}
        <button
          className="btn btn-outline-primary"
          disabled={ocupado || cargando}
          onClick={() => revisar((n) => n + 1)}
        >
          Actualizar
        </button>
      </div>
      {error && (
        <p className="alert alert-danger" role="alert">
          {error}
        </p>
      )}
      {mensaje && (
        <p className="alert alert-info" role="status">
          {mensaje}
        </p>
      )}
      {cargando && <p role="status">Cargando promociones…</p>}
      {!cargando &&
        nueva &&
        (admin ? (
          <div className="card">
            <div className="card-body">
              <h2 className="h4">Crear borrador</h2>
              <p>
                Guardá los datos, agregá los archivos y luego publicá la
                promoción.
              </p>
              <FormularioPromocion
                guardar={(datos) => guardar("crear", datos)}
                ocupado={ocupado}
              />
            </div>
          </div>
        ) : (
          <p>No tenés permiso para crear promociones.</p>
        ))}
      {!cargando && !nueva && detalle && (
        <div className="card">
          <div className="card-body">
            <h2>{detalle.titulo}</h2>
            <p>
              <span className="badge bg-secondary">{vigencia(detalle)}</span> ·{" "}
              {detalle.desde} al {detalle.hasta} · Córdoba
            </p>
            <p>
              Destinatarios:{" "}
              {detalle.destinatarios === "ambos"
                ? "Vendedores y agentes"
                : detalle.destinatarios === "agente"
                  ? "Agentes"
                  : "Vendedores"}
            </p>
            <p className="texto-con-saltos">{detalle.descripcion}</p>
            <h3 className="h5">Condiciones</h3>
            <p className="texto-con-saltos">{detalle.condiciones}</p>
            {admin && detalle.estado === "borrador" && (
              <details className="mb-3">
                <summary>Editar información del borrador</summary>
                <FormularioPromocion
                  key={`${detalle.id}-${detalle.version}`}
                  promocion={detalle}
                  guardar={(datos) => guardar("editar", datos)}
                  ocupado={ocupado}
                />
              </details>
            )}
            <h3 className="h5">PDF e imágenes</h3>
            <ul className="list-unstyled">
              {ordenarAlfabeticamente(detalle.archivos_promociones)
                .filter((a) => a.estado !== "retirado")
                .map((a) => (
                  <li
                    className="border-bottom py-2 d-flex flex-wrap gap-2 align-items-center"
                    key={a.id}
                  >
                    <span>
                      {a.nombre} · {(a.bytes / 1048576).toFixed(1)} MB{" "}
                      {a.estado === "pendiente" ? "· Carga pendiente" : ""}
                    </span>
                    {a.estado === "disponible" && (
                      <button
                        className="btn btn-sm btn-outline-primary"
                        disabled={ocupado}
                        onClick={() => descargar(a)}
                      >
                        Descargar {a.nombre}
                      </button>
                    )}
                    {admin && detalle.estado === "borrador" && (
                      <>
                        {a.estado === "pendiente" && (
                          <button
                            className="btn btn-sm btn-outline-secondary"
                            disabled={ocupado}
                            onClick={() =>
                              archivo(() => gestion.confirmar(a.id))
                            }
                          >
                            Confirmar carga
                          </button>
                        )}
                        <button
                          className="btn btn-sm btn-outline-danger"
                          disabled={ocupado}
                          onClick={() =>
                            guardar("retirar_archivo", { id: a.id })
                          }
                        >
                          Retirar adjunto
                        </button>
                      </>
                    )}
                  </li>
                ))}
            </ul>
            {!detalle.archivos_promociones.some(
              (a) => a.estado !== "retirado",
            ) && <p>Sin archivos adjuntos.</p>}
            {admin && (
              <>
                {detalle.estado === "borrador" && (
                  <label className="d-block mb-3">
                    Subir PDF, JPG, PNG o WebP · hasta 20 MB · máximo 10
                    adjuntos
                    <input
                      className="form-control"
                      type="file"
                      accept="application/pdf,image/jpeg,image/png,image/webp"
                      disabled={ocupado}
                      onChange={(e) => {
                        const f = e.target.files[0];
                        e.target.value = "";
                        if (f) archivo(() => gestion.subir(detalle, f));
                      }}
                    />
                  </label>
                )}
                <div className="d-flex flex-wrap gap-2">
                  {detalle.estado === "borrador" ? (
                    <button
                      className="btn btn-success"
                      disabled={ocupado}
                      onClick={() => guardar("publicar")}
                    >
                      Publicar y notificar
                    </button>
                  ) : (
                    <button
                      className="btn btn-outline-primary"
                      disabled={ocupado}
                      onClick={() => {
                        if (
                          window.confirm(
                            "La promoción dejará de estar disponible para el equipo hasta volver a publicarla. ¿Continuar?",
                          )
                        )
                          guardar("borrador");
                      }}
                    >
                      Pasar a borrador para editar
                    </button>
                  )}
                  {detalle.estado !== "archivada" && (
                    <button
                      className="btn btn-outline-secondary"
                      disabled={ocupado}
                      onClick={() => {
                        if (
                          window.confirm(
                            "¿Archivar la promoción y retirarla de la consulta del equipo?",
                          )
                        )
                          guardar("archivar");
                      }}
                    >
                      Archivar
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {!id && !nueva && (
        <div className="card">
          <div className="card-body">
            <label className="mb-3">
              Mostrar
              <select
                className="form-select"
                value={filtro}
                onChange={(e) => {
                  filtrar(e.target.value);
                  paginar(0);
                }}
              >
                <option value="vigentes">Vigentes</option>
                <option value="proximas">Próximas</option>
                <option value="vencidas">Vencidas</option>
                {admin && (
                  <>
                    <option value="borrador">Borradores</option>
                    <option value="archivada">Archivadas</option>
                    <option value="todas">Todas</option>
                  </>
                )}
              </select>
            </label>
            {!cargando && !error && (
              <>
                {lista.filas.map((p) => (
                  <article className="border-bottom py-3" key={p.id}>
                    <h2 className="h5">
                      <Link to={`/promociones?id=${p.id}`}>{p.titulo}</Link>
                    </h2>
                    <p>
                      {vigencia(p)} · {p.desde} al {p.hasta}
                    </p>
                  </article>
                ))}
                {!lista.filas.length && (
                  <p>No hay promociones para este filtro.</p>
                )}
                <div className="d-flex flex-wrap gap-3 mt-3 align-items-center">
                  <button
                    className="btn btn-outline-secondary"
                    disabled={!pagina}
                    onClick={() => paginar(pagina - 1)}
                  >
                    Anterior
                  </button>
                  <span>
                    {lista.total} promociones · página {pagina + 1}
                  </span>
                  <button
                    className="btn btn-outline-secondary"
                    disabled={(pagina + 1) * 20 >= lista.total}
                    onClick={() => paginar(pagina + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {(id || nueva) && <Link to="/promociones">Volver al listado</Link>}
    </section>
  );
}
import { ordenarAlfabeticamente } from "../../../shared/ui/ordenAlfabetico.js";
