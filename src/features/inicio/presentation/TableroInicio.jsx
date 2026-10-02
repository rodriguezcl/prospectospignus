import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { construirTablero, mesCordoba } from "../domain/tablero.js";
import { GraficoRegistros } from "./GraficoRegistros.jsx";
import "./tablero.css";

const numero = (n) => n.toLocaleString("es-AR", { maximumFractionDigits: 1 });
const fecha = (valor) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Cordoba",
  }).format(new Date(valor));

export function GraficosResultados({ tablero, administrador, seleccionar }) {
  let acumulado = 0;
  const total = tablero.cohorte.length;
  return (
    <div className="tablero-graficos">
      <section className="card card-body">
        <h2 className="h5">Distribución por estado</h2>
        {!total ? (
          <p>Sin prospectos en este período.</p>
        ) : (
          <div className="distribucion-estados">
            <svg
              viewBox="0 0 120 120"
              className="grafico-anillo"
              role="img"
              aria-label={`Distribución de ${total} prospectos. Cantidades en la leyenda.`}
            >
              {tablero.porEstado
                .filter((e) => e.cantidad)
                .map((e) => {
                  const porcentaje = (e.cantidad / total) * 100;
                  const inicio = acumulado;
                  acumulado += porcentaje;
                  return (
                    <circle
                      key={e.valor}
                      className={`tono-${e.color}`}
                      cx="60"
                      cy="60"
                      r="44"
                      fill="none"
                      strokeWidth="16"
                      pathLength="100"
                      strokeDasharray={`${porcentaje} ${100 - porcentaje}`}
                      strokeDashoffset={-inicio}
                      transform="rotate(-90 60 60)"
                    />
                  );
                })}
              <text x="60" y="59" textAnchor="middle" className="anillo-total">
                {numero(total)}
              </text>
              <text
                x="60"
                y="73"
                textAnchor="middle"
                className="anillo-etiqueta"
              >
                prospectos
              </text>
            </svg>
            <div className="leyenda-estados">
              {tablero.porEstado.map((e) => (
                <button
                  key={e.valor}
                  type="button"
                  className="leyenda-estado"
                  onClick={() =>
                    seleccionar(
                      e.nombre,
                      tablero.cohorte.filter((r) => r.estado === e.valor),
                    )
                  }
                >
                  <span
                    className={`muestra-color tono-${e.color}`}
                    aria-hidden="true"
                  />
                  <span>{e.nombre}</span>
                  <strong>{numero(e.cantidad)}</strong>
                  <small>{numero((100 * e.cantidad) / total)} %</small>
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
      {administrador && (
        <section className="card card-body">
          <h2 className="h5">Resultados por responsable</h2>
          {!total ? (
            <p>Sin resultados para comparar.</p>
          ) : (
            <div className="resultados-equipo">
              {tablero.equipo.map((persona) => (
                <button
                  key={persona.id || "sin-asignar"}
                  className="resultado-persona"
                  type="button"
                  onClick={() =>
                    seleccionar(
                      persona.nombre,
                      tablero.cohorte.filter(
                        (r) => r.atribuido_id === persona.id,
                      ),
                    )
                  }
                >
                  <span>{persona.nombre}</span>
                  <strong>{persona.total}</strong>
                  <span className="barra-equipo" aria-hidden="true">
                    {persona.estados
                      .filter((e) => e.cantidad)
                      .map((e) => (
                        <span
                          key={e.valor}
                          className={`tono-${e.color}`}
                          style={{
                            width: `${(100 * e.cantidad) / Math.max(...tablero.equipo.map((p) => p.total))}%`,
                          }}
                        />
                      ))}
                  </span>
                  <small>
                    {persona.estados
                      .filter((e) => e.cantidad)
                      .map((e) => `${e.nombre}: ${e.cantidad}`)
                      .join(" · ")}
                  </small>
                </button>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export function TableroInicio({ gestion, perfil, renderRendimiento }) {
  const [mes, cambiarMes] = useState(() => mesCordoba());
  const [responsable, cambiarResponsable] = useState("");
  const [datos, cambiarDatos] = useState(null);
  const [error, fallar] = useState("");
  const [revision, recargar] = useState(0);
  const [detalle, cambiarDetalle] = useState(null);
  const [pagina, paginar] = useState(0);
  const referenciaDetalle = useRef(null);
  const admin = perfil.rol === "administrador";
  useEffect(() => {
    let vigente = true;
    cambiarDatos(null);
    fallar("");
    cambiarDetalle(null);
    paginar(0);
    if (!gestion) {
      fallar("No hay conexión configurada.");
      return;
    }
    gestion
      .cargarTablero(mes, admin ? responsable : "")
      .then((resultado) => {
        const tablero = construirTablero(
          resultado,
          mes,
          perfil,
          responsable,
          new Date(resultado.corte),
        );
        if (vigente) cambiarDatos({ ...resultado, tablero });
      })
      .catch((e) => {
        if (vigente) fallar(e.message);
      });
    return () => {
      vigente = false;
    };
  }, [gestion, mes, responsable, revision, perfil.id, perfil.rol]);
  useEffect(() => {
    if (detalle) referenciaDetalle.current?.focus();
  }, [detalle]);
  const seleccionar = (titulo, filas, registros = false) => {
    cambiarDetalle({ titulo, filas, registros });
    paginar(0);
  };
  const t = datos?.tablero;
  return (
    <div className="tablero-inicio">
      <header className="tablero-cabecera">
        <div>
          <h1>Inicio</h1>
          <p>{admin ? "Resumen del equipo" : "Mi resumen comercial"}</p>
        </div>
        <div className="tablero-filtros">
          <label>
            Mes
            <input
              type="month"
              className="form-control"
              value={mes}
              min="2000-01"
              max="2099-12"
              onChange={(e) => {
                if (e.target.value) cambiarMes(e.target.value);
              }}
            />
          </label>
          {admin && (
            <label>
              Responsable
              <select
                className="form-select"
                value={responsable}
                onChange={(e) => cambiarResponsable(e.target.value)}
              >
                <option value="">Todo el equipo</option>
                {datos?.perfiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre}
                  </option>
                ))}
                {!datos && responsable && (
                  <option value={responsable}>Responsable seleccionado</option>
                )}
              </select>
            </label>
          )}
          <button
            className="btn btn-outline-primary"
            onClick={() => recargar((r) => r + 1)}
          >
            Actualizar
          </button>
        </div>
      </header>
      {renderRendimiento?.({ mes, responsable, revision })}
      <details className="tablero-ayuda">
        <summary>Criterios de captación y pendientes</summary>
        <p>
          Los prospectos del período son necesidades comerciales creadas en el
          mes, no registros iniciales sin calificar. Ganadas y conversión
          corresponden a ese mismo conjunto, no a todas las ventas del mes.
          Conversión = ganadas ÷ prospectos del período; sin prospectos se
          muestra —.
        </p>
        <p>
          El histórico conserva el resultado y responsable originales de
          septiembre, aunque un caso se reactive. Los casos nuevos muestran
          estado y responsable actuales al actualizar. Las cargas diarias usan
          la fecha real confirmada, no la importación, y son conteos brutos.
          Fechas de Córdoba.
        </p>
        <p>
          Los pendientes muestran la cartera actual, sin filtro de mes.
          Vendedores y agentes ven sus indicadores propios; la bandeja sin
          asignar solo aparece para agentes y administración. Las ventas se
          atribuyen al responsable al cierre. Ganada indica aceptación
          comercial, no instalación ni cobro.
        </p>
      </details>
      {error ? (
        <p className="alert alert-danger" role="alert">
          {error}
        </p>
      ) : !t ? (
        <p role="status">Cargando resumen…</p>
      ) : (
        <>
          <details
            className="detalle-secundario"
            open={renderRendimiento ? undefined : true}
          >
            <summary>
              Captación y resultados de los prospectos creados en el mes
            </summary>
            <div className="tablero-indicadores">
              {[
                ["Prospectos del período", t.cohorte.length, "azul", t.cohorte],
                [
                  "Ganadas de esos prospectos",
                  t.ganadas.length,
                  "verde",
                  t.ganadas,
                ],
                [
                  "Conversión por captación",
                  t.conversion === null ? "—" : `${numero(t.conversion)} %`,
                  "violeta",
                  t.cohorte,
                ],
                [
                  "Pendientes del período",
                  t.abiertas.length,
                  "ambar",
                  t.abiertas,
                ],
              ].map(([titulo, valor, color, filas]) => (
                <button
                  key={titulo}
                  className={`card indicador tono-${color}`}
                  onClick={() => seleccionar(titulo, filas)}
                >
                  <span>{titulo}</span>
                  <strong>
                    {typeof valor === "number" ? numero(valor) : valor}
                  </strong>
                  <small>Ver detalle</small>
                </button>
              ))}
            </div>
            <div className="tablero-contexto">
              <span>Actualizado: {fecha(datos.corte)}</span>
              {t.cohorte.some((r) => r.periodo_historico) && (
                <span>
                  Histórico: resultado original; estado actual en el detalle.
                </span>
              )}
              <Link
                to={`/ventas?mes=${mes}${responsable ? `&responsable=${encodeURIComponent(responsable)}` : ""}`}
              >
                Ventas cerradas en el mes: <strong>{datos.ventas}</strong> →
              </Link>
            </div>
            <section className="card card-body cargas-tablero">
              <h2 className="h5">
                Cargas diarias{" "}
                <small>
                  · {numero(t.registros.length)} registros iniciales
                </small>
              </h2>
              <GraficoRegistros
                grupo={{
                  titulo: "Cargas diarias",
                  campo: "dia",
                  valores: t.cargas.porDia,
                  nombre: (v) => v.slice(8),
                }}
                filtro={null}
                seleccionar={(_, dia, titulo) =>
                  seleccionar(
                    titulo,
                    t.registros.filter((r) => r.dia === dia),
                    true,
                  )
                }
              />
            </section>
            <GraficosResultados
              tablero={t}
              administrador={admin}
              seleccionar={seleccionar}
            />
          </details>
          <section className="card card-body">
            <h2 className="h5">
              Para atender ahora <small>· cartera actual</small>
            </h2>
            <div className="pendientes-tablero">
              {[
                ["Visitas próximas · 7 días", t.visitasProximas, "azul"],
                [
                  "Visitas pendientes de actualizar",
                  t.visitasVencidas,
                  "ambar",
                ],
                ["Seguimientos vencidos", t.seguimientos, "rojo"],
                ...(perfil.rol !== "vendedor"
                  ? [
                      ["Recuperaciones asignadas", t.recuperaciones, "violeta"],
                      ...(!responsable
                        ? [
                            [
                              "Recuperaciones sin asignar",
                              t.sinAsignar,
                              "ambar",
                            ],
                          ]
                        : []),
                    ]
                  : []),
              ].map(([titulo, filas, color]) => (
                <button
                  key={titulo}
                  className={`pendiente-item tono-${color}`}
                  onClick={() => seleccionar(titulo, filas)}
                >
                  <strong>{filas.length}</strong>
                  <span>{titulo}</span>
                </button>
              ))}
            </div>
          </section>
          {detalle && (
            <section
              ref={referenciaDetalle}
              tabIndex={-1}
              className="card card-body detalle-tablero"
              aria-label={detalle.titulo}
            >
              <div className="d-flex justify-content-between gap-2 align-items-start">
                <h2 className="h5">
                  {detalle.titulo} · {detalle.filas.length}
                </h2>
                <button
                  className="btn btn-outline-secondary btn-sm"
                  onClick={() => cambiarDetalle(null)}
                >
                  Cerrar detalle
                </button>
              </div>
              {!detalle.filas.length ? (
                <p>No hay registros en esta selección.</p>
              ) : (
                <>
                  <div className="table-responsive">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Nombre</th>
                          <th>
                            {detalle.registros ? "Fecha de carga" : "Estado"}
                          </th>
                          <th>
                            {detalle.registros ? "Tipo" : "Estado actual"}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalle.filas
                          .slice(pagina * 20, pagina * 20 + 20)
                          .map((r) => (
                            <tr key={r.id}>
                              <td>
                                <Link
                                  to={
                                    detalle.registros
                                      ? `/registros?registro=${r.id}`
                                      : `/prospectos?id=${r.id}`
                                  }
                                >
                                  {r.nombre ||
                                    r.prospectos?.nombre ||
                                    "Abrir ficha"}
                                </Link>
                              </td>
                              <td>
                                {detalle.registros
                                  ? r.fecha_carga
                                    ? fecha(r.fecha_carga)
                                    : r.dia
                                  : r.estado}
                              </td>
                              <td>
                                {detalle.registros
                                  ? r.tipo_carga === "historica_confirmada"
                                    ? "Histórico confirmado"
                                    : "Plataforma"
                                  : r.estado_actual || r.estado}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <nav
                    className="d-flex gap-2 align-items-center"
                    aria-label="Páginas del detalle"
                  >
                    <button
                      className="btn btn-outline-secondary"
                      disabled={!pagina}
                      onClick={() => paginar(pagina - 1)}
                    >
                      Anterior
                    </button>
                    <span>Página {pagina + 1}</span>
                    <button
                      className="btn btn-outline-secondary"
                      disabled={(pagina + 1) * 20 >= detalle.filas.length}
                      onClick={() => paginar(pagina + 1)}
                    >
                      Siguiente
                    </button>
                  </nav>
                </>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
