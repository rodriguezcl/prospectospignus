import { ModuloEnPreparacion } from "../../../shared/ui/feedback/ModuloEnPreparacion.jsx";

export function ProximasAccionesPagina() {
  return (
    <ModuloEnPreparacion
      titulo="Próximas acciones"
      descripcion="Compromisos claros para sostener el seguimiento."
      icono="bi-calendar-check-fill"
      funciones={[
        "Acciones de hoy",
        "Seguimientos vencidos",
        "Realizadas y canceladas",
      ]}
    />
  );
}
