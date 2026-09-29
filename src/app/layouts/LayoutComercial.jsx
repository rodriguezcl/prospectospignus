import { useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { menu } from "../navegacion/menu.js";
import { MenuLateral } from "../../shared/ui/navegacion/MenuLateral.jsx";
import { BarraSuperior } from "../../shared/ui/layout/BarraSuperior.jsx";
import { PiePagina } from "../../shared/ui/layout/PiePagina.jsx";
import { Link } from "react-router-dom";
import {
  esAdministrador,
  useSesion,
} from "../../features/autenticacion/index.js";

export function LayoutComercial() {
  const { perfil, acceso } = useSesion();
  const [errorSalida, cambiarErrorSalida] = useState("");
  const [saliendo, cambiarSaliendo] = useState(false);
  const menuPermitido = menu.filter(
    (grupo) => !grupo.soloAdministrador || esAdministrador(perfil),
  );
  async function salir() {
    cambiarSaliendo(true);
    cambiarErrorSalida("");
    try {
      await acceso.salir();
    } catch (error) {
      cambiarErrorSalida(error.message);
      cambiarSaliendo(false);
    }
  }
  const [movil, cambiarMovil] = useState(
    () => window.matchMedia("(max-width: 1199px)").matches,
  );
  const [abiertoMovil, cambiarAbiertoMovil] = useState(false);
  const [colapsado, cambiarColapsado] = useState(false);
  const boton = useRef(null);
  const cerrarBoton = useRef(null);
  const lateral = useRef(null);
  const contenido = useRef(null);
  const ubicacion = useLocation();
  const abierto = movil ? abiertoMovil : !colapsado;

  function cerrarMenu() {
    cambiarAbiertoMovil(false);
    if (!movil) cambiarColapsado(true);
    requestAnimationFrame(() => boton.current?.focus());
  }

  useEffect(() => {
    const consulta = window.matchMedia("(max-width: 1199px)");
    const actualizar = (evento) => {
      cambiarMovil(evento.matches);
      cambiarAbiertoMovil(false);
      boton.current?.focus();
    };
    consulta.addEventListener("change", actualizar);
    return () => consulta.removeEventListener("change", actualizar);
  }, []);

  useEffect(() => {
    cambiarAbiertoMovil(false);
    const actual = menu
      .flatMap((grupo) => grupo.elementos)
      .find((elemento) => elemento.ruta === ubicacion.pathname);
    document.title = `${actual?.titulo || (ubicacion.pathname === "/mi-cuenta" ? "Mi cuenta" : "Página no encontrada")} · Prospectos Pignus`;
    contenido.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [ubicacion]);

  useEffect(() => {
    if (!movil || !abiertoMovil) return;
    cerrarBoton.current?.focus();
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function manejarTeclado(evento) {
      if (evento.key === "Escape") {
        cambiarAbiertoMovil(false);
        requestAnimationFrame(() => boton.current?.focus());
      }
      if (evento.key === "Tab") {
        const controles = lateral.current.querySelectorAll(
          "a[href], button:not([disabled])",
        );
        const primero = controles[0];
        const ultimo = controles[controles.length - 1];
        if (evento.shiftKey && document.activeElement === primero) {
          evento.preventDefault();
          ultimo.focus();
        }
        if (!evento.shiftKey && document.activeElement === ultimo) {
          evento.preventDefault();
          primero.focus();
        }
      }
    }
    document.addEventListener("keydown", manejarTeclado);
    return () => {
      document.body.style.overflow = anterior;
      document.removeEventListener("keydown", manejarTeclado);
    };
  }, [movil, abiertoMovil]);

  return (
    <div className={"estructura " + (abierto ? "menu-visible" : "menu-oculto")}>
      <a
        className="saltar-contenido"
        href="#contenido"
        onClick={(evento) => {
          evento.preventDefault();
          contenido.current?.focus();
        }}
      >
        Saltar al contenido
      </a>
      <MenuLateral
        grupos={menuPermitido}
        abierto={abierto}
        cerrar={cerrarMenu}
        navegar={() => {
          if (movil) cerrarMenu();
        }}
        referencia={lateral}
        referenciaCerrar={cerrarBoton}
      />
      {movil && abierto && (
        <div id="fondo-menu" aria-hidden="true" onClick={cerrarMenu} />
      )}
      <main id="main" inert={movil && abierto}>
        <BarraSuperior
          cuenta={
            <div className="cuenta-barra">
              <Link to="/mi-cuenta">
                {perfil.nombre} ·{" "}
                {perfil.rol === "administrador" ? "Administrador" : "Vendedor"}
              </Link>
              <button
                className="btn btn-outline-secondary btn-sm"
                onClick={salir}
                disabled={saliendo}
              >
                {saliendo ? "Cerrando…" : "Cerrar sesión"}
              </button>
            </div>
          }
          referencia={boton}
          abierto={abierto}
          alternar={() =>
            movil
              ? cambiarAbiertoMovil((valor) => !valor)
              : cambiarColapsado((valor) => !valor)
          }
        />
        <div ref={contenido} id="contenido" tabIndex={-1}>
          {errorSalida && (
            <div className="alert alert-danger" role="alert">
              {errorSalida}
            </div>
          )}
          <Outlet />
        </div>
        <PiePagina />
      </main>
    </div>
  );
}
