import {
  ubicacionesAlarma,
  ubicacionesMarca,
  ubicacionesOferta,
} from "../domain/ubicaciones.js";
import { ordenarAlfabeticamente } from "../../../shared/ui/ordenAlfabetico.js";
import { useEffect, useRef, useState } from "react";
import { enfocarPanel } from "../../../shared/ui/enfocarPanel.js";
import { CampoImporte } from "../../../shared/ui/CampoImporte.jsx";
import {
  servicios,
  estados,
  nivelesPrecios,
  esMarcaComponentes,
  componenteCompatible,
} from "../domain/catalogo.js";
const Campo = ({ titulo, children }) => (
  <label className="d-block mb-3">
    {titulo}
    {children}
  </label>
);
export function EditorCatalogo({
  datos,
  grupo,
  valor,
  oferta,
  ocupado,
  guardar,
  cancelar,
  apertura,
}) {
  const titulo = useRef(null);
  useEffect(() => {
    enfocarPanel(titulo.current);
  }, [apertura]);
  const [item, editar] = useState(() =>
    structuredClone(
      valor ||
        (grupo !== "items"
          ? { id: crypto.randomUUID(), nombre: "", estado: "activo" }
          : {
              id: crypto.randomUUID(),
              nombre: "",
              codigo: "",
              marca_id: "",
              marcas_compatibles: [],
              servicio: "alarma",
              tipo: oferta ? "kit" : "adicional",
              modalidad: oferta ? "plan" : null,
              unidad: "unidad",
              estado: "activo",
              adicional_habilitado: false,
              validado_tecnicamente: false,
              incluidos: [],
              kits_compatibles: [],
              precios: {},
              precios_usd: {},
              moneda_referencia: "ARS",
              abonos: {},
            }),
    ),
  );
  const cambiar = (campo, valor) =>
    editar((i) => ({
      ...i,
      [campo]: valor,
      ...(campo === "incluidos" ? { validado_tecnicamente: false } : {}),
    }));
  const referencias = ordenarAlfabeticamente(datos.items).filter(
    (i) =>
      ((oferta
        ? componenteCompatible(datos, i, item)
        : componenteCompatible(datos, item, i)) ||
        item.incluidos?.some((c) => c.item_id === i.id) ||
        item.kits_compatibles?.includes(i.id)) &&
      i.servicio === item.servicio &&
      i.id !== item.id &&
      (i.estado === "activo" ||
        item.incluidos?.some((c) => c.item_id === i.id) ||
        item.kits_compatibles?.includes(i.id)),
  );
  const marcas = ordenarAlfabeticamente(datos.marcas).filter(
    (m) =>
      (!oferta || !esMarcaComponentes(m)) &&
      (m.estado === "activo" || m.id === item.marca_id),
  );
  const vinculadosNoActivos = [
    ...marcas.filter((m) => m.id === item.marca_id),
    ...referencias,
  ].filter((i) => i.estado !== "activo");
  function precio(grupoPrecios, nivel, valor) {
    const p = { ...item[grupoPrecios] };
    if (valor === "") delete p[nivel];
    else p[nivel] = valor;
    cambiar(grupoPrecios, p);
  }
  const niveles = nivelesPrecios(item);
  function precios(grupoPrecios, nombres) {
    return (
      <div className="row">
        {nombres.map((n) => (
          <div className="col-sm-6 col-lg-3" key={n}>
            <Campo
              titulo={`${grupoPrecios === "abonos" ? "Abono " : "Precio "}${n}`}
            >
              <CampoImporte
                value={item[grupoPrecios]?.[n] ?? ""}
                simbolo={grupoPrecios.endsWith("_usd") ? "US$" : "$"}
                onChange={(valor) => precio(grupoPrecios, n, valor)}
              />
            </Campo>
          </div>
        ))}
      </div>
    );
  }
  return (
    <form
      className="card card-body"
      onSubmit={(e) => {
        e.preventDefault();
        guardar({
          ...item,
          ...(grupo === "marcas" || (oferta && item.servicio === "alarma")
            ? {
                ubicaciones_alarma:
                  grupo === "marcas"
                    ? ubicacionesMarca(item)
                    : ubicacionesOferta(datos, item),
              }
            : {}),
          ...(grupo === "items"
            ? {
                tipo: oferta ? "kit" : "adicional",
                precios: Object.fromEntries(
                  Object.entries(item.precios).filter(([n]) =>
                    niveles.includes(n),
                  ),
                ),
                ...(!oferta
                  ? {
                      ...Object.fromEntries(
                        ["precios_pack_2", "precios_pack_2_usd"].map(
                          (campo) => [
                            campo,
                            Object.fromEntries(
                              Object.entries(item[campo] || {}).filter(([n]) =>
                                niveles.includes(n),
                              ),
                            ),
                          ],
                        ),
                      ),
                      precios_usd: Object.fromEntries(
                        Object.entries(item.precios_usd || {}).filter(([n]) =>
                          niveles.includes(n),
                        ),
                      ),
                    }
                  : {}),
              }
            : {}),
        });
      }}
    >
      <h2
        className="h4"
        ref={titulo}
        tabIndex={-1}
        style={{ scrollMarginTop: "1rem" }}
      >
        {valor ? "Editar" : "Crear"}{" "}
        {grupo === "marcas" ? "marca" : oferta ? "plan o kit" : "producto"}
      </h2>
      <fieldset disabled={ocupado}>
        {oferta && (
          <p>
            Elegí la marca, agregá los productos y sus cantidades y definí los
            precios de este plan o kit. Diferenciá las variantes en el nombre,
            por ejemplo «Garnet cableado Inicial».
          </p>
        )}
        {vinculadosNoActivos.length > 0 && (
          <p role="status" className="alert alert-warning">
            Hay vínculos no activos:{" "}
            {vinculadosNoActivos
              .map((i) => `${i.nombre} (${i.estado})`)
              .join(", ")}
            . Se conservan para revisión; reemplazalos o reactivá sus registros
            antes de ofrecerlos.
          </p>
        )}
        {(grupo === "marcas" || (oferta && item.servicio === "alarma")) && (
          <fieldset className="mb-3">
            <legend className="h6">Ubicaciones habilitadas para alarmas</legend>
            <p className="small text-muted">
              La marca define las ubicaciones disponibles. Al retirar una
              ubicación de la marca, se retira también de sus planes y kits.
            </p>
            {Object.entries(ubicacionesAlarma).map(([id, nombre]) => {
              const seleccionadas =
                grupo === "marcas"
                  ? ubicacionesMarca(item)
                  : ubicacionesOferta(datos, item);
              const disponibleEnMarca =
                grupo === "marcas" ||
                ubicacionesMarca(
                  datos.marcas.find((m) => m.id === item.marca_id),
                ).includes(id);
              return (
                <label className="d-block mb-2" key={id}>
                  <input
                    type="checkbox"
                    disabled={!disponibleEnMarca}
                    checked={disponibleEnMarca && seleccionadas.includes(id)}
                    onChange={(e) =>
                      cambiar(
                        "ubicaciones_alarma",
                        e.target.checked
                          ? [...seleccionadas, id]
                          : seleccionadas.filter((u) => u !== id),
                      )
                    }
                  />{" "}
                  {nombre}
                  {!disponibleEnMarca && " · No habilitada en la marca"}
                </label>
              );
            })}
          </fieldset>
        )}
        <Campo titulo="Nombre">
          <input
            className="form-control"
            required
            minLength={2}
            maxLength={grupo === "items" ? 150 : 100}
            value={item.nombre}
            onBlur={(e) =>
              cambiar("nombre", e.target.value.trim().toUpperCase())
            }
            onChange={(e) => cambiar("nombre", e.target.value)}
          />
        </Campo>
        {grupo === "items" && (
          <>
            <Campo titulo="Código">
              <input
                className="form-control"
                required
                maxLength={50}
                value={item.codigo}
                onChange={(e) => cambiar("codigo", e.target.value)}
              />
            </Campo>
            <Campo titulo="Servicio">
              <select
                className="form-select"
                value={item.servicio}
                onChange={(e) =>
                  editar((i) => ({
                    ...i,
                    servicio: e.target.value,
                    tipo: oferta ? "kit" : "adicional",
                    validado_tecnicamente: false,
                    incluidos: [],
                    kits_compatibles: [],
                    precios: {},
                    abonos: {},
                    modalidad: oferta
                      ? e.target.value === "alarma"
                        ? "plan"
                        : "kit"
                      : null,
                    unidad: "unidad",
                  }))
                }
              >
                {Object.entries(servicios).map(([s, n]) => (
                  <option key={s} value={s}>
                    {n}
                  </option>
                ))}
              </select>
            </Campo>
            {oferta && (
              <Campo titulo="Modalidad de equipos">
                <select
                  className="form-select"
                  required
                  value={item.modalidad === "pendiente" ? "" : item.modalidad}
                  onChange={(e) => cambiar("modalidad", e.target.value)}
                >
                  <option value="">Seleccioná…</option>
                  {item.servicio === "alarma" && (
                    <option value="plan">Plan · comodato</option>
                  )}
                  <option value="kit">Kit · venta directa</option>
                </select>
              </Campo>
            )}
            <Campo titulo="Marca">
              <select
                className="form-select"
                required
                value={item.marca_id}
                onChange={(e) =>
                  editar((i) => ({
                    ...i,
                    marca_id: e.target.value,
                    marcas_compatibles: [],
                    validado_tecnicamente: false,
                    incluidos: [],
                    kits_compatibles: [],
                  }))
                }
              >
                <option value="">Seleccioná…</option>
                {marcas.map((m) => (
                  <option
                    key={m.id}
                    value={m.id}
                    disabled={m.estado !== "activo"}
                  >
                    {m.nombre} · {m.estado}
                  </option>
                ))}
              </select>
            </Campo>
            {!oferta &&
              esMarcaComponentes(
                datos.marcas.find((m) => m.id === item.marca_id),
              ) && (
                <fieldset className="mb-3">
                  <legend className="h5">Marcas compatibles</legend>
                  <p>
                    Marcá las marcas que pueden usar este componente. El
                    producto y sus precios se comparten entre ellas.
                  </p>
                  {ordenarAlfabeticamente(datos.marcas)
                    .filter(
                      (m) =>
                        !esMarcaComponentes(m) &&
                        (m.estado === "activo" ||
                          item.marcas_compatibles?.includes(m.id)),
                    )
                    .map((m) => (
                      <label className="d-block" key={m.id}>
                        <input
                          type="checkbox"
                          className="form-check-input me-2"
                          checked={
                            item.marcas_compatibles?.includes(m.id) || false
                          }
                          disabled={
                            m.estado !== "activo" &&
                            !item.marcas_compatibles?.includes(m.id)
                          }
                          onChange={(e) =>
                            editar((i) => ({
                              ...i,
                              marcas_compatibles: e.target.checked
                                ? [...(i.marcas_compatibles || []), m.id]
                                : i.marcas_compatibles.filter(
                                    (id) => id !== m.id,
                                  ),
                              validado_tecnicamente: false,
                            }))
                          }
                        />
                        {m.nombre} · {m.estado}
                      </label>
                    ))}
                </fieldset>
              )}
            {!oferta && (
              <>
                <Campo titulo="Se vende por">
                  <select
                    className="form-select"
                    value={item.unidad}
                    onChange={(e) =>
                      editar((i) => ({
                        ...i,
                        unidad: e.target.value,
                        ...(e.target.value !== "unidad"
                          ? { precios_pack_2: {}, precios_pack_2_usd: {} }
                          : {}),
                      }))
                    }
                  >
                    {["unidad", "pack"].map((u) => (
                      <option key={u} value={u}>
                        {
                          {
                            unidad: "Unidad",
                            pack: "Paquete (pack)",
                          }[u]
                        }
                      </option>
                    ))}
                  </select>
                </Campo>
                {item.tipo === "adicional" && (
                  <label className="d-block mb-3">
                    <input
                      className="form-check-input me-2"
                      type="checkbox"
                      checked={item.adicional_habilitado}
                      onChange={(e) =>
                        cambiar("adicional_habilitado", e.target.checked)
                      }
                    />
                    Ofrecer también como adicional
                  </label>
                )}
              </>
            )}
            <h3 className="h5">Precios finales con IVA</h3>
            <p className="small">
              Vacío significa pendiente; cero es un precio explícito. No se
              modifican cotizaciones anteriores. El precio del plan o kit es
              propio; los componentes incluidos no se suman a ese importe.
            </p>
            {item.precio_unico_anterior !== undefined && (
              <p className="small">
                Precio único anterior: {item.precio_unico_anterior}. Confirmá el
                precio Telefónico; no se asigna automáticamente.
              </p>
            )}
            {!oferta && (
              <Campo titulo="Lista de referencia del producto">
                <select
                  className="form-select"
                  value={item.moneda_referencia || "ARS"}
                  onChange={(e) => cambiar("moneda_referencia", e.target.value)}
                >
                  <option value="ARS">Pesos (ARS)</option>
                  <option value="USD">
                    Dólares (USD) × dólar oficial venta
                  </option>
                </select>
              </Campo>
            )}
            {!oferta && <h4 className="h6">Lista en pesos (ARS)</h4>}
            {precios("precios", niveles)}
            {!oferta && (
              <>
                <h4 className="h6">Lista en dólares (USD)</h4>
                <p className="small">
                  Se utiliza cuando la referencia de este producto es Dólares.
                  El importe final se convierte a pesos con dólar oficial venta.
                </p>
                {precios("precios_usd", niveles)}
              </>
            )}
            {!oferta && item.unidad === "unidad" && (
              <details className="mb-3">
                <summary>Precio especial por cantidad · Pack de 2</summary>
                <p className="small">
                  Cargá el precio total de las dos unidades, sin superar el
                  doble del precio individual. Vacío usa el precio individual.
                  Se aplican packs completos y unidades restantes del mismo
                  nivel; no cuentan incluidos ni bonificados.
                </p>
                <h4 className="h6">Total del pack en pesos (ARS)</h4>
                {precios("precios_pack_2", niveles)}
                <h4 className="h6">Total del pack en dólares (USD)</h4>
                {precios("precios_pack_2_usd", niveles)}
              </details>
            )}
            {oferta &&
              item.servicio === "alarma" &&
              item.modalidad === "plan" && (
                <details className="mb-3">
                  <summary>Abono mensual · con monitoreo</summary>
                  {precios("abonos", ["alto", "medio", "bajo", "telefonico"])}
                </details>
              )}
            {oferta && (
              <section className="mb-3">
                <h3 className="h5">Productos incluidos</h3>
                <p>
                  Indicá cantidades incluidas. Las unidades adicionales se
                  cotizan por separado.
                </p>
                {referencias
                  .filter((i) => i.tipo === "adicional")
                  .map((p) => (
                    <Campo
                      key={p.id}
                      titulo={`${p.codigo} · ${p.nombre} · ${p.estado}`}
                    >
                      <input
                        className="form-control"
                        type="number"
                        min="0"
                        max={
                          p.estado === "activo"
                            ? 9999
                            : item.incluidos.find((c) => c.item_id === p.id)
                                ?.cantidad || 0
                        }
                        step="1"
                        value={
                          item.incluidos.find((c) => c.item_id === p.id)
                            ?.cantidad || 0
                        }
                        onChange={(e) =>
                          cambiar("incluidos", [
                            ...item.incluidos.filter((c) => c.item_id !== p.id),
                            ...(Number(e.target.value) > 0
                              ? [
                                  {
                                    item_id: p.id,
                                    cantidad: Number(e.target.value),
                                  },
                                ]
                              : []),
                          ])
                        }
                      />
                    </Campo>
                  ))}
                {!referencias.some((i) => i.tipo === "adicional") && (
                  <p>
                    No hay productos activos disponibles para esta marca y
                    servicio. Crealos o activalos en Productos.
                  </p>
                )}
              </section>
            )}
            {!oferta && item.tipo === "adicional" && (
              <details className="mb-3">
                <summary>Compatibilidad con planes y kits</summary>
                <p>
                  Sin selección: todos los de las marcas compatibles y el mismo
                  servicio. Confirmá la compatibilidad técnica antes de activar.
                </p>
                {referencias
                  .filter((i) => i.tipo === "kit")
                  .map((k) => (
                    <label className="d-block" key={k.id}>
                      <input
                        className="form-check-input me-2"
                        type="checkbox"
                        checked={item.kits_compatibles.includes(k.id)}
                        onChange={(e) =>
                          cambiar(
                            "kits_compatibles",
                            e.target.checked
                              ? [...item.kits_compatibles, k.id]
                              : item.kits_compatibles.filter(
                                  (id) => id !== k.id,
                                ),
                          )
                        }
                      />
                      {k.nombre} · {k.modalidad} · {k.estado}
                    </label>
                  ))}
              </details>
            )}
            <label className="d-block mb-3">
              <input
                className="form-check-input me-2"
                type="checkbox"
                checked={item.validado_tecnicamente}
                onChange={(e) =>
                  cambiar("validado_tecnicamente", e.target.checked)
                }
              />
              Composición, compatibilidad y unidades validadas técnicamente
            </label>
          </>
        )}
        <Campo titulo="Estado">
          <select
            className="form-select"
            value={item.estado}
            onChange={(e) => cambiar("estado", e.target.value)}
          >
            {estados.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </Campo>
        <div className="d-flex gap-2">
          <button className="btn btn-primary" type="submit">
            Guardar
          </button>
          <button
            className="btn btn-outline-secondary"
            type="button"
            onClick={cancelar}
          >
            Cancelar
          </button>
        </div>
      </fieldset>
    </form>
  );
}
