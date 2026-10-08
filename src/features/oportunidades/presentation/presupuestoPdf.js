import { calcularPago } from "../domain/pago.js";
import { subcategorias } from "../domain/alternativas.js";
import { precioUnitarioAdicional } from "./precioUnitarioAdicional.js";
import { ordenarItemsCotizacion } from "./ordenarItemsCotizacion.js";
import { monedaArgentina } from "../../../shared/ui/importe.js";
import { vencimientoPropuesta } from "../domain/vigencia.js";

export const PIE_PRESUPUESTO =
  "Presupuesto de carácter comercial. Validez: cinco (5) días corridos consecutivos desde la fecha de emisión, sujeto a disponibilidad. Vencido dicho plazo, los precios y condiciones podrán ser modificados y deberán ser confirmados por La Garde S.R.L.";
const moneda = (valor) => monedaArgentina(valor, "No corresponde");
const fecha = (valor) =>
  new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Argentina/Cordoba",
  }).format(new Date(valor));

// Proyección de presentación: reutiliza los importes del cotizador, sin otra regla de precios.
export function prepararPresupuesto({
  oportunidad,
  conceptos,
  catalogo,
  pago,
  emision = new Date(),
  referencia,
}) {
  if (!pago || !conceptos.length)
    throw new Error(
      "Calculá la cotización y elegí el pago antes de descargar.",
    );
  const cliente = oportunidad.prospectos;
  if (!cliente?.nombre)
    throw new Error("Faltan los datos del cliente para el presupuesto.");
  const secciones = conceptos.map((c) => {
    const kit = catalogo.items.find((i) => i.id === c.seleccion.kit_id);
    if (!kit) throw new Error("No se encontró el plan o kit del presupuesto.");
    const nombre = (id) =>
      catalogo.items.find((i) => i.id === id)?.nombre || "Componente";
    const incluidos = ordenarItemsCotizacion(kit.incluidos || [], catalogo).map(
      (i) => ({
        cantidad: String(i.cantidad),
        descripcion: nombre(i.item_id),
        condicion: "Incluido",
      }),
    );
    const adicionales = [];
    for (const e of ordenarItemsCotizacion(c.seleccion.extras, catalogo)) {
      const gratis = Number(e.bonificados || 0);
      const pagadas = Number(e.cantidad) - gratis;
      if (gratis)
        adicionales.push({
          cantidad: String(gratis),
          descripcion: nombre(e.item_id),
          condicion: "Sin cargo adicional",
        });
      if (pagadas > 0)
        adicionales.push({
          cantidad: String(pagadas),
          descripcion: nombre(e.item_id),
          condicion:
            moneda(precioUnitarioAdicional(e, catalogo)) +
            (pagadas > 1 ? " por unidad" : ""),
        });
    }
    const expensas =
      kit.modalidad !== "kit" &&
      ["docta", "nobu"].includes(c.seleccion.subcategoria);
    return {
      nombre: kit.nombre,
      ubicacion:
        subcategorias[c.seleccion.ubicacion_alarma || c.seleccion.subcategoria],
      incluidos,
      adicionales,
      abono:
        c.nivel_abono != null
          ? moneda(c.abono) + " por mes"
          : expensas
            ? "Incluido en expensas"
            : "No corresponde",
      condiciones: [
        kit.modalidad === "kit"
          ? "Los equipos son propiedad del cliente."
          : "Los equipos del plan y los adicionales bonificados se entregan en comodato. Los adicionales pagados son propiedad del cliente.",
        ...(c.nivel_abono != null
          ? [
              "El abono mensual se paga por separado. No se incluye en las cuotas ni recibe el descuento por efectivo.",
            ]
          : []),
        ...(c.meses_congelamiento > 0
          ? [
              `Abono congelado por ${c.meses_congelamiento} meses desde la activación; no son meses gratis.`,
            ]
          : []),
      ],
    };
  });
  const opciones = [
    ["Débito, transferencia o crédito en 1 cuota", { medioSaldo: "debito" }],
    ["Efectivo · 10 % de descuento", { baseEfectivo: pago.base }],
    ["Crédito en 3 cuotas sin interés", { medioSaldo: "credito", cuotas: 3 }],
    ["Crédito en 6 cuotas sin interés", { medioSaldo: "credito", cuotas: 6 }],
  ];
  const pagos = opciones.map(([nombre, parametros]) => {
    const opcion = calcularPago({ total: pago.base, ...parametros });
    return {
      nombre,
      detalle: [
        ...(Number(opcion.descuento) > 0
          ? ["Descuento por efectivo: " + moneda(opcion.descuento)]
          : []),
        ...(Number(opcion.ajuste_redondeo) > 0
          ? ["Ajuste por redondeo de cuotas: " + moneda(opcion.ajuste_redondeo)]
          : []),
      ].join(" · "),
      importe: parametros.cuotas
        ? `${parametros.cuotas} cuotas de ${moneda(opcion.cuotas[0])} · Total: ${moneda(opcion.total)}`
        : moneda(opcion.total),
    };
  });
  return {
    referencia,
    cliente: {
      nombre: cliente.nombre,
      telefono: cliente.telefono,
      direccion: cliente.direccion,
      correo: cliente.correo,
    },
    emision: fecha(emision),
    vencimiento: fecha(
      vencimientoPropuesta({ creado_en: new Date(emision).toISOString() }),
    ),
    secciones,
    pagos,
    redondeoComercial:
      Number(pago.redondeo_manual) > 0
        ? {
            importe: moneda(pago.redondeo_manual),
            descuento:
              Number(pago.descuento) > 0 ? moneda(pago.descuento) : null,
            ajusteCuotas:
              Number(pago.ajuste_redondeo) > 0
                ? moneda(pago.ajuste_redondeo)
                : null,
            total: moneda(pago.total),
            condiciones: [
              ...(Number(pago.efectivo_a_abonar) > 0
                ? ["Efectivo: " + moneda(pago.efectivo_a_abonar)]
                : []),
              ...(Number(pago.saldo) > 0
                ? [
                    pago.medio_saldo === "credito"
                      ? `Crédito: ${pago.cuotas.length} cuota(s) de ${moneda(pago.cuotas[0])}`
                      : `${pago.medio_saldo === "debito" ? "Débito" : "Transferencia"}: ${moneda(pago.saldo)}`,
                  ]
                : []),
            ].join(" · "),
          }
        : null,
    total: moneda(pago.base),
    pie: PIE_PRESUPUESTO,
  };
}
