import { useEffect, useState } from "react";
import {
  nivelesDePrecio,
  rolesDePrecio,
  validarPermisosPrecios,
} from "../domain/permisosPrecios.js";

export function ListasPrecios({ permisos, guardar, ocupado }) {
  const [seleccion, seleccionar] = useState(() =>
    validarPermisosPrecios(permisos),
  );
  useEffect(() => seleccionar(validarPermisosPrecios(permisos)), [permisos]);
  const cambiado = JSON.stringify(seleccion) !== JSON.stringify(permisos);
  function cambiar(rol, nivel, habilitado) {
    seleccionar(
      validarPermisosPrecios({
        ...seleccion,
        [rol]: habilitado
          ? [...seleccion[rol], nivel]
          : seleccion[rol].filter((n) => n !== nivel),
      }),
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!ocupado && cambiado) guardar(seleccion);
      }}
    >
      <p>
        Marcá los niveles que cada rol puede ver y usar al cotizar.
        Administración conserva acceso a todos.
      </p>
      <div className="table-responsive">
        <table className="table align-middle" style={{ maxWidth: "42rem" }}>
          <thead>
            <tr>
              <th scope="col">Nivel de precio</th>
              {Object.entries(rolesDePrecio).map(([rol, nombre]) => (
                <th className="text-center" scope="col" key={rol}>
                  {nombre}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.entries(nivelesDePrecio).map(([nivel, nombre]) => (
              <tr key={nivel}>
                <th scope="row">{nombre}</th>
                {Object.entries(rolesDePrecio).map(([rol, nombreRol]) => (
                  <td key={rol} className="text-center">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      aria-label={`${nombre} para ${nombreRol}`}
                      checked={seleccion[rol].includes(nivel)}
                      disabled={ocupado}
                      onChange={(e) => cambiar(rol, nivel, e.target.checked)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small">
        Se aplican a planes, abonos y adicionales según los niveles disponibles
        en cada uno. Los kits de venta y sus adicionales conservan su tarifa
        única.
      </p>
      <p className="small">
        Las propuestas ya ofrecidas conservan sus condiciones. Estos permisos no
        habilitan la edición del catálogo ni el acceso a negociaciones ajenas.
      </p>
      {Object.entries(rolesDePrecio)
        .filter(([rol]) => !seleccion[rol].length)
        .map(([rol, nombre]) => (
          <p key={rol} role="status" className="text-warning">
            {nombre}: sin niveles habilitados para nuevas cotizaciones de
            planes.
          </p>
        ))}
      <button
        className="btn btn-primary"
        type="submit"
        disabled={ocupado || !cambiado}
      >
        {ocupado ? "Guardando…" : "Guardar permisos"}
      </button>
    </form>
  );
}
