import { ModuloEnPreparacion } from "../../../shared/ui/feedback/ModuloEnPreparacion.jsx";

export function RegistrosInicialesPagina() {
  return (
    <ModuloEnPreparacion
      titulo="Registros iniciales"
      descripcion="El punto de partida de cada relación comercial."
      icono="bi-inbox-fill"
      funciones={[
        "Registros brutos y válidos",
        "Origen y responsable",
        "Revisión de coincidencias",
      ]}
    />
  );
}
