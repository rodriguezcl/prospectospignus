export function validarCuenta({ nombre, correo, clave, rol }) {
  if (
    typeof nombre !== "string" ||
    nombre.trim().length < 2 ||
    nombre.trim().length > 100
  )
    throw new Error("El nombre debe tener entre 2 y 100 caracteres.");
  if (
    typeof correo !== "string" ||
    correo.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim())
  )
    throw new Error("Ingresá un correo válido.");
  if (typeof clave !== "string" || clave.length < 12 || clave.length > 128)
    throw new Error("La contraseña debe tener entre 12 y 128 caracteres.");
  if (!["administrador", "vendedor"].includes(rol))
    throw new Error("Seleccioná un rol válido.");
  return {
    nombre: nombre.trim(),
    correo: correo.trim().toLowerCase(),
    clave,
    rol,
  };
}
