import { ordenarAlfabeticamente } from "../../../shared/ui/ordenAlfabetico.js";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { seleccionarRegistros } from "../domain/resumen.js";
import { GraficoRegistros } from "./GraficoRegistros.jsx";
import { ResumenHistorico } from "./ResumenHistorico.jsx";

export function EstadisticasMensuales({ gestion, perfil }) {
  const [mes, cambiarMes] = useState("2026-09");
  const [datos, cambiarDatos] = useState(null);
  const [error, cambiarError] = useState("");
  const [revision, recargar] = useState(0);
  const [filtro, cambiarFiltro] = useState(null);
  const [pagina, cambiarPagina] = useState(0);
  useEffect(() => {
    let vigente = true;
    cambiarDatos(null);
    cambiarError("");
    cambiarFiltro(null);
    cambiarPagina(0);
    if (!gestion) {
      cambiarError("No hay conexión configurada.");
      return;
    }
    gestion
      .cargar(mes)
      .then((resultado) => {
        if (vigente) cambiarDatos(resultado);
      })
      .catch((fallo) => {
        if (vigente) cambiarError(fallo.message);
      });
    return () => {
      vigente = false;
    };
  }, [gestion, mes, revision, perfil.id]);
  const seleccionar = (campo, valor, etiqueta) => {
    cambiarFiltro(campo ? { campo, valor, etiqueta } : null);
    cambiarPagina(0);
  };
  const nombrePerfil = (id) =>
    id
      ? datos.perfiles.find((p) => p.id === id)?.nombre || "Otro integrante"
      : "Sin asignar";
  const fechaCarga = (r) =>
    r.fecha_carga
      ? new Intl.DateTimeFormat("es-AR", {
          dateStyle: "short",
          timeStyle: "medium",
          timeZone: "America/Argentina/Cordoba",
        }).format(new Date(r.fecha_carga))
      : r.dia;
  const nombreOrigen = (codigo) =>
    datos.origenes.find((o) => o.codigo === codigo)?.nombre || codigo;
  const filas = datos ? seleccionarRegistros(datos.registros, filtro) : [];
  const grupos = datos
    ? [
        {
          titulo: "Cargas por día",
          campo: "dia",
          valores: datos.resumen.porDia,
          nombre: (v) => v.slice(8),
        },
        {
          titulo: "Por origen",
          campo: "origen",
          valores: datos.resumen.porOrigen,
          nombre: nombreOrigen,
        },
        {
          titulo: "Registrado por (incluye importador)",
          campo: "creado_por",
          valores: datos.resumen.porCreador,
          nombre: nombrePerfil,
        },
        {
          titulo: "Por responsable actual",
          campo: "responsable_id",
          valores: datos.resumen.porResponsable,
          nombre: nombrePerfil,
        },
      ]
    : [];
  return (
    <section aria-labelledby="titulo-estadisticas">
      <h2 id="titulo-estadisticas">Prospectos · resumen mensual</h2>
      <p>
        {perfil.rol === "administrador"
          ? "Alcance: todos los registros."
          : "Alcance: tu cartera actual; no incluye registros reasignados a otros."}{" "}
        Fechas de Córdoba, Argentina.
      </p>
      <div className="d-flex flex-wrap gap-3 align-items-end mb-3">
        <div>
          <label className="form-label" htmlFor="mes-estadisticas">
            Mes
          </label>
          <input
            id="mes-estadisticas"
            type="month"
            className="form-control"
            value={mes}
            min="2000-01"
            max="2099-12"
            onChange={(e) => cambiarMes(e.target.value)}
          />
        </div>
        <button
          className="btn btn-outline-primary"
          onClick={() => recargar((n) => n + 1)}
        >
          Actualizar estadísticas
        </button>
      </div>
      <p className="text-muted">
        Conteos brutos, no captaciones válidas ni ventas.
      </p>
      {error ? (
        <p className="alert alert-danger" role="alert">
          {error}
        </p>
      ) : !datos ? (
        <p role="status">Cargando estadísticas…</p>
      ) : (
        <>
          <ResumenHistorico key={mes} filas={datos.historico || []} />
          {!!datos.historico?.length && (
            <p>
              Los gráficos incluyen las cargas históricas con fecha confirmada
              por administración, usando el día y la hora del Excel en Córdoba.
              La importación no cambia esa fecha ni se cuenta dos veces. Estas
              son fechas de carga, no fechas de cierre de venta.
            </p>
          )}
          {datos.resumen.demostracion > 0 && (
            <p className="alert alert-warning">
              Contiene {datos.resumen.demostracion} registros de demostración.
              Sus fechas son simuladas; no representan actividad real ni una
              proyección. No contactar sus teléfonos ni atribuir sus direcciones
              a personas reales.
            </p>
          )}
          <div className="row g-3 mb-3">
            {[
              ["Total del mes", datos.resumen.total, null],
              ["Demostración", datos.resumen.demostracion, "demostracion"],
              [
                "No demostración",
                datos.resumen.total - datos.resumen.demostracion,
                "reales",
              ],
              ["Sin asignar", datos.resumen.sinAsignar, "responsable_id"],
            ]
              .filter(
                ([, , campo]) =>
                  datos.resumen.demostracion > 0 ||
                  !["demostracion", "reales"].includes(campo),
              )
              .map(([titulo, cantidad, campo]) => (
                <div
                  className={
                    datos.resumen.demostracion > 0 ? "col-6 col-xl-3" : "col-6"
                  }
                  key={titulo}
                >
                  <button
                    className="card card-body w-100 text-start"
                    onClick={() => seleccionar(campo, null, titulo)}
                    aria-label={`${titulo}: ${cantidad}. Ver registros`}
                  >
                    <span>{titulo}</span>
                    <strong className="fs-2">{cantidad}</strong>
                    <small>Ver registros</small>
                  </button>
                </div>
              ))}
          </div>
          <div className="row g-3">
            {grupos.map((grupo) => (
              <div
                className={grupo.campo === "dia" ? "col-12" : "col-lg-6"}
                key={grupo.campo}
              >
                <section className="card card-body">
                  <h3 className="h5">{grupo.titulo}</h3>
                  <GraficoRegistros
                    grupo={grupo}
                    filtro={filtro}
                    seleccionar={seleccionar}
                  />
                  <details className="mt-3">
                    <summary className="text-primary">
                      Ver tabla: {grupo.titulo}
                    </summary>
                    <div style={{ maxHeight: "22rem", overflowY: "auto" }}>
                      <table className="table table-sm">
                        <thead>
                          <tr>
                            <th scope="col">
                              {grupo.campo === "dia" ? "Día" : "Categoría"}
                            </th>
                            <th scope="col">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {grupo.valores.map((g) => (
                            <tr key={g.valor}>
                              <td>{grupo.nombre(g.valor)}</td>
                              <td>
                                <button
                                  className="btn btn-sm btn-outline-primary"
                                  onClick={() =>
                                    seleccionar(
                                      grupo.campo,
                                      g.valor,
                                      `${grupo.titulo}: ${grupo.nombre(g.valor)}`,
                                    )
                                  }
                                  aria-label={`Ver ${g.cantidad} registros: ${grupo.nombre(g.valor)}`}
                                >
                                  {g.cantidad}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                  {!grupo.valores.length && <p>Sin registros.</p>}
                </section>
              </div>
            ))}
          </div>
          <section
            className="card card-body"
            aria-labelledby="detalle-estadisticas"
          >
            <h3 id="detalle-estadisticas" className="h5">
              {filtro?.etiqueta || "Todos los registros del mes"}
            </h3>
            <p role="status">
              {filas.length} registros. El detalle corresponde a la misma
              lectura que las cifras.
            </p>
            {filtro && (
              <button
                className="btn btn-link text-start"
                onClick={() => seleccionar(null)}
              >
                Quitar filtro del detalle
              </button>
            )}
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Nombre</th>
                    <th scope="col">Fecha y hora de carga · Córdoba</th>
                    <th scope="col">Origen</th>
                    <th scope="col">Registrado por</th>
                    <th scope="col">Tipo</th>
                  </tr>
                </thead>
                <tbody>
                  {ordenarAlfabeticamente(filas)
                    .slice(pagina * 20, pagina * 20 + 20)
                    .map((r) => (
                      <tr key={r.id}>
                        <td>
                          <Link to={`/prospectos?registro=${r.id}`}>
                            {r.nombre}
                          </Link>
                        </td>
                        <td>{fechaCarga(r)}</td>
                        <td>{nombreOrigen(r.origen)}</td>
                        <td>{nombrePerfil(r.creado_por)}</td>
                        <td>
                          {r.lote_demostracion
                            ? "DEMO"
                            : r.tipo_carga === "historica_confirmada"
                              ? "Histórico · fecha confirmada"
                              : "Plataforma"}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <nav
              aria-label="Páginas del detalle estadístico"
              className="d-flex gap-2 align-items-center"
            >
              <button
                className="btn btn-outline-secondary"
                disabled={!pagina}
                onClick={() => cambiarPagina((n) => n - 1)}
              >
                Anterior
              </button>
              <span>Página {pagina + 1}</span>
              <button
                className="btn btn-outline-secondary"
                disabled={(pagina + 1) * 20 >= filas.length}
                onClick={() => cambiarPagina((n) => n + 1)}
              >
                Siguiente
              </button>
            </nav>
          </section>
        </>
      )}
    </section>
  );
}
