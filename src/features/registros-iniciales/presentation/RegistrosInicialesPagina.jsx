import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EncabezadoPagina } from "../../../shared/ui/contenido/EncabezadoPagina.jsx";
import { camposRegistro } from "../domain/registro.js";

const fecha = (valor) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Cordoba",
  }).format(new Date(valor));
export function RegistrosInicialesPagina({ gestion, perfil }) {
  const [parametros, cambiarParametros] = useSearchParams();
  const seleccionado = parametros.get("registro");
  const nuevo = parametros.get("nuevo") === "1";
  const administrador = perfil?.rol === "administrador";
  const [catalogos, cambiarCatalogos] = useState({
    origenes: [],
    perfiles: [],
  });
  const [lista, cambiarLista] = useState({ registros: [], total: 0 });
  const [filtros, cambiarFiltros] = useState({
    pagina: 0,
    busqueda: "",
    origen: "",
    responsable: "",
  });
  const [detalle, cambiarDetalle] = useState(null);
  const [eventos, cambiarEventos] = useState([]);
  const [revision, actualizar] = useState(0);
  const [cargando, cambiarCargando] = useState(true);
  const [guardando, cambiarGuardando] = useState(false);
  const [error, cambiarError] = useState("");
  const [aviso, cambiarAviso] = useState("");
  const guardia = useRef(false);
  const turno = useRef(0);
  const nombrePerfil = (id) =>
    catalogos.perfiles.find((p) => p.id === id)?.nombre ||
    (id ? "Otro integrante" : "Sin asignar");
  const nombreOrigen = (codigo) =>
    catalogos.origenes.find((o) => o.codigo === codigo)?.nombre || codigo;

  useEffect(() => {
    const actual = ++turno.current;
    cambiarCargando(true);
    cambiarError("");
    cambiarDetalle(null);
    cambiarEventos([]);
    if (!gestion || !perfil) {
      cambiarError("No hay una sesión configurada.");
      cambiarCargando(false);
      return;
    }
    async function cargar() {
      try {
        const [catalogo, resultado] = await Promise.all([
          gestion.catalogos(),
          seleccionado
            ? Promise.all([
                gestion.obtener(seleccionado),
                gestion.historial(seleccionado),
              ])
            : nuevo
              ? Promise.resolve(null)
              : gestion.listar(filtros),
        ]);
        if (actual !== turno.current) return;
        cambiarCatalogos(catalogo);
        if (seleccionado) {
          cambiarDetalle(resultado[0]);
          cambiarEventos(resultado[1]);
        } else if (nuevo)
          cambiarDetalle({
            id: crypto.randomUUID(),
            version: 0,
            nombre: "",
            telefono: "",
            correo: "",
            ubicacion: "",
            observaciones: "",
            origen: "",
            responsable_id: administrador ? "" : perfil.id,
          });
        else cambiarLista(resultado);
      } catch (fallo) {
        if (actual === turno.current) cambiarError(fallo.message);
      } finally {
        if (actual === turno.current) cambiarCargando(false);
      }
    }
    void cargar();
    return () => {
      ++turno.current;
    };
  }, [
    gestion,
    perfil?.id,
    administrador,
    seleccionado,
    nuevo,
    filtros,
    revision,
  ]);

  async function guardar(evento) {
    evento.preventDefault();
    if (guardia.current) return;
    guardia.current = true;
    cambiarGuardando(true);
    cambiarError("");
    cambiarAviso("");
    const actual = turno.current;
    const entrada = Object.fromEntries(new FormData(evento.currentTarget));
    entrada.origen = detalle.origen || entrada.origen;
    if (!administrador) entrada.responsable_id = perfil.id;
    try {
      const resultado = await gestion.guardar(
        detalle.id,
        detalle.version,
        entrada,
      );
      if (actual !== turno.current) return;
      cambiarAviso(
        detalle.version
          ? "Cambios guardados."
          : "Registro creado. Todavía no es un Prospecto.",
      );
      cambiarParametros({ registro: resultado.id });
      actualizar((v) => v + 1);
    } catch (fallo) {
      if (actual === turno.current) cambiarError(fallo.message);
    } finally {
      guardia.current = false;
      cambiarGuardando(false);
    }
  }
  function filtrar(evento) {
    evento.preventDefault();
    cambiarFiltros({
      ...Object.fromEntries(new FormData(evento.currentTarget)),
      pagina: 0,
    });
  }
  return (
    <>
      <EncabezadoPagina
        titulo="Registros iniciales"
        descripcion="Captá contactos y organizá el primer paso de la relación comercial."
      />
      <p className="text-muted">
        Los registros pueden estar incompletos. Guardarlos no los califica como
        Prospectos ni como captaciones válidas.
      </p>
      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      {aviso && (
        <div className="alert alert-success" role="status">
          {aviso}
        </div>
      )}
      <div className="d-flex flex-wrap gap-2 mb-3">
        {seleccionado || nuevo ? (
          <button
            className="btn btn-outline-primary"
            disabled={guardando}
            onClick={() => {
              cambiarAviso("");
              cambiarParametros({});
            }}
          >
            Volver al listado
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => {
              cambiarAviso("");
              cambiarParametros({ nuevo: "1" });
            }}
          >
            Nuevo registro
          </button>
        )}
        <button
          className="btn btn-outline-secondary"
          disabled={guardando || cargando}
          onClick={() => actualizar((v) => v + 1)}
        >
          Recargar {detalle ? "(descarta cambios sin guardar)" : ""}
        </button>
      </div>
      {cargando ? (
        <p role="status">Cargando registros…</p>
      ) : seleccionado || nuevo ? (
        detalle && (
          <>
            <section className="card">
              <div className="card-body">
                <h2 className="h5">
                  {detalle.version
                    ? "Detalle y edición"
                    : "Crear registro inicial"}
                </h2>
                {!!detalle.version && (
                  <p>
                    Creado por {nombrePerfil(detalle.creado_por)} ·{" "}
                    {fecha(detalle.creado_en)} · Versión {detalle.version}
                  </p>
                )}
                <form
                  key={`${detalle.id}-${detalle.version}-${revision}`}
                  onSubmit={guardar}
                  aria-busy={guardando}
                >
                  <fieldset disabled={guardando}>
                    <div className="row g-3">
                      {camposRegistro.map((campo) => (
                        <div
                          className={
                            campo.nombre === "observaciones"
                              ? "col-12"
                              : "col-md-6"
                          }
                          key={campo.nombre}
                        >
                          <label
                            className="form-label"
                            htmlFor={`registro-${campo.nombre}`}
                          >
                            {campo.etiqueta}
                            {campo.requerido ? " *" : ""}
                          </label>
                          {campo.nombre === "observaciones" ? (
                            <textarea
                              id={`registro-${campo.nombre}`}
                              name={campo.nombre}
                              className="form-control"
                              rows={3}
                              maxLength={campo.limite}
                              defaultValue={detalle[campo.nombre]}
                            />
                          ) : (
                            <input
                              id={`registro-${campo.nombre}`}
                              name={campo.nombre}
                              type={campo.tipo || "text"}
                              className="form-control"
                              required={campo.requerido}
                              minLength={campo.requerido ? 2 : undefined}
                              maxLength={campo.limite}
                              defaultValue={detalle[campo.nombre]}
                            />
                          )}
                        </div>
                      ))}
                      <div className="col-md-6">
                        <label className="form-label" htmlFor="registro-origen">
                          Origen *
                        </label>
                        <select
                          id="registro-origen"
                          name="origen"
                          className="form-select"
                          required
                          disabled={!!detalle.version}
                          defaultValue={detalle.origen}
                        >
                          <option value="">Seleccionar origen</option>
                          {catalogos.origenes
                            .filter(
                              (o) => o.activo || o.codigo === detalle.origen,
                            )
                            .map((o) => (
                              <option key={o.codigo} value={o.codigo}>
                                {o.nombre}
                              </option>
                            ))}
                        </select>
                        <small>El origen se conserva después del alta.</small>
                      </div>
                      {administrador ? (
                        <>
                          <div className="col-md-6">
                            <label
                              className="form-label"
                              htmlFor="registro-responsable"
                            >
                              Responsable
                            </label>
                            <select
                              id="registro-responsable"
                              name="responsable_id"
                              className="form-select"
                              defaultValue={detalle.responsable_id || ""}
                            >
                              <option value="">Sin asignar</option>
                              {catalogos.perfiles
                                .filter(
                                  (p) =>
                                    p.activo || p.id === detalle.responsable_id,
                                )
                                .map((p) => (
                                  <option
                                    key={p.id}
                                    value={p.id}
                                    disabled={!p.activo}
                                  >
                                    {p.nombre}
                                    {p.activo ? "" : " (inactivo)"}
                                  </option>
                                ))}
                            </select>
                            <small>
                              Asignación manual; no se distribuye
                              automáticamente.
                            </small>
                          </div>
                          {!!detalle.version && (
                            <div className="col-12">
                              <label
                                className="form-label"
                                htmlFor="registro-motivo"
                              >
                                Motivo si cambiás el responsable
                              </label>
                              <input
                                id="registro-motivo"
                                name="motivo"
                                className="form-control"
                                maxLength={500}
                                placeholder="Mínimo 5 caracteres al reasignar"
                              />
                            </div>
                          )}
                        </>
                      ) : (
                        <p className="col-md-6 mb-0 align-self-center">
                          Responsable: {perfil.nombre}
                        </p>
                      )}
                    </div>
                    <button className="btn btn-primary mt-3" type="submit">
                      {guardando ? "Guardando…" : "Guardar registro"}
                    </button>
                  </fieldset>
                </form>
              </div>
            </section>
            {!!detalle.version && (
              <section className="card">
                <div className="card-body">
                  <h2 className="h5">Historial (últimos 50 eventos)</h2>
                  <ul className="list-unstyled">
                    {eventos.map((e) => (
                      <li className="border-bottom py-2" key={e.id}>
                        <strong>
                          {e.tipo === "registro_creado"
                            ? "Registro creado"
                            : "Registro actualizado"}
                        </strong>{" "}
                        · {fecha(e.ocurrido_en)} · {nombrePerfil(e.actor_id)}
                        {e.motivo && <p className="mb-1">Motivo: {e.motivo}</p>}
                        <details>
                          <summary>Ver cambios</summary>
                          <ul>
                            {[
                              ...camposRegistro.map((c) => c.nombre),
                              "origen",
                              "responsable_id",
                            ]
                              .filter(
                                (c) =>
                                  !e.anterior || e.anterior[c] !== e.nuevo[c],
                              )
                              .map((c) => (
                                <li key={c}>
                                  {camposRegistro.find((x) => x.nombre === c)
                                    ?.etiqueta ||
                                    (c === "origen" ? "Origen" : "Responsable")}
                                  :{" "}
                                  {e.anterior && (
                                    <>
                                      {c === "responsable_id"
                                        ? nombrePerfil(e.anterior[c])
                                        : e.anterior[c] || "—"}{" "}
                                      →{" "}
                                    </>
                                  )}
                                  {c === "responsable_id"
                                    ? nombrePerfil(e.nuevo[c])
                                    : e.nuevo[c] || "—"}
                                </li>
                              ))}
                          </ul>
                        </details>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </>
        )
      ) : (
        !error && (
          <section className="card">
            <div className="card-body">
              <form className="row g-2 mb-3" onSubmit={filtrar}>
                <div className="col-md-4">
                  <label htmlFor="buscar-registros" className="form-label">
                    Buscar por nombre
                  </label>
                  <input
                    id="buscar-registros"
                    name="busqueda"
                    className="form-control"
                    maxLength={150}
                    defaultValue={filtros.busqueda}
                  />
                </div>
                <div className="col-md-3">
                  <label htmlFor="filtrar-origen" className="form-label">
                    Origen
                  </label>
                  <select
                    id="filtrar-origen"
                    name="origen"
                    className="form-select"
                    defaultValue={filtros.origen}
                  >
                    <option value="">Todos</option>
                    {catalogos.origenes.map((o) => (
                      <option key={o.codigo} value={o.codigo}>
                        {o.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                {administrador && (
                  <div className="col-md-3">
                    <label htmlFor="filtrar-responsable" className="form-label">
                      Responsable
                    </label>
                    <select
                      id="filtrar-responsable"
                      name="responsable"
                      className="form-select"
                      defaultValue={filtros.responsable}
                    >
                      <option value="">Todos</option>
                      <option value="sin-asignar">Sin asignar</option>
                      {catalogos.perfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="col-md-2 align-self-end">
                  <button className="btn btn-outline-primary" type="submit">
                    Filtrar
                  </button>
                </div>
              </form>
              <p role="status">
                {lista.total} registros en tu alcance de acceso.
              </p>
              {!lista.registros.length ? (
                <p>
                  No hay registros con estos filtros. Podés crear uno nuevo.
                </p>
              ) : (
                <div className="table-responsive">
                  <table className="table">
                    <caption>
                      Ordenados del más reciente al más antiguo. Fechas de
                      Argentina.
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col">Nombre</th>
                        <th scope="col">Teléfono</th>
                        <th scope="col">Origen</th>
                        <th scope="col">Responsable</th>
                        <th scope="col">Creación</th>
                        <th scope="col">Detalle</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.registros.map((r) => (
                        <tr key={r.id}>
                          <td>{r.nombre}</td>
                          <td>{r.telefono || "—"}</td>
                          <td>{nombreOrigen(r.origen)}</td>
                          <td>{nombrePerfil(r.responsable_id)}</td>
                          <td>{fecha(r.creado_en)}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => {
                                cambiarAviso("");
                                cambiarParametros({ registro: r.id });
                              }}
                              aria-label={`Abrir ${r.nombre}`}
                            >
                              Abrir
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <nav
                aria-label="Páginas de registros"
                className="d-flex gap-2 align-items-center"
              >
                <button
                  className="btn btn-outline-secondary btn-sm"
                  disabled={filtros.pagina === 0}
                  onClick={() =>
                    cambiarFiltros((f) => ({ ...f, pagina: f.pagina - 1 }))
                  }
                >
                  Anterior
                </button>
                <span>Página {filtros.pagina + 1}</span>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  disabled={(filtros.pagina + 1) * 20 >= lista.total}
                  onClick={() =>
                    cambiarFiltros((f) => ({ ...f, pagina: f.pagina + 1 }))
                  }
                >
                  Siguiente
                </button>
              </nav>
            </div>
          </section>
        )
      )}
    </>
  );
}
