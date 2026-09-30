import { useState } from "react";
import { Link } from "react-router-dom";

export function ResumenHistorico({ filas }) {
  const [filtro, filtrar] = useState("");
  const [pagina, paginar] = useState(0);
  if (!filas.length) return null;
  const ganadas = filas.filter((r) => r.resultado === "ganada").length;
  const seleccionadas = filas.filter((r) => !filtro || r.resultado === filtro);
  const vendedores = [
    ...new Set(filas.map((r) => r.responsable_nombre)),
  ].sort();
  return (
    <section className="card card-body" aria-labelledby="historico-titulo">
      <h3 id="historico-titulo">Resultados históricos del mes</h3>
      <p>
        Datos comerciales importados de Excel. Las fechas y horas diarias del
        archivo son estimadas: no se presentan como actividad real. El resultado
        original se conserva aunque una oportunidad se reactive.
      </p>
      <div className="d-flex flex-wrap gap-3 mb-3">
        {[
          ["", "Total", filas.length],
          ["ganada", "Ganadas", ganadas],
          ["perdida", "Perdidas", filas.length - ganadas],
        ].map(([valor, nombre, cantidad]) => (
          <button
            key={valor}
            className="btn btn-outline-primary"
            onClick={() => {
              filtrar(valor);
              paginar(0);
            }}
          >
            {nombre}: {cantidad}
          </button>
        ))}
        <span>
          Tasa de cierre ganado:{" "}
          {((100 * ganadas) / filas.length).toLocaleString("es-AR", {
            maximumFractionDigits: 2,
          })}{" "}
          %
        </span>
      </div>
      <table className="table">
        <thead>
          <tr>
            <th>Vendedor al cierre</th>
            <th>Total</th>
            <th>Ganadas</th>
            <th>Perdidas</th>
          </tr>
        </thead>
        <tbody>
          {vendedores.map((nombre) => {
            const propias = filas.filter(
              (r) => r.responsable_nombre === nombre,
            );
            const ganadas = propias.filter(
              (r) => r.resultado === "ganada",
            ).length;
            return (
              <tr key={nombre}>
                <td>{nombre}</td>
                <td>{propias.length}</td>
                <td>{ganadas}</td>
                <td>{propias.length - ganadas}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p>
        Perdidas: clasificación histórica indicada por administración; motivo
        individual no informado. No acredita un rechazo específico ni gestiones
        de recuperación.
      </p>
      <details>
        <summary>Ver oportunidades ({seleccionadas.length})</summary>
        <table className="table">
          <thead>
            <tr>
              <th>Prospecto</th>
              <th>Resultado histórico</th>
              <th>Estado actual</th>
            </tr>
          </thead>
          <tbody>
            {seleccionadas.slice(pagina * 20, pagina * 20 + 20).map((r) => (
              <tr key={r.id}>
                <td>
                  <Link to={`/oportunidades?id=${r.id}`}>{r.nombre}</Link>
                </td>
                <td>{r.resultado}</td>
                <td>{r.estado_actual}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          className="btn btn-outline-secondary"
          disabled={!pagina}
          onClick={() => paginar(pagina - 1)}
        >
          Anterior
        </button>
        <span className="mx-3">Página {pagina + 1}</span>
        <button
          className="btn btn-outline-secondary"
          disabled={(pagina + 1) * 20 >= seleccionadas.length}
          onClick={() => paginar(pagina + 1)}
        >
          Siguiente
        </button>
      </details>
    </section>
  );
}
