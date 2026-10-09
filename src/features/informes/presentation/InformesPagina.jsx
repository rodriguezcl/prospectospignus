import { ordenarAlfabeticamente } from "../../../shared/ui/ordenAlfabetico.js";
import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { monedaArgentina } from "../../../shared/ui/importe.js";
import "./rendimiento.css";

const numero = (v) =>
  v == null
    ? "—"
    : Number(v).toLocaleString("es-AR", { maximumFractionDigits: 2 });
const dinero = monedaArgentina;
const origenes = {
  propio: "Propio",
  asignado_agente: "Asignado por agente",
  sin_identificar: "Sin identificar",
};
const indicadores = [
  ["ventas", "Ventas cerradas en el mes", "#269766", numero],
  [
    "conversion",
    "Conversión de casos visitados",
    "#9064cc",
    (v) => (v == null ? "—" : `${numero(v)} %`),
  ],
  ["volumen_inicial", "Volumen inicial neto", "#3b86c4", dinero],
  ["ticket_inicial", "Ticket inicial por venta con importe", "#c48b25", dinero],
  ["ticket_instalacion", "Ticket de instalación", "#219b9b", dinero],
  ["ticket_abono", "Ticket de abono mensual original", "#bc668e", dinero],
];

export function GraficosRendimiento({ filas, seleccionar }) {
  return (
    <div className="rendimiento-graficos">
      {indicadores.map(([campo, titulo, color, formato]) => {
        const orden = [...filas].sort(
          (a, b) =>
            Number(b[campo] ?? -1) - Number(a[campo] ?? -1) ||
            a.nombre.localeCompare(b.nombre),
        );
        const maximo = Math.max(1, ...orden.map((f) => Number(f[campo] ?? 0)));
        return (
          <section className="card card-body" key={campo}>
            <h2 className="h5">{titulo}</h2>
            {!filas.length && <p>Sin personas en esta selección.</p>}
            {orden.map((f) => (
              <button
                type="button"
                className="rendimiento-barra"
                key={f.id}
                onClick={() =>
                  seleccionar(f, campo === "conversion" ? "visitas" : "ventas")
                }
              >
                <span>{f.nombre}</span>
                <strong>{formato(f[campo])}</strong>
                <span className="rendimiento-pista" aria-hidden="true">
                  <span
                    style={{
                      width: `${(100 * Number(f[campo] ?? 0)) / maximo}%`,
                      background: color,
                    }}
                  />
                </span>
                <small>
                  {campo === "conversion"
                    ? `${f.directos} cierres propios / ${f.visitados} casos visitados`
                    : campo === "ticket_abono"
                      ? `${f.con_abono} ventas con abono`
                      : campo === "ticket_instalacion"
                        ? `${f.con_instalacion} ventas con instalación cobrada`
                        : `${f.con_importe} con importe · ${f.sin_importe} sin importe · ${f.desconocidas} sin datos de importe`}
                </small>
              </button>
            ))}
          </section>
        );
      })}
    </div>
  );
}

export function PanelRendimiento({
  gestion,
  perfil,
  mes,
  responsable = "",
  compacto = false,
}) {
  const [datos, establecer] = useState(null),
    [error, fallar] = useState("");
  const [origen, cambiarOrigen] = useState(""),
    [rol, cambiarRol] = useState("vendedor");
  const [revision, recargar] = useState(0),
    [seleccion, seleccionar] = useState(null);
  const [detalle, detallar] = useState(null),
    [errorDetalle, fallarDetalle] = useState(""),
    [pagina, paginar] = useState(0);
  const admin = perfil.rol === "administrador";
  useEffect(() => {
    let vigente = true;
    establecer(null);
    fallar("");
    seleccionar(null);
    gestion
      .resumen({ mes, origen })
      .then((d) => {
        if (vigente) establecer(d);
      })
      .catch((e) => {
        if (vigente) fallar(e.message);
      });
    return () => {
      vigente = false;
    };
  }, [gestion, mes, origen, revision]);
  useEffect(() => {
    let vigente = true;
    detallar(null);
    fallarDetalle("");
    if (seleccion)
      gestion
        .detalle({
          mes,
          origen,
          responsable: seleccion.persona.id,
          tipo: seleccion.tipo,
          pagina,
        })
        .then((d) => {
          if (vigente) detallar(d);
        })
        .catch((e) => {
          if (vigente) fallarDetalle(e.message);
        });
    return () => {
      vigente = false;
    };
  }, [gestion, mes, origen, seleccion, pagina]);
  const abrir = (persona, tipo) => {
    seleccionar({ persona, tipo });
    paginar(0);
  };
  const filas = (datos?.filas || []).filter(
    (f) => !responsable || f.id === responsable,
  );
  const comparables = filas.filter((f) => !admin || !rol || f.rol === rol);
  const propia = filas.find((f) => f.id === (responsable || perfil.id));
  const individual = Boolean(responsable) || !admin;
  const resumen = individual ? propia : datos?.empresa;
  return (
    <section aria-label="Rendimiento comercial" className="rendimiento">
      {!compacto && (
        <div className="d-flex flex-wrap gap-3 mb-3">
          <label>
            Origen
            <select
              className="form-select"
              value={origen}
              onChange={(e) => cambiarOrigen(e.target.value)}
            >
              <option value="">Todos los orígenes</option>
              {Object.entries(origenes).map(([id, nombre]) => (
                <option key={id} value={id}>
                  {nombre}
                </option>
              ))}
            </select>
          </label>
          {admin && (
            <label>
              Comparar
              <select
                className="form-select"
                value={rol}
                onChange={(e) => cambiarRol(e.target.value)}
              >
                <option value="vendedor">Vendedores</option>
                <option value="agente">Agentes</option>
                <option value="">Todo el equipo</option>
              </select>
            </label>
          )}
          <button
            className="btn btn-outline-primary align-self-end"
            onClick={() => recargar((r) => r + 1)}
          >
            Actualizar
          </button>
        </div>
      )}
      {error ? (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      ) : !datos ? (
        <p role="status">Cargando rendimiento…</p>
      ) : (
        <>
          <div className="rendimiento-tarjetas">
            <div className="card card-body">
              <span>Ventas del mes</span>
              <strong>{numero(resumen?.ventas ?? 0)}</strong>
            </div>
            <div className="card card-body">
              <span>Casos con primera visita en el mes</span>
              <strong>{numero(resumen?.visitados ?? 0)}</strong>
            </div>
            <div className="card card-body">
              <span>Volumen inicial neto informado</span>
              <strong>{dinero(resumen?.volumen_inicial)}</strong>
            </div>
            <div className="card card-body">
              <span>
                {individual
                  ? "Conversión de visitas propias"
                  : "Ventas sin importe informado"}
              </span>
              <strong>
                {individual
                  ? propia?.conversion == null
                    ? "—"
                    : `${numero(propia.conversion)} %`
                  : numero(datos.empresa.sin_importes)}
              </strong>
            </div>
          </div>
          {compacto && admin ? (
            <p>
              <Link to={`/informes?mes=${mes}`}>
                Comparar ventas, conversión y tickets →
              </Link>
            </p>
          ) : (
            <details
              className="detalle-secundario"
              open={compacto ? undefined : true}
            >
              <summary>
                {compacto
                  ? "Mis resultados y tickets en detalle"
                  : "Comparativas y detalle del equipo"}
              </summary>
              <GraficosRendimiento filas={comparables} seleccionar={abrir} />
              <div className="table-responsive">
                <table className="table">
                  <caption>
                    Detalle por persona. Ventas por mes de cierre; visitas por
                    primera visita del ciclo.
                  </caption>
                  <thead>
                    <tr>
                      <th>Persona</th>
                      <th>Ventas</th>
                      <th>Casos visitados</th>
                      <th>Origen de visitas</th>
                      <th>Resultado de la cohorte visitada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ordenarAlfabeticamente(comparables).map((f) => (
                      <tr key={f.id}>
                        <td>
                          {f.nombre}
                          <small className="d-block">{f.rol}</small>
                        </td>
                        <td>
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => abrir(f, "ventas")}
                          >
                            {f.ventas} · Ver ventas
                          </button>
                          <small className="d-block">
                            {f.con_importe} con importe / {f.sin_importe} sin
                            importe / {f.desconocidas} no informado
                          </small>
                        </td>
                        <td>
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => abrir(f, "visitas")}
                          >
                            {f.visitados} · Ver casos
                          </button>
                        </td>
                        <td>
                          {f.propios} propios · {f.asignados} asignados ·{" "}
                          {f.sin_identificar} sin identificar
                        </td>
                        <td>
                          {f.directos} cierres propios · {f.recuperados}{" "}
                          recuperados por otro · {f.derivados} derivados ·{" "}
                          {f.pendientes} abiertos
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {!compacto && (
                <p>
                  Categorías con propuesta registrada:{" "}
                  {datos.categorias
                    .map((c) => `${c.servicio}: ${c.ventas}`)
                    .join(" · ") || "sin datos"}
                  . Una venta combinada aparece en varias categorías; no sumar
                  estos conteos. Ventas del mes sin visita registrada en su
                  ciclo: {datos.empresa.sin_visita}.
                </p>
              )}
            </details>
          )}
          <details className="detalle-secundario">
            <summary>Criterios y cobertura de estos indicadores</summary>
            <p>
              Ventas: mes del cierre en Córdoba (o mes histórico confirmado).
              Importes finales con IVA, luego de bonificaciones y descuento de
              efectivo; no representan cobros. Abono original separado del pago
              inicial. Los tickets excluyen importes cero y desconocidos; cada
              gráfico informa su denominador.
            </p>
            <p>
              Conversión: cierres propios de los casos cuya primera visita
              efectiva del ciclo ocurrió en el mes, divididos por esos casos
              visitados. Revisitas no duplican el caso. Cada participante lo
              cuenta una vez; la empresa una sola vez. La venta pertenece solo a
              quien cerró. No se divide ventas del mes por visitas del mes. Los
              resultados de la cohorte se actualizan con cierres posteriores.
            </p>
            <p>
              Visitas realizadas declaradas en Agenda y vinculadas a un
              caso/ciclo; no prueba de presencia. Origen no identificado y
              precios históricos faltantes permanecen desconocidos. Un caso
              derivado y luego recuperado puede aparecer en ambas columnas.
              Agentes no se comparan por conversión de visitas si no tienen
              visitas propias.
            </p>
            <p>
              Actualización:{" "}
              {new Date(datos.corte).toLocaleString("es-AR", {
                timeZone: "America/Argentina/Cordoba",
              })}
              . El comparador de rol filtra gráficos y tabla, no los totales
              generales.
            </p>
          </details>
        </>
      )}
      {seleccion && (
        <section className="card card-body" aria-label="Detalle del indicador">
          <div className="d-flex justify-content-between gap-2">
            <h2 className="h5">
              {seleccion.tipo === "ventas" ? "Ventas" : "Casos visitados"} ·{" "}
              {seleccion.persona.nombre}
            </h2>
            <button
              className="btn btn-outline-secondary btn-sm"
              onClick={() => seleccionar(null)}
            >
              Cerrar detalle
            </button>
          </div>
          {errorDetalle ? (
            <p role="alert">{errorDetalle}</p>
          ) : !detalle ? (
            <p role="status">Cargando detalle…</p>
          ) : (
            <>
              <p>{detalle.total} registros</p>
              <ul>
                {detalle.filas.map((f) => (
                  <li key={`${f.id}-${f.ciclo}`}>
                    <Link to={`/cotizaciones?id=${f.id}`}>
                      {f.nombre} · {f.necesidad}
                    </Link>{" "}
                    · Ciclo {f.ciclo} · {origenes[f.origen]} ·{" "}
                    {f.resultado === "ganar"
                      ? "Ganada"
                      : f.resultado === "perder"
                        ? "Perdida"
                        : "Abierta"}
                    {seleccion.tipo === "ventas" && ` · ${dinero(f.importe)}`}
                  </li>
                ))}
              </ul>
              <nav
                aria-label="Páginas del indicador"
                className="d-flex flex-wrap gap-2 align-items-center"
              >
                <button
                  className="btn btn-outline-secondary"
                  disabled={!pagina}
                  onClick={() => paginar((p) => p - 1)}
                >
                  Anterior
                </button>
                <span>Página {pagina + 1}</span>
                <button
                  className="btn btn-outline-secondary"
                  disabled={(pagina + 1) * 20 >= detalle.total}
                  onClick={() => paginar((p) => p + 1)}
                >
                  Siguiente
                </button>
              </nav>
            </>
          )}
        </section>
      )}
    </section>
  );
}

export function InformesPagina({ gestion, perfil }) {
  const [consulta] = useSearchParams();
  const [mes, cambiarMes] = useState(() => {
    const pedido = consulta.get("mes");
    if (/^(20\d{2})-(0[1-9]|1[0-2])$/.test(pedido || "")) return pedido;
    const partes = new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "2-digit",
      timeZone: "America/Argentina/Cordoba",
    }).formatToParts(new Date());
    return `${partes.find((p) => p.type === "year").value}-${partes.find((p) => p.type === "month").value}`;
  });
  return (
    <>
      <h1>Informes</h1>
      <p>Resultados comerciales y conversión por visitas.</p>
      <label className="mb-3">
        Mes
        <input
          className="form-control"
          type="month"
          min="2000-01"
          max="2099-12"
          value={mes}
          onChange={(e) => {
            if (e.target.value) cambiarMes(e.target.value);
          }}
        />
      </label>
      <PanelRendimiento gestion={gestion} perfil={perfil} mes={mes} />
    </>
  );
}
