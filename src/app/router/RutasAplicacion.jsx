import { Navigate, Route, Routes } from "react-router-dom";
import { LayoutComercial } from "../layouts/LayoutComercial.jsx";
import { InicioPagina } from "../../features/inicio/index.js";
import { PaginaNoEncontrada } from "../../shared/ui/feedback/PaginaNoEncontrada.jsx";
import { accesosInicio } from "../navegacion/menu.js";
import { RegistrosInicialesPagina } from "../../features/registros-iniciales/index.js";
import { ProspectosPagina } from "../../features/prospectos/index.js";
import { OportunidadesPagina } from "../../features/oportunidades/index.js";
import { GestionesPagina } from "../../features/gestiones/index.js";
import { ProximasAccionesPagina } from "../../features/proximas-acciones/index.js";
import { SupervisionPagina } from "../../features/supervision/index.js";
import { InformesPagina } from "../../features/informes/index.js";
import { ConfiguracionPagina } from "../../features/configuracion/index.js";
import { AuditoriaPagina } from "../../features/auditoria/index.js";

export function RutasAplicacion() {
  return (
    <Routes>
      <Route element={<LayoutComercial />}>
        <Route index element={<Navigate to="/inicio" replace />} />
        <Route
          path="inicio"
          element={<InicioPagina accesos={accesosInicio} />}
        />
        <Route path="registros" element={<RegistrosInicialesPagina />} />
        <Route path="prospectos" element={<ProspectosPagina />} />
        <Route path="oportunidades" element={<OportunidadesPagina />} />
        <Route path="gestiones" element={<GestionesPagina />} />
        <Route path="acciones" element={<ProximasAccionesPagina />} />
        <Route path="supervision" element={<SupervisionPagina />} />
        <Route path="informes" element={<InformesPagina />} />
        <Route path="configuracion" element={<ConfiguracionPagina />} />
        <Route path="auditoria" element={<AuditoriaPagina />} />
        <Route path="*" element={<PaginaNoEncontrada />} />
      </Route>
    </Routes>
  );
}
