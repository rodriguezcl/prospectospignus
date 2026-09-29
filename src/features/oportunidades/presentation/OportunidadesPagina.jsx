import { ModuloEnPreparacion } from "../../../shared/ui/feedback/ModuloEnPreparacion.jsx";

export function OportunidadesPagina() {
  return (
    <ModuloEnPreparacion
      titulo="Oportunidades"
      descripcion="Acompañá cada necesidad hasta su resultado comercial."
      icono="bi-kanban-fill"
      funciones={[
        "Etapas comerciales",
        "Responsable principal",
        "Resultados y ciclos",
      ]}
    />
  );
}
