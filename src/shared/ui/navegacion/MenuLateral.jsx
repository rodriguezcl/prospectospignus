import { Link, NavLink } from "react-router-dom";
import { MarcaPignus } from "../contenido/MarcaPignus.jsx";

export function MenuLateral({
  grupos,
  abierto,
  cerrar,
  navegar,
  referencia,
  referenciaCerrar,
}) {
  return (
    <aside
      id="sidebar"
      ref={referencia}
      inert={!abierto}
      aria-label="Menú principal"
    >
      <div className="sidebar-wrapper">
        <div className="sidebar-header">
          <Link className="marca" to="/inicio" onClick={navegar}>
            <MarcaPignus />
          </Link>
          <button
            ref={referenciaCerrar}
            id="cerrar-menu"
            className="btn btn-light"
            aria-label="Cerrar menú"
            onClick={cerrar}
          >
            ×
          </button>
        </div>
        <nav className="sidebar-menu" aria-label="Secciones">
          <ul className="menu">
            {grupos.map((grupo) => (
              <li key={grupo.grupo}>
                <GrupoMenu grupo={grupo}>
                  {!grupo.plegable && (
                    <span className="sidebar-title titulo-grupo">
                      {grupo.grupo}
                    </span>
                  )}
                  <ul className="lista-grupo">
                    {grupo.elementos.map((elemento) => (
                      <li className="sidebar-item" key={elemento.ruta}>
                        <NavLink
                          to={elemento.ruta}
                          className={({ isActive }) =>
                            "sidebar-link" + (isActive ? " seleccionada" : "")
                          }
                          onClick={navegar}
                        >
                          <i
                            className={"bi " + elemento.icono}
                            aria-hidden="true"
                          />
                          <span>{elemento.titulo}</span>
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                </GrupoMenu>
              </li>
            ))}
          </ul>
        </nav>
        <div className="nota-menu">
          <span className="punto" /> Entorno de desarrollo
        </div>
      </div>
    </aside>
  );
}

function GrupoMenu({ grupo, children }) {
  return grupo.plegable ? (
    <details className="menu-secundario">
      <summary className="sidebar-title titulo-grupo">{grupo.grupo}</summary>
      {children}
    </details>
  ) : (
    children
  );
}
