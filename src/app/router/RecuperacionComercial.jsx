import { Navigate, useLocation } from "react-router-dom";
import { OportunidadesPagina } from "../../features/oportunidades/index.js";
import { rolesRecuperacion } from "../navegacion/menu.js";

export function RecuperacionComercial({ perfil, gestion }) {
  const { search } = useLocation();
  if (!perfil?.activo || !rolesRecuperacion.includes(perfil.rol)) {
    return <Navigate replace to={{ pathname: "/prospectos", search }} />;
  }
  return (
    <OportunidadesPagina soloRecuperacion perfil={perfil} gestion={gestion} />
  );
}
