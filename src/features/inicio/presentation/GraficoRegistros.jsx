import { useId } from "react";
import "./graficos.css";

// Presentación pura: utiliza exactamente las categorías del resumen y su filtro.
export function GraficoRegistros({ grupo, filtro, seleccionar }) {
  const ayuda = useId();
  const diario = grupo.campo === "dia";
  const maximo = Math.max(1, ...grupo.valores.map((v) => v.cantidad));
  const techo = Math.max(4, Math.ceil(maximo / 4) * 4);
  const elegir = (g) =>
    seleccionar(
      grupo.campo,
      g.valor,
      `${grupo.titulo}: ${grupo.nombre(g.valor)}`,
    );
  if (!grupo.valores.length) return <p>Sin registros para graficar.</p>;
  return (
    <>
      <p id={ayuda} className="text-muted small">
        Cantidad de registros · seleccioná una barra para ver el detalle debajo.
      </p>
      {diario ? (
        <div
          className="grafico-diario-desplazable"
          role="group"
          aria-label={grupo.titulo}
          aria-describedby={ayuda}
        >
          <div className="grafico-diario">
            <div className="grafico-eje" aria-hidden="true">
              {[4, 3, 2, 1, 0].map((n) => (
                <span key={n}>{(techo * n) / 4}</span>
              ))}
            </div>
            <div className="grafico-columnas">
              {grupo.valores.map((g) => (
                <button
                  type="button"
                  key={g.valor}
                  className="grafico-columna"
                  onClick={() => elegir(g)}
                  aria-pressed={
                    filtro?.campo === grupo.campo && filtro.valor === g.valor
                  }
                  aria-label={`Día ${grupo.nombre(g.valor)}: ${g.cantidad} registros. Ver detalle`}
                  title={`${g.valor}: ${g.cantidad} registros`}
                >
                  <span className="grafico-columna-area" aria-hidden="true">
                    <span
                      className="grafico-columna-barra"
                      style={{ height: `${(g.cantidad / techo) * 100}%` }}
                    >
                      <span className="grafico-valor">{g.cantidad}</span>
                    </span>
                  </span>
                  <span className="grafico-dia" aria-hidden="true">
                    {grupo.nombre(g.valor)}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <p className="text-center small text-muted mt-2">
            Día del mes · escala desde cero
          </p>
        </div>
      ) : (
        <div
          className="grafico-horizontal"
          role="group"
          aria-label={grupo.titulo}
          aria-describedby={ayuda}
        >
          {grupo.valores.map((g) => (
            <button
              type="button"
              key={g.valor}
              className="grafico-fila"
              onClick={() => elegir(g)}
              aria-pressed={
                filtro?.campo === grupo.campo && filtro.valor === g.valor
              }
              aria-label={`${grupo.nombre(g.valor)}: ${g.cantidad} registros. Ver detalle`}
            >
              <span className="grafico-etiqueta">{grupo.nombre(g.valor)}</span>
              <strong>{g.cantidad}</strong>
              <span className="grafico-pista" aria-hidden="true">
                <span style={{ width: `${(g.cantidad / maximo) * 100}%` }} />
              </span>
            </button>
          ))}
          <p className="small text-muted mt-2">
            Escala desde 0 hasta {maximo} registros.
          </p>
        </div>
      )}
    </>
  );
}
