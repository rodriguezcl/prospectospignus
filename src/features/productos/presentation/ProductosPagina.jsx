import { useEffect, useState, useRef } from "react";
import { EncabezadoPagina } from "../../../shared/ui/contenido/EncabezadoPagina.jsx";

const estados = ["borrador", "activo", "inactivo"];
const niveles = ["catalogo", "alto", "medio", "bajo", "telefonico"];
function Campo({ titulo, children }) {
  return (
    <label className="d-block mb-3">
      {titulo}
      {children}
    </label>
  );
}

export function ProductosPagina({ gestion }) {
  const [catalogo, setCatalogo] = useState(null);
  const [edicion, setEdicion] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const envio = useRef(null);
  useEffect(() => {
    let vigente = true;
    gestion
      .leer()
      .then((v) => {
        if (vigente) setCatalogo(v);
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
      setCatalogo(await gestion.leer());
      setEdicion(null);
      envio.current = null;
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }
  function abrir(tipo, valor) {
    setError("");
    setAviso("");
    envio.current = null;
    setEdicion({
      tipo,
      valor: structuredClone(
        valor ||
          (tipo === "familias"
            ? {
                id: crypto.randomUUID(),
                nombre: "",
                marca: "",
                servicio: "alarma",
                estado: "borrador",
              }
            : {
                id: crypto.randomUUID(),
                codigo: "",
                nombre: "",
                familia_id: catalogo.datos.familias[0]?.id || "",
                tipo: "adicional",
                unidad: "unidad",
                estado: "borrador",
                validado_tecnicamente: false,
                precios: {},
                abonos: {},
                incluidos: [],
                kits_compatibles: [],
              }),
      ),
    });
  }
  function cambiar(campo, valor) {
    envio.current = null;
    setEdicion((e) => ({ ...e, valor: { ...e.valor, [campo]: valor } }));
  }
  async function guardar(e) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setError("");
    const datos = structuredClone(catalogo.datos),
      { tipo, valor } = edicion;
    const posicion = datos[tipo].findIndex((x) => x.id === valor.id);
    if (posicion < 0) datos[tipo].push(valor);
    else datos[tipo][posicion] = valor;
    envio.current ||= crypto.randomUUID();
    try {
      const version = await gestion.guardar({
        version: catalogo.version,
        operacion: envio.current,
        datos,
      });
      setCatalogo({ version, datos });
      setEdicion(null);
      envio.current = null;
      setAviso(
        `Versión ${version} guardada. Las versiones anteriores se conservan.`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }
  const item = edicion?.valor;
  const familia = catalogo?.datos.familias.find(
    (f) => f.id === item?.familia_id,
  );
  const precios =
    familia?.servicio === "alarma"
      ? item?.tipo === "kit"
        ? niveles
        : ["alto", "bajo", "telefonico"]
      : ["unico"];
  function precio(grupo, nivel, valor) {
    const valores = { ...item[grupo] };
    if (valor === "") delete valores[nivel];
    else valores[nivel] = valor;
    cambiar(grupo, valores);
  }
  return (
    <>
      <EncabezadoPagina
        titulo="Catálogo comercial"
        descripcion="Familias, kits y precios. Los borradores no se ofrecen al equipo."
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
          onClick={actualizar}
          disabled={ocupado}
        >
          Cargar catálogo
        </button>
      ) : (
        <>
          <div className="d-flex flex-wrap gap-2 mb-3">
            <button
              className="btn btn-primary"
              disabled={ocupado}
              onClick={() => abrir("familias")}
            >
              Nueva familia
            </button>
            <button
              className="btn btn-primary"
              disabled={ocupado || !catalogo.datos.familias.length}
              onClick={() => abrir("items")}
            >
              Nuevo producto o kit
            </button>
            <button
              className="btn btn-outline-primary"
              disabled={ocupado}
              onClick={actualizar}
            >
              Actualizar
            </button>
            <span className="align-self-center">
              Versión {catalogo.version}
            </span>
          </div>
          {edicion && (
            <form className="card card-body" onSubmit={guardar}>
              <h2 className="h4">
                {edicion.tipo === "familias"
                  ? "Familia y marca"
                  : "Producto o kit"}
              </h2>
              <fieldset disabled={ocupado}>
                <Campo titulo="Nombre">
                  <input
                    className="form-control"
                    required
                    maxLength={150}
                    value={item.nombre}
                    onChange={(e) => cambiar("nombre", e.target.value)}
                  />
                </Campo>
                {edicion.tipo === "familias" ? (
                  <>
                    <Campo titulo="Marca">
                      <input
                        className="form-control"
                        required
                        maxLength={100}
                        value={item.marca}
                        onChange={(e) => cambiar("marca", e.target.value)}
                      />
                    </Campo>
                    <Campo titulo="Servicio">
                      <select
                        className="form-select"
                        value={item.servicio}
                        onChange={(e) => cambiar("servicio", e.target.value)}
                      >
                        <option value="alarma">Instalación de Alarma</option>
                        <option value="camaras">Instalación de Cámaras</option>
                        <option value="cerco">
                          Instalación de Cerco Eléctrico
                        </option>
                      </select>
                    </Campo>
                  </>
                ) : (
                  <>
                    <Campo titulo="Código de producto">
                      <input
                        className="form-control"
                        required
                        maxLength={50}
                        value={item.codigo}
                        onChange={(e) => cambiar("codigo", e.target.value)}
                      />
                    </Campo>
                    <Campo titulo="Familia">
                      <select
                        className="form-select"
                        value={item.familia_id}
                        onChange={(e) => cambiar("familia_id", e.target.value)}
                      >
                        {catalogo.datos.familias.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.marca} · {f.nombre}
                          </option>
                        ))}
                      </select>
                    </Campo>
                    <div className="row">
                      <div className="col-md-6">
                        <Campo titulo="Tipo">
                          <select
                            className="form-select"
                            value={item.tipo}
                            onChange={(e) => cambiar("tipo", e.target.value)}
                          >
                            <option value="adicional">
                              Componente / adicional
                            </option>
                            <option value="kit">
                              Kit inicial (instalación incluida)
                            </option>
                            <option value="mano_obra">
                              Mano de obra de cerco
                            </option>
                          </select>
                        </Campo>
                      </div>
                      <div className="col-md-6">
                        <Campo titulo="Unidad comercial">
                          <select
                            className="form-select"
                            value={item.unidad}
                            onChange={(e) => cambiar("unidad", e.target.value)}
                          >
                            {["unidad", "pack", "metro", "servicio"].map(
                              (v) => (
                                <option key={v}>{v}</option>
                              ),
                            )}
                          </select>
                        </Campo>
                      </div>
                    </div>
                    <h3 className="h5">Precios finales con IVA</h3>
                    <p>
                      Dejá vacío si todavía no está definido. Cero es un precio
                      explícito.
                    </p>
                    <div className="row">
                      {precios.map((n) => (
                        <div className="col-sm-6 col-lg-3" key={n}>
                          <Campo titulo={n}>
                            <input
                              className="form-control"
                              inputMode="decimal"
                              value={item.precios[n] ?? ""}
                              onChange={(e) =>
                                precio("precios", n, e.target.value)
                              }
                            />
                          </Campo>
                        </div>
                      ))}
                    </div>
                    {item.tipo === "kit" && familia?.servicio === "alarma" && (
                      <details className="mb-3">
                        <summary>
                          Abono mensual (solo residencial con monitoreo)
                        </summary>
                        <div className="row mt-2">
                          {["alto", "medio", "bajo", "telefonico"].map((n) => (
                            <div className="col-sm-6" key={n}>
                              <Campo titulo={`Abono ${n}`}>
                                <input
                                  className="form-control"
                                  inputMode="decimal"
                                  value={item.abonos[n] ?? ""}
                                  onChange={(e) =>
                                    precio("abonos", n, e.target.value)
                                  }
                                />
                              </Campo>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                    {item.tipo === "kit" && (
                      <details open className="mb-3">
                        <summary>Componentes incluidos en el kit</summary>
                        <p>
                          Creá primero los componentes de esta familia. No se
                          cobran otra vez como adicionales.
                        </p>
                        {catalogo.datos.items
                          .filter(
                            (x) =>
                              x.tipo === "adicional" &&
                              x.familia_id === item.familia_id,
                          )
                          .map((x) => (
                            <Campo
                              key={x.id}
                              titulo={`${x.codigo} · ${x.nombre} (${x.unidad})`}
                            >
                              <input
                                className="form-control"
                                type="number"
                                min="0"
                                max="9999"
                                step="1"
                                value={
                                  item.incluidos.find((c) => c.item_id === x.id)
                                    ?.cantidad || 0
                                }
                                onChange={(e) =>
                                  cambiar("incluidos", [
                                    ...item.incluidos.filter(
                                      (c) => c.item_id !== x.id,
                                    ),
                                    ...(Number(e.target.value) > 0
                                      ? [
                                          {
                                            item_id: x.id,
                                            cantidad: Number(e.target.value),
                                          },
                                        ]
                                      : []),
                                  ])
                                }
                              />
                            </Campo>
                          ))}
                      </details>
                    )}
                    {item.tipo === "adicional" && (
                      <details className="mb-3">
                        <summary>Kits compatibles</summary>
                        <p>
                          Sin selección: todos los kits de esta familia, sujeto
                          a validación técnica.
                        </p>
                        {catalogo.datos.items
                          .filter(
                            (x) =>
                              x.tipo === "kit" &&
                              x.familia_id === item.familia_id,
                          )
                          .map((x) => (
                            <label className="d-block" key={x.id}>
                              <input
                                type="checkbox"
                                className="form-check-input me-2"
                                checked={item.kits_compatibles.includes(x.id)}
                                onChange={(e) =>
                                  cambiar(
                                    "kits_compatibles",
                                    e.target.checked
                                      ? [...item.kits_compatibles, x.id]
                                      : item.kits_compatibles.filter(
                                          (id) => id !== x.id,
                                        ),
                                  )
                                }
                              />
                              {x.nombre}
                            </label>
                          ))}
                      </details>
                    )}
                    <label className="d-block mb-3">
                      <input
                        type="checkbox"
                        className="form-check-input me-2"
                        checked={item.validado_tecnicamente}
                        onChange={(e) =>
                          cambiar("validado_tecnicamente", e.target.checked)
                        }
                      />
                      Composición, compatibilidad y unidad validadas
                      técnicamente
                    </label>
                  </>
                )}
                <Campo titulo="Estado">
                  <select
                    className="form-select"
                    value={item.estado}
                    onChange={(e) => cambiar("estado", e.target.value)}
                  >
                    {estados.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Campo>
                <div className="d-flex gap-2">
                  <button className="btn btn-primary" type="submit">
                    Guardar nueva versión
                  </button>
                  <button
                    className="btn btn-outline-secondary"
                    type="button"
                    onClick={() => setEdicion(null)}
                  >
                    Cancelar
                  </button>
                </div>
              </fieldset>
            </form>
          )}
          <section className="card card-body">
            <h2 className="h4">Familias</h2>
            {catalogo.datos.familias.length === 0 && (
              <p>
                Sin familias cargadas. Administración debe validar el catálogo
                antes de utilizarlo.
              </p>
            )}
            {catalogo.datos.familias.map((f) => (
              <div
                className="d-flex flex-wrap justify-content-between gap-2 border-bottom py-2"
                key={f.id}
              >
                <span>
                  {f.marca} · {f.nombre} · {f.estado}
                </span>
                <button
                  className="btn btn-sm btn-outline-primary"
                  disabled={ocupado}
                  onClick={() => abrir("familias", f)}
                >
                  Editar familia {f.nombre}
                </button>
              </div>
            ))}
          </section>
          <section className="card card-body">
            <h2 className="h4">Productos y kits</h2>
            {!catalogo.datos.items.length && <p>No hay productos cargados.</p>}
            {catalogo.datos.items.map((i) => (
              <div
                className="d-flex flex-wrap justify-content-between gap-2 border-bottom py-2"
                key={i.id}
              >
                <span>
                  {i.codigo} · {i.nombre} · {i.tipo} · {i.estado}
                </span>
                <button
                  className="btn btn-sm btn-outline-primary"
                  disabled={ocupado}
                  onClick={() => abrir("items", i)}
                >
                  Editar {i.codigo}
                </button>
              </div>
            ))}
          </section>
        </>
      )}
    </>
  );
}
