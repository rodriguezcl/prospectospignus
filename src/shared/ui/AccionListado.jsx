import { Link } from "react-router-dom";

export function AccionListado({
  texto,
  etiqueta,
  to,
  className = "btn-outline-primary",
  disabled,
  ...props
}) {
  const Componente = to ? Link : "button";
  return (
    <Componente
      {...props}
      {...(to ? { to } : { type: "button", disabled })}
      className={`btn btn-sm accion-listado ${className}`}
      aria-label={etiqueta}
    >
      {texto || etiqueta}
    </Componente>
  );
}
