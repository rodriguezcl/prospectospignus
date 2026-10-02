import { TableroInicio } from "./TableroInicio.jsx";

export function InicioPagina({ gestion, perfil, renderRendimiento }) {
  return (
    <TableroInicio
      key={perfil.id}
      gestion={gestion}
      perfil={perfil}
      renderRendimiento={renderRendimiento}
    />
  );
}
