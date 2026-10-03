import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  prepararCatalogo,
  completarGrupos,
} from "../src/features/productos/domain/catalogo.js";

// Preparación local de la carga solicitada. Publicar el resultado mediante la RPC 026,
// con la versión leída, conserva concurrencia, permisos, historial y control de uso.
export function unificarComponentes(datos, crearId = randomUUID) {
  const nuevo = prepararCatalogo(datos);
  let marca = nuevo.marcas.find((m) => m.nombre === "COMPONENTES");
  if (!marca) {
    marca = { id: crearId(), nombre: "COMPONENTES", estado: "activo" };
    nuevo.marcas.push(marca);
  }
  const grupos = [
    ["SIM M2M", ["HIK-SIM-M2M", "GAR-SIM-M2M"]],
    ["CARTEL DISUASIVO", ["HIK-CARTEL-DISUASIVO", "GAR-CARTEL-DISUASIVO"]],
    ["BATERIA 12 V 7 AMP", ["GAR-BAT-12V-7AMP"]],
    ["TRANSFORMADOR 16.5 V 1.5 AMP", ["GAR-TRAFO-16.5V-1.5AMP"]],
  ];
  const sustituciones = new Map();
  const resumen = [];
  for (const [nombre, codigos] of grupos) {
    const originales = nuevo.items.filter((i) => codigos.includes(i.codigo));
    if (!originales.length) continue;
    const principal = originales[0];
    const firma = (i) =>
      JSON.stringify([
        i.servicio,
        i.tipo,
        i.unidad,
        i.estado,
        i.adicional_habilitado,
        i.validado_tecnicamente,
        Object.entries(i.precios).sort(),
        Object.entries(i.abonos).sort(),
        [...(i.kits_compatibles || [])].sort(),
      ]);
    if (
      originales.some(
        (i) => i.tipo !== "adicional" || firma(i) !== firma(principal),
      )
    )
      throw new Error(
        `Revisar diferencias de precios o configuración antes de unificar ${nombre}.`,
      );
    principal.marcas_compatibles = [
      ...new Set(
        originales.flatMap((i) =>
          i.marca_id === marca.id ? i.marcas_compatibles || [] : [i.marca_id],
        ),
      ),
    ];
    principal.marca_id = marca.id;
    for (const duplicado of originales.slice(1))
      sustituciones.set(duplicado.id, principal.id);
    resumen.push({
      nombre,
      conservado: principal.id,
      retirados: originales.slice(1).map((i) => i.id),
      marcas_compatibles: principal.marcas_compatibles,
    });
  }
  nuevo.items = nuevo.items.filter((i) => !sustituciones.has(i.id));
  for (const i of nuevo.items) {
    const cantidades = new Map();
    for (const c of i.incluidos || []) {
      const id = sustituciones.get(c.item_id) || c.item_id;
      cantidades.set(id, (cantidades.get(id) || 0) + Number(c.cantidad));
    }
    i.incluidos = [...cantidades].map(([item_id, cantidad]) => ({
      item_id,
      cantidad,
    }));
  }
  return { datos: completarGrupos(nuevo, crearId), resumen };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [entrada, salida] = process.argv.slice(2);
  if (!entrada || !salida)
    throw new Error(
      "Uso: node scripts/componentes-compartidos.mjs catalogo.json preparado.json",
    );
  const catalogo = JSON.parse(await readFile(entrada, "utf8"));
  const preparado = unificarComponentes(catalogo.datos);
  await writeFile(
    salida,
    JSON.stringify(
      { version: catalogo.version, operacion: randomUUID(), ...preparado },
      null,
      2,
    ),
    { flag: "wx" },
  );
}
