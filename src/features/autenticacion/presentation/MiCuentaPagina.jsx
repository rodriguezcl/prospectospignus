import { useState } from "react";
import { useSesion } from "./ProveedorSesion.jsx";
import { EncabezadoPagina } from "../../../shared/ui/contenido/EncabezadoPagina.jsx";

export function MiCuentaPagina() {
  const { perfil, acceso } = useSesion();
  const [mensaje, cambiarMensaje] = useState("");
  const [error, cambiarError] = useState("");
  const [ocupado, cambiarOcupado] = useState(false);
  async function guardar(evento) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    const datos = new FormData(formulario);
    cambiarError("");
    cambiarMensaje("");
    if (datos.get("clave") !== datos.get("confirmacion")) {
      cambiarError("Las contraseñas no coinciden.");
      return;
    }
    cambiarOcupado(true);
    try {
      await acceso.cambiarClave(String(datos.get("clave")));
      formulario.reset();
      cambiarMensaje("Contraseña actualizada.");
    } catch (fallo) {
      cambiarError(fallo.message);
    } finally {
      cambiarOcupado(false);
    }
  }
  return (
    <>
      <EncabezadoPagina
        titulo="Mi cuenta"
        descripcion={`${perfil.nombre} · ${perfil.correo}`}
      />
      <section className="card">
        <div className="card-body">
          <h2 className="h5">Cambiar contraseña</h2>
          {error && (
            <p role="alert" className="alert alert-danger">
              {error}
            </p>
          )}
          {mensaje && (
            <p role="status" className="alert alert-success">
              {mensaje}
            </p>
          )}
          <form onSubmit={guardar}>
            <fieldset disabled={ocupado}>
              <label htmlFor="clave-nueva" className="form-label">
                Nueva contraseña
              </label>
              <input
                id="clave-nueva"
                name="clave"
                className="form-control mb-3"
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
              />
              <label htmlFor="confirmacion-clave" className="form-label">
                Repetir contraseña
              </label>
              <input
                id="confirmacion-clave"
                name="confirmacion"
                className="form-control mb-3"
                type="password"
                required
                minLength={10}
                maxLength={128}
                autoComplete="new-password"
              />
              <button className="btn btn-primary" type="submit">
                {ocupado ? "Guardando…" : "Guardar contraseña"}
              </button>
            </fieldset>
          </form>
        </div>
      </section>
    </>
  );
}
