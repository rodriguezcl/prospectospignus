// Configuración del producto; visibilidad no equivale a autorización.
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
        ruta: "/registros",
        titulo: "Registros iniciales",
        icono: "bi-inbox-fill",
      },
      {
        ruta: "/prospectos",
        titulo: "Prospectos",
        icono: "bi-people-fill",
      },
      {
        ruta: "/oportunidades",
        titulo: "Oportunidades",
        icono: "bi-kanban-fill",
      },
      {
        ruta: "/gestiones",
        titulo: "Gestiones",
        icono: "bi-chat-left-text-fill",
      },
      {
        ruta: "/acciones",
        titulo: "Próximas acciones",
        icono: "bi-calendar-check-fill",
      },
    ],
  },
  {
    grupo: "GESTIÓN DEL EQUIPO",
    soloAdministrador: true,
    elementos: [
      {
        ruta: "/supervision",
        titulo: "Supervisión",
        icono: "bi-person-check-fill",
      },
      {
        ruta: "/informes",
        titulo: "Informes",
        icono: "bi-bar-chart-fill",
      },
    ],
  },
  {
    grupo: "ADMINISTRACIÓN",
    soloAdministrador: true,
    elementos: [
      {
        ruta: "/configuracion",
        titulo: "Configuración",
        icono: "bi-gear-fill",
      },
      { ruta: "/usuarios", titulo: "Usuarios", icono: "bi-person-plus-fill" },
      {
        ruta: "/auditoria",
        titulo: "Auditoría",
        icono: "bi-clock-history",
      },
    ],
  },
];

export const accesosInicio = ["registros", "oportunidades", "acciones"].map(
  (id) =>
    menu
      .flatMap((grupo) => grupo.elementos)
      .find((elemento) => elemento.ruta === "/" + id),
);
