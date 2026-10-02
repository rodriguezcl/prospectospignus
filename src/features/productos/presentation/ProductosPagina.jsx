import { ordenarAlfabeticamente } from "../../../shared/ui/ordenAlfabetico.js";
import { useEffect, useRef, useState } from "react";
import { EncabezadoPagina } from "../../../shared/ui/contenido/EncabezadoPagina.jsx";
import {
  prepararCatalogo,
  completarGrupos,
  modificarCatalogo,
  servicios,
} from "../domain/catalogo.js";
import { EditorCatalogo } from "./EditorCatalogo.jsx";
const secciones = {
  marcas: "Marcas",
  tipos: "Tipos",
  productos: "Productos",
  ofertas: "Planes y kits",
  adicionales: "Adicionales",
};
export function ProductosPagina({ gestion }) {
  const [catalogo, setCatalogo] = useState(null),
    [seccion, setSeccion] = useState("marcas");
  const [edicion, setEdicion] = useState(null),
    [baja, setBaja] = useState(null);
  const [error, setError] = useState(""),
    [aviso, setAviso] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const envio = useRef(null);
  function recibir(v) {
    return {
      ...v,
      datos: prepararCatalogo(v.datos),
      anterior: v.datos.esquema !== 2 && v.version > 0,
    };
  }
  useEffect(() => {
    let vigente = true;
    gestion
      .leer()
      .then((v) => {
        if (vigente) setCatalogo(recibir(v));
      })
      .catch((e) => {
        if (vigente) setError(e.message);
      });
    return () => {
      vigente = false;
    };
  }, [gestion]);
  async function actualizar() {
    setOcupado(true);
    setError("");
    try {
      setCatalogo(recibir(await gestion.leer()));
      setEdicion(null);
      setBaja(null);
      envio.current = null;
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }
  async function guardar(seccionDatos, valor, accion = "guardar") {
    if (ocupado) return;
    setOcupado(true);
    setError("");
    setAviso("");
    try {
      const datosBase = modificarCatalogo(
        catalogo.datos,
        seccionDatos,
        valor,
        accion,
      );
      const clave = JSON.stringify({ version: catalogo.version, datosBase });
      if (envio.current?.clave !== clave)
        envio.current = {
          clave,
          operacion: crypto.randomUUID(),
          datos: completarGrupos(datosBase, () => crypto.randomUUID()),
        };
      const datos = envio.current.datos;
      const version = await gestion.guardar({
        version: catalogo.version,
        operacion: envio.current.operacion,
        datos,
      });
      setCatalogo({ version, datos });
      setEdicion(null);
      setBaja(null);
      envio.current = null;
      setAviso(
        `Cambio guardado · versión ${version}. El historial se conserva.`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }
  const grupo = ["marcas", "tipos"].includes(seccion) ? seccion : "items";
  const filas = !catalogo
    ? []
    : catalogo.datos[grupo].filter(
        (i) =>
          grupo !== "items" ||
          (seccion === "ofertas"
            ? i.tipo === "kit"
            : seccion === "adicionales"
              ? i.tipo === "adicional" && i.adicional_habilitado
              : i.tipo !== "kit"),
      );
  function abrir(valor) {
    setError("");
    setAviso("");
    setBaja(null);
    envio.current = null;
    setEdicion({ grupo, valor });
  }
  return (
    <>
      <EncabezadoPagina
        titulo="Catálogo comercial"
        descripcion="Marcas, tipos, productos, planes, kits y adicionales."
      />
      {error && (
        <div role="alert" className="alert alert-danger">
          {error}
        </div>
      )}
      {aviso && (
        <div role="status" className="alert alert-success">
          {aviso}
        </div>
      )}
      {!catalogo ? (
        <button
          className="btn btn-outline-primary"
          disabled={ocupado}
          onClick={actualizar}
        >
          Cargar catálogo
        </button>
      ) : (
        <>
          {catalogo.anterior && (
            <div className="alert alert-warning">
              Catálogo anterior pendiente de revisión. Se conservan marcas y
              productos; los productos quedan en borrador hasta confirmar su
              clasificación y activarlos. El primer guardado publica esta
              adaptación sin cambiar propuestas históricas.
            </div>
          )}
          <nav
            aria-label="Secciones del catálogo"
            className="d-flex flex-wrap gap-2 mb-3"
          >
            {Object.entries(secciones).map(([id, nombre]) => (
              <button
                key={id}
                disabled={ocupado}
                aria-pressed={seccion === id}
                className={`btn btn-${seccion === id ? "primary" : "outline-primary"}`}
                onClick={() => {
                  setSeccion(id);
                  setEdicion(null);
                  setBaja(null);
                  setError("");
                }}
              >
                {nombre}
              </button>
            ))}
          </nav>
          <div className="d-flex flex-wrap gap-2 mb-3">
            <button
              className="btn btn-primary"
              disabled={ocupado}
              onClick={() => abrir(null)}
            >
              {seccion === "marcas"
                ? "Nueva marca"
                : seccion === "tipos"
                  ? "Nuevo tipo"
                  : seccion === "ofertas"
                    ? "Nuevo plan o kit"
                    : seccion === "adicionales"
                      ? "Nuevo adicional"
                      : "Nuevo producto"}
            </button>
            <button
              className="btn btn-outline-primary"
              disabled={ocupado}
              onClick={actualizar}
            >
              Actualizar
            </button>
            <span>Versión {catalogo.version}</span>
          </div>
          {edicion && (
            <EditorCatalogo
              key={`${seccion}-${edicion.valor?.id || "nuevo"}`}
              datos={catalogo.datos}
              grupo={edicion.grupo}
              valor={edicion.valor}
              oferta={seccion === "ofertas"}
              adicional={seccion === "adicionales"}
              ocupado={ocupado}
              guardar={(valor) => guardar(edicion.grupo, valor)}
              cancelar={() => setEdicion(null)}
            />
          )}
          {baja && (
            <section className="card card-body" aria-label="Confirmar baja">
              <h2 className="h5">
                {baja.accion === "eliminar"
                  ? "Eliminar del catálogo vigente"
                  : baja.accion === "retirar_adicional"
                    ? "Retirar como adicional"
                    : "Dar de baja"}
                : {baja.valor.nombre}
              </h2>
              <p>
                {baja.accion === "eliminar"
                  ? "Solo se permite sin vínculos ni uso en propuestas. Las versiones históricas no se borran."
                  : baja.accion === "retirar_adicional"
                    ? "Ya no podrá ofrecerse por separado. Se conserva el producto y su inclusión en planes y kits, sin alterar cotizaciones anteriores."
                    : "Dejará de estar disponible para nuevas cotizaciones. Primero deben deshabilitarse los elementos activos que dependan de este registro."}
              </p>
              <div className="d-flex gap-2">
                <button
                  className="btn btn-danger"
                  disabled={ocupado}
                  onClick={() =>
                    guardar(
                      baja.grupo,
                      baja.accion === "retirar_adicional"
                        ? { ...baja.valor, adicional_habilitado: false }
                        : { ...baja.valor, estado: "inactivo" },
                      baja.accion === "retirar_adicional"
                        ? "guardar"
                        : baja.accion,
                    )
                  }
                >
                  Confirmar{" "}
                  {baja.accion === "eliminar" ? "eliminación" : "baja"}
                </button>
                <button
                  className="btn btn-outline-secondary"
                  disabled={ocupado}
                  onClick={() => setBaja(null)}
                >
                  Cancelar
                </button>
              </div>
            </section>
          )}
          <section className="card card-body">
            <h2 className="h4">{secciones[seccion]}</h2>
            {seccion === "adicionales" && (
              <p>
                Son productos habilitados para ofrecer por separado. Editar aquí
                modifica el mismo producto, sin duplicarlo. Para retirar solo su
                oferta adicional, usá «Retirar como adicional». Eliminar retira
                el producto completo y requiere que no tenga vínculos ni uso
                comercial.
              </p>
            )}
            {!filas.length && <p>No hay registros en esta sección.</p>}
            {ordenarAlfabeticamente(filas).map((i) => (
              <div
                key={i.id}
                className="d-flex flex-wrap justify-content-between gap-2 border-bottom py-3"
              >
                <span>
                  {i.codigo && `${i.codigo} · `}
                  {i.nombre} · {i.estado}
                  {i.servicio && ` · ${servicios[i.servicio]}`}
                  {i.tipo === "kit" &&
                    ` · ${i.modalidad === "plan" ? "Plan (comodato)" : i.modalidad === "kit" ? "Kit (venta directa)" : "Clasificación pendiente"}`}
                </span>
                <div className="d-flex flex-wrap gap-2">
                  <button
                    className="btn btn-sm btn-outline-primary"
                    disabled={ocupado}
                    onClick={() => abrir(i)}
                  >
                    Editar {i.nombre}
                  </button>
                  {seccion === "adicionales" && (
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      disabled={ocupado}
                      onClick={() => {
                        setEdicion(null);
                        setBaja({
                          grupo,
                          valor: i,
                          accion: "retirar_adicional",
                        });
                      }}
                    >
                      Retirar como adicional
                    </button>
                  )}
                  {i.estado !== "inactivo" && (
                    <button
                      className="btn btn-sm btn-outline-secondary"
                      disabled={ocupado}
                      onClick={() => {
                        setEdicion(null);
                        setBaja({ grupo, valor: i, accion: "guardar" });
                      }}
                    >
                      Dar de baja
                    </button>
                  )}
                  <button
                    className="btn btn-sm btn-outline-danger"
                    disabled={ocupado}
                    onClick={() => {
                      setEdicion(null);
                      setBaja({ grupo, valor: i, accion: "eliminar" });
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </section>
        </>
      )}
    </>
  );
}
