import { clienteSupabase } from "../../infrastructure/supabase/clienteSupabase.js";
import { componerAcceso } from "../../features/autenticacion/composicion.js";
import { componerUsuarios } from "../../features/usuarios/composicion.js";

export const acceso = componerAcceso(clienteSupabase);
export const usuarios = componerUsuarios(clienteSupabase);
