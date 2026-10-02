export const servicios = {
  alarma: "Alarma",
  camaras: "Cámaras",
  cerco: "Cerco eléctrico",
};
export const estados = ["borrador", "activo", "inactivo"];
export function aplicarPlantilla(item, plantilla, datos) {
  if (
    !plantilla ||
    plantilla.estado !== "activo" ||
    plantilla.marca_id !== item.marca_id ||
    plantilla.servicio !== item.servicio ||
    !plantilla.variante ||
    !plantilla.incluidos?.length
  )
    throw new Error(
      "Seleccioná una plantilla activa de la misma marca y servicio.",
    );
  for (const c of plantilla.incluidos) {
    const p = datos.items.find((i) => i.id === c.item_id);
    if (
      !p ||
      p.estado !== "activo" ||
      p.tipo !== "adicional" ||
      p.marca_id !== item.marca_id ||
      p.servicio !== item.servicio ||
      !Number.isInteger(c.cantidad) ||
      c.cantidad < 1 ||
      c.cantidad > 9999
    )
      throw new Error(
        "Revisá los componentes de la plantilla antes de aplicarla.",
      );
  }
  if (
    new Set(plantilla.incluidos.map((c) => c.item_id)).size !==
    plantilla.incluidos.length
  )
    throw new Error("La plantilla tiene componentes repetidos.");
  return {
    ...item,
    tipo_comercial_id: plantilla.id,
    incluidos: structuredClone(plantilla.incluidos),
    validado_tecnicamente: false,
  };
}

export function nombrePlantilla(plantilla) {
  return plantilla.variante
    ? `${plantilla.variante} · ${plantilla.nombre}`
    : `${plantilla.nombre} · pendiente de completar`;
}
export function normalizarNombresCatalogo(datos) {
  const nuevo = structuredClone(datos);
  for (const coleccion of ["marcas", "tipos", "familias", "items"]) {
    for (const item of nuevo[coleccion] || []) {
      if (typeof item.nombre === "string")
        item.nombre = item.nombre.trim().toUpperCase();
      if (coleccion === "tipos" && typeof item.variante === "string")
        item.variante = item.variante.trim().toUpperCase();
      if (coleccion === "familias" && typeof item.marca === "string")
        item.marca = item.marca.trim().toUpperCase();
    }
  }
  return nuevo;
}
export function prepararCatalogo(datos) {
  datos = normalizarNombresCatalogo(datos);
  if (datos.esquema === 2) return structuredClone(datos);
  const marcas = [];
  const familias = (datos.familias || []).map((f) => {
    let marca = marcas.find(
      (m) => m.nombre.toLowerCase() === f.marca.toLowerCase(),
    );
    if (!marca) {
      marca = { id: f.id, nombre: f.marca, estado: f.estado };
      marcas.push(marca);
    }
    return { ...f, marca_id: marca.id };
  });
  return {
    esquema: 2,
    marcas,
    tipos: [],
    familias,
    items: (datos.items || []).map((i) => {
      const f = familias.find((f) => f.id === i.familia_id);
      return {
        ...i,
        marca_id: f.marca_id,
        servicio: f.servicio,
        adicional_habilitado: i.tipo === "adicional",
        modalidad: i.tipo === "kit" ? "pendiente" : null,
        tipo_comercial_id: null,
        estado: "borrador",
      };
    }),
  };
}
export function completarGrupos(datos, crearId) {
  const nuevo = normalizarNombresCatalogo(datos);
  nuevo.plantillas_version = 1;
  nuevo.familias = [];
  for (const i of nuevo.items) {
    const marca = nuevo.marcas.find((m) => m.id === i.marca_id);
    if (!marca) throw new Error("Seleccioná una marca.");
    let f = nuevo.familias.find(
      (f) => f.marca_id === marca.id && f.servicio === i.servicio,
    );
    if (!f) {
      const previo = datos.familias.find(
        (f) => f.marca_id === marca.id && f.servicio === i.servicio,
      );
      f = {
        id: previo?.id || crearId(),
        marca_id: marca.id,
        marca: marca.nombre,
        nombre: marca.nombre,
        servicio: i.servicio,
        estado: marca.estado,
      };
      nuevo.familias.push(f);
    }
    i.familia_id = f.id;
  }
  return nuevo;
}
export function dependencias(datos, seccion, id, soloActivas = false) {
  const plantillas = (datos.tipos || [])
    .filter(
      (t) =>
        (!soloActivas || t.estado === "activo") &&
        (seccion === "marcas"
          ? t.marca_id === id
          : seccion === "items" && t.incluidos?.some((c) => c.item_id === id)),
    )
    .map((t) => `Plantilla ${nombrePlantilla(t)}`);
  return plantillas.concat(
    datos.items
      .filter(
        (i) =>
          (!soloActivas || i.estado === "activo") &&
          (seccion === "marcas"
            ? i.marca_id === id
            : seccion === "tipos"
              ? i.tipo_comercial_id === id
              : i.id !== id &&
                ((i.incluidos || []).some((c) => c.item_id === id) ||
                  (!soloActivas && (i.kits_compatibles || []).includes(id)))),
      )
      .map((i) => `${i.codigo} · ${i.nombre}`),
  );
}
export function modificarCatalogo(datos, seccion, valor, accion = "guardar") {
  valor = { ...valor, nombre: valor.nombre?.trim().toUpperCase() };
  const nuevo = structuredClone(datos);
  if (
    accion === "eliminar" ||
    (accion === "guardar" && valor.estado !== "activo")
  ) {
    const vinculados = dependencias(
      datos,
      seccion,
      valor.id,
      accion !== "eliminar",
    );
    if (vinculados.length)
      throw new Error(`Primero revisá los vínculos: ${vinculados.join(", ")}.`);
  }
  if (accion === "eliminar")
    nuevo[seccion] = nuevo[seccion].filter((x) => x.id !== valor.id);
  else {
    const indice = nuevo[seccion].findIndex((x) => x.id === valor.id);
    if (indice < 0) nuevo[seccion].push(valor);
    else nuevo[seccion][indice] = valor;
  }
  return nuevo;
}
