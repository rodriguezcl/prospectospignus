export const camposRegistro = [
  {
    nombre: "nombre",
    etiqueta: "Nombre o empresa",
    limite: 150,
    requerido: true,
  },
  { nombre: "telefono", etiqueta: "Teléfono", limite: 40, tipo: "tel" },
  {
    nombre: "correo",
    etiqueta: "Correo electrónico",
    limite: 254,
    tipo: "email",
  },
  { nombre: "ubicacion", etiqueta: "Dirección o zona", limite: 250 },
  { nombre: "observaciones", etiqueta: "Observaciones", limite: 2000 },
];
export function validarRegistro(entrada) {
  const datos = {};
  for (const { nombre, etiqueta, limite, requerido } of camposRegistro) {
    const valor = entrada[nombre] ?? "";
    if (typeof valor !== "string")
      throw new Error(`${etiqueta}: valor inválido.`);
    datos[nombre] = valor.trim();
    if (
      datos[nombre].length > limite ||
      (requerido && datos[nombre].length < 2)
    )
      throw new Error(
        `${etiqueta}: ${requerido ? "entre 2 y" : "hasta"} ${limite} caracteres.`,
      );
  }
  datos.correo = datos.correo.toLowerCase();
  if (datos.correo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(datos.correo))
    throw new Error("Ingresá un correo válido.");
  if (typeof entrada.origen !== "string" || !entrada.origen.trim())
    throw new Error("Seleccioná el origen.");
  datos.origen = entrada.origen;
  datos.responsable_id = entrada.responsable_id || null;
  if (
    datos.responsable_id &&
    !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(datos.responsable_id)
  )
    throw new Error("Responsable inválido.");
  datos.motivo =
    typeof entrada.motivo === "string" ? entrada.motivo.trim() : "";
  if (datos.motivo.length > 500)
    throw new Error("El motivo admite hasta 500 caracteres.");
  return datos;
}
