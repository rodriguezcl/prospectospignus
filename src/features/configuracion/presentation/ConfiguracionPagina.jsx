import { ModuloEnPreparacion } from "../../../shared/ui/feedback/ModuloEnPreparacion.jsx";

export function ConfiguracionPagina() {
  return (
    <ModuloEnPreparacion
      titulo="Configuración"
      descripcion="Administración de las reglas y accesos del producto."
      icono="bi-gear-fill"
      funciones={[
        "Usuarios y funciones",
        "Orígenes y motivos",
        "Reglas de seguimiento",
      ]}
    />
  );
}
