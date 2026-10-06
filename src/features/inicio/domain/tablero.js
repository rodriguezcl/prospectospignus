import { resumirMes } from "./resumen.js";

const formatoMes = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Argentina/Cordoba",
  year: "numeric",
  month: "2-digit",
});
export function mesCordoba(fecha = new Date()) {
  const partes = formatoMes.formatToParts(new Date(fecha));
  return `${partes.find((p) => p.type === "year").value}-${partes.find((p) => p.type === "month").value}`;
}
export const estadosTablero = [
  { valor: "cotizacion", nombre: "En preparación", color: "azul" },
  { valor: "ganada", nombre: "Ganadas", color: "verde" },
  { valor: "perdida", nombre: "Perdidas", color: "rojo" },
  { valor: "visita", nombre: "Visita", color: "azul" },
  { valor: "seguimiento", nombre: "Seguimiento", color: "ambar" },
  { valor: "recuperacion", nombre: "Recuperación", color: "violeta" },
];
const abierta = (r) => !["ganada", "perdida", "anulada"].includes(r.estado);

export function construirTablero(
  datos,
  mes,
  perfil,
  responsable = "",
  ahora = new Date(),
) {
  const titular = perfil.rol === "administrador" ? responsable : perfil.id;
  const historico = new Map(datos.historico.map((r) => [r.id, r]));
  const cohorte = datos.oportunidades
    .filter((r) => r.estado !== "anulada")
    .filter((r) =>
      r.periodo_historico
        ? r.periodo_historico.slice(0, 7) === mes
        : mesCordoba(r.creado_en) === mes,
    )
    .map((r) => {
      const original = historico.get(r.id);
      if (r.periodo_historico && !original)
        throw new Error(
          "No pudimos verificar el resultado histórico. Actualizá el resumen.",
        );
      return {
        ...r,
        nombre: r.prospectos?.nombre || "Prospecto",
        estado_actual: r.estado,
        estado: original?.resultado || r.estado,
        atribuido_id: original?.responsable_id || r.responsable_id,
        atribuido_nombre:
          original?.responsable_nombre ||
          datos.perfiles.find((p) => p.id === r.responsable_id)?.nombre ||
          "Sin asignar",
      };
    })
    .filter((r) => !titular || r.atribuido_id === titular);
  const registros = datos.registros.filter(
    (r) =>
      !titular ||
      (r.tipo_carga === "historica_confirmada"
        ? r.responsable_id
        : r.creado_por) === titular,
  );
  const pendientes = datos.oportunidades.filter(
    (r) => abierta(r) && (!titular || r.responsable_id === titular),
  );
  const ganadas = cohorte.filter((r) => r.estado === "ganada");
  const porEstado = estadosTablero.map((e) => ({
    ...e,
    cantidad: cohorte.filter((r) => r.estado === e.valor).length,
  }));
  const equipo = [...new Set(cohorte.map((r) => r.atribuido_id))]
    .map((id) => {
      const filas = cohorte.filter((r) => r.atribuido_id === id);
      return {
        id,
        nombre: filas[0].atribuido_nombre,
        total: filas.length,
        estados: estadosTablero.map((e) => ({
          ...e,
          cantidad: filas.filter((r) => r.estado === e.valor).length,
        })),
      };
    })
    .sort((a, b) => b.total - a.total || a.nombre.localeCompare(b.nombre));
  return {
    cohorte,
    registros,
    ganadas,
    porEstado,
    equipo,
    cargas: resumirMes(mes, registros),
    conversion: cohorte.length ? (100 * ganadas.length) / cohorte.length : null,
    abiertas: cohorte.filter(abierta),
    visitasVencidas: pendientes.filter(
      (r) =>
        r.estado === "visita" && r.visita_en && new Date(r.visita_en) < ahora,
    ),
    visitasProximas: pendientes.filter(
      (r) =>
        r.estado === "visita" &&
        r.visita_en &&
        new Date(r.visita_en) >= ahora &&
        new Date(r.visita_en) < new Date(+ahora + 7 * 86400000),
    ),
    seguimientos: pendientes.filter(
      (r) =>
        r.estado === "seguimiento" &&
        r.proxima_accion_en &&
        new Date(r.proxima_accion_en) < ahora,
    ),
    recuperaciones: pendientes.filter(
      (r) => r.estado === "recuperacion" && r.responsable_id,
    ),
    sinAsignar: datos.oportunidades.filter(
      (r) => r.estado === "recuperacion" && !r.responsable_id,
    ),
  };
}
