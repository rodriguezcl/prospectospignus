export function VisitaInicial({ programar, cambiar }) {
  return (
    <div className="mt-3">
      <div className="form-check">
        <input
          id="registro-agendar-visita"
          className="form-check-input"
          type="checkbox"
          checked={programar}
          onChange={(e) => cambiar(e.target.checked)}
          aria-controls="registro-datos-visita"
          aria-expanded={programar}
        />
        <label className="form-check-label" htmlFor="registro-agendar-visita">
          Agendar visita comercial
        </label>
      </div>
      {programar && (
        <div id="registro-datos-visita" className="mt-3">
          <p className="small text-muted">
            La visita se guardará en tu Agenda y el prospecto quedará reservado
            para vos. Horarios de Córdoba.
          </p>
          <div className="row g-3">
            <div className="col-md-6">
              <label className="form-label" htmlFor="registro-visita-inicio">
                Fecha y hora de la visita *
              </label>
              <input
                id="registro-visita-inicio"
                name="visita_inicio"
                className="form-control"
                type="datetime-local"
                required
              />
            </div>
            <div className="col-md-6">
              <label className="form-label" htmlFor="registro-visita-fin">
                Finalización prevista (opcional)
              </label>
              <input
                id="registro-visita-fin"
                name="visita_fin"
                className="form-control"
                type="datetime-local"
              />
            </div>
            <div className="col-12">
              <label className="form-label" htmlFor="registro-visita-nota">
                Indicaciones para la visita (opcional)
              </label>
              <textarea
                id="registro-visita-nota"
                name="visita_nota"
                className="form-control"
                rows={2}
                maxLength={2000}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
