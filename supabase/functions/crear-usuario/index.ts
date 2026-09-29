import { createClient } from "npm:@supabase/supabase-js@2";
import { crearManejador } from "./manejador.js";

// Credencial privilegiada disponible únicamente en el entorno de Edge Functions.
const cliente = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
  },
);

Deno.serve(
  crearManejador({
    origenes: (Deno.env.get("ORIGENES_PERMITIDOS") || "")
      .split(",")
      .map((valor) => valor.trim())
      .filter(Boolean),
    async verificarIdentidad(token: string) {
      const { data, error } = await cliente.auth.getUser(token);
      return error ? null : data.user;
    },
    async obtenerPerfil(id: string) {
      const { data, error } = await cliente
        .from("perfiles")
        .select("rol,activo")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async crearCuenta(datos: {
      nombre: string;
      correo: string;
      clave: string;
      rol: string;
      creadoPor: string;
    }) {
      const { data, error } = await cliente.auth.admin.createUser({
        email: datos.correo,
        password: datos.clave,
        email_confirm: true,
        app_metadata: {
          pignus_autorizado: true,
          nombre: datos.nombre,
          rol: datos.rol,
          creado_por: datos.creadoPor,
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error("Sin usuario creado");
      return data.user;
    },
  }),
);
