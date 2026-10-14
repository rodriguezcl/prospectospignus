const orden = ["catalogo", "alto", "medio", "bajo", "telefonico"];

// La proyección del catálogo es la autoridad de permisos del cotizador.
// El fallback mantiene legibles los catálogos y borradores anteriores a 044.
export function nivelesCotizacion(catalogo, telefonico = false) {
  return catalogo?.permisos_precios_version === 1
    ? orden.filter((n) => catalogo.niveles_habilitados?.includes(n))
    : orden.filter((n) => n !== "telefonico" || telefonico);
}

export function requiereEvaluacionRemota(catalogo, kitId) {
  const kit = catalogo?.items.find((i) => i.id === kitId);
  return Boolean(
    catalogo?.permisos_precios_version === 1 &&
    !nivelesCotizacion(catalogo).includes("bajo") &&
    kit?.modalidad === "plan",
  );
}

export function condicionesHabilitadas(
  catalogo,
  nivel,
  subcategoria,
  telefonico,
) {
  const niveles = nivelesCotizacion(catalogo, telefonico);
  return [
    ...(!["docta", "nobu"].includes(subcategoria) && nivel !== "telefonico"
      ? ["bonificados"]
      : []),
    ...(niveles.includes("alto") ? ["altos"] : []),
    ...(niveles.includes("bajo") ? ["bajos"] : []),
    ...(niveles.includes("telefonico") && nivel === "telefonico"
      ? ["telefonicos"]
      : []),
  ];
}

export function validarNivelesSeleccion(
  catalogo,
  seleccion,
  telefonico = false,
) {
  const kit = catalogo.items.find((i) => i.id === seleccion.kit_id);
  if (kit?.modalidad === "kit" && catalogo.esquema >= 4) return;
  const habilitados = nivelesCotizacion(catalogo, telefonico);
  if (!habilitados.includes(seleccion.nivel))
    throw new Error("Seleccioná un nivel del plan habilitado para tu rol.");
  if (seleccion.nivel_abono && !habilitados.includes(seleccion.nivel_abono))
    throw new Error("Seleccioná un nivel del abono habilitado para tu rol.");
  for (const extra of seleccion.extras || [])
    for (const [campo, nivel] of [
      ["altos", "alto"],
      ["bajos", "bajo"],
      ["telefonicos", "telefonico"],
    ])
      if (Number(extra[campo] || 0) > 0 && !habilitados.includes(nivel))
        throw new Error(
          "Revisá las condiciones de los adicionales: hay un nivel que ya no está habilitado para tu rol.",
        );
}
