export function EncabezadoPagina({
  titulo,
  descripcion,
  etiqueta = "PROSPECTOS PIGNUS",
}) {
  return (
    <div className="page-heading">
      <p className="sobretitulo">{etiqueta}</p>
      <h1>{titulo}</h1>
      {descripcion && <p className="text-muted">{descripcion}</p>}
    </div>
  );
}
