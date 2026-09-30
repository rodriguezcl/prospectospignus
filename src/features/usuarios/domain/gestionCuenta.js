export function validarGestionCuenta({ id, version, accion, ...datos }) {
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      id,
    ) ||
    !Number.isInteger(version) ||
    version < 1
  )
    throw new Error("Recargá la lista de cuentas antes de continuar.");
  if (!["editar", "desactivar", "reactivar", "eliminar"].includes(accion))
    throw new Error("Acción no válida.");
  const motivo = typeof datos.motivo === "string" ? datos.motivo.trim() : "";
  if (motivo.length < 5 || motivo.length > 500)
    throw new Error("Ingresá un motivo de entre 5 y 500 caracteres.");
  const cambios = { motivo };
  if (accion === "editar") {
    if (
      typeof datos.nombre !== "string" ||
      datos.nombre.trim().length < 2 ||
      datos.nombre.trim().length > 100
    )
      throw new Error("El nombre debe tener entre 2 y 100 caracteres.");
    if (!["administrador", "vendedor"].includes(datos.rol))
      throw new Error("Seleccioná un rol válido.");
    cambios.nombre = datos.nombre.trim();
    cambios.rol = datos.rol;
  }
  if (accion === "eliminar") {
    if (typeof datos.confirmacion !== "string" || !datos.confirmacion.trim())
      throw new Error(
        "Escribí el correo de la cuenta para confirmar la eliminación.",
      );
    cambios.confirmacion = datos.confirmacion.trim();
  }
  return { id, version, accion, datos: cambios };
}
