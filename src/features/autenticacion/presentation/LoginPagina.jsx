import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { MarcaPignus } from "../../../shared/ui/contenido/MarcaPignus.jsx";
import { useSesion } from "./ProveedorSesion.jsx";
import "./autenticacion.css";

export function LoginPagina() {
  const { estado, error: errorSesion, acceso } = useSesion();
  const [error, cambiarError] = useState("");
  const [enviando, cambiarEnviando] = useState(false);
  const [mostrarClave, cambiarMostrarClave] = useState(false);
  useEffect(() => {
    document.title = "Ingresar · Prospectos Pignus";
  }, []);
  if (estado === "autenticado") return <Navigate to="/inicio" replace />;

  async function ingresar(evento) {
    evento.preventDefault();
    const formulario = new FormData(evento.currentTarget);
    cambiarError("");
    cambiarEnviando(true);
    try {
      await acceso.ingresar(
        String(formulario.get("correo")),
        String(formulario.get("clave")),
      );
    } catch (fallo) {
      cambiarError(fallo.message);
    } finally {
      cambiarEnviando(false);
    }
  }

  async function salir() {
    cambiarError("");
    cambiarEnviando(true);
    try {
      await acceso.salir();
    } catch (fallo) {
      cambiarError(fallo.message);
    } finally {
      cambiarEnviando(false);
    }
  }

  const configurado = estado !== "sin-configuracion";
  const ocupado = enviando || estado === "cargando";
  return (
    <main className="acceso-plataforma">
      <section className="acceso-presentacion" aria-label="Prospectos Pignus">
        <span className="acceso-marca">
          <MarcaPignus />
        </span>
        <div>
          <p className="acceso-etiqueta">TU ESPACIO COMERCIAL</p>
          <h2>
            Cada relación comienza
            <br />
            con un próximo paso.
          </h2>
          <p>
            Tu cartera, tus gestiones y tus oportunidades.
            <br />
            Todo en un mismo lugar.
          </p>
        </div>
        <small>Acceso exclusivo para el equipo autorizado.</small>
      </section>
      <section className="acceso-formulario">
        <div>
          <p className="sobretitulo">PROSPECTOS PIGNUS</p>
          <h1>Bienvenido</h1>
          <p className="text-muted">
            Ingresá con la cuenta que te asignó tu administrador.
          </p>
          {!configurado && (
            <div className="alert alert-warning" role="status">
              El acceso todavía no está habilitado. Falta conectar el servicio
              de autenticación.
            </div>
          )}
          {(error || errorSesion) && (
            <div className="alert alert-danger" role="alert">
              {error || errorSesion}
            </div>
          )}
          {estado === "bloqueado" ? (
            <button
              className="btn btn-primary w-100"
              onClick={salir}
              disabled={enviando}
            >
              Volver a ingresar
            </button>
          ) : (
            <form onSubmit={ingresar} aria-busy={ocupado}>
              <div className="mb-3">
                <label className="form-label" htmlFor="correo-login">
                  Correo electrónico
                </label>
                <input
                  id="correo-login"
                  name="correo"
                  className="form-control form-control-lg"
                  type="email"
                  autoComplete="username"
                  required
                  maxLength={254}
                  disabled={!configurado || ocupado}
                />
              </div>
              <div className="mb-4">
                <label className="form-label" htmlFor="clave-login">
                  Contraseña
                </label>
                <div className="input-group">
                  <input
                    id="clave-login"
                    name="clave"
                    className="form-control form-control-lg"
                    type={mostrarClave ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    maxLength={128}
                    disabled={!configurado || ocupado}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    onClick={() => cambiarMostrarClave((valor) => !valor)}
                    aria-label={
                      mostrarClave ? "Ocultar contraseña" : "Mostrar contraseña"
                    }
                    aria-pressed={mostrarClave}
                  >
                    <i
                      aria-hidden="true"
                      className={
                        "bi " + (mostrarClave ? "bi-eye-slash" : "bi-eye")
                      }
                    />
                  </button>
                </div>
              </div>
              <button
                className="btn btn-primary btn-lg w-100"
                disabled={!configurado || ocupado}
                type="submit"
              >
                {ocupado ? "Verificando acceso…" : "Ingresar a la plataforma"}
              </button>
            </form>
          )}
          <p className="acceso-ayuda">
            ¿Necesitás una cuenta o recuperar el acceso? Contactá al
            administrador.
          </p>
        </div>
        <small className="text-muted">
          Prospectos Pignus · Gestión comercial
        </small>
      </section>
    </main>
  );
}
