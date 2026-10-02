import { useRef, useState } from "react";

const moneda = (n) =>
  n == null
    ? "No informado"
    : new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
      }).format(n);
const fecha = (n) => (n ? n.split("-").reverse().join("/") : "Pendiente");
export function DetalleVenta({ id, gestion, perfil }) {
  const [detalle, guardarDetalle] = useState(null),
    [error, fallar] = useState(""),
    [ocupado, ocupar] = useState(false);
  const intento = useRef(null);
  async function cargar() {
    ocupar(true);
    fallar("");
    try {
      guardarDetalle(await gestion.detalle(id));
    } catch (e) {
      fallar(e.message);
    } finally {
      ocupar(false);
    }
  }
  async function guardar(e) {
    e.preventDefault();
    const campos = Object.fromEntries(new FormData(e.currentTarget));
    const entrada = {
      id,
      version: detalle.activacion?.version || 0,
      fecha: campos.fecha,
      respaldo: campos.respaldo,
    };
    const clave = JSON.stringify(entrada);
    if (intento.current?.clave !== clave)
      intento.current = { clave, operacion: crypto.randomUUID() };
    ocupar(true);
    fallar("");
    try {
      await gestion.activar({
        ...entrada,
        operacion: intento.current.operacion,
      });
      guardarDetalle(await gestion.detalle(id));
      intento.current = null;
    } catch (e) {
      fallar(e.message);
    } finally {
      ocupar(false);
    }
  }
  return (
    <div className="mt-2">
      <button
        className="btn btn-sm btn-outline-primary"
        disabled={ocupado}
        onClick={cargar}
      >
        {detalle ? "Actualizar detalle" : "Importes e instalación"}
      </button>
      {error && <p role="alert">{error}</p>}
      {detalle && (
        <div className="border rounded p-3 mt-2">
          {detalle.propuesta ? (
            <>
              <p>
                <strong>{detalle.propuesta.codigo}</strong>
              </p>
              <p>
                Inicial acordado: {moneda(detalle.propuesta.base)} · Descuento
                efectivo: {moneda(detalle.propuesta.descuento_pago)} ·{" "}
                <strong>
                  Total inicial: {moneda(detalle.propuesta.total)}
                </strong>
              </p>
              <p>
                Abono original: {moneda(detalle.propuesta.abono)} (no se suma al
                inicial).
              </p>
              <p>
                Efectivo: {moneda(detalle.propuesta.pago.efectivo_a_abonar)} ·
                Saldo {detalle.propuesta.pago.medio_saldo}:{" "}
                {moneda(detalle.propuesta.pago.saldo)} ·{" "}
                {detalle.propuesta.pago.cantidad_cuotas} cuota(s), última{" "}
                {moneda(detalle.propuesta.pago.ultima_cuota)}. No acredita
                cobro.
              </p>
              {detalle.propuesta.conceptos.map((c, i) => (
                <p key={i}>
                  {c.familia} · {c.kit?.nombre || "Cerco"} · {c.seleccion.nivel}{" "}
                  ·{" "}
                  {c.incluido_expensas
                    ? "Instalación y abono incluidos en expensas"
                    : ""}
                  {c.extras
                    .map(
                      (e) =>
                        `${e.cantidad} × ${e.nombre} (${e.distribucion.bonificados || 0} bonificados)`,
                    )
                    .join(", ")}
                </p>
              ))}
            </>
          ) : (
            <p>
              Esta venta no tiene una propuesta estructurada aceptada. Importes
              y congelamiento no informados; no equivalen a cero.
            </p>
          )}
          <h3 className="h6">Instalación efectiva</h3>
          <p>
            {fecha(detalle.activacion?.fecha)}. Esta fecha es también activación
            e inicio de facturación; no calcula la primera factura.
          </p>
          {detalle.activacion && <p>Respaldo: {detalle.activacion.respaldo}</p>}
          {detalle.congelamientos.map((c, i) => (
            <p key={i}>
              {c.concepto}:{" "}
              {Number(c.meses) > 0
                ? `${c.meses} meses de congelamiento · hasta ${fecha(c.hasta_inclusive)} inclusive`
                : "Sin congelamiento"}
              .
            </p>
          ))}
          <p className="small">
            No se generan aumentos automáticos, facturas ni días gratis.
          </p>
          {perfil.rol === "administrador" && (
            <details>
              <summary>
                {detalle.activacion
                  ? "Corregir instalación"
                  : "Registrar instalación"}
              </summary>
              <form key={detalle.activacion?.version || 0} onSubmit={guardar}>
                <fieldset disabled={ocupado}>
                  <label className="d-block my-2">
                    Fecha confirmada en Agenda Pignus (sistema técnico)
                    <input
                      className="form-control"
                      name="fecha"
                      type="date"
                      required
                      defaultValue={detalle.activacion?.fecha || ""}
                    />
                  </label>
                  <label className="d-block my-2">
                    Referencia de respaldo y motivo de la carga/corrección
                    <textarea
                      className="form-control"
                      name="respaldo"
                      minLength={5}
                      maxLength={2000}
                      required
                    />
                  </label>
                  <button className="btn btn-primary" type="submit">
                    Confirmar instalación
                  </button>
                </fieldset>
              </form>
            </details>
          )}
          {!!detalle.historial.length && (
            <details className="mt-2">
              <summary>Historial de instalación</summary>
              {detalle.historial.map((e) => (
                <p key={e.id}>
                  Versión {e.nuevo.version}: {fecha(e.nuevo.fecha)} ·{" "}
                  {e.nuevo.respaldo}
                </p>
              ))}
            </details>
          )}
        </div>
      )}
    </div>
  );
}
