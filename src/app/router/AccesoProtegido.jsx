import { Navigate, Outlet } from "react-router-dom";
import {
  esAdministrador,
  useSesion,
} from "../../features/autenticacion/index.js";

export function AccesoProtegido({ soloAdministrador = false }) {
  const { estado, perfil } = useSesion();
  if (estado === "cargando")
    return (
      <main className="container py-5" role="status">
        Verificando acceso…
      </main>
    );
  if (estado !== "autenticado") return <Navigate to="/login" replace />;
  if (soloAdministrador && !esAdministrador(perfil))
    return (
      <section className="container py-5">
        <h1>Acceso restringido</h1>
        <p>Esta sección está disponible solo para administradores.</p>
      </section>
    );
  return <Outlet />;
}
