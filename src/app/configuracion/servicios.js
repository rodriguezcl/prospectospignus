import { clienteSupabase } from "../../infrastructure/supabase/clienteSupabase.js";
import { componerAcceso } from "../../features/autenticacion/composicion.js";
import { componerUsuarios } from "../../features/usuarios/composicion.js";
import { componerRegistros } from "../../features/registros-iniciales/composicion.js";
import { componerResumenInicio } from "../../features/inicio/composicion.js";
import { componerOportunidades } from "../../features/oportunidades/composicion.js";
import { componerVentas } from "../../features/ventas/composicion.js";
import { componerPromociones } from "../../features/promociones/composicion.js";
import { combinarAvisos } from "./combinarAvisos.js";
import { componerAgenda } from "../../features/agenda/composicion.js";
import { componerProductos } from "../../features/productos/composicion.js";
import { componerCondiciones } from "../../features/configuracion/composicion.js";

export const acceso = componerAcceso(clienteSupabase);
export const usuarios = componerUsuarios(clienteSupabase);
export const registros = componerRegistros(clienteSupabase);
export const resumenInicio = componerResumenInicio(clienteSupabase);
export const ventas = componerVentas(clienteSupabase);
export const promociones = componerPromociones(clienteSupabase);
export const agenda = componerAgenda(clienteSupabase);
export const productos = componerProductos(clienteSupabase);
export const condiciones = componerCondiciones(clienteSupabase);
export const oportunidades = componerOportunidades(clienteSupabase, {
  catalogo: productos.leer,
  condiciones: condiciones.leer,
});
export const avisos = combinarAvisos(oportunidades, promociones, agenda);
