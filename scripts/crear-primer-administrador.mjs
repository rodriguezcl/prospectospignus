import { createClient } from "@supabase/supabase-js";
import { validarCuenta } from "../src/features/usuarios/domain/cuenta.js";

const {
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  PIGNUS_ADMIN_NOMBRE,
  PIGNUS_ADMIN_CORREO,
  PIGNUS_ADMIN_CLAVE,
} = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY)
  throw new Error(
    "Faltan las variables privadas del servidor. No usar variables VITE_ para este script.",
  );
const datos = validarCuenta({
  nombre: PIGNUS_ADMIN_NOMBRE,
  correo: PIGNUS_ADMIN_CORREO,
  clave: PIGNUS_ADMIN_CLAVE,
  rol: "administrador",
});
const cliente = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { count, error: errorConsulta } = await cliente
  .from("perfiles")
  .select("id", { count: "exact", head: true });
if (errorConsulta)
  throw new Error(
    "No se pudo verificar la instalación. Aplicá primero la migración.",
  );
if (count !== 0)
  throw new Error(
    "Ya existen perfiles. Usá un administrador existente para crear cuentas.",
  );
const { error } = await cliente.auth.admin.createUser({
  email: datos.correo,
  password: datos.clave,
  email_confirm: true,
  app_metadata: {
    pignus_autorizado: true,
    nombre: datos.nombre,
    rol: datos.rol,
  },
});
if (error)
  throw new Error(
    "No se pudo crear el administrador. Revisá la instalación y si el correo ya existe.",
  );
console.log(
  "Primer administrador creado. Eliminá las credenciales del entorno temporal.",
);
