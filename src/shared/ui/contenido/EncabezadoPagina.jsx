export function EncabezadoPagina({ titulo, descripcion, etiqueta }) {
  return (
    <div className="page-heading">
      {etiqueta && <p className="sobretitulo">{etiqueta}</p>}
      <h1>{titulo}</h1>
      {descripcion && <p className="text-muted">{descripcion}</p>}
    </div>
  );
}
