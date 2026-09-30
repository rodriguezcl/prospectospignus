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
import {
  LoginPagina,
  MiCuentaPagina,
  useSesion,
} from "../../features/autenticacion/index.js";
import { UsuariosPagina } from "../../features/usuarios/index.js";
import {
  usuarios,
  registros,
  resumenInicio,
} from "../configuracion/servicios.js";
import { AccesoProtegido } from "./AccesoProtegido.jsx";

export function RutasAplicacion() {
  const { perfil } = useSesion();
  return (
    <Routes>
      <Route path="login" element={<LoginPagina />} />
      <Route element={<AccesoProtegido />}>
        <Route element={<LayoutComercial />}>
          <Route index element={<Navigate to="/inicio" replace />} />
          <Route
            path="inicio"
            element={
              <InicioPagina
                key={perfil?.id}
                accesos={accesosInicio}
                gestion={resumenInicio}
                perfil={perfil}
              />
            }
          />
          <Route
            path="registros"
            element={
              <RegistrosInicialesPagina
                key={perfil?.id}
                gestion={registros}
                perfil={perfil}
              />
            }
          />
          <Route path="prospectos" element={<ProspectosPagina />} />
          <Route path="oportunidades" element={<OportunidadesPagina />} />
          <Route path="gestiones" element={<GestionesPagina />} />
          <Route path="acciones" element={<ProximasAccionesPagina />} />
          <Route path="mi-cuenta" element={<MiCuentaPagina />} />
          <Route element={<AccesoProtegido soloAdministrador />}>
            <Route
              path="usuarios"
              element={<UsuariosPagina gestion={usuarios} />}
            />
            <Route path="supervision" element={<SupervisionPagina />} />
            <Route path="informes" element={<InformesPagina />} />
            <Route path="configuracion" element={<ConfiguracionPagina />} />
            <Route path="auditoria" element={<AuditoriaPagina />} />
          </Route>
          <Route path="*" element={<PaginaNoEncontrada />} />
        </Route>
      </Route>
    </Routes>
  );
}
