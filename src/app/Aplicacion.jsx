import { HashRouter } from "react-router-dom";
import { RutasAplicacion } from "./router/RutasAplicacion.jsx";

export function Aplicacion() {
  return (
    <HashRouter>
      <RutasAplicacion />
    </HashRouter>
  );
}
