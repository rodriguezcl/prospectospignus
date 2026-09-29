import { HashRouter } from "react-router-dom";
import { RutasAplicacion } from "./router/RutasAplicacion.jsx";
import { ProveedorSesion } from "../features/autenticacion/index.js";
import { acceso } from "./configuracion/servicios.js";

export function Aplicacion() {
  return (
    <ProveedorSesion acceso={acceso}>
      <HashRouter>
        <RutasAplicacion />
      </HashRouter>
    </ProveedorSesion>
  );
}
