import { monedaArgentina } from "../../../shared/ui/importe.js";

const moneda = (valor) => monedaArgentina(valor, "Precio pendiente");
const enumerar = (elementos) =>
  new Intl.ListFormat("es-AR", { style: "long", type: "conjunction" }).format(
    elementos,
  );

export function OfertaComercial({
  alternativa,
  catalogo,
  kit,
  revision,
  conAbono,
  nivelAbono,
  meses,
  agregar,
}) {
  const venta = kit?.modalidad === "kit";
  const nombre = (id) =>
    catalogo.items.find((i) => i.id === id)?.nombre || "Componente";
  const incluidos = (kit?.incluidos || []).map(
    (i) => `${i.cantidad} × ${nombre(i.item_id)}`,
  );
  const extras = alternativa.seleccion.extras;
  const bonificados = extras
    .filter((e) => Number(e.bonificados) > 0)
    .map((e) => `${e.bonificados} × ${nombre(e.item_id)}`);
  const abono = kit?.abonos?.[nivelAbono];
  return (
    <article
      className="border rounded p-3 mb-3"
      aria-label={`Oferta ${alternativa.ordinal}`}
    >
      <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
        <div>
          <h4 className="h5 mb-1">
            Oferta {alternativa.ordinal} · {kit?.nombre}
          </h4>
          <span className="text-muted">
            {venta ? "Compra de equipos" : "Plan con equipos en comodato"}
          </span>
        </div>
        <div>
          <strong className="fs-4">{moneda(alternativa.total)}</strong>
          <div className="small">
            Importe inicial · antes del descuento por pago
          </div>
        </div>
      </div>
      <p className="mb-2">
        Te ofrecemos {kit?.nombre}
        {incluidos.length ? `, que incluye ${enumerar(incluidos)}` : ""}.
        {extras.length > 0 &&
          ` Además, agregamos ${enumerar(extras.map((e) => `${e.cantidad} × ${nombre(e.item_id)}`))}.`}
      </p>
      {bonificados.length > 0 ? (
        <p className="mb-2">
          <strong>Sin cargo adicional:</strong> {enumerar(bonificados)}.{" "}
          {venta ? "Son de tu propiedad." : "Se entregan en comodato."}
        </p>
      ) : (
        extras.length > 0 && (
          <p className="small mb-2">
            Los adicionales están contemplados en el importe inicial; esta
            opción no bonifica unidades.
          </p>
        )
      )}
      {!venta && (
        <p className="small mb-2">
          Los equipos del plan y los adicionales bonificados se entregan en
          comodato. Los adicionales pagados son propiedad del cliente.
        </p>
      )}
      <p className="mb-2">
        En efectivo, pagando todo el importe inicial:{" "}
        <strong>{moneda(alternativa.efectivo)}</strong> (10 % de descuento).
      </p>
      <p className="mb-2">
        Con tarjeta, 6 cuotas sin interés:{" "}
        <strong>{moneda(alternativa.cuotas6[0])}</strong>
        {alternativa.cuotas6.at(-1) !== alternativa.cuotas6[0] &&
          `; última cuota de ${moneda(alternativa.cuotas6.at(-1))}`}
        . También podés combinar medios de pago al armar la propuesta.
      </p>
      {conAbono && (
        <p className="mb-3">
          <strong>Abono mensual aparte: {moneda(abono)}.</strong>
          {abono != null &&
            meses > 0 &&
            ` Congelado por ${meses} meses desde la activación; no son meses gratis.`}
        </p>
      )}
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => agregar(alternativa)}
      >
        Elegir esta oferta
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
