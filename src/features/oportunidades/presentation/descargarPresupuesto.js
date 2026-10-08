import { jsPDF } from "jspdf";

const tinta = [20, 61, 79],
  gris = [79, 89, 99],
  claro = [242, 245, 247];
// Texto plano, nunca HTML ni comandos PDF provenientes del cliente.
const texto = (valor) =>
  String(valor ?? "")
    .normalize("NFC")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/[\u2010-\u2015]/g, "-");
export function crearPdfPresupuesto(datos, logo) {
  const doc = new jsPDF({ unit: "mm", format: "a4", compress: true });
  doc.setProperties({
    title: "Presupuesto Pignus",
    author: "La Garde S.R.L.",
    subject: "Presupuesto comercial",
  });
  let y = 42;
  function fuente(size = 10, bold = false, color = gris) {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
  }
  function cabecera(primera) {
    doc.setFillColor(...claro);
    doc.triangle(0, 0, 210, 0, 0, 194, "F");
    doc.setFillColor(...tinta);
    doc.triangle(0, 0, 210, 0, 0, 31, "F");
    fuente(20, true, [255, 255, 255]);
    doc.text("PRESUPUESTO", 16, 18);
    if (logo) {
      const img = doc.getImageProperties(logo);
      doc.addImage(logo, "PNG", 151, 12, 43, (43 * img.height) / img.width);
    } else {
      fuente(18, true, tinta);
      doc.text("PIGNUS", 194, 24, { align: "right" });
    }
    fuente(8, false);
    doc.text("La Garde S.R.L.", 194, 35, { align: "right" });
    if (!primera) {
      fuente(9, true, tinta);
      doc.text("Presupuesto " + datos.referencia + " - continuación", 16, 43);
    }
  }
  function espacio(alto) {
    if (y + alto > 257) {
      doc.addPage();
      cabecera(false);
      y = 51;
    }
  }
  function parrafo(
    value,
    { size = 9, bold = false, width = 178, x = 16, gap = 2 } = {},
  ) {
    fuente(size, bold);
    const lineas = doc.splitTextToSize(texto(value), width);
    const alto = size * 0.3528 * 1.3;
    for (const linea of lineas) {
      espacio(alto);
      fuente(size, bold);
      doc.text(linea, x, y);
      y += alto;
    }
    y += gap;
  }
  function titulo(value) {
    espacio(10);
    y += 1;
    parrafo(value, { size: 10, bold: true, gap: 2 });
  }
  function tabla(filas) {
    function encabezado() {
      espacio(10);
      doc.setDrawColor(...tinta);
      doc.setLineWidth(0.4);
      doc.rect(16, y - 4, 178, 8);
      fuente(9, true, tinta);
      doc.text("CANT.", 19, y + 2);
      doc.text("DESCRIPCIÓN", 35, y + 2);
      doc.text("CONDICIÓN / PRECIO", 147, y + 2);
      y += 10;
    }
    encabezado();
    for (const fila of filas) {
      fuente(9);
      const desc = doc.splitTextToSize(texto(fila.descripcion), 106);
      const cond = doc.splitTextToSize(texto(fila.condicion), 44);
      let offset = 0;
      const n = Math.max(desc.length, cond.length);
      while (offset < n) {
        if (y + 10 > 257) {
          espacio(20);
          encabezado();
        }
        const capacidad = Math.max(1, Math.floor((254 - y) / 4.3));
        const count = Math.min(n - offset, capacidad);
        fuente(9);
        doc.text(offset === 0 ? texto(fila.cantidad) : "", 19, y);
        doc.text(desc.slice(offset, offset + count), 35, y, {
          lineHeightFactor: 1.35,
        });
        doc.text(cond.slice(offset, offset + count), 147, y, {
          lineHeightFactor: 1.35,
        });
        y += count * 4.3 + 1.5;
        doc.setDrawColor(208, 216, 220);
        doc.setLineWidth(0.2);
        doc.line(16, y - 3.8, 194, y - 3.8);
        offset += count;
        if (offset < n) {
          espacio(260);
          encabezado();
        }
      }
    }
    y += 3;
  }
  cabecera(true);
  fuente(8, true, tinta);
  doc.text("EMISIÓN (AR)", 194, 43, { align: "right" });
  fuente(9);
  doc.text(datos.emision, 194, 48, { align: "right" });
  fuente(8, true, tinta);
  doc.text("VÁLIDO HASTA (AR)", 194, 54, { align: "right" });
  fuente(9);
  doc.text(datos.vencimiento, 194, 59, { align: "right" });
  fuente(8);
  doc.text("Ref. " + datos.referencia, 194, 65, { align: "right" });
  parrafo("PREPARADO PARA", { size: 8, bold: true, width: 112 });
  parrafo(datos.cliente.nombre, { size: 11, bold: true, width: 112 });
  for (const value of [
    datos.cliente.direccion,
    datos.cliente.telefono,
    datos.cliente.correo,
  ].filter(Boolean))
    parrafo(value, { size: 9, width: 112, gap: 1 });
  y = Math.max(y + 3, 69);
  for (const s of datos.secciones) {
    titulo(s.nombre);
    if (s.ubicacion) parrafo(s.ubicacion, { size: 8, gap: 2 });
    titulo("Detalle del plan o kit");
    tabla(s.incluidos);
    if (s.adicionales.length) {
      titulo("Adicionales");
      tabla(s.adicionales);
    }
    parrafo("Abono mensual: " + s.abono, { bold: true });
    for (const c of s.condiciones) parrafo(c, { size: 8, gap: 2 });
  }
  espacio(48);
  titulo("Formas de pago disponibles");
  for (const opcion of datos.pagos) {
    fuente(8.5, true);
    const label = doc.splitTextToSize(texto(opcion.nombre), 81);
    fuente(8.5);
    const importe = doc.splitTextToSize(
      texto(opcion.importe + (opcion.detalle ? ` (${opcion.detalle})` : "")),
      90,
    );
    const alto = Math.max(label.length, importe.length) * 4 + 2;
    espacio(alto);
    fuente(8.5, true);
    doc.text(label, 16, y, { lineHeightFactor: 1.3 });
    fuente(8.5);
    doc.text(importe, 104, y, { lineHeightFactor: 1.3 });
    y += alto;
  }
  if (datos.redondeoComercial) {
    const r = datos.redondeoComercial;
    espacio(30);
    y += 4;
    parrafo("Condición de pago con redondeo comercial", {
      size: 8.5,
      bold: true,
      gap: 1,
    });
    parrafo(
      [
        r.descuento && "Descuento por efectivo: " + r.descuento,
        "Redondeo comercial: " + r.importe,
        r.ajusteCuotas && "Ajuste de cuotas: " + r.ajusteCuotas,
      ]
        .filter(Boolean)
        .join(" · "),
      { size: 7.5, gap: 1 },
    );
    parrafo(r.condiciones + " · Total: " + r.total, { size: 8, gap: 2 });
  }
  parrafo(
    "Importes por el pago completo del costo inicial. Podés combinar medios de pago. Abono mensual por separado.",
    { size: 7.5, gap: 3 },
  );
  espacio(16);
  doc.setFillColor(...tinta);
  doc.rect(16, y - 2, 178, 16, "F");
  fuente(10, true, [255, 255, 255]);
  doc.text("IMPORTE INICIAL SIN DESCUENTO POR PAGO", 20, y + 8);
  doc.text(datos.total, 190, y + 8, { align: "right" });
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setDrawColor(208, 216, 220);
    doc.line(16, 264, 194, 264);
    fuente(7);
    doc.text(doc.splitTextToSize(datos.pie, 178), 16, 270, {
      lineHeightFactor: 1.3,
    });
    fuente(7);
    doc.text(`${i} / ${pages}`, 16, 289);
    doc.setFillColor(...tinta);
    doc.triangle(160, 297, 210, 283, 210, 297, "F");
  }
  return doc;
}
export async function descargarPresupuesto(datos) {
  const respuesta = await fetch("/marca/pignus.png");
  if (!respuesta.ok)
    throw new Error("No se pudo cargar el logo. Reintentá la descarga.");
  const logo = new Uint8Array(await respuesta.arrayBuffer());
  const doc = crearPdfPresupuesto(datos, logo);
  const nombre =
    datos.cliente.nombre
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9 -]/g, "")
      .trim()
      .slice(0, 60) || "cliente";
  doc.save(`Presupuesto-Pignus-${nombre}-${datos.referencia}.pdf`);
}
