import { ModuloEnPreparacion } from "../../../shared/ui/feedback/ModuloEnPreparacion.jsx";

export function ProspectosPagina() {
  return (
    <ModuloEnPreparacion
      titulo="Prospectos"
      descripcion="Personas y empresas contactadas con una posibilidad comercial real."
      icono="bi-people-fill"
      funciones={[
        "Contacto efectivo",
        "Datos de calificación",
        "Oportunidades vinculadas",
      ]}
    />
  );
}
