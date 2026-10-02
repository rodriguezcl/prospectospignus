import { useCallback, useEffect, useRef, useState } from "react";
import { EncabezadoPagina } from "../../../shared/ui/contenido/EncabezadoPagina.jsx";
import { FormularioGestionCuenta } from "./FormularioGestionCuenta.jsx";

export function UsuariosPagina({ gestion }) {
  const [cuentas, cambiarCuentas] = useState([]);
  const [cargando, cambiarCargando] = useState(true);
  const [guardando, cambiarGuardando] = useState(false);
  const [error, cambiarError] = useState("");
  const [aviso, cambiarAviso] = useState("");
  const [seleccion, cambiarSeleccion] = useState(null);
  const botonActualizar = useRef(null);
  const operacionEnCurso = useRef(false);
  const formulario = useRef(null);
  const vigente = useRef(false);

  const cargar = useCallback(async () => {
    cambiarCargando(true);
    cambiarError("");
    try {
      const lista = await gestion.listar();
      if (vigente.current) cambiarCuentas(lista);
    } catch (fallo) {
      if (vigente.current) cambiarError(fallo.message);
    } finally {
      if (vigente.current) cambiarCargando(false);
    }
  }, [gestion]);

  useEffect(() => {
    vigente.current = true;
    void cargar();
    return () => {
      vigente.current = false;
    };
  }, [cargar]);

  async function crear(evento) {
    evento.preventDefault();
    if (guardando) return;
    const datos = Object.fromEntries(new FormData(evento.currentTarget));
    cambiarGuardando(true);
    cambiarError("");
    cambiarAviso("");
    try {
      const usuario = await gestion.crear(datos);
      if (!vigente.current) return;
      formulario.current.reset();
      cambiarAviso(
        `Cuenta creada para ${usuario.correo}. Entregá la contraseña por un canal privado; el usuario podrá cambiarla desde su cuenta.`,
      );
      await cargar();
    } catch (fallo) {
      if (vigente.current) cambiarError(fallo.message);
    } finally {
      if (vigente.current) cambiarGuardando(false);
    }
  }

  async function gestionar(datos) {
    if (operacionEnCurso.current || guardando) return;
    operacionEnCurso.current = true;
    cambiarGuardando(true);
    cambiarError("");
    cambiarAviso("");
    try {
      await gestion.gestionar(datos);
      if (!vigente.current) return;
      cambiarSeleccion(null);
      cambiarAviso(
        datos.accion === "eliminar"
          ? "Cuenta eliminada. Se conservó su auditoría."
          : "Cuenta actualizada correctamente.",
      );
      await cargar();
    } catch (fallo) {
      if (vigente.current) cambiarError(fallo.message);
    } finally {
      operacionEnCurso.current = false;
      if (vigente.current) {
        cambiarGuardando(false);
        requestAnimationFrame(() => botonActualizar.current?.focus());
      }
    }
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion="Creá y administrá las cuentas del equipo y su acceso."
      />
      {error && !seleccion && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}
      {aviso && (
        <div className="alert alert-success" role="status">
          {aviso}
        </div>
      )}
      <section className="card">
        <div className="card-body">
          <details className="detalle-secundario">
            <summary>Crear cuenta</summary>
            <form ref={formulario} onSubmit={crear} aria-busy={guardando}>
              <fieldset disabled={guardando || !!seleccion}>
                <div className="row g-3">
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="nombre-usuario">
                      Nombre completo
                    </label>
                    <input
                      id="nombre-usuario"
                      name="nombre"
                      onBlur={(e) => {
                        e.target.value = e.target.value.trim().toUpperCase();
                      }}
                      className="form-control"
                      required
                      minLength={2}
                      maxLength={100}
                      autoComplete="off"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="correo-usuario">
                      Correo electrónico
                    </label>
                    <input
                      id="correo-usuario"
                      name="correo"
                      type="email"
                      className="form-control"
                      required
                      maxLength={254}
                      autoComplete="off"
                    />
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="clave-usuario">
                      Contraseña inicial
                    </label>
                    <input
                      id="clave-usuario"
                      name="clave"
                      type="password"
                      className="form-control"
                      required
                      minLength={10}
                      maxLength={128}
                      autoComplete="new-password"
                      aria-describedby="ayuda-clave"
                    />
                    <small id="ayuda-clave">
                      Entre 10 y 128 caracteres. Compartila únicamente con su
                      titular.
                    </small>
                  </div>
                  <div className="col-md-6">
                    <label className="form-label" htmlFor="rol-usuario">
                      Rol
                    </label>
                    <select
                      id="rol-usuario"
                      name="rol"
                      className="form-select"
                      defaultValue="vendedor"
                    >
                      <option value="vendedor">Vendedor</option>
                      <option value="agente">Agente</option>
                      <option value="administrador">Administrador</option>
                    </select>
                    <small>El administrador puede crear otras cuentas.</small>
                  </div>
                </div>
                <button type="submit" className="btn btn-primary mt-3">
                  {guardando ? "Creando cuenta…" : "Crear cuenta"}
                </button>
              </fieldset>
            </form>
          </details>
        </div>
      </section>
      <section className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <h2 className="h5 mb-0">Cuentas del equipo</h2>
            <button
              ref={botonActualizar}
              className="btn btn-outline-primary btn-sm"
              disabled={cargando || guardando || !!seleccion}
              onClick={cargar}
            >
              Actualizar
            </button>
          </div>
          <details className="detalle-secundario mb-3">
            <summary>Permisos y eliminación de cuentas</summary>
            <p className="text-muted small">
              Desactivar conserva la cuenta y su historial. Eliminar solo está
              permitido sin actividad comercial ni vínculos con otras cuentas.
              No podés retirar tu propio acceso.
            </p>
          </details>
          {seleccion && (
            <FormularioGestionCuenta
              key={`${seleccion.cuenta.id}-${seleccion.accion}`}
              {...seleccion}
              ocupado={guardando}
              error={error}
              confirmar={gestionar}
              cancelar={() => {
                cambiarSeleccion(null);
                requestAnimationFrame(() => botonActualizar.current?.focus());
              }}
            />
          )}
          {cargando ? (
            <p role="status">Cargando cuentas…</p>
          ) : cuentas.length === 0 ? (
            <p>No hay cuentas para mostrar.</p>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <caption>
                  Hasta 200 cuentas, ordenadas por fecha de creación.
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Nombre</th>
                    <th scope="col">Correo</th>
                    <th scope="col">Rol</th>
                    <th scope="col">Estado</th>
                    <th scope="col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {cuentas.map((cuenta) => (
                    <tr key={cuenta.id}>
                      <td>{cuenta.nombre}</td>
                      <td>{cuenta.correo}</td>
                      <td>
                        {cuenta.rol === "administrador"
                          ? "Administrador"
                          : cuenta.rol === "agente"
                            ? "Agente"
                            : "Vendedor"}
                      </td>
                      <td>{cuenta.activo ? "Activa" : "Inactiva"}</td>
                      <td>
                        {cuenta.lote_demostracion ? (
                          <small>
                            DEMO · retiro mediante limpieza del lote
                          </small>
                        ) : (
                          <div className="d-flex gap-2 flex-wrap">
                            {[
                              ["editar", "Editar"],
                              [
                                cuenta.activo ? "desactivar" : "reactivar",
                                cuenta.activo ? "Desactivar" : "Reactivar",
                              ],
                              ["eliminar", "Eliminar"],
                            ].map(([accion, etiqueta]) => (
                              <button
                                type="button"
                                key={accion}
                                className={`btn btn-sm ${accion === "eliminar" ? "btn-outline-danger" : "btn-outline-primary"}`}
                                disabled={guardando || !!seleccion}
                                aria-label={`${etiqueta}: ${cuenta.nombre}`}
                                onClick={() => {
                                  cambiarError("");
                                  cambiarAviso("");
                                  cambiarSeleccion({ cuenta, accion });
                                }}
                              >
                                {etiqueta}
                              </button>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
