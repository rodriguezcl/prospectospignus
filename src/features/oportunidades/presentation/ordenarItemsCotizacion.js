import { ordenarAlfabeticamente } from "../../../shared/ui/ordenAlfabetico.js";

// Orden visual: conserva cantidades, precios y el orden original del catálogo.
export function ordenarItemsCotizacion(filas, catalogo) {
  const productos = new Map(catalogo.items.map((i) => [i.id, i]));
  const compartidas = new Set(
    (catalogo.marcas || [])
      .filter((m) => m.nombre?.trim().toUpperCase() === "COMPONENTES")
      .map((m) => m.id),
  );
  const producto = (fila) => productos.get(fila.item_id || fila.id) || fila;
  const compartido = (fila) => compartidas.has(producto(fila).marca_id);
  const porNombre = ordenarAlfabeticamente(
    filas,
    (fila) => fila.nombre || producto(fila).nombre || "Componente",
  );
  return [
    ...porNombre.filter((fila) => !compartido(fila)),
    ...porNombre.filter(compartido),
  ];
}
