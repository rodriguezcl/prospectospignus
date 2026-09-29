import React from "react";
import { createRoot } from "react-dom/client";
import { Aplicacion } from "./app/Aplicacion.jsx";
import { conservarEnlacesAnteriores } from "./app/router/compatibilidadHash.js";
import "./shared/ui/estilos/personalizacion.css";

conservarEnlacesAnteriores();
window.addEventListener("hashchange", conservarEnlacesAnteriores);
createRoot(document.getElementById("app")).render(
  <React.StrictMode>
    <Aplicacion />
  </React.StrictMode>,
);
