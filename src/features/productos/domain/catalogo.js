import { prepararUbicaciones } from "./ubicaciones.js";
export const servicios = {
  alarma: "Alarma",
  camaras: "Cámaras",
};
export const estados = ["borrador", "activo", "inactivo"];
export const esMarcaComponentes = (marca) =>
  marca?.nombre?.trim().toUpperCase() === "COMPONENTES";
export function componenteCompatible(datos, componente, oferta) {
  return (
    componente.servicio === oferta.servicio &&
    (componente.marca_id === oferta.marca_id ||
      (esMarcaComponentes(
        datos.marcas.find((m) => m.id === componente.marca_id),
      ) &&
        componente.marcas_compatibles?.includes(oferta.marca_id)))
  );
}
export function normalizarNombresCatalogo(datos) {
  const nuevo = structuredClone(datos);
  for (const coleccion of ["marcas", "familias", "items"]) {
    for (const item of nuevo[coleccion] || []) {
      if (typeof item.nombre === "string")
        item.nombre = item.nombre.trim().toUpperCase();
      if (coleccion === "familias" && typeof item.marca === "string")
        item.marca = item.marca.trim().toUpperCase();
    }
  }
  return nuevo;
}
function adaptarEstructura(datos) {
  datos = normalizarNombresCatalogo(datos);
  if ([2, 3, 4, 5, 6, 7].includes(datos.esquema)) {
    const { tipos, plantillas_version, ...vigente } = datos;
    return {
      ...vigente,
      esquema: 3,
      items: vigente.items.map(({ tipo_comercial_id, ...i }) => i),
    };
  }
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
    esquema: 3,
    marcas,

    familias,
    items: (datos.items || []).map((i) => {
      const f = familias.find((f) => f.id === i.familia_id);
      return {
        ...i,
        marca_id: f.marca_id,
        servicio: f.servicio,
        adicional_habilitado: i.tipo === "adicional",
        modalidad: i.tipo === "kit" ? "pendiente" : null,

        estado: "borrador",
      };
    }),
  };
}
export function nivelesPrecios(item) {
  if (item.tipo === "kit")
    return item.modalidad === "plan" || item.modalidad === "pendiente"
      ? ["catalogo", "alto", "medio", "bajo", "telefonico"]
      : ["telefonico"];
  return item.servicio === "camaras"
    ? ["telefonico"]
    : ["alto", "bajo", "telefonico"];
}
export function prepararCatalogo(datos) {
  const nuevo = prepararUbicaciones(adaptarEstructura(datos));
  nuevo.esquema = 7;
  nuevo.moneda_productos_version = 1;
  nuevo.moneda_adicionales = "ARS";
  nuevo.familias = nuevo.familias.filter((f) => f.servicio !== "cerco");
  nuevo.items = nuevo.items.filter(
    (i) => i.servicio !== "cerco" && i.tipo !== "mano_obra",
  );
  for (const i of nuevo.items) {
    if (i.tipo === "adicional") {
      i.precios_usd ??= {};
      i.moneda_referencia ??= datos.moneda_adicionales || "ARS";
    }
    if (i.precios?.unico !== undefined) {
      i.precio_unico_anterior = i.precios.unico;
      delete i.precios.unico;
    }
    const niveles = nivelesPrecios(i);
    i.precios = Object.fromEntries(
      Object.entries(i.precios || {}).filter(([n]) => niveles.includes(n)),
    );
    if (
      i.estado === "activo" &&
      niveles.some((n) => i.precios?.[n] === undefined)
    )
      i.estado = "borrador";
  }
  for (const i of nuevo.items) {
    if (
      i.estado === "activo" &&
      i.incluidos?.some(
        (c) =>
          !nuevo.items.some((p) => p.id === c.item_id && p.estado === "activo"),
      )
    )
      i.estado = "borrador";
  }
  return nuevo;
}
export function completarGrupos(datos, crearId) {
  const nuevo = normalizarNombresCatalogo(datos);

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
  return datos.items
    .filter(
      (i) =>
        (!soloActivas || i.estado === "activo") &&
        (seccion === "marcas"
          ? i.marca_id === id ||
            (!soloActivas && i.marcas_compatibles?.includes(id))
          : i.id !== id &&
            ((i.incluidos || []).some((c) => c.item_id === id) ||
              (!soloActivas && (i.kits_compatibles || []).includes(id)))),
    )
    .map((i) => `${i.codigo} · ${i.nombre}`);
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
  return prepararUbicaciones(nuevo);
}
