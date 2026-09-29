import { createContext, useContext, useEffect, useRef, useState } from "react";

const ContextoSesion = createContext(null);

export function ProveedorSesion({ acceso, children }) {
  const [estado, actualizar] = useState({
    estado: acceso ? "cargando" : "sin-configuracion",
    perfil: null,
    error: "",
  });
  const generacion = useRef(0);

  useEffect(() => {
    if (!acceso) return;
    let vigente = true;
    let ultimoId = null;
    async function resolver(id) {
      const version = ++generacion.current;
      if (!id) {
        actualizar({ estado: "anonimo", perfil: null, error: "" });
        return;
      }
      // Una renovación del mismo usuario no debe desmontar formularios en curso.
      actualizar((anterior) =>
        anterior.estado === "autenticado" && anterior.perfil.id === id
          ? anterior
          : { estado: "cargando", perfil: null, error: "" },
      );
      try {
        const perfil = await acceso.resolverPerfil(id);
        if (vigente && version === generacion.current)
          actualizar({ estado: "autenticado", perfil, error: "" });
      } catch (error) {
        if (vigente && version === generacion.current)
          actualizar({
            estado: "bloqueado",
            perfil: null,
            error: error.message,
          });
      }
    }
    const dejarDeObservar = acceso.observar((id) => {
      ultimoId = id;
      // Salir del callback Auth antes de consultar el perfil; invalida respuestas anteriores.
      ++generacion.current;
      if (!id) actualizar({ estado: "anonimo", perfil: null, error: "" });
      setTimeout(() => {
        if (vigente && id === ultimoId) void resolver(id);
      }, 0);
    });
    const revisar = () => {
      if (document.visibilityState === "visible") void resolver(ultimoId);
    };
    window.addEventListener("focus", revisar);
    return () => {
      vigente = false;
      ++generacion.current;
      dejarDeObservar();
      window.removeEventListener("focus", revisar);
    };
  }, [acceso]);

  return (
    <ContextoSesion.Provider value={{ ...estado, acceso }}>
      {children}
    </ContextoSesion.Provider>
  );
}

export function useSesion() {
  const sesion = useContext(ContextoSesion);
  if (!sesion) throw new Error("Falta el proveedor de sesión.");
  return sesion;
}
