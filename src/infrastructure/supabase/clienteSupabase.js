import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const clavePublica = import.meta.env.VITE_SUPABASE_CLAVE_PUBLICA;

// Instancia única. Sin configuración no se habilita ningún acceso alternativo.
export const clienteSupabase =
  url && clavePublica
    ? createClient(url, clavePublica, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: false,
        },
      })
    : null;
