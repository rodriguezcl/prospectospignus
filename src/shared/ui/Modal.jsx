import { useEffect, useId, useRef } from "react";

let abiertos = 0;
let overflowAnterior = "";

/** Montar solo mientras la acción está abierta. El diálogo nativo contiene el foco. */
export function Modal({ titulo, cerrar, ocupado = false, error, children }) {
  const dialogo = useRef(null);
  const encabezado = useRef(null);
  const mensajeError = useRef(null);
  const id = useId();
  useEffect(() => {
    const elemento = dialogo.current;
    const origen = document.activeElement;
    if (abiertos++ === 0) {
      overflowAnterior = document.body.style.overflow;
      document.body.style.overflow = "hidden";
    }
    elemento.showModal();
    encabezado.current?.focus({ preventScroll: true });
    return () => {
      elemento.close();
      if (--abiertos === 0) document.body.style.overflow = overflowAnterior;
      if (origen?.isConnected) origen.focus({ preventScroll: true });
    };
  }, []);
  useEffect(() => {
    if (error) {
      dialogo.current.scrollTop = 0;
      mensajeError.current?.focus({ preventScroll: true });
    }
  }, [error]);
  function solicitarCierre() {
    if (!ocupado && !dialogo.current.querySelector('[aria-busy="true"]'))
      cerrar();
  }
  return (
    <dialog
      ref={dialogo}
      className="modal-pignus"
      aria-labelledby={id}
      aria-busy={ocupado}
      onClickCapture={(e) => {
        // Los enlaces no se deshabilitan con fieldset: impedir navegar mientras guarda.
        if (ocupado && e.target.closest("a")) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        e.stopPropagation();
        solicitarCierre();
      }}
    >
      <header className="modal-pignus-cabecera">
        <h2 id={id} ref={encabezado} tabIndex={-1} className="h4 mb-0">
          {titulo}
        </h2>
        <button
          type="button"
          className="btn btn-outline-secondary"
          disabled={ocupado}
          onClick={solicitarCierre}
          aria-label={`Cerrar: ${titulo}`}
        >
          Cerrar
        </button>
      </header>
      <div className="modal-pignus-contenido">
        {error && (
          <p
            ref={mensajeError}
            tabIndex={-1}
            role="alert"
            className="alert alert-danger"
          >
            {error}
          </p>
        )}
        {children}
      </div>
    </dialog>
  );
}
