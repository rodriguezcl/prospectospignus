import { importeExacto, decimalCentavos, cuotasSinInteres } from "./dinero.js";

export const subcategorias = {
  docta: "Docta Urbanización",
  nobu: "Nobu Town",
  con_monitoreo: "Residencial con monitoreo",
  sin_monitoreo: "Residencial sin monitoreo",
};
// Nueve decimales internos: seis de precio por tres de metros, sin truncar.
const precio = (item, nivel) => importeExacto(item.precios[nivel]) * 1000n;
const redondear = (importe) => (importe + 5000000n) / 10000000n;
// Límite exclusivamente computacional: rechaza explícitamente, nunca ofrece lista parcial.
const MAX_COMBINACIONES = 50000;
export function generarAlternativas({
  catalogo,
  familiaId,
  kitId,
  extras = [],
  nivel = "catalogo",
  subcategoria = "sin_monitoreo",
  telefonico = false,
}) {
  const habilitado = (i) => !i.estado || i.estado === "activo";
  const familia = catalogo.familias.find(
    (f) => f.id === familiaId && habilitado(f),
  );
  if (!familia)
    throw new Error("Seleccioná una marca habilitada para este servicio.");
  const kit = catalogo.items.find(
    (i) =>
      i.id === kitId &&
      i.familia_id === familiaId &&
      i.tipo === "kit" &&
      habilitado(i),
  );
  const alarma = familia.servicio === "alarma",
    incluido = alarma && ["docta", "nobu"].includes(subcategoria);
  if (alarma && !subcategorias[subcategoria])
    throw new Error("Seleccioná una subcategoría.");
  if (familia.servicio !== "cerco" && !kit)
    throw new Error("Seleccioná un plan o kit.");
  if (
    catalogo.esquema === 2 &&
    kit &&
    (!["plan", "kit"].includes(kit.modalidad) ||
      !catalogo.tipos.some(
        (t) => t.id === kit.tipo_comercial_id && habilitado(t),
      ))
  )
    throw new Error("El plan o kit no tiene una clasificación habilitada.");
  if (nivel === "telefonico" && !telefonico)
    throw new Error("Nivel no habilitado.");
  if (!alarma) nivel = "unico";
  if (
    alarma &&
    !["catalogo", "alto", "medio", "bajo", "telefonico"].includes(nivel)
  )
    throw new Error("Nivel no válido.");
  if (new Set(extras.map((x) => x.item_id)).size !== extras.length)
    throw new Error("No repitas adicionales.");
  let posibilidades = 1;
  const grupos = extras.map((e) => {
    const item = catalogo.items.find(
      (x) =>
        x.id === e.item_id &&
        x.familia_id === familiaId &&
        x.tipo !== "kit" &&
        (catalogo.esquema !== 2 ||
          x.tipo === "mano_obra" ||
          x.adicional_habilitado) &&
        habilitado(x),
    );
    if (
      !item ||
      (item.kits_compatibles.length && !item.kits_compatibles.includes(kitId))
    )
      throw new Error("Adicional incompatible.");
    const cantidad = String(e.cantidad);
    if (
      !/^[0-9]+(\.[0-9]{1,3})?$/.test(cantidad) ||
      Number(cantidad) <= 0 ||
      Number(cantidad) > 9999 ||
      (item.unidad !== "metro" && !Number.isInteger(Number(cantidad)))
    )
      throw new Error("Cantidad inválida.");
    const n = Number(cantidad),
      opciones = [];
    if (!alarma)
      return [
        {
          item_id: item.id,
          cantidad,
          bonificados: 0,
          nivel: "unico",
          importe:
            (precio(item, "unico") * BigInt(Math.round(n * 1000))) / 1000n,
          consumo: 0n,
        },
      ];
    const permiteBonificar = !incluido && nivel !== "telefonico";
    // Un mismo adicional puede repartir unidades pagas Alto/Bajo; la lista muestra cada distribución.
    const niveles =
      telefonico && nivel === "telefonico"
        ? ["alto", "bajo", "telefonico"]
        : ["alto", "bajo"];
    const estimadas = permiteBonificar
      ? ((n + 1) * (n + 2)) / 2
      : niveles.length === 3
        ? ((n + 1) * (n + 2)) / 2
        : n + 1;
    posibilidades *= estimadas;
    if (posibilidades > MAX_COMBINACIONES)
      throw new Error(
        "La selección supera 50.000 combinaciones. Reducí cantidades o separá la selección para comparar; no se generó una lista parcial.",
      );
    for (let gratis = 0; gratis <= (permiteBonificar ? n : 0); gratis++)
      for (let altos = 0; altos <= n - gratis; altos++) {
        const restantes = n - gratis - altos;
        for (
          let telefono = 0;
          telefono <= (niveles.includes("telefonico") ? restantes : 0);
          telefono++
        ) {
          const bajos = restantes - telefono;
          opciones.push({
            item_id: item.id,
            cantidad,
            bonificados: gratis,
            altos,
            bajos,
            telefonicos: telefono,
            importe:
              BigInt(altos) * precio(item, "alto") +
              BigInt(bajos) * precio(item, "bajo") +
              (telefono ? BigInt(telefono) * precio(item, "telefonico") : 0n),
            consumo: BigInt(gratis) * precio(item, "bajo"),
          });
        }
      }
    return opciones;
  });
  const base = incluido || !kit ? 0n : precio(kit, nivel);
  const bolsa =
    alarma && !incluido && nivel !== "telefonico"
      ? base - precio(kit, "bajo")
      : 0n;
  const piso =
    alarma && !incluido && nivel !== "telefonico"
      ? precio(kit, "bajo") +
        extras.reduce(
          (s, e) =>
            s +
            BigInt(e.cantidad) *
              precio(
                catalogo.items.find((i) => i.id === e.item_id),
                "bajo",
              ),
          0n,
        )
      : 0n;
  let combinaciones = [{ items: [], importe: base, consumo: 0n }];
  for (const grupo of grupos) {
    const siguientes = [];
    for (const c of combinaciones)
      for (const e of grupo)
        if (c.consumo + e.consumo <= bolsa)
          siguientes.push({
            items: [...c.items, e],
            importe: c.importe + e.importe,
            consumo: c.consumo + e.consumo,
          });
    combinaciones = siguientes;
  }
  if (
    familia.servicio === "cerco" &&
    (!extras.some(
      (e) =>
        catalogo.items.find((i) => i.id === e.item_id)?.tipo === "adicional",
    ) ||
      !extras.some(
        (e) =>
          catalogo.items.find((i) => i.id === e.item_id)?.tipo === "mano_obra",
      ))
  )
    throw new Error("Agregá metros/componentes y mano de obra separada.");
  return combinaciones
    .filter((c) => c.importe >= piso)
    .sort((a, b) =>
      a.importe > b.importe
        ? -1
        : a.importe < b.importe
          ? 1
          : JSON.stringify(
              a.items.map(({ importe, consumo, ...x }) => x),
            ).localeCompare(
              JSON.stringify(b.items.map(({ importe, consumo, ...x }) => x)),
            ),
    )
    .map((c, indice) => ({
      ordinal: indice + 1,
      total: decimalCentavos(redondear(c.importe)),
      importe_exacto: `${c.importe / 1000000000n}.${String(c.importe % 1000000000n).padStart(9, "0")}`,
      efectivo: decimalCentavos(
        redondear(c.importe) - (redondear(c.importe) + 5n) / 10n,
      ),
      cuotas3: cuotasSinInteres(redondear(c.importe), 3),
      cuotas6: cuotasSinInteres(redondear(c.importe), 6),
      seleccion: {
        familia_id: familiaId,
        kit_id: kit?.id || null,
        subcategoria: alarma ? subcategoria : null,
        nivel,
        extras: c.items.map(({ importe, consumo, ...x }) => x),
      },
    }));
}
