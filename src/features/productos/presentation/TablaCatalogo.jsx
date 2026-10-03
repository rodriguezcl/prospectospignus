import { useState } from "react";
import { servicios } from "../domain/catalogo.js";

const comparar = new Intl.Collator("es-AR", {
  sensitivity: "base",
  numeric: true,
});
const textoBuscable = (valor) =>
  String(valor ?? "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("es-AR");
const estados = {
  activo: "Activo",
  inactivo: "Inactivo",
  borrador: "Borrador",
};
const modalidades = {
  plan: "Plan · comodato",
  kit: "Kit · venta",
  pendiente: "Pendiente",
};

export function TablaCatalogo({
  filas,
  marcas,
  seccion,
  titulo,
  acciones,
  cambiarEstado,
  ocupado,
}) {
  const [busqueda, buscar] = useState("");
  const [segmento, filtrarSegmento] = useState("");
  const [orden, ordenar] = useState({ campo: "nombre", direccion: 1 });
  const productos = seccion !== "marcas";
  const nombresMarcas = new Map(marcas.map((m) => [m.id, m.nombre]));
  const columnas = [
    { campo: "nombre", titulo: "Nombre", valor: (i) => i.nombre },
    ...(productos
      ? [
          { campo: "codigo", titulo: "Código", valor: (i) => i.codigo },
          {
            campo: "marca",
            titulo: "Marca",
            valor: (i) => nombresMarcas.get(i.marca_id) || "Sin marca",
          },
          {
            campo: "servicio",
            titulo: "Segmento",
            valor: (i) => servicios[i.servicio] || "Sin segmento",
          },
          ...(seccion === "ofertas"
            ? [
                {
                  campo: "modalidad",
                  titulo: "Modalidad",
                  valor: (i) => modalidades[i.modalidad] || "Pendiente",
                },
              ]
            : []),
        ]
      : []),
    {
      campo: "estado",
      titulo: "Estado",
      valor: (i) => estados[i.estado] || i.estado,
    },
    ...(seccion === "productos"
      ? [
          {
            campo: "compatibilidad",
            titulo: "Marcas compatibles",
            valor: (i) =>
              i.marcas_compatibles?.length
                ? i.marcas_compatibles
                    .map((id) => nombresMarcas.get(id) || "Marca no disponible")
                    .sort(comparar.compare)
                    .join(", ")
                : nombresMarcas.get(i.marca_id) || "—",
          },
          {
            campo: "adicional",
            titulo: "Adicional",
            valor: (i) => (i.adicional_habilitado ? "Sí" : "No"),
          },
        ]
      : []),
  ];
  const columnaOrden =
    columnas.find((c) => c.campo === orden.campo) || columnas[0];
  const terminos = textoBuscable(busqueda).trim().split(/\s+/).filter(Boolean);
  const visibles = filas
    .filter((i) => {
      if (productos && segmento && i.servicio !== segmento) return false;
      const texto = textoBuscable(columnas.map((c) => c.valor(i)).join(" "));
      return terminos.every((termino) => texto.includes(termino));
    })
    .sort(
      (a, b) =>
        orden.direccion *
          comparar.compare(columnaOrden.valor(a), columnaOrden.valor(b)) ||
        comparar.compare(a.nombre, b.nombre) ||
        comparar.compare(a.codigo ?? "", b.codigo ?? "") ||
        comparar.compare(a.id, b.id),
    );
  const filtros = Boolean(busqueda || segmento);

  return (
    <>
      <div className="row g-3 align-items-end mb-3">
        <label className={productos ? "col-12 col-md-7" : "col-12 col-md-9"}>
          Buscar en {titulo.toLocaleLowerCase("es-AR")}
          <input
            type="search"
            className="form-control mt-1"
            value={busqueda}
            placeholder={
              productos ? "Nombre, código o marca…" : "Nombre de la marca…"
            }
            onChange={(e) => buscar(e.target.value)}
          />
        </label>
        {productos && (
          <label className="col-12 col-sm-7 col-md-3">
            Segmento
            <select
              className="form-select mt-1"
              value={segmento}
              onChange={(e) => filtrarSegmento(e.target.value)}
            >
              <option value="">Todos los segmentos</option>
              {Object.entries(servicios).map(([id, nombre]) => (
                <option key={id} value={id}>
                  {nombre}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="col-auto">
          <button
            type="button"
            className="btn btn-outline-secondary"
            disabled={!filtros}
            onClick={() => {
              buscar("");
              filtrarSegmento("");
            }}
          >
            Limpiar
          </button>
        </div>
      </div>
      <p className="small text-muted mb-2" role="status">
        {visibles.length} de {filas.length} registros · {columnaOrden.titulo}{" "}
        {orden.direccion === 1 ? "A–Z" : "Z–A"}. Ordená haciendo clic en los
        encabezados.
      </p>
      {!filas.length ? (
        <p>No hay registros en esta sección.</p>
      ) : !visibles.length ? (
        <p>No hay coincidencias. Cambiá la búsqueda o el segmento.</p>
      ) : (
        <div
          className="table-responsive"
          role="region"
          aria-label={`Tabla de ${titulo.toLowerCase()}`}
          tabIndex={0}
        >
          <table className="table table-hover align-middle">
            <caption className="visually-hidden">{titulo}</caption>
            <thead>
              <tr>
                {columnas.map((c) => (
                  <th
                    key={c.campo}
                    scope="col"
                    aria-sort={
                      orden.campo === c.campo
                        ? orden.direccion === 1
                          ? "ascending"
                          : "descending"
                        : "none"
                    }
                  >
                    <button
                      type="button"
                      className="btn btn-link p-0 fw-semibold text-decoration-none text-nowrap"
                      aria-label={`Ordenar por ${c.titulo.toLowerCase()} ${orden.campo === c.campo && orden.direccion === 1 ? "de Z a A" : "de A a Z"}`}
                      onClick={() =>
                        ordenar({
                          campo: c.campo,
                          direccion:
                            orden.campo === c.campo ? -orden.direccion : 1,
                        })
                      }
                    >
                      {c.titulo}{" "}
                      <span aria-hidden="true">
                        {orden.campo === c.campo
                          ? orden.direccion === 1
                            ? "↑"
                            : "↓"
                          : "↕"}
                      </span>
                    </button>
                  </th>
                ))}
                <th scope="col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((i) => (
                <tr key={i.id}>
                  {columnas.map((c) =>
                    c.campo === "nombre" ? (
                      <th scope="row" key={c.campo} className="fw-semibold">
                        {c.valor(i)}
                      </th>
                    ) : (
                      <td
                        key={c.campo}
                        className={
                          c.campo === "codigo" ? "text-nowrap" : undefined
                        }
                      >
                        {c.campo === "estado" ? (
                          <button
                            type="button"
                            className={`badge border-0 ${i.estado === "activo" ? "bg-success" : i.estado === "borrador" ? "bg-warning text-dark" : "bg-secondary"}`}
                            disabled={ocupado}
                            aria-label={`${c.valor(i)}: ${i.estado === "inactivo" ? "activar" : "desactivar"} ${i.nombre}${i.codigo ? ` · ${i.codigo}` : ""}`}
                            aria-haspopup="dialog"
                            onClick={() => cambiarEstado(i)}
                          >
                            {c.valor(i)}
                          </button>
                        ) : (
                          c.valor(i)
                        )}
                      </td>
                    ),
                  )}
                  <td>{acciones(i)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
