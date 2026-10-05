import { createClient } from "npm:@supabase/supabase-js@2";
import { crearManejadorDolar } from "./manejador.js";
const cliente = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
Deno.serve(
  crearManejadorDolar({
    origenes: (
      Deno.env.get("ORIGENES_PERMITIDOS") ||
      "https://prospectospignus.vercel.app,http://127.0.0.1:5173,http://localhost:5173"
    )
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
    async autorizado(token: string) {
      const { data, error } = await cliente.auth.getUser(token);
      if (error || !data.user) return false;
      const perfil = await cliente
        .from("perfiles")
        .select("activo")
        .eq("id", data.user.id)
        .maybeSingle();
      return !perfil.error && perfil.data?.activo === true;
    },
    async consultarCache() {
      const { data, error } = await cliente
        .from("cotizaciones_dolar")
        .select("id,venta,fecha_fuente,consultado_en")
        .gte(
          "consultado_en",
          new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        )
        .order("fecha_fuente", { ascending: false })
        .order("consultado_en", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data
        ? {
            id: data.id,
            venta: String(data.venta),
            fechaActualizacion: data.fecha_fuente,
            consultado_en: data.consultado_en,
          }
        : null;
    },
    async consultarFuente() {
      const respuesta = await fetch("https://dolarapi.com/v1/dolares/oficial", {
        signal: AbortSignal.timeout(10000),
      });
      if (!respuesta.ok) throw new Error("DolarAPI no disponible");
      return respuesta.json();
    },
    async registrar(venta: string, fecha: string) {
      const { data, error } = await cliente.rpc("registrar_cotizacion_dolar", {
        p_venta: venta,
        p_fecha: fecha,
      });
      if (error) throw error;
      return data;
    },
  }),
);
