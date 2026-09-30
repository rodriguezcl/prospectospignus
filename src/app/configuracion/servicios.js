import { clienteSupabase } from "../../infrastructure/supabase/clienteSupabase.js";
import { componerAcceso } from "../../features/autenticacion/composicion.js";
import { componerUsuarios } from "../../features/usuarios/composicion.js";
import { componerRegistros } from "../../features/registros-iniciales/composicion.js";
import { componerResumenInicio } from "../../features/inicio/composicion.js";
import { componerOportunidades } from "../../features/oportunidades/composicion.js";

export const acceso = componerAcceso(clienteSupabase);
export const usuarios = componerUsuarios(clienteSupabase);
export const registros = componerRegistros(clienteSupabase);
export const resumenInicio = componerResumenInicio(clienteSupabase);
export const oportunidades = componerOportunidades(clienteSupabase);
