import { ModuloEnPreparacion } from "../../../shared/ui/feedback/ModuloEnPreparacion.jsx";

export function AuditoriaPagina() {
  return (
    <ModuloEnPreparacion
      titulo="Auditoría"
      descripcion="Trazabilidad de cambios relevantes."
      icono="bi-clock-history"
      funciones={[
        "Cambios de etapa",
        "Cambios de responsable",
        "Correcciones justificadas",
      ]}
    />
  );
}
