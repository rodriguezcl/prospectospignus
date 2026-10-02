// Configuración del producto; visibilidad no equivale a autorización.
export const rolesRecuperacion = ["agente", "administrador"];
export const menu = [
  {
    grupo: "ESPACIO COMERCIAL",
    elementos: [
      {
        ruta: "/inicio",
        titulo: "Inicio",
        icono: "bi-grid-fill",
      },
      {
        ruta: "/agenda",
        titulo: "Agenda",
        icono: "bi-calendar-week",
        roles: ["vendedor", "administrador"],
      },
      {
        ruta: "/prospectos",
        titulo: "Prospectos",
        icono: "bi-inbox-fill",
      },
      {
        ruta: "/cotizaciones",
        titulo: "Cotizaciones",
        icono: "bi-people-fill",
      },
      {
        ruta: "/recuperacion",
        titulo: "Recuperación comercial",
        icono: "bi-kanban-fill",
        roles: rolesRecuperacion,
      },
      {
        ruta: "/ventas",
        titulo: "Ventas concretadas",
        icono: "bi-check-circle-fill",
      },
      {
        ruta: "/promociones",
        titulo: "Promociones",
        icono: "bi-megaphone-fill",
      },
    ],
  },
  {
    grupo: "ADMINISTRACIÓN",
    soloAdministrador: true,
    elementos: [
      { ruta: "/usuarios", titulo: "Usuarios", icono: "bi-person-plus-fill" },
      { ruta: "/productos", titulo: "Productos", icono: "bi-box-seam" },
      { ruta: "/informes", titulo: "Informes", icono: "bi-bar-chart-fill" },
      {
        ruta: "/configuracion",
        titulo: "Configuración",
        icono: "bi-gear-fill",
      },
    ],
  },
  {
    grupo: "EN PREPARACIÓN",
    plegable: true,
    soloAdministrador: true,
    elementos: [
      {
        ruta: "/supervision",
        titulo: "Supervisión",
        icono: "bi-person-check-fill",
      },
      {
        ruta: "/auditoria",
        titulo: "Auditoría",
        icono: "bi-clock-history",
      },
    ],
  },
];

export const accesosInicio = ["prospectos", "cotizaciones", "ventas"].map(
  (id) =>
    menu
      .flatMap((grupo) => grupo.elementos)
      .find((elemento) => elemento.ruta === "/" + id),
);
