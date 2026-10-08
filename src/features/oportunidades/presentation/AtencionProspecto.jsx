import { useState } from "react";

export function AtencionProspecto({ atencion, perfil, gestion, actualizada }) {
  const [ocupado, ocupar] = useState(false);
  const [error, fallar] = useState("");
  if (!atencion) return null;
  const mio = atencion.vendedor_id === perfil.id;
  async function cambiar(liberar) {
    ocupar(true);
    fallar("");
    try {
      await gestion.tomarProspecto({
        registro: atencion.registro_id,
        version: atencion.version,
        liberar,
      });
      actualizada();
    } catch (e) {
      fallar(e.message);
    } finally {
      ocupar(false);
    }
  }
  return (
    <div className="my-2">
      <p className="mb-2">
        {atencion.vendedor_id
          ? `En atención por ${atencion.vendedor_nombre}${mio ? " (vos)" : ""}`
          : "Disponible para contactar"}
      </p>
      {!atencion.vendedor_id && perfil.rol === "vendedor" && (
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={ocupado}
          onClick={() => cambiar(false)}
        >
          Tomar prospecto
        </button>
      )}
      {atencion.vendedor_id && (mio || perfil.rol === "administrador") && (
        <button
          type="button"
          className="btn btn-outline-secondary btn-sm"
          disabled={ocupado}
          onClick={() => cambiar(true)}
        >
          Liberar prospecto
        </button>
      )}
      {error && (
        <p role="alert" className="text-danger mt-2">
          {error}
        </p>
      )}
    </div>
  );
}

export function puedeAtender(atencion, perfil) {
  return Boolean(
    !atencion ||
    (atencion.vendedor_id &&
      (atencion.vendedor_id === perfil.id || perfil.rol === "administrador")),
  );
}
