import { useId, useRef, useState } from "react";
import { AccionListado } from "../../../shared/ui/AccionListado.jsx";

export function AtencionProspecto({ atencion, perfil, gestion, actualizada }) {
  const [ocupado, ocupar] = useState(false);
  const [error, fallar] = useState("");
  const modal = useRef(null);
  const tituloId = useId();
  if (!atencion) return null;
  const mio = atencion.vendedor_id === perfil.id;
  const puedeLiberar =
    atencion.vendedor_id && (mio || perfil.rol === "administrador");
  const estado = atencion.vendedor_id
    ? `En atención por ${atencion.vendedor_nombre}${mio ? " (vos)" : ""}`
    : "Disponible para contactar";
  async function cambiar(liberar) {
    ocupar(true);
    fallar("");
    try {
      await gestion.tomarProspecto({
        registro: atencion.registro_id,
        version: atencion.version,
        liberar,
      });
      if (liberar) modal.current?.close();
      actualizada();
    } catch (e) {
      fallar(e.message);
    } finally {
      ocupar(false);
    }
  }
  return (
    <div className="atencion-prospecto">
      {puedeLiberar ? (
        <button
          type="button"
          className="btn btn-link p-0 small text-start atencion-enlace"
          aria-haspopup="dialog"
          onClick={() => {
            fallar("");
            modal.current.showModal();
          }}
        >
          {estado}
        </button>
      ) : (
        <p className="mb-0 small">{estado}</p>
      )}
      {!atencion.vendedor_id && perfil.rol === "vendedor" && (
        <AccionListado
          texto="Tomar"
          etiqueta="Tomar prospecto"
          className="btn-primary"
          disabled={ocupado}
          onClick={() => cambiar(false)}
        />
      )}
      {puedeLiberar && (
        <dialog
          ref={modal}
          aria-labelledby={tituloId}
          className="border rounded p-4"
          style={{
            maxWidth: "min(480px, 95vw)",
            maxHeight: "80vh",
            overflowY: "auto",
          }}
          onCancel={(e) => {
            if (ocupado) e.preventDefault();
          }}
        >
          <h2 id={tituloId} className="h5">
            Atención del prospecto
          </h2>
          <p>{estado}</p>
          <p>
            Al liberarlo, quedará disponible para que otro vendedor lo tome.
          </p>
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
          <div className="acciones-registro pie-acciones">
            <AccionListado
              etiqueta="Cancelar"
              className="btn-outline-secondary"
              disabled={ocupado}
              onClick={() => modal.current.close()}
            />
            <AccionListado
              texto={ocupado ? "Liberando…" : "Liberar"}
              etiqueta={ocupado ? "Liberando…" : "Liberar prospecto"}
              className="btn-primary"
              disabled={ocupado}
              onClick={() => cambiar(true)}
            />
          </div>
        </dialog>
      )}
      {error && !puedeLiberar && (
        <p role="alert" className="text-danger mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
