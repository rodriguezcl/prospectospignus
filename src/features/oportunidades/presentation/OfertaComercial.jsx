import { monedaArgentina } from "../../../shared/ui/importe.js";
import { compararOfertas } from "./compararOfertas.js";
import { centavos, importeExacto, decimalCentavos } from "../domain/dinero.js";

const moneda = (valor) => monedaArgentina(valor, "Precio pendiente de carga");
function Cuotas({ importes }) {
  const total = decimalCentavos(
    importes.reduce((s, i) => s + centavos(importeExacto(i)), 0n),
  );
  return (
    <>
      {importes.length} cuotas de {moneda(importes[0])} · Total: {moneda(total)}
    </>
  );
}

export function OfertaComercial({
  alternativa,
  anterior,
  catalogo,
  kit,
  revision,
  conAbono,
  nivelAbono,
  meses,
  agregar,
  referencia,
  ofrecida = false,
  ofrecidaNoComparable = false,
}) {
  const comparacion = compararOfertas(alternativa, anterior, catalogo.items);
  const venta = kit?.modalidad === "kit";
  const nombre = (id) =>
    catalogo.items.find((i) => i.id === id)?.nombre || "Componente";
  const extras = alternativa.seleccion.extras;
  const abono = kit?.abonos?.[nivelAbono];
  const expensas =
    !venta && ["docta", "nobu"].includes(alternativa.seleccion.subcategoria);
  return (
    <article
      className="border rounded p-3 mb-3"
      aria-label={`Oferta ${alternativa.ordinal}`}
    >
      <h4
        className="h5 fw-bold mb-3"
        ref={referencia}
        tabIndex={-1}
        style={{ scrollMarginTop: "1rem" }}
      >
        Oferta {alternativa.ordinal} · {kit?.nombre}
        {ofrecida && (
          <span className="badge bg-success ms-2">Última ofrecida</span>
        )}
      </h4>
      {comparacion ? (
        <aside
          className="alert alert-info"
          aria-label={
            anterior.codigoOfrecida
              ? "Cambios respecto de la oferta efectivamente ofrecida"
              : "Cambios respecto de la oferta anterior"
          }
        >
          <h5 className="h6 fw-bold">
            {anterior.codigoOfrecida
              ? `Qué cambia respecto de la última oferta efectivamente ofrecida · ${anterior.codigoOfrecida}`
              : `Qué cambia respecto de la oferta ${anterior.ordinal}`}
          </h5>
          <ul className="mb-2">
            {comparacion.cambios.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
          <p className="mb-0 fw-bold">
            {comparacion.sentido === "igual"
              ? comparacion.cambios.length
                ? "Mismo importe inicial; cambia la distribución de precios o bonificaciones."
                : "Mismo importe inicial y condiciones de los adicionales."
              : `${comparacion.sentido === "ahorro" ? "Ahorro" : "Aumento"} en el pago inicial: ${moneda(comparacion.importe)}.`}
          </p>
          <p className="small mb-0">
            Comparación antes de descuentos por forma de pago. Se mantiene la
            cantidad de equipos. El abono mensual se detalla por separado.
          </p>
        </aside>
      ) : (
        <p className="small">
          {ofrecidaNoComparable
            ? "La última propuesta ofrecida tiene otra composición o no permite una comparación directa. Revisala arriba; no se utiliza una oferta no presentada como referencia."
            : "Oferta inicial de referencia para comparar las siguientes alternativas."}
        </p>
      )}
      <div className="row g-3">
        <section className="col-12 col-lg-6">
          <h5 className="h6 fw-bold">
            Te ofrecemos {kit?.nombre}, que incluye:
          </h5>
          <ul>
            {(kit?.incluidos || []).map((i) => (
              <li key={i.item_id}>
                {i.cantidad} × {nombre(i.item_id)}
              </li>
            ))}
          </ul>
          <h5 className="h6 fw-bold">Agregamos los siguientes adicionales:</h5>
          {extras.length ? (
            <ul>
              {extras.map((e) => (
                <li key={e.item_id}>
                  {e.cantidad} × {nombre(e.item_id)}
                  {Number(e.bonificados) > 0 && (
                    <strong> · {e.bonificados} sin cargo adicional</strong>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p>Sin adicionales seleccionados.</p>
          )}
          <h5 className="h6 fw-bold">Condición de los equipos</h5>
          <p>
            {venta
              ? "Los equipos son propiedad del cliente."
              : "Los equipos del plan y los adicionales bonificados se entregan en comodato. Los adicionales pagados son propiedad del cliente."}
          </p>
        </section>
        <section className="col-12 col-lg-6">
          <h5 className="h6 fw-bold">
            {venta
              ? "Costo del kit y adicionales"
              : "Costo de instalación y adicionales"}
          </h5>
          <p className="fs-4 fw-bold mb-1">{moneda(alternativa.total)}</p>
          <p className="small">
            Pago inicial, separado del abono mensual. Los adicionales
            seleccionados ya están contemplados en este importe.
          </p>
          {expensas && (
            <p>
              El plan está incluido en expensas; el importe inicial corresponde
              a los adicionales seleccionados.
            </p>
          )}
          <h5 className="h6 fw-bold">Abono mensual</h5>
          <p className="fw-bold">
            {conAbono
              ? abono == null
                ? "Precio pendiente de carga"
                : `${moneda(abono)} por mes`
              : expensas
                ? "Incluido en expensas"
                : "No corresponde a esta oferta"}
          </p>
          {conAbono && (
            <p className="small">
              Se paga por separado. No se incluye en las cuotas ni recibe el
              descuento por efectivo.
              {abono != null && meses > 0
                ? ` Precio congelado por ${meses} meses desde la activación; no son meses gratis.`
                : ""}
            </p>
          )}
        </section>
      </div>
      <section className="border-top pt-3 mb-3">
        <h5 className="h6 fw-bold">
          Formas de pago del{" "}
          {venta ? "kit y adicionales" : "costo de instalación y adicionales"}
        </h5>
        <dl className="row mb-2">
          <dt className="col-sm-6">
            Débito, transferencia o crédito en 1 cuota
          </dt>
          <dd className="col-sm-6">{moneda(alternativa.total)}</dd>
          <dt className="col-sm-6">Efectivo · 10 % de descuento</dt>
          <dd className="col-sm-6">{moneda(alternativa.efectivo)}</dd>
          <dt className="col-sm-6">Crédito en 3 cuotas sin interés</dt>
          <dd className="col-sm-6">
            <Cuotas importes={alternativa.cuotas3} />
          </dd>
          <dt className="col-sm-6">Crédito en 6 cuotas sin interés</dt>
          <dd className="col-sm-6">
            <Cuotas importes={alternativa.cuotas6} />
          </dd>
        </dl>
        <p className="small">
          Cuotas iguales, con redondeo de centavos a favor del cliente. Estos
          importes corresponden al pago completo de esta oferta. También podés
          combinar medios de pago al armar la propuesta.
        </p>
      </section>
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => agregar(alternativa)}
      >
        {ofrecida
          ? "Volver a usar esta oferta"
          : "Elegir y registrar como ofrecida"}
      </button>
      <details className="mt-3 small">
        <summary>Detalle de negociación y referencia interna</summary>
        <p className="mt-2">
          SIM-{revision}-{alternativa.ordinal} · Nivel de la oferta:{" "}
          {alternativa.seleccion.nivel}
        </p>
        {extras.map((e) => (
          <p key={e.item_id}>
            {nombre(e.item_id)} · {e.cantidad} unidades · {e.bonificados || 0}{" "}
            bonificadas · Alto: {e.altos || 0} / Bajo: {e.bajos || 0} /
            Telefónico: {e.telefonicos || 0}
          </p>
        ))}
      </details>
    </article>
  );
}
