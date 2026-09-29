import { ModuloEnPreparacion } from "../../../shared/ui/feedback/ModuloEnPreparacion.jsx";

export function InformesPagina() {
  return (
    <ModuloEnPreparacion
      titulo="Informes"
      descripcion="Cada indicador permitirá consultar los registros que lo componen."
      icono="bi-bar-chart-fill"
      funciones={[
        "Actividad del período",
        "Cierres por responsable",
        "Conversión por cohorte",
      ]}
    />
  );
}
