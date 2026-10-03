import { mostrarFecha } from "../domain/circuito.js";
import { monedaArgentina } from "../../../shared/ui/importe.js";

export function ContextoRecuperacion({ oportunidad }) {
  if (oportunidad.estado !== "recuperacion") return null;
  const evento = [...(oportunidad.eventos || [])]
    .filter(
      (e) =>
        e.tipo === "derivar" &&
        (e.nuevo?.ciclo || 1) === (oportunidad.ciclo || 1),
    )
    .sort((a, b) =>
      String(b.ocurrido_en).localeCompare(String(a.ocurrido_en)),
    )[0];
  const datos = evento?.solicitud?.datos;
  const propuesta = oportunidad.propuestas?.find(
    (p) => p.id === datos?.propuesta_id,
  );
  return (
    <section
      className="alert alert-info"
      aria-label="Información para recuperar la venta"
    >
      <h3 className="h5">Antes de llamar al prospecto</h3>
      <p>
        <strong>Próximo contacto:</strong>{" "}
        {mostrarFecha(oportunidad.proxima_accion_en)}
        {oportunidad.proxima_accion_en &&
        new Date(oportunidad.proxima_accion_en) < new Date()
          ? " · Pendiente vencido"
          : ""}
      </p>
      {!oportunidad.responsable_id && (
        <p className="fw-bold">
          Pendiente de asignación: todavía no hay un agente responsable.
        </p>
      )}
      {datos ? (
        <dl>
          <dt>Qué impidió cerrar</dt>
          <dd className="texto-con-saltos">
            {datos.objecion || "Sin registrar"}
          </dd>
          <dt>Contexto y necesidades</dt>
          <dd className="texto-con-saltos">{datos.resumen}</dd>
          <dt>Preferencia de contacto</dt>
          <dd className="texto-con-saltos">
            {datos.contacto_preferido || "No registrada en la derivación"}
          </dd>
          <dt>Información para cerrar</dt>
          <dd className="texto-con-saltos">
            {datos.decision_pendiente || "Sin información adicional"}
          </dd>
          <dt>Condiciones conversadas</dt>
          <dd className="texto-con-saltos">{datos.condiciones}</dd>
          <dt>Propuesta ofrecida al derivar</dt>
          <dd>
            {propuesta
              ? `${propuesta.detalle.codigo} · Inicial ${monedaArgentina(propuesta.detalle.total)} · Abono ${monedaArgentina(propuesta.detalle.abono, "no corresponde")}`
              : "Consultá la propuesta vinculada en el historial de la negociación."}
          </dd>
        </dl>
      ) : (
        <p className="texto-con-saltos">
          {oportunidad.resumen} · {oportunidad.condiciones}
        </p>
      )}
      <p className="mb-0 small">
        Revisá la oferta original antes de preparar una mejora. Los precios
        Telefónicos se habilitan únicamente al rol autorizado para este caso.
      </p>
    </section>
  );
}
