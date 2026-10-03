import { OfertaComercial } from "./OfertaComercial.jsx";
import { enfocarPanel } from "../../../shared/ui/enfocarPanel.js";
import { ordenarAlfabeticamente } from "../../../shared/ui/ordenAlfabetico.js";
import { useEffect, useRef, useState } from "react";
import { CampoImporte } from "../../../shared/ui/CampoImporte.jsx";
import { monedaArgentina } from "../../../shared/ui/importe.js";
import {
  generarAlternativas,
  subcategorias,
  adicionalCompatible,
} from "../domain/alternativas.js";
import { calcularPago } from "../domain/pago.js";
import { totalConceptos } from "../domain/propuesta.js";
import { serviciosInteres } from "../domain/interesComercial.js";
import { puedeCotizar } from "../domain/circuito.js";

const moneda = (valor) => monedaArgentina(valor, "No corresponde");
const activo = (item) => !item.estado || item.estado === "activo";
const niveles = ["catalogo", "alto", "medio", "bajo"];

export function PropuestaComercial({
  gestion,
  oportunidad,
  perfil,
  actualizada,
  abierto = false,
  apertura = 0,
}) {
  const panel = useRef(null);
  const [referencias, cargarReferencias] = useState(null);
  useEffect(() => {
    if ((abierto || apertura > 0) && referencias && panel.current) {
      panel.current.open = true;
      panel.current.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [abierto, apertura, referencias]);
  const [historial, guardarHistorial] = useState([]);
  const [error, fallar] = useState("");
  const [ocupado, ocupar] = useState(false);
  const interes = oportunidad.interes_comercial;
  const [servicio, elegirServicio] = useState(
    interes?.servicios?.find((s) => ["alarma", "camaras"].includes(s)) ||
      "alarma",
  );
  const [familiaId, elegirFamilia] = useState("");
  const [modalidadEquipo, elegirModalidadEquipo] = useState("plan");
  const [kitId, elegirKit] = useState("");
  const [subcategoria, elegirSubcategoria] = useState(
    interes?.servicios?.includes("alarma")
      ? interes.tipo_alarma === "a_definir"
        ? ""
        : interes.tipo_alarma
      : interes
        ? ""
        : "sin_monitoreo",
  );
  const [extras, elegirExtras] = useState({});
  const [nivel, elegirNivel] = useState("catalogo");
  const [alternativas, generar] = useState([]);
  const primeraOferta = useRef(null);
  useEffect(() => {
    if (alternativas.length) enfocarPanel(primeraOferta.current);
  }, [alternativas]);
  const [pagina, paginar] = useState(0);
  const [conceptos, agregarConceptos] = useState([]);
  const [nivelAbono, elegirAbono] = useState("alto");
  const [meses, elegirMeses] = useState(0);
  const [baseEfectivo, elegirEfectivo] = useState("0");
  const [medioSaldo, elegirMedio] = useState("debito");
  const [cuotas, elegirCuotas] = useState(1);
  const intento = useRef(null);
  const revision = useRef(crypto.randomUUID());
  const puedeEditar = puedeCotizar(oportunidad, perfil);
  const telefonico =
    oportunidad.estado === "recuperacion" &&
    ["administrador", "agente"].includes(perfil.rol);

  useEffect(() => {
    let vigente = true;
    Promise.all([
      gestion.catalogo(oportunidad.id),
      gestion.condiciones(),
      gestion.propuestas(oportunidad.id),
    ])
      .then(([catalogo, condiciones, propuestas]) => {
        if (vigente) {
          cargarReferencias({ catalogo, condiciones });
          guardarHistorial(propuestas);
        }
      })
      .catch((e) => {
        if (vigente) fallar(e.message);
      });
    return () => {
      vigente = false;
    };
  }, [gestion, oportunidad.id]);

  function invalidar() {
    generar([]);
    paginar(0);
    revision.current = crypto.randomUUID();
    fallar("");
  }
  function cambiarFamilia(valor) {
    elegirFamilia(valor);
    elegirKit("");
    elegirExtras({});
    elegirNivel("catalogo");
    elegirAbono("alto");
    elegirMeses(0);
    invalidar();
  }
  if (!referencias)
    return (
      <div className="my-3">
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          <p role="status">Cargando propuesta comercial…</p>
        )}
      </div>
    );
  const catalogo = referencias.catalogo.datos;
  const condiciones = referencias.condiciones.datos;
  const familias = ordenarAlfabeticamente(
    catalogo.familias,
    (f) => f.marca || f.nombre,
  ).filter(
    (f) => activo(f) && f.servicio === servicio && f.marca !== "COMPONENTES",
  );
  const kits = ordenarAlfabeticamente(catalogo.items).filter(
    (i) =>
      activo(i) &&
      i.familia_id === familiaId &&
      i.tipo === "kit" &&
      (!(catalogo.esquema >= 2) ||
        i.modalidad === (servicio === "alarma" ? modalidadEquipo : "kit")),
  );
  const kit = kits.find((i) => i.id === kitId);
  const venta =
    catalogo.esquema >= 4 &&
    (servicio === "camaras" || modalidadEquipo === "kit");
  const adicionales = ordenarAlfabeticamente(catalogo.items).filter(
    (i) =>
      activo(i) &&
      adicionalCompatible(catalogo, i, familiaId) &&
      i.tipo !== "kit" &&
      (!(catalogo.esquema >= 2) || i.adicional_habilitado) &&
      (!i.kits_compatibles.length || i.kits_compatibles.includes(kitId)),
  );
  const conAbono =
    !venta && servicio === "alarma" && subcategoria === "con_monitoreo";
  const permiteCongelar =
    perfil.rol === "administrador" ||
    condiciones[`congelamiento_${perfil.rol}`];
  let pago = null,
    errorPago = "";
  if (conceptos.length)
    try {
      pago = calcularPago({
        total: totalConceptos(conceptos),
        baseEfectivo,
        medioSaldo,
        cuotas,
      });
    } catch (e) {
      errorPago = e.message;
    }

  function confirmar() {
    fallar("");
    try {
      generar(
        generarAlternativas({
          catalogo,
          familiaId,
          kitId,
          subcategoria,
          nivel,
          telefonico,
          extras: Object.entries(extras)
            .filter(([, v]) => v.activo)
            .map(([item_id, v]) => ({ item_id, cantidad: v.cantidad })),
        }),
      );
      paginar(0);
    } catch (e) {
      fallar(e.message);
    }
  }
  function agregar(opcion) {
    if (conceptos.length >= 10) {
      fallar("La propuesta admite hasta diez conceptos.");
      return;
    }
    if (conAbono && kit?.abonos[nivelAbono] == null) {
      fallar("Falta el precio del abono. Administración debe completarlo.");
      return;
    }
    agregarConceptos([
      ...conceptos,
      {
        ...opcion,
        etiqueta: `${familias.find((f) => f.id === familiaId)?.nombre} · ${kit?.nombre || "Cerco"}`,
        codigo: `SIM-${revision.current}-${opcion.ordinal}`,
        nivel_abono: conAbono ? nivelAbono : null,
        abono: conAbono ? kit.abonos[nivelAbono] : null,
        meses_congelamiento: conAbono ? meses : 0,
      },
    ]);
    generar([]);
  }
  async function guardar() {
    if (!pago) return;
    const entrada = {
      oportunidad: oportunidad.id,
      version: oportunidad.version,
      catalogo: referencias.catalogo.version,
      condiciones: referencias.condiciones.version,
      datos: {
        conceptos: conceptos.map(
          ({ seleccion, ordinal, nivel_abono, meses_congelamiento }) => ({
            seleccion,
            ordinal,
            nivel_abono,
            meses_congelamiento,
          }),
        ),
        pago: { base_efectivo: baseEfectivo, medio_saldo: medioSaldo, cuotas },
      },
    };
    const clave = JSON.stringify(entrada);
    if (intento.current?.clave !== clave)
      intento.current = { clave, id: crypto.randomUUID() };
    ocupar(true);
    fallar("");
    try {
      await gestion.guardarPropuesta({ ...entrada, id: intento.current.id });
      actualizada();
    } catch (e) {
      fallar(e.message);
    } finally {
      ocupar(false);
    }
  }
  return (
    <details
      ref={panel}
      className="detalle-secundario my-4"
      open={abierto || undefined}
    >
      <summary>
        {puedeEditar ? "Preparar cotización" : "Consultar cotizaciones"} · kits,
        adicionales y pago
      </summary>
      <p>
        Guardar la cotización no confirma una venta. Si el cliente acepta, elegí
        Registrar venta concretada en las acciones de esta ficha.
      </p>
      {interes?.servicios?.length > 0 && (
        <p className="small">
          Servicios de interés:{" "}
          {interes.servicios
            .map(
              (s) =>
                serviciosInteres[s] ||
                (s === "cerco" ? "Cerco eléctrico (histórico)" : s),
            )
            .join(" + ")}
          . Podés ajustar la cotización según el relevamiento.
        </p>
      )}
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      {puedeEditar && (
        <fieldset disabled={ocupado}>
          <legend className="h5">Preparar lo que vas a ofrecer</legend>
          {![4, 5].includes(catalogo.esquema) || !catalogo.items.length ? (
            <p>
              Administración debe revisar y guardar el catálogo actualizado y
              habilitar sus productos y precios.
            </p>
          ) : (
            <>
              <div className="row g-3">
                <label className="col-md-6">
                  Servicio
                  <select
                    className="form-select"
                    value={servicio}
                    onChange={(e) => {
                      elegirServicio(e.target.value);
                      cambiarFamilia("");
                    }}
                  >
                    <option value="alarma">Instalación de Alarma</option>
                    <option value="camaras">Instalación de Cámaras</option>
                  </select>
                </label>
                {catalogo.esquema >= 2 && servicio === "alarma" && (
                  <label className="col-md-6">
                    Modalidad de equipos
                    <select
                      className="form-select"
                      value={modalidadEquipo}
                      onChange={(e) => {
                        elegirModalidadEquipo(e.target.value);
                        cambiarFamilia("");
                      }}
                    >
                      <option value="plan">Plan · comodato</option>
                      <option value="kit">Kit · venta directa</option>
                    </select>
                  </label>
                )}
                <label className="col-md-6">
                  Marca
                  <select
                    className="form-select"
                    value={familiaId}
                    onChange={(e) => cambiarFamilia(e.target.value)}
                  >
                    <option value="">Seleccioná…</option>
                    {familias.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.marca}
                      </option>
                    ))}
                  </select>
                </label>
                {
                  <label className="col-md-6">
                    Plan o kit
                    <select
                      className="form-select"
                      value={kitId}
                      onChange={(e) => {
                        elegirKit(e.target.value);
                        elegirExtras({});
                        invalidar();
                      }}
                    >
                      <option value="">Seleccioná…</option>
                      {kits.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                }
                {servicio === "alarma" && !venta && (
                  <label className="col-md-6">
                    Condición del servicio de alarma
                    <select
                      className="form-select"
                      value={subcategoria}
                      onChange={(e) => {
                        elegirSubcategoria(e.target.value);
                        elegirMeses(0);
                        invalidar();
                      }}
                    >
                      <option value="">
                        Seleccioná la modalidad para cotizar…
                      </option>
                      {Object.entries(subcategorias).map(([id, nombre]) => (
                        <option key={id} value={id}>
                          {nombre}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {kit && (
                <p className="small mt-2">
                  Incluido en el kit:{" "}
                  {kit.incluidos
                    .map(
                      (i) =>
                        `${i.cantidad} × ${catalogo.items.find((x) => x.id === i.item_id)?.nombre || "Componente"}`,
                    )
                    .join(", ")}
                  . Cargá abajo solo cantidades adicionales.
                </p>
              )}
              <fieldset className="my-3">
                <legend className="h6">Adicionales (opcional)</legend>
                {adicionales.map((i) => (
                  <div
                    key={i.id}
                    className="d-flex flex-wrap align-items-center gap-3 my-2"
                  >
                    <label>
                      <input
                        type="checkbox"
                        checked={extras[i.id]?.activo || false}
                        onChange={(e) => {
                          elegirExtras({
                            ...extras,
                            [i.id]: {
                              cantidad: extras[i.id]?.cantidad || "1",
                              activo: e.target.checked,
                            },
                          });
                          invalidar();
                        }}
                      />{" "}
                      {i.nombre} · {i.unidad}
                    </label>
                    {extras[i.id]?.activo && (
                      <label>
                        Cantidad de {i.nombre}
                        <input
                          className="form-control"
                          type="number"
                          min={i.unidad === "metro" ? "0.001" : "1"}
                          max="9999"
                          step={i.unidad === "metro" ? "0.001" : "1"}
                          value={extras[i.id].cantidad}
                          onChange={(e) => {
                            elegirExtras({
                              ...extras,
                              [i.id]: {
                                ...extras[i.id],
                                cantidad: e.target.value,
                              },
                            });
                            invalidar();
                          }}
                        />
                      </label>
                    )}
                  </div>
                ))}
              </fieldset>
              {servicio === "alarma" && !venta && (
                <label className="d-block mb-3">
                  Nivel del plan o kit
                  <select
                    className="form-select"
                    value={nivel}
                    onChange={(e) => {
                      elegirNivel(e.target.value);
                      invalidar();
                    }}
                  >
                    {[...niveles, ...(telefonico ? ["telefonico"] : [])].map(
                      (n) => (
                        <option key={n} value={n}>
                          {n === "catalogo"
                            ? "Catálogo"
                            : n === "telefonico"
                              ? "Telefónico"
                              : n[0].toUpperCase() + n.slice(1)}
                        </option>
                      ),
                    )}
                  </select>
                </label>
              )}
              {venta && (
                <p>
                  Precio del kit: Telefónico. Los adicionales se suman también a
                  precio Telefónico. Los componentes incluidos no se cobran
                  nuevamente.
                </p>
              )}
              {conAbono && (
                <div className="row g-3 mb-3">
                  <label className="col-md-6">
                    Nivel del abono (independiente)
                    <select
                      className="form-select"
                      value={nivelAbono}
                      onChange={(e) => elegirAbono(e.target.value)}
                    >
                      {[
                        "alto",
                        "medio",
                        "bajo",
                        ...(telefonico ? ["telefonico"] : []),
                      ].map((n) => (
                        <option key={n} value={n}>
                          {n} ·{" "}
                          {kit?.abonos[n] == null
                            ? "Precio sin cargar"
                            : moneda(kit.abonos[n])}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="col-md-6">
                    Abono congelado
                    <select
                      className="form-select"
                      value={meses}
                      onChange={(e) => elegirMeses(Number(e.target.value))}
                    >
                      <option value={0}>Sin congelamiento</option>
                      {permiteCongelar &&
                        condiciones.meses_congelamiento.map((n) => (
                          <option key={n} value={n}>
                            {n} meses desde activación (no gratis)
                          </option>
                        ))}
                    </select>
                  </label>
                </div>
              )}
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={confirmar}
              >
                Confirmar y calcular opciones
              </button>
              {!!alternativas.length && (
                <div className="my-3">
                  <p>
                    {alternativas.length} opciones · mayor a menor importe antes
                    del descuento por pago. Elegí la oferta que vas a presentar
                    al cliente; luego podrás combinar medios de pago y guardar
                    la propuesta.
                  </p>
                  {alternativas
                    .slice(pagina * 10, pagina * 10 + 10)
                    .map((a) => (
                      <OfertaComercial
                        referencia={a.ordinal === 1 ? primeraOferta : undefined}
                        key={a.ordinal}
                        alternativa={a}
                        catalogo={catalogo}
                        kit={kit}
                        revision={revision.current}
                        conAbono={conAbono}
                        nivelAbono={nivelAbono}
                        meses={meses}
                        agregar={agregar}
                      />
                    ))}
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={!pagina}
                    onClick={() => paginar(pagina - 1)}
                  >
                    Anterior
                  </button>{" "}
                  Página {pagina + 1}{" "}
                  <button
                    type="button"
                    className="btn btn-outline-secondary"
                    disabled={(pagina + 1) * 10 >= alternativas.length}
                    onClick={() => paginar(pagina + 1)}
                  >
                    Siguiente
                  </button>
                </div>
              )}
            </>
          )}
          {!!conceptos.length && (
            <div className="border rounded p-3 my-3">
              <h3 className="h5">Propuesta conjunta · una sola operación</h3>
              {conceptos.map((c, i) => (
                <div key={i} className="mb-3">
                  <strong>{c.etiqueta}</strong> · {moneda(c.total)} · Abono:{" "}
                  {moneda(c.abono)}
                  {c.meses_congelamiento > 0 &&
                    ` · congelado ${c.meses_congelamiento} meses`}{" "}
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={() =>
                      agregarConceptos(conceptos.filter((_, j) => j !== i))
                    }
                  >
                    Quitar concepto {i + 1}
                  </button>
                </div>
              ))}
              <div className="row g-3">
                <label className="col-md-4">
                  Parte a cancelar en efectivo (antes del 10 %)
                  <CampoImporte
                    decimales={2}
                    value={baseEfectivo}
                    onChange={elegirEfectivo}
                  />
                </label>
                <label className="col-md-4">
                  Medio para el resto
                  <select
                    className="form-select"
                    value={medioSaldo}
                    onChange={(e) => {
                      elegirMedio(e.target.value);
                      elegirCuotas(1);
                    }}
                  >
                    <option value="debito">Débito</option>
                    <option value="transferencia">Transferencia</option>
                    <option value="credito">Crédito</option>
                  </select>
                </label>
                {medioSaldo === "credito" && (
                  <label className="col-md-4">
                    Cuotas sin interés
                    <select
                      className="form-select"
                      value={cuotas}
                      onChange={(e) => elegirCuotas(Number(e.target.value))}
                    >
                      {[1, 3, 6].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
              {errorPago && <p role="alert">{errorPago}</p>}
              {pago && (
                <p className="my-3">
                  Acordado: {moneda(pago.base)} · Descuento:{" "}
                  {moneda(pago.descuento)} · Efectivo a entregar:{" "}
                  {moneda(pago.efectivo_a_abonar)} · Saldo: {moneda(pago.saldo)}{" "}
                  ({pago.cuotas.map(moneda).join(" + ")}) ·{" "}
                  <strong>Total inicial: {moneda(pago.total)}</strong>. Abonos
                  por separado.
                </p>
              )}
              <button
                type="button"
                className="btn btn-primary"
                disabled={!pago}
                onClick={guardar}
              >
                {ocupado ? "Guardando…" : "Guardar como propuesta ofrecida"}
              </button>
              <p className="small mt-2">
                No registra una venta ni un cobro. El servidor valida precios y
                permisos vigentes.
              </p>
            </div>
          )}
        </fieldset>
      )}
      <details className="mt-3">
        <summary>Propuestas guardadas · últimas 20 accesibles</summary>
        {!historial.length && <p>Sin propuestas estructuradas accesibles.</p>}
        {historial.map((p) => (
          <article key={p.id} className="border-bottom py-3">
            <strong>{p.detalle.codigo}</strong>
            <p>
              Ciclo {p.ciclo} · catálogo {p.catalogo_version} · inicial{" "}
              {moneda(p.detalle.total)} · abono {moneda(p.detalle.abono)}
            </p>
            {p.detalle.conceptos.map((c, i) => (
              <p key={i}>
                {c.marca || c.familia} ·{" "}
                {c.modalidad === "plan"
                  ? "Plan (comodato)"
                  : c.modalidad === "kit"
                    ? "Kit (venta directa)"
                    : ""}{" "}
                · {c.kit?.nombre || "Cerco"} · {c.seleccion.nivel} ·{" "}
                {c.extras
                  .map(
                    (e) =>
                      `${e.cantidad} × ${e.nombre} (${e.distribucion.bonificados || 0} bonificados)${e.propiedad ? ` · ${e.propiedad.comodato} en comodato / ${e.propiedad.cliente} del cliente (${e.propiedad.obsequio} de obsequio)` : ""}`,
                  )
                  .join(", ")}
                {c.modalidad && (
                  <span className="d-block">
                    Incluidos:{" "}
                    {c.kit?.incluidos
                      .map(
                        (i) =>
                          `${i.cantidad} × ${i.nombre || i.item_id} · ${i.propiedad === "comodato" ? "comodato" : "propiedad del cliente"}`,
                      )
                      .join(", ")}
                  </span>
                )}
              </p>
            ))}
          </article>
        ))}
      </details>
    </details>
  );
}
