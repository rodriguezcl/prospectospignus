// Lógica del endpoint aislada del SDK para verificar autorización con pruebas.
export function crearManejador({
  verificarIdentidad,
  obtenerPerfil,
  crearCuenta,
  origenes,
}) {
  return async function manejar(solicitud) {
    const origen = solicitud.headers.get("origin");
    const permitido = !origen || origenes.includes(origen);
    const cabeceras = {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      Vary: "Origin",
      ...(origen && permitido ? { "Access-Control-Allow-Origin": origen } : {}),
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
    const responder = (estado, cuerpo) =>
      new Response(JSON.stringify(cuerpo), {
        status: estado,
        headers: cabeceras,
      });
    if (!permitido) return responder(403, { error: "Origen no autorizado." });
    if (solicitud.method === "OPTIONS")
      return new Response(null, { status: 204, headers: cabeceras });
    if (solicitud.method !== "POST")
      return responder(405, { error: "Método no permitido." });
    const autorizacion = solicitud.headers.get("authorization");
    if (!autorizacion?.startsWith("Bearer "))
      return responder(401, { error: "Sesión requerida." });
    try {
      const identidad = await verificarIdentidad(autorizacion.slice(7));
      if (!identidad) return responder(401, { error: "Sesión inválida." });
      const perfil = await obtenerPerfil(identidad.id);
      if (!perfil?.activo || perfil.rol !== "administrador")
        return responder(403, { error: "Acceso restringido." });
      const texto = await solicitud.text();
      if (texto.length > 4096)
        return responder(413, { error: "Solicitud demasiado extensa." });
      let datos;
      try {
        datos = JSON.parse(texto);
      } catch {
        return responder(400, { error: "Solicitud inválida." });
      }
      if (!datos || Array.isArray(datos))
        return responder(400, { error: "Solicitud inválida." });
      const { nombre, correo, clave, rol } = datos;
      if (
        typeof nombre !== "string" ||
        nombre.trim().length < 2 ||
        nombre.trim().length > 100 ||
        typeof correo !== "string" ||
        correo.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo.trim()) ||
        typeof clave !== "string" ||
        clave.length < 10 ||
        clave.length > 128 ||
        !["administrador", "vendedor"].includes(rol)
      )
        return responder(400, { error: "Datos de cuenta inválidos." });
      const usuario = await crearCuenta({
        nombre: nombre.trim(),
        correo: correo.trim().toLowerCase(),
        clave,
        rol,
        creadoPor: identidad.id,
      });
      return responder(201, {
        usuario: {
          id: usuario.id,
          correo: correo.trim().toLowerCase(),
          nombre: nombre.trim(),
          rol,
        },
      });
    } catch (error) {
      if (["email_exists", "user_already_exists"].includes(error?.code))
        return responder(409, { error: "La cuenta ya existe." });
      if (error?.status === 429)
        return responder(429, { error: "Demasiadas solicitudes." });
      // No devolver detalles del SDK, contraseñas, tokens ni trazas.
      return responder(500, { error: "No se pudo completar la solicitud." });
    }
  };
}
