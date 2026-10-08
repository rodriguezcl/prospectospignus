import { test } from "node:test";
import assert from "node:assert/strict";
import { prepararPresupuesto, PIE_PRESUPUESTO } from "./presupuestoPdf.js";
import { crearPdfPresupuesto } from "./descargarPresupuesto.js";
import { calcularPago } from "../domain/pago.js";
export function ejemploPresupuesto() {
  const catalogo = {
    esquema: 7,
    items: [
      {
        id: "kit",
        nombre: "PLAN INICIAL HIKVISION AX PRO",
        modalidad: "plan",
        incluidos: [
          { item_id: "central", cantidad: 1 },
          { item_id: "pir", cantidad: 1 },
          { item_id: "mag", cantidad: 1 },
        ],
      },
      { id: "central", nombre: "CENTRAL HUB AX-PRO" },
      {
        id: "pir",
        nombre: "PIR INALÁMBRICO AX-PRO",
        precios: { alto: "80000", bajo: "60000" },
      },
      {
        id: "mag",
        nombre: "MAGNÉTICO INALÁMBRICO AX-PRO",
        precios: { alto: "72000", bajo: "62000" },
      },
    ],
  };
  return {
    catalogo,
    oportunidad: {
      prospectos: {
        nombre: "Cliente de ejemplo",
        telefono: "Teléfono de ejemplo",
        direccion: "Dirección de ejemplo - Córdoba",
      },
    },
    conceptos: [
      {
        seleccion: {
          kit_id: "kit",
          subcategoria: "con_monitoreo",
          extras: [
            {
              item_id: "pir",
              cantidad: 3,
              bonificados: 2,
              altos: 1,
              bajos: 0,
              telefonicos: 0,
            },
            {
              item_id: "mag",
              cantidad: 2,
              bonificados: 0,
              altos: 1,
              bajos: 1,
              telefonicos: 0,
            },
          ],
        },
        nivel_abono: "alto",
        abono: "70000",
        meses_congelamiento: 3,
      },
    ],
    pago: calcularPago({
      total: "522363.60",
      baseEfectivo: "100000",
      medioSaldo: "credito",
      cuotas: 3,
      redondeoManual: "1000",
    }),
    emision: new Date("2026-10-08T12:00:00Z"),
    referencia: "EJEMPLO",
  };
}
test("PDF ofrece todos los pagos y separa incluidos de adicionales sin listas internas", () => {
  const datos = prepararPresupuesto(ejemploPresupuesto());
  assert.match(datos.emision, /8\/10\/26/);
  assert.match(datos.vencimiento, /13\/10\/26/);
  assert.equal(datos.pie, PIE_PRESUPUESTO);
  assert.equal(
    datos.secciones[0].adicionales.find(
      (f) => f.cantidad === "2" && f.descripcion.includes("PIR"),
    ).condicion,
    "Sin cargo adicional",
  );
  assert.match(
    datos.secciones[0].adicionales.find(
      (f) => f.descripcion.includes("MAGN") && f.condicion !== "Incluido",
    ).condicion,
    /67.000,00 por unidad/,
  );
  assert.match(datos.total, /522.363,60/);
  assert.doesNotMatch(
    JSON.stringify(datos),
    /Precio Alto|Precio Bajo|telefonico|tipo_cambio|responsableSeguimiento/,
  );
  assert.equal(datos.secciones[0].incluidos.length, 3);
  assert.equal(datos.pagos.length, 4);
  assert.match(datos.pagos[1].importe, /470.127,24/);
  assert.match(datos.pagos[2].importe, /174.121,20/);
  assert.match(datos.pagos[3].importe, /87.060,60/);
  const otro = ejemploPresupuesto();
  otro.conceptos[0].seleccion.extras = [];
  assert.deepEqual(prepararPresupuesto(otro).secciones[0].adicionales, []);
});
test("PDF rechaza falta de cálculo o cliente y pagina contenido extenso", () => {
  const entrada = ejemploPresupuesto();
  assert.throws(() => prepararPresupuesto({ ...entrada, pago: null }));
  assert.throws(() => prepararPresupuesto({ ...entrada, oportunidad: {} }));
  const datos = prepararPresupuesto(entrada);
  datos.secciones[0].adicionales = Array.from({ length: 90 }, (_, i) => ({
    cantidad: "1",
    descripcion:
      "Producto de descripción extensa para verificar paginación " + i,
    condicion: "Sin cargo adicional",
  }));
  const doc = crearPdfPresupuesto(datos);
  assert.ok(doc.getNumberOfPages() > 2);
  assert.ok(doc.output("arraybuffer").byteLength > 1000);
});

test("presupuesto de referencia completo entra en una página A4", () => {
  const doc = crearPdfPresupuesto(prepararPresupuesto(ejemploPresupuesto()));
  assert.equal(doc.getNumberOfPages(), 1);
});

test("redondeos se explican sin trasladar el manual a otras formas de pago", () => {
 const entrada=ejemploPresupuesto();const datos=prepararPresupuesto(entrada);
 assert.match(datos.redondeoComercial.importe,/1.000,00/);
 assert.match(datos.redondeoComercial.total,/511.363,58/);
 assert.match(datos.redondeoComercial.ajusteCuotas,/0,02/);
 assert.match(datos.pagos[1].detalle,/52.236,36/);
 entrada.pago=calcularPago({total:"100",medioSaldo:"credito",cuotas:3});
 const sinManual=prepararPresupuesto(entrada);
 assert.equal(sinManual.redondeoComercial,null);
 assert.match(sinManual.pagos[2].detalle,/0,01/);
 assert.match(sinManual.pagos[3].detalle,/0,04/);
});
