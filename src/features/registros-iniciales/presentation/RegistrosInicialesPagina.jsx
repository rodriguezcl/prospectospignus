import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { EncabezadoPagina } from "../../../shared/ui/contenido/EncabezadoPagina.jsx";
import { camposRegistro } from "../domain/registro.js";
import { IconoAccion } from "../../../shared/ui/IconoAccion.jsx";

const fecha = (valor) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Cordoba",
  }).format(new Date(valor));
export function RegistrosInicialesPagina({
  gestion,
  perfil,
  renderContinuacion,
}) {
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
    autor: "",
  });
  const [detalle, cambiarDetalle] = useState(null);
  const [eventos, cambiarEventos] = useState([]);
  const [revision, actualizar] = useState(0);
  const [cargando, cambiarCargando] = useState(true);
  const [guardando, cambiarGuardando] = useState(false);
  const [error, cambiarError] = useState("");
  const [aviso, cambiarAviso] = useState("");
  const [baja, cambiarBaja] = useState(null);
  const [errorBaja, cambiarErrorBaja] = useState("");
  const modalBaja = useRef(null);
  useEffect(() => {
    if (baja) modalBaja.current?.showModal();
  }, [baja]);
  function solicitarBaja(registro) {
    cambiarErrorBaja("");
    cambiarBaja(registro);
  }
  async function eliminar(evento) {
    evento.preventDefault();
    if (guardia.current) return;
    guardia.current = true;
    cambiarGuardando(true);
    cambiarErrorBaja("");
    const motivo = new FormData(evento.currentTarget).get("motivo").trim();
    try {
      await gestion.eliminar(baja.id, baja.version, motivo);
      cambiarBaja(null);
      cambiarAviso(
        "Prospecto eliminado del listado. Se conservó el historial de la operación.",
      );
      cambiarParametros({});
      cambiarFiltros((f) => ({ ...f, pagina: 0 }));
      actualizar((v) => v + 1);
    } catch (fallo) {
      cambiarErrorBaja(fallo.message);
    } finally {
      guardia.current = false;
      cambiarGuardando(false);
    }
  }
  const [modificado, marcarModificado] = useState(false);
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
    marcarModificado(false);
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
          : "Prospecto guardado. Ya está disponible en Cotizaciones; podés cotizar ahora o continuar después.",
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
        titulo="Prospectos"
        descripcion="Base compartida: todos pueden consultar y editar. La autoría de cada carga se conserva."
      />
      {baja && (
        <dialog
          ref={modalBaja}
          className="border-0 rounded shadow p-4"
          style={{ width: "min(36rem, calc(100% - 2rem))" }}
          aria-labelledby="eliminar-prospecto-titulo"
          onCancel={(e) => {
            e.preventDefault();
            if (!guardando) cambiarBaja(null);
          }}
        >
          <h2 id="eliminar-prospecto-titulo" className="h5">
            Eliminar prospecto: {baja.nombre}
          </h2>
          <p>
            Se retirará de Prospectos y de la bandeja de Cotizaciones. Se
            anularán sus negociaciones abiertas y se cancelarán sus visitas y
            tareas pendientes. Las ventas y los casos ya cerrados conservarán su
            resultado. Se mantienen la autoría, las propuestas y el historial.
          </p>
          <form onSubmit={eliminar}>
            <label htmlFor="motivo-baja-prospecto" className="form-label">
              Motivo de eliminación
            </label>
            <textarea
              id="motivo-baja-prospecto"
              name="motivo"
              className="form-control mb-3"
              required
              minLength={5}
              maxLength={500}
              disabled={guardando}
            />
            {errorBaja && (
              <p role="alert" className="alert alert-danger">
                {errorBaja}
              </p>
            )}
            <div className="d-flex gap-2">
              <button
                type="button"
                className="btn btn-outline-secondary"
                autoFocus
                disabled={guardando}
                onClick={() => cambiarBaja(null)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-danger"
                disabled={guardando}
              >
                {guardando ? "Eliminando…" : "Confirmar eliminación"}
              </button>
            </div>
          </form>
        </dialog>
      )}
      {(nuevo || seleccionado) && (
        <p className="text-muted small">
          Guardá los datos del contacto. Aparecerá automáticamente en
          Cotizaciones, sin convertirlo ni volver a cargarlo.
        </p>
      )}
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
            {aviso
              ? "Continuar después · volver al listado"
              : "Volver al listado"}
          </button>
        ) : (
          <button
            className="btn btn-primary"
            onClick={() => {
              cambiarAviso("");
              cambiarParametros({ nuevo: "1" });
            }}
          >
            Nuevo prospecto
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
            {!!detalle.version &&
              (modificado ? (
                <p className="alert alert-warning">
                  Guardá los cambios del contacto antes de continuar a
                  Cotizaciones.
                </p>
              ) : (
                renderContinuacion?.(detalle)
              ))}
            <section className="card">
              <div className="card-body">
                <h2 className="h5">
                  {detalle.version ? "Detalle y edición" : "Cargar prospecto"}
                </h2>
                {detalle.lote_demostracion && (
                  <p className="alert alert-warning">
                    DEMO · Persona y teléfono ficticios. No contactar. La
                    dirección es una referencia pública, no un domicilio
                    personal.
                  </p>
                )}
                {!!detalle.version && (
                  <p>
                    Cargado por {nombrePerfil(detalle.creado_por)} ·{" "}
                    {fecha(detalle.creado_en)} · Versión {detalle.version}
                  </p>
                )}
                <form
                  key={`${detalle.id}-${detalle.version}-${revision}`}
                  onSubmit={guardar}
                  onChange={() => marcarModificado(true)}
                  aria-busy={guardando}
                >
                  <fieldset disabled={guardando || !!detalle.lote_demostracion}>
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
                              onBlur={
                                campo.nombre === "nombre"
                                  ? (e) => {
                                      e.target.value = e.target.value
                                        .trim()
                                        .toUpperCase();
                                    }
                                  : undefined
                              }
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
                    </div>
                    <div className="d-flex flex-wrap align-items-center gap-3 mt-3">
                      <button className="btn btn-primary" type="submit">
                        {guardando
                          ? "Guardando…"
                          : detalle.version
                            ? "Actualizar prospecto"
                            : "Guardar prospecto"}
                      </button>
                      {administrador &&
                        !!detalle.version &&
                        !detalle.lote_demostracion && (
                          <button
                            type="button"
                            className="btn btn-danger"
                            disabled={guardando || modificado}
                            title={
                              modificado
                                ? "Guardá los cambios antes de eliminar"
                                : "Eliminar " + detalle.nombre
                            }
                            onClick={() => solicitarBaja(detalle)}
                          >
                            <IconoAccion accion="eliminar" /> Eliminar prospecto
                          </button>
                        )}
                    </div>
                  </fieldset>
                </form>
              </div>
            </section>
            {!!detalle.version && (
              <section className="card">
                <div className="card-body">
                  <details className="detalle-secundario">
                    <summary>Historial (últimos 50 eventos)</summary>
                    <ul className="list-unstyled">
                      {eventos.map((e) => (
                        <li className="border-bottom py-2" key={e.id}>
                          <strong>
                            {e.tipo === "registro_creado"
                              ? "Prospecto creado"
                              : "Prospecto actualizado"}
                          </strong>{" "}
                          · {fecha(e.ocurrido_en)} · {nombrePerfil(e.actor_id)}
                          {e.motivo && (
                            <p className="mb-1">Motivo: {e.motivo}</p>
                          )}
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
                                      (c === "origen"
                                        ? "Origen"
                                        : "Responsable")}
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
                  </details>
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
                <div className="col-md-3">
                  <label htmlFor="filtrar-autor" className="form-label">
                    Cargado por
                  </label>
                  <select
                    id="filtrar-autor"
                    name="autor"
                    className="form-select"
                    defaultValue={filtros.autor}
                  >
                    <option value="">Todos</option>
                    {catalogos.perfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-2 align-self-end">
                  <button className="btn btn-outline-primary" type="submit">
                    Filtrar
                  </button>
                </div>
              </form>
              <p role="status">{lista.total} prospectos</p>
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
                        <th scope="col">Cargado por</th>
                        <th scope="col">Creación</th>
                        <th scope="col">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lista.registros.map((r) => (
                        <tr key={r.id}>
                          <td>
                            {r.nombre}{" "}
                            {r.lote_demostracion && (
                              <span className="badge bg-warning text-dark">
                                DEMO
                              </span>
                            )}
                          </td>
                          <td>{r.telefono || "—"}</td>
                          <td>{nombreOrigen(r.origen)}</td>
                          <td>{nombrePerfil(r.creado_por)}</td>
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
                              Ver contacto y siguiente paso
                            </button>
                            {administrador && !r.lote_demostracion && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger ms-2"
                                disabled={guardando}
                                title={`Eliminar ${r.nombre}`}
                                aria-label={`Eliminar ${r.nombre}`}
                                onClick={() => solicitarBaja(r)}
                              >
                                <IconoAccion accion="eliminar" />
                              </button>
                            )}
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
