import { useState } from "react";
import { CampoImporte } from "../../../shared/ui/CampoImporte.jsx";
import { monedaArgentina as moneda } from "../../../shared/ui/importe.js";

export function PagoOferta({
  total,
  pago,
  error,
  baseEfectivo,
  medioSaldo,
  cuotas,
  cambiar,
  redondeoManual = "0",
  porcentajeRedondeo = "1",
  cambiarRedondeo,
}) {
  const [mostrarRedondeo, abrirRedondeo] = useState(false);
  const [combinado, combinar] = useState(
    Number(baseEfectivo) > 0 && Number(baseEfectivo) !== Number(total),
  );
  const modo = combinado
    ? "combinado"
    : Number(baseEfectivo) > 0 && Number(baseEfectivo) === Number(total)
      ? "efectivo"
      : medioSaldo;
  function seleccionar(valor) {
    combinar(valor === "combinado");
    cambiar({
      base: valor === "efectivo" ? total : "0",
      medio: ["efectivo", "combinado"].includes(valor) ? "debito" : valor,
      cantidad: 1,
    });
  }
  return (
    <div className="mb-3">
      <fieldset className="mb-3">
        <legend className="h6">Forma de pago</legend>
        <div className="d-flex flex-wrap gap-2">
          {[
            ["debito", "Débito"],
            ["transferencia", "Transferencia"],
            ["efectivo", "Efectivo · 10 % menos"],
            ["credito", "Crédito"],
            ["combinado", "Pago combinado"],
          ].map(([valor, texto]) => (
            <label
              key={valor}
              className={`btn btn-sm ${modo === valor ? "btn-primary" : "btn-outline-primary"}`}
            >
              <input
                className="me-2"
                type="radio"
                name="forma-pago-oferta"
                checked={modo === valor}
                onChange={() => seleccionar(valor)}
              />
              {texto}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="row g-3">
        {combinado && (
          <>
            <label className="col-md-6">
              Parte en efectivo (antes del 10 %)
              <CampoImporte
                decimales={2}
                value={baseEfectivo}
                onChange={(base) =>
                  cambiar({ base, medio: medioSaldo, cantidad: cuotas })
                }
              />
            </label>
            <label className="col-md-6">
              Resto a pagar con
              <select
                className="form-select"
                value={medioSaldo}
                onChange={(e) =>
                  cambiar({
                    base: baseEfectivo,
                    medio: e.target.value,
                    cantidad: 1,
                  })
                }
              >
                <option value="debito">Débito</option>
                <option value="transferencia">Transferencia</option>
                <option value="credito">Crédito</option>
              </select>
            </label>
          </>
        )}
        {medioSaldo === "credito" && (
          <label className="col-md-6">
            Cuotas sin interés
            <select
              className="form-select"
              value={cuotas}
              onChange={(e) =>
                cambiar({
                  base: baseEfectivo,
                  medio: medioSaldo,
                  cantidad: Number(e.target.value),
                })
              }
            >
              {[1, 3, 6].map((n) => (
                <option key={n} value={n}>
                  {n === 1 ? "1 cuota" : `${n} cuotas`}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {error && (
        <p role="alert" className="alert alert-danger mt-3">
          {error}
        </p>
      )}
      {cambiarRedondeo && (
        <div className="my-3">
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            aria-expanded={mostrarRedondeo}
            onClick={() => abrirRedondeo(!mostrarRedondeo)}
          >
            Redondeo
          </button>
          {mostrarRedondeo && (
            <label className="d-block mt-2">
              Importe a descontar del total final
              <CampoImporte
                value={redondeoManual}
                onChange={cambiarRedondeo}
                decimales={2}
              />
              <small>
                Máximo {porcentajeRedondeo} % del total después del descuento
                por pago. No modifica el abono mensual.
              </small>
            </label>
          )}
          {redondeoManual !== "0" && (
            <button
              type="button"
              className="btn btn-link btn-sm"
              onClick={() => cambiarRedondeo("0")}
            >
              Quitar redondeo
            </button>
          )}
        </div>
      )}
      {pago && (
        <>
          <div className="bg-body-tertiary border rounded p-3 my-3">
            <span>Total inicial · instalación o equipos y adicionales</span>
            <strong className="d-block fs-3">{moneda(pago.total)}</strong>
            {Number(pago.efectivo_a_abonar) > 0 && (
              <div>
                Efectivo: <strong>{moneda(pago.efectivo_a_abonar)}</strong>
              </div>
            )}
            {Number(pago.saldo) > 0 && (
              <div>
                {medioSaldo === "credito"
                  ? `${pago.cuotas.length} ${pago.cuotas.length === 1 ? "cuota" : "cuotas"} de`
                  : medioSaldo === "debito"
                    ? "Débito:"
                    : "Transferencia:"}{" "}
                <strong>{moneda(pago.cuotas[0])}</strong>
              </div>
            )}
          </div>
          <details className="small">
            <summary>Ver detalle del cálculo</summary>
            <dl className="mt-2">
              <dt>Importe antes de descuentos</dt>
              <dd>{moneda(pago.base)}</dd>
              {Number(pago.redondeo_manual) > 0 && (
                <>
                  <dt>Redondeo comercial</dt>
                  <dd>{moneda(pago.redondeo_manual)}</dd>
                </>
              )}
              {Number(pago.descuento) > 0 && (
                <>
                  <dt>Descuento por efectivo</dt>
                  <dd>{moneda(pago.descuento)}</dd>
                </>
              )}
              {Number(pago.ajuste_redondeo) > 0 && (
                <>
                  <dt>Redondeo a favor del cliente</dt>
                  <dd>{moneda(pago.ajuste_redondeo)}</dd>
                </>
              )}
            </dl>
          </details>
        </>
      )}
    </div>
  );
}
