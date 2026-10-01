import { TableroInicio } from "./TableroInicio.jsx";

export function InicioPagina({ gestion, perfil }) {
  return <TableroInicio key={perfil.id} gestion={gestion} perfil={perfil} />;
}
