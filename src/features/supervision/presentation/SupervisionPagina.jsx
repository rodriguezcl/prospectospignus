import { ModuloEnPreparacion } from "../../../shared/ui/feedback/ModuloEnPreparacion.jsx";

export function SupervisionPagina() {
  return (
    <ModuloEnPreparacion
      titulo="Supervisión"
      descripcion="Organizá la distribución y el seguimiento de la cartera."
      icono="bi-person-check-fill"
      funciones={[
        "Bandeja sin asignar",
        "Reasignaciones",
        "Duplicados y correcciones",
      ]}
    />
  );
}
