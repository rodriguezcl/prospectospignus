import { Link } from "react-router-dom";
export function PaginaNoEncontrada() {
  return (
    <>
      <h1>Página no encontrada</h1>
      <p>La dirección solicitada no corresponde a una sección disponible.</p>
      <Link to="/inicio">Volver al inicio</Link>
    </>
  );
}
