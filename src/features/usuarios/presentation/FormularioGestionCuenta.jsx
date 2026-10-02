import { useEffect, useRef } from "react";

const titulos = {
  editar: "Editar cuenta",
  desactivar: "Desactivar cuenta",
  reactivar: "Reactivar cuenta",
  eliminar: "Eliminar cuenta definitivamente",
};

export function FormularioGestionCuenta({
  cuenta,
  accion,
  ocupado,
  error,
  confirmar,
  cancelar,
}) {
  const titulo = useRef(null);
  useEffect(() => {
    titulo.current?.focus();
  }, []);
  return (
    <section
      className="border rounded p-3 mb-4"
      aria-labelledby="titulo-gestion-cuenta"
    >
      <h3 ref={titulo} tabIndex={-1} id="titulo-gestion-cuenta" className="h5">
        {titulos[accion]}
      </h3>
      <p>
        {cuenta.nombre} · {cuenta.correo}
      </p>
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      {accion === "eliminar" ? (
        <p className="alert alert-danger">
          Esta eliminación es irreversible. Solo se permite sin registros ni
          historial comercial asociado. La auditoría de la cuenta se conserva.
          Para retirar el acceso conservando la cuenta, usá Desactivar.
        </p>
      ) : accion === "desactivar" ? (
        <p>
          Se bloqueará el acceso a la plataforma. Sus registros e historial se
          conservarán; la cartera no se reasigna automáticamente.
        </p>
      ) : accion === "reactivar" ? (
        <p>
          La cuenta recuperará acceso con su rol actual y su contraseña
          existente.
        </p>
      ) : (
        <p>El correo y la contraseña no se modifican desde este formulario.</p>
      )}
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          confirmar({
            ...Object.fromEntries(new FormData(evento.currentTarget)),
            id: cuenta.id,
            version: cuenta.version,
            accion,
          });
        }}
        aria-busy={ocupado}
      >
        <fieldset disabled={ocupado}>
          {accion === "editar" && (
            <div className="row g-3 mb-3">
              <div className="col-md-6">
                <label className="form-label" htmlFor="editar-nombre">
                  Nombre completo
                </label>
                <input
                  id="editar-nombre"
                  name="nombre"
                  onBlur={(e) => {
                    e.target.value = e.target.value.trim().toUpperCase();
                  }}
                  className="form-control"
                  defaultValue={cuenta.nombre}
                  required
                  minLength={2}
                  maxLength={100}
                />
              </div>
              <div className="col-md-6">
                <label className="form-label" htmlFor="editar-rol">
                  Rol
                </label>
                <select
                  id="editar-rol"
                  name="rol"
                  className="form-select"
                  defaultValue={cuenta.rol}
                >
                  <option value="vendedor">Vendedor</option>
                  <option value="agente">Agente</option>
                  <option value="administrador">Administrador</option>
                </select>
                <small>
                  Administrador otorga acceso a todas las carteras y a la
                  gestión de cuentas.
                </small>
              </div>
            </div>
          )}
          <label className="form-label" htmlFor="motivo-cuenta">
            Motivo del cambio
          </label>
          <textarea
            id="motivo-cuenta"
            name="motivo"
            className="form-control mb-3"
            required
            minLength={5}
            maxLength={500}
          />
          {accion === "eliminar" && (
            <>
              <label className="form-label" htmlFor="confirmar-correo">
                Escribí {cuenta.correo} para confirmar
              </label>
              <input
                id="confirmar-correo"
                name="confirmacion"
                type="email"
                className="form-control mb-3"
                required
                autoComplete="off"
                onInput={(e) =>
                  e.currentTarget.setCustomValidity(
                    e.currentTarget.value.trim() === cuenta.correo
                      ? ""
                      : "El correo debe coincidir con la cuenta seleccionada.",
                  )
                }
              />
            </>
          )}
          <div className="d-flex gap-2 flex-wrap">
            <button
              type="submit"
              className={`btn ${accion === "eliminar" ? "btn-danger" : "btn-primary"}`}
            >
              {ocupado
                ? "Procesando…"
                : accion === "eliminar"
                  ? "Eliminar definitivamente"
                  : "Confirmar cambio"}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={cancelar}
            >
              Cancelar
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
