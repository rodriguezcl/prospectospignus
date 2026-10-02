import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { LayoutComercial } from "../layouts/LayoutComercial.jsx";
import { InicioPagina } from "../../features/inicio/index.js";
import { PaginaNoEncontrada } from "../../shared/ui/feedback/PaginaNoEncontrada.jsx";
import { accesosInicio } from "../navegacion/menu.js";
import { RegistrosInicialesPagina } from "../../features/registros-iniciales/index.js";
import { OportunidadesPagina } from "../../features/oportunidades/index.js";
import { VentasPagina } from "../../features/ventas/index.js";
import { PromocionesPagina } from "../../features/promociones/index.js";
import { AgendaPagina } from "../../features/agenda/index.js";
import { SupervisionPagina } from "../../features/supervision/index.js";
import {
  InformesPagina,
  PanelRendimiento,
} from "../../features/informes/index.js";
import { ConfiguracionPagina } from "../../features/configuracion/index.js";
import { ProductosPagina } from "../../features/productos/index.js";
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
  oportunidades,
  ventas,
  promociones,
  agenda,
  productos,
  condiciones,
  informes,
} from "../configuracion/servicios.js";
import { AccesoProtegido } from "./AccesoProtegido.jsx";
import { RecuperacionComercial } from "./RecuperacionComercial.jsx";

function OportunidadesAnteriores() {
  const { search } = useLocation();
  return <Navigate replace to={{ pathname: "/prospectos", search }} />;
}

export function RutasAplicacion() {
  const { perfil } = useSesion();
  return (
    <Routes>
      <Route path="login" element={<LoginPagina />} />
      <Route element={<AccesoProtegido />}>
        <Route element={<LayoutComercial />}>
          <Route index element={<Navigate to="/inicio" replace />} />
          <Route
            path="agenda"
            element={
              <AgendaPagina key={perfil?.id} gestion={agenda} perfil={perfil} />
            }
          />
          <Route
            path="inicio"
            element={
              <InicioPagina
                key={perfil?.id}
                accesos={accesosInicio}
                gestion={resumenInicio}
                perfil={perfil}
                renderRendimiento={({ mes, responsable, revision }) => (
                  <PanelRendimiento
                    key={`${perfil.id}-${mes}-${responsable}-${revision}`}
                    gestion={informes}
                    perfil={perfil}
                    mes={mes}
                    responsable={responsable}
                    compacto
                  />
                )}
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
          <Route
            path="prospectos"
            element={
              <OportunidadesPagina
                key={`prospectos-${perfil?.id}`}
                gestion={oportunidades}
                perfil={perfil}
              />
            }
          />
          <Route
            path="recuperacion"
            element={
              <RecuperacionComercial
                key={`recuperacion-${perfil?.id}`}
                gestion={oportunidades}
                perfil={perfil}
              />
            }
          />
          <Route path="oportunidades" element={<OportunidadesAnteriores />} />
          <Route
            path="ventas"
            element={
              <VentasPagina key={perfil?.id} gestion={ventas} perfil={perfil} />
            }
          />
          <Route
            path="promociones"
            element={
              <PromocionesPagina
                key={perfil?.id}
                gestion={promociones}
                perfil={perfil}
              />
            }
          />
          <Route
            path="gestiones"
            element={<Navigate to="/prospectos" replace />}
          />
          <Route
            path="acciones"
            element={<Navigate to="/prospectos" replace />}
          />
          <Route path="mi-cuenta" element={<MiCuentaPagina />} />
          <Route element={<AccesoProtegido soloAdministrador />}>
            <Route
              path="usuarios"
              element={<UsuariosPagina gestion={usuarios} />}
            />
            <Route path="supervision" element={<SupervisionPagina />} />
            <Route
              path="informes"
              element={
                <InformesPagina
                  key={perfil?.id}
                  gestion={informes}
                  perfil={perfil}
                />
              }
            />
            <Route
              path="productos"
              element={<ProductosPagina key={perfil?.id} gestion={productos} />}
            />
            <Route
              path="configuracion"
              element={
                <ConfiguracionPagina key={perfil?.id} gestion={condiciones} />
              }
            />
            <Route path="auditoria" element={<AuditoriaPagina />} />
          </Route>
          <Route path="*" element={<PaginaNoEncontrada />} />
        </Route>
      </Route>
    </Routes>
  );
}
