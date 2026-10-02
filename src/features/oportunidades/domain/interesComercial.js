import { subcategorias } from "./alternativas.js";

export const serviciosInteres = {
  alarma: "Instalación de Alarma",
  camaras: "Instalación de Cámaras",
  cerco: "Instalación de Cerco Eléctrico",
};

export function validarInteres(interes) {
  if (
    !interes ||
    !Array.isArray(interes.servicios) ||
    !interes.servicios.length ||
    interes.servicios.length > 3 ||
    new Set(interes.servicios).size !== interes.servicios.length ||
    interes.servicios.some((s) => !Object.hasOwn(serviciosInteres, s))
  )
    throw new Error(
      "Seleccioná al menos un servicio de interés, sin repetirlo.",
    );
  if (
    interes.servicios.includes("alarma") &&
    interes.tipo_alarma !== "a_definir" &&
    !Object.hasOwn(subcategorias, interes.tipo_alarma)
  )
    throw new Error("Seleccioná el tipo de alarma o A definir en la visita.");
  return {
    servicios: interes.servicios,
    tipo_alarma: interes.servicios.includes("alarma")
      ? interes.tipo_alarma
      : null,
  };
}
