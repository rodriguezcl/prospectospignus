export function AnularCotizacion({ guardar, ocupado }) {
  return (
    <details className="detalle-secundario my-3">
      <summary>Anular por error de carga</summary>
      <p>
        El prospecto y el historial se conservan. La negociación dejará de
        contar en las estadísticas y se cancelarán sus visitas pendientes. No es
        una venta perdida.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          guardar("anular", Object.fromEntries(new FormData(e.currentTarget)));
        }}
      >
        <fieldset disabled={ocupado}>
          <label className="d-block mb-3">
            ¿Qué se cargó por error?
            <textarea
              name="resumen"
              required
              minLength={5}
              maxLength={2000}
              className="form-control"
            />
          </label>
          <label className="d-block mb-3">
            <input
              type="checkbox"
              name="confirmar_anulacion"
              value="si"
              required
            />{" "}
            Confirmo la anulación de esta negociación. No se puede reabrir.
          </label>
          <button className="btn btn-outline-danger">
            Confirmar anulación
          </button>
        </fieldset>
      </form>
    </details>
  );
}
