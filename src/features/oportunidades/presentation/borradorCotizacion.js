import { generarAlternativas } from "../domain/alternativas.js";

export const claveBorrador = (perfil, oportunidad) =>
  `pignus:cotizacion:1:${perfil.id}:${oportunidad.id}:${oportunidad.ciclo || 1}:${perfil.rol}:${oportunidad.estado}`;

// Se conservan selecciones, nunca precios ni datos personales del prospecto.
export function seleccionBorrador(concepto) {
  const { seleccion, ordinal, nivel_abono, meses_congelamiento } = concepto;
  return { seleccion, ordinal, nivel_abono, meses_congelamiento };
}

export function reconstruirConceptos(conceptos, catalogo, telefonico) {
  return conceptos.map((c) => {
    const s = c.seleccion;
    const opciones = generarAlternativas({
      distribucionManual: true,
      catalogo,
      familiaId: s.familia_id,
      kitId: s.kit_id,
      nivel: s.nivel,
      subcategoria: s.subcategoria,
      extras: s.extras,
      telefonico,
    });
    const opcion = opciones.find(
      (o) =>
        o.seleccion.extras.length === s.extras.length &&
        o.seleccion.extras.every((e) => {
          const previo = s.extras.find((x) => x.item_id === e.item_id);
          return (
            previo &&
            ["cantidad", "altos", "bajos", "telefonicos", "bonificados"].every(
              (k) => Number(e[k] || 0) === Number(previo[k] || 0),
            )
          );
        }),
    );
    if (!opcion)
      throw new Error(
        "La composición guardada ya no está disponible. Revisá las condiciones y calculá nuevamente.",
      );
    const kit = catalogo.items.find((i) => i.id === s.kit_id);
    if (c.nivel_abono && kit?.abonos?.[c.nivel_abono] == null)
      throw new Error("El abono guardado ya no está disponible.");
    return {
      ...opcion,
      etiqueta: kit?.nombre || "Oferta",
      codigo: "Borrador recuperado",
      nivel_abono: c.nivel_abono,
      meses_congelamiento: c.meses_congelamiento,
      abono: c.nivel_abono ? kit.abonos[c.nivel_abono] : null,
    };
  });
}

export function leerBorrador(storage, clave, referencias) {
  const raw = storage.getItem(clave);
  if (!raw) return null;
  const b = JSON.parse(raw);
  if (
    b?.esquema !== 1 ||
    !b.seleccion ||
    !Array.isArray(b.conceptos) ||
    b.conceptos.length > 10 ||
    !b.pago ||
    ![
      "servicio",
      "familiaId",
      "modalidadEquipo",
      "kitId",
      "subcategoria",
      "nivel",
      "nivelAbono",
    ].every((k) => typeof b.seleccion[k] === "string") ||
    !b.seleccion.extras ||
    typeof b.seleccion.extras !== "object" ||
    Array.isArray(b.seleccion.extras) ||
    !Object.values(b.seleccion.extras).every(
      (e) =>
        e &&
        typeof e.activo === "boolean" &&
        ["string", "number"].includes(typeof e.cantidad),
    ) ||
    typeof b.pago.baseEfectivo !== "string" ||
    !["debito", "transferencia", "credito"].includes(b.pago.medioSaldo) ||
    ![1, 3, 6].includes(b.pago.cuotas)
  )
    throw new Error("No se pudo recuperar el borrador de este navegador.");
  return {
    ...b,
    vigente:
      (b.tipo_cambio_id || null) ===
        (referencias.catalogo.datos?.tipo_cambio?.id || null) &&
      b.catalogo === referencias.catalogo.version &&
      b.condiciones === referencias.condiciones.version,
  };
}
