import { ModuloEnPreparacion } from "../../../shared/ui/feedback/ModuloEnPreparacion.jsx";

export function GestionesPagina() {
  return (
    <ModuloEnPreparacion
      titulo="Gestiones"
      descripcion="El historial de interacciones de cada oportunidad."
      icono="bi-chat-left-text-fill"
      funciones={[
        "Llamadas y mensajes",
        "Visitas y reuniones",
        "Resultados de contacto",
      ]}
    />
  );
}
