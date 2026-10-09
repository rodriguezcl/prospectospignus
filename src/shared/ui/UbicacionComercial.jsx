import { ubicacionesComerciales } from "../domain/ubicacionComercial.js";
export function CampoUbicacionComercial({ valor = "" }) {
  return (
    <label className="d-block mb-3">
      Ubicación del prospecto
      <select
        name="ubicacion_comercial"
        className="form-select"
        defaultValue={valor}
      >
        <option value="">Sin clasificar</option>
        {Object.entries(ubicacionesComerciales).map(([id, nombre]) => (
          <option key={id} value={id}>
            {nombre}
          </option>
        ))}
      </select>
    </label>
  );
}
export function FiltroUbicacionComercial({ valor, cambiar }) {
  return (
    <div
      className="d-flex flex-wrap gap-2 mb-3"
      role="group"
      aria-label="Filtrar por ubicación del prospecto"
    >
      {[
        ["", "Todos"],
        ...Object.entries(ubicacionesComerciales),
        ["sin_clasificar", "Sin clasificar"],
      ].map(([id, nombre]) => (
        <button
          type="button"
          key={id}
          aria-pressed={valor === id}
          className={
            valor === id ? "btn btn-primary" : "btn btn-outline-primary"
          }
          onClick={() => cambiar(id)}
        >
          {nombre}
        </button>
      ))}
    </div>
  );
}
