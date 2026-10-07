import { ubicacionesMarca, ofertaEnUbicacion } from "../../productos/reglas.js";
import { disponibilidadAdicional } from "./disponibilidadAdicional.js";
import { unidadesAdicional, condicionesExtra } from "./unidadesAdicional.js";
import { ordenarItemsCotizacion } from "./ordenarItemsCotizacion.js";
import { propuestaVencida, vencimientoPropuesta } from "../domain/vigencia.js";
import { OfertaComercial } from "./OfertaComercial.jsx";
import { ofertaOfrecida, referenciaOfrecida } from "./ofertaOfrecida.js";
import { enfocarPanel } from "../../../shared/ui/enfocarPanel.js";
import { ordenarAlfabeticamente } from "../../../shared/ui/ordenAlfabetico.js";
import { useEffect, useRef, useState } from "react";
import { PagoOferta } from "./PagoOferta.jsx";
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
import {
  claveBorrador,
  leerBorrador,
  seleccionBorrador,
  reconstruirConceptos,
} from "./borradorCotizacion.js";

const moneda = (valor) => monedaArgentina(valor, "No corresponde");
const activo = (item) => !item.estado || item.estado === "activo";
const niveles = ["catalogo", "alto", "medio", "bajo"];

export function PropuestaComercial({
  gestion,
  oportunidad,
  perfil,
  equipo = [],
  actualizada,
  abierto = false,
  apertura = 0,
  derivar,
  registrarVenta,
}) {
  const [responsableSeguimiento, elegirResponsableSeguimiento] = useState("");
  const panel = useRef(null);
  const panelPago = useRef(null);
  const armado = useRef(null);
  const [mostrarArmado, mostrarConfiguracion] = useState(true);
  const [registrando, mostrarRegistro] = useState(false);
  function cambiarOferta() {
    mostrarRegistro(false);
    confirmarOfrecida(false);
    if (!alternativas.length) mostrarConfiguracion(true);
    requestAnimationFrame(() =>
      enfocarPanel(
        alternativas.length ? primeraOferta.current : armado.current,
      ),
    );
  }
  const [ofrecidaConfirmada, confirmarOfrecida] = useState(false);
  const [aperturaPago, abrirPago] = useState(0);
  useEffect(() => {
    if (aperturaPago) enfocarPanel(panelPago.current);
  }, [aperturaPago]);
  const [avisoBorrador, avisarBorrador] = useState("");
  const [borradorListo, prepararBorrador] = useState(false);
  const guardada = useRef(false);
  const [referencias, cargarReferencias] = useState(null);
  const [revisionReferencias, recargarReferencias] = useState(0);
  useEffect(() => {
    if (
      (apertura > 0 || (abierto && oportunidad.estado !== "recuperacion")) &&
      referencias &&
      panel.current
    ) {
      panel.current.open = true;
      enfocarPanel(panel.current);
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
  const [conceptos, agregarConceptos] = useState([]);
  const [nivelAbono, elegirAbono] = useState("alto");
  const [meses, elegirMeses] = useState(0);
  const [baseEfectivo, elegirEfectivo] = useState("0");
  const [redondeoManual, elegirRedondeo] = useState("0");
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
          if (puedeEditar) {
            try {
              const b = leerBorrador(
                window.localStorage,
                claveBorrador(perfil, oportunidad),
                { catalogo, condiciones },
              );
              if (b) {
                mostrarRegistro(b.vigente && b.conceptos.length > 0);
                mostrarConfiguracion(!b.vigente || !b.calculado);
                restaurarSeleccion(b.seleccion);
                if (b.vigente) {
                  agregarConceptos(
                    reconstruirConceptos(
                      b.conceptos,
                      catalogo.datos,
                      telefonico,
                    ),
                  );
                  elegirEfectivo(b.pago.baseEfectivo);
                  elegirRedondeo(b.pago.redondeoManual || "0");
                  elegirMedio(b.pago.medioSaldo);
                  elegirCuotas(b.pago.cuotas);
                  if (b.calculado)
                    generar(
                      generarAlternativas({
                        distribucionManual: true,
                        catalogo: catalogo.datos,
                        familiaId: b.seleccion.familiaId,
                        kitId: b.seleccion.kitId,
                        nivel: b.seleccion.nivel,
                        subcategoria: b.seleccion.subcategoria,
                        telefonico,
                        extras: Object.entries(b.seleccion.extras)
                          .filter(([, v]) => v.activo)
                          .map(([item_id, v]) => ({
                            item_id,
                            cantidad: v.cantidad,
                            ...condicionesExtra(v),
                          })),
                      }),
                    );
                  avisarBorrador(
                    "Retomaste el borrador de esta negociación. Las ofertas calculadas y el pago se recuperaron.",
                  );
                } else
                  avisarBorrador(
                    "El catálogo o las condiciones cambiaron. Recuperamos tu selección; revisala y calculá los precios vigentes antes de elegir una oferta.",
                  );
              }
            } catch (e) {
              avisarBorrador(
                "No se pudo recuperar todo el borrador. " + e.message,
              );
            }
          }
          prepararBorrador(true);
        }
      })
      .catch((e) => {
        if (vigente) fallar(e.message);
      });
    return () => {
      vigente = false;
    };
  }, [gestion, oportunidad.id, revisionReferencias]);

  function restaurarSeleccion(s) {
    elegirServicio(s.servicio);
    elegirFamilia(s.familiaId);
    elegirModalidadEquipo(s.modalidadEquipo);
    elegirKit(s.kitId);
    elegirSubcategoria(s.subcategoria);
    elegirExtras(s.extras);
    elegirNivel(s.nivel);
    elegirAbono(s.nivelAbono);
    elegirMeses(s.meses);
  }
  const borrador = JSON.stringify({
    esquema: 1,
    catalogo: referencias?.catalogo.version,
    tipo_cambio_id: referencias?.catalogo.datos.tipo_cambio?.id || null,
    condiciones: referencias?.condiciones.version,
    seleccion: {
      servicio,
      familiaId,
      modalidadEquipo,
      kitId,
      subcategoria,
      extras,
      nivel,
      nivelAbono,
      meses,
    },
    calculado: alternativas.length > 0,
    conceptos: conceptos.map(seleccionBorrador),
    pago: { baseEfectivo, medioSaldo, cuotas, redondeoManual },
  });
  useEffect(() => confirmarOfrecida(false), [borrador]);
  useEffect(() => {
    if (!borradorListo || !puedeEditar || guardada.current) return;
    try {
      window.localStorage.setItem(claveBorrador(perfil, oportunidad), borrador);
    } catch {
      avisarBorrador(
        "Este navegador no permite guardar el borrador. Guardá la propuesta ofrecida antes de salir para conservarla.",
      );
    }
  }, [borrador, borradorListo, puedeEditar, perfil.id, oportunidad.id]);

  function invalidar() {
    elegirRedondeo("0");
    mostrarRegistro(false);
    agregarConceptos([]);
    confirmarOfrecida(false);
    generar([]);

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
          <>
            <p role="alert">{error}</p>
            <button
              className="btn btn-outline-primary"
              onClick={() => {
                fallar("");
                recargarReferencias((n) => n + 1);
              }}
            >
              Reintentar carga
            </button>
          </>
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
    (f) =>
      activo(f) &&
      f.servicio === servicio &&
      f.marca !== "COMPONENTES" &&
      (servicio !== "alarma" ||
        ubicacionesMarca(
          catalogo.marcas?.find((m) => m.id === f.marca_id),
        ).includes(subcategoria)),
  );
  const kits = ordenarAlfabeticamente(catalogo.items).filter(
    (i) =>
      activo(i) &&
      i.familia_id === familiaId &&
      i.tipo === "kit" &&
      ofertaEnUbicacion(catalogo, i, subcategoria) &&
      (!(catalogo.esquema >= 2) ||
        i.modalidad === (servicio === "alarma" ? modalidadEquipo : "kit")),
  );
  const kit = kits.find((i) => i.id === kitId);
  const venta =
    catalogo.esquema >= 4 &&
    (servicio === "camaras" || modalidadEquipo === "kit");
  const disponibilidad =
    !venta && servicio === "alarma" && kit
      ? disponibilidadAdicional(
          { catalogo, familiaId, kitId, subcategoria, nivel, telefonico },
          extras,
        )
      : null;
  const adicionales = ordenarItemsCotizacion(catalogo.items, catalogo).filter(
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
  const baseComparacion = alternativas.length
    ? referenciaOfrecida(
        historial,
        oportunidad.ciclo || 1,
        alternativas[0].seleccion,
      )
    : { hayOfrecida: false };
  let pago = null,
    errorPago = "";
  if (conceptos.length)
    try {
      pago = calcularPago({
        total: totalConceptos(conceptos),
        baseEfectivo,
        medioSaldo,
        cuotas,
        redondeoManual,
        porcentajeRedondeo: condiciones.redondeo_maximo_porcentaje ?? "1",
      });
    } catch (e) {
      errorPago = e.message;
    }

  async function confirmar() {
    fallar("");
    ocupar(true);
    invalidar();
    try {
      const [actualizado, condicionesActuales] = await Promise.all([
        gestion.catalogo(oportunidad.id),
        gestion.condiciones(),
      ]);
      cargarReferencias({
        catalogo: actualizado,
        condiciones: condicionesActuales,
      });
      generar(
        generarAlternativas({
          distribucionManual: true,
          catalogo: actualizado.datos,
          familiaId,
          kitId,
          subcategoria,
          nivel,
          telefonico,
          extras: Object.entries(extras)
            .filter(([, v]) => v.activo)
            .map(([item_id, v]) => ({
              item_id,
              cantidad: v.cantidad,
              ...condicionesExtra(v),
            })),
        }),
      );

      mostrarConfiguracion(false);
      mostrarRegistro(false);
    } catch (e) {
      fallar(e.message);
    } finally {
      ocupar(false);
    }
  }
  function agregar(opcion) {
    elegirRedondeo("0");
    if (conAbono && kit?.abonos[nivelAbono] == null) {
      fallar("Falta el precio del abono. Administración debe completarlo.");
      return;
    }
    agregarConceptos([
      {
        ...opcion,
        etiqueta: `${familias.find((f) => f.id === familiaId)?.nombre} · ${kit?.nombre || "Cerco"}`,
        codigo: `SIM-${revision.current}-${opcion.ordinal}`,
        nivel_abono: conAbono ? nivelAbono : null,
        abono: conAbono ? kit.abonos[nivelAbono] : null,
        meses_congelamiento: conAbono ? meses : 0,
      },
    ]);
    confirmarOfrecida(false);
    elegirEfectivo("0");
    mostrarConfiguracion(false);
    mostrarRegistro(true);
    abrirPago((n) => n + 1);
  }
  async function guardar() {
    if (!pago || !ofrecidaConfirmada) return;
    const entrada = {
      oportunidad: oportunidad.id,
      version: oportunidad.version,
      catalogo: referencias.catalogo.version,
      condiciones: referencias.condiciones.version,
      datos: {
        ...(oportunidad.preparacion_compartida && perfil.rol === "administrador"
          ? { responsable_seguimiento_id: responsableSeguimiento }
          : {}),
        conceptos: conceptos.map(
          ({ seleccion, ordinal, nivel_abono, meses_congelamiento }) => ({
            seleccion,
            ordinal,
            nivel_abono,
            meses_congelamiento,
          }),
        ),
        pago: {
          base_efectivo: baseEfectivo,
          medio_saldo: medioSaldo,
          cuotas,
          redondeo_manual: redondeoManual,
        },
      },
    };
    const clave = JSON.stringify(entrada);
    if (intento.current?.clave !== clave)
      intento.current = { clave, id: crypto.randomUUID() };
    ocupar(true);
    fallar("");
    try {
      await gestion.guardarPropuesta({ ...entrada, id: intento.current.id });
      guardada.current = true;
      try {
        window.localStorage.setItem(
          claveBorrador(perfil, oportunidad),
          JSON.stringify({
            ...JSON.parse(borrador),
            conceptos: [],
            pago: { baseEfectivo: "0", medioSaldo, cuotas },
          }),
        );
      } catch {
        /* El guardado del servidor ya fue confirmado. */
      }
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
      tabIndex={-1}
      className="detalle-secundario my-4"
      open={abierto || undefined}
    >
      <summary>
        {puedeEditar ? "Preparar cotización" : "Consultar cotizaciones"} · kits,
        adicionales y pago
      </summary>
      {historial.length > 0 && (
        <section
          className="border rounded p-3 my-3"
          aria-label="Última propuesta guardada"
        >
          <h3 className="h5">
            <span className="badge bg-success me-2">Última ofrecida</span>
            Última propuesta guardada
            {historial[0].ciclo !== (oportunidad.ciclo || 1)
              ? " · ciclo anterior"
              : ""}
          </h3>
          <p className="small">
            Referencia interna:{" "}
            <strong>
              {historial[0].codigo_interno || historial[0].detalle.codigo}
            </strong>
          </p>
          <p className="mb-1">
            <strong>Pago inicial: {moneda(historial[0].detalle.total)}</strong>{" "}
            · Abono mensual: {moneda(historial[0].detalle.abono)}
          </p>
          <p
            className={
              propuestaVencida(historial[0]) ? "text-danger fw-bold" : "small"
            }
          >
            {propuestaVencida(historial[0])
              ? "Cotización vencida · recalculá y registrá una nueva oferta para confirmar la venta."
              : `Válida hasta ${new Date(vencimientoPropuesta(historial[0])).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} (AR).`}
          </p>
          {Number(historial[0].detalle.redondeo_manual) > 0 && (
            <p className="small">
              Redondeo comercial aplicado:{" "}
              {moneda(historial[0].detalle.redondeo_manual)}.
            </p>
          )}
          <ul>
            {historial[0].detalle.conceptos.map((c, i) => (
              <li key={i}>
                {c.kit?.nombre || c.familia} ·{" "}
                {ordenarItemsCotizacion(c.extras, catalogo)
                  .map(
                    (e) =>
                      `${e.cantidad} × ${e.nombre}${e.packs?.length ? " · precio especial por cantidad" : ""}`,
                  )
                  .join(", ") || "Sin adicionales"}
              </li>
            ))}
          </ul>
          <p>
            Forma de pago: {historial[0].detalle.pago.medio_saldo} ·{" "}
            {historial[0].detalle.pago.cantidad_cuotas} cuota(s) de{" "}
            {moneda(historial[0].detalle.pago.cuota)}
            {historial[0].detalle.pago.cuota !==
            historial[0].detalle.pago.ultima_cuota
              ? `; última de ${moneda(historial[0].detalle.pago.ultima_cuota)}`
              : ""}
            . Efectivo: {moneda(historial[0].detalle.pago.efectivo_a_abonar)}.
          </p>
          {puedeEditar && (
            <button
              type="button"
              className="btn btn-outline-primary"
              onClick={() => {
                try {
                  const ultima = historial[0],
                    c = ultima.detalle.conceptos[0],
                    s = c.seleccion;
                  const item = catalogo.items.find((i) => i.id === s.kit_id);
                  if (!item)
                    throw new Error("El plan o kit ya no está disponible.");
                  restaurarSeleccion({
                    servicio: item.servicio,
                    familiaId: s.familia_id,
                    modalidadEquipo: item.modalidad,
                    kitId: s.kit_id,
                    subcategoria:
                      s.ubicacion_alarma || s.subcategoria || "sin_monitoreo",
                    extras: Object.fromEntries(
                      s.extras.map((e) => [
                        e.item_id,
                        {
                          activo: true,
                          cantidad: e.cantidad,
                          bajos: e.bajos,
                          bonificados: e.bonificados,
                          telefonicos: e.telefonicos,
                        },
                      ]),
                    ),
                    nivel: s.nivel,
                    nivelAbono: c.nivel_abono || "alto",
                    meses: c.meses_congelamiento || 0,
                  });
                  invalidar();
                  agregarConceptos([]);
                  elegirEfectivo("0");
                  elegirMedio("debito");
                  elegirCuotas(1);
                  if (
                    !propuestaVencida(ultima) &&
                    ultima.catalogo_version === referencias.catalogo.version &&
                    ultima.condiciones_version ===
                      referencias.condiciones.version
                  ) {
                    generar(
                      generarAlternativas({
                        distribucionManual: true,
                        catalogo,
                        familiaId: s.familia_id,
                        kitId: s.kit_id,
                        nivel: s.nivel,
                        subcategoria: s.ubicacion_alarma || s.subcategoria,
                        telefonico,
                        extras: s.extras,
                      }),
                    );
                    mostrarConfiguracion(false);
                    avisarBorrador(
                      "Propuesta recuperada para preparar una nueva revisión. La propuesta original se conserva.",
                    );
                  } else {
                    mostrarConfiguracion(true);
                    avisarBorrador(
                      "Recuperamos la selección del primer plan o kit. Los precios o condiciones cambiaron: calculá una nueva oferta. La propuesta original se conserva.",
                    );
                  }
                } catch (e) {
                  fallar(e.message);
                }
              }}
            >
              {propuestaVencida(historial[0])
                ? "Recalcular cotización vencida"
                : "Seguir negociando"}
            </button>
          )}
          {registrarVenta &&
            historial[0].ciclo === (oportunidad.ciclo || 1) && (
              <button
                type="button"
                className="btn btn-primary ms-2"
                onClick={registrarVenta}
              >
                Registrar venta
              </button>
            )}
          {derivar && (
            <button
              type="button"
              className="btn btn-outline-primary ms-2"
              onClick={derivar}
            >
              Derivar a Recuperación comercial
            </button>
          )}
        </section>
      )}
      {puedeEditar && (
        <p className="small" role="status">
          {avisoBorrador || "Borrador guardado en este navegador."}
        </p>
      )}
      <details className="my-3">
        <summary>Ayuda para cotizar</summary>
        <p>
          Guardar la cotización no confirma una venta. Si el cliente acepta,
          elegí Registrar venta concretada en «Seguimiento, visitas y cierre de
          la negociación».
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
      </details>
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      {puedeEditar && (
        <fieldset disabled={ocupado}>
          <legend className="h5">Cotizador</legend>
          {catalogo.tipo_cambio && (
            <p className="small">
              Adicionales calculados en pesos con dólar oficial venta:{" "}
              <strong>{moneda(catalogo.tipo_cambio.venta)}</strong>. Fuente:
              DolarAPI ·{" "}
              {new Date(catalogo.tipo_cambio.fechaActualizacion).toLocaleString(
                "es-AR",
                { timeZone: "America/Argentina/Buenos_Aires" },
              )}{" "}
              (AR). Al calcular se verifica nuevamente la cotización.
            </p>
          )}
          {![4, 5, 6, 7].includes(catalogo.esquema) ||
          !catalogo.items.length ? (
            <p>
              Administración debe revisar y guardar el catálogo actualizado y
              habilitar sus productos y precios.
            </p>
          ) : (
            <>
              <details
                ref={armado}
                tabIndex={-1}
                className="border rounded p-3 mb-3"
                open={mostrarArmado}
                onToggle={(e) => mostrarConfiguracion(e.currentTarget.open)}
              >
                <summary className="fw-bold">
                  1. Armar oferta · {kit?.nombre || "Elegí un plan o kit"}
                  <span className="btn btn-primary btn-sm ms-3 my-1">
                    Modificar
                  </span>
                </summary>
                <div className="row g-3 mt-1">
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
                  {servicio === "alarma" && (
                    <label className="col-md-6">
                      Ubicación de la alarma
                      <select
                        className="form-select"
                        value={subcategoria}
                        onChange={(e) => {
                          elegirSubcategoria(e.target.value);
                          cambiarFamilia("");
                          elegirMeses(0);
                          invalidar();
                        }}
                      >
                        <option value="">
                          Seleccioná la ubicación para cotizar…
                        </option>
                        {Object.entries(subcategorias).map(([id, nombre]) => (
                          <option key={id} value={id}>
                            {nombre}
                          </option>
                        ))}
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
                      Nivel del plan o kit
                      <select
                        className="form-select"
                        value={nivel}
                        onChange={(e) => {
                          elegirNivel(e.target.value);
                          invalidar();
                        }}
                      >
                        {[
                          ...niveles,
                          ...(telefonico ? ["telefonico"] : []),
                        ].map((n) => (
                          <option key={n} value={n}>
                            {n === "catalogo"
                              ? "Catálogo"
                              : n === "telefonico"
                                ? "Telefónico"
                                : n[0].toUpperCase() + n.slice(1)}
                          </option>
                        ))}
                      </select>
                    </label>
                  )}
                </div>
                {kit && (
                  <p className="small mt-2">
                    Incluido en el kit:{" "}
                    {ordenarItemsCotizacion(kit.incluidos, catalogo)
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
                  {disponibilidad && (
                    <p className="small text-muted">
                      Las opciones se actualizan según el margen disponible y
                      las condiciones de todos los adicionales.
                    </p>
                  )}
                  {disponibilidad?.errorActual && (
                    <p role="alert" className="text-danger">
                      {disponibilidad.errorActual} Podés pasar unidades a precio
                      Alto o quitar adicionales para revisar la selección.
                    </p>
                  )}
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
                                ...extras[i.id],
                                cantidad: extras[i.id]?.cantidad || "1",
                                ...(!venta
                                  ? {
                                      unidades: unidadesAdicional(
                                        extras[i.id] || { cantidad: 1 },
                                      ),
                                    }
                                  : {}),
                                activo: e.target.checked,
                              },
                            });
                            invalidar();
                          }}
                        />{" "}
                        {i.nombre}
                      </label>
                      {extras[i.id]?.activo && (
                        <label className="d-inline-flex align-items-center gap-2 mb-0">
                          <input
                            className="form-control"
                            style={{ width: "6rem" }}
                            aria-label={`Cantidad de ${i.nombre}`}
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
                                  ...(!venta
                                    ? {
                                        unidades: unidadesAdicional(
                                          extras[i.id],
                                          e.target.value,
                                        ),
                                      }
                                    : {}),
                                  ...(venta ? { telefonicos: undefined } : {}),
                                },
                              });
                              invalidar();
                            }}
                          />
                          <span>
                            {i.unidad === "metro"
                              ? Number(extras[i.id].cantidad) === 1
                                ? "Metro"
                                : "Metros"
                              : Number(extras[i.id].cantidad) === 1
                                ? "Unidad"
                                : "Unidades"}
                          </span>
                        </label>
                      )}
                      {extras[i.id]?.activo &&
                        !venta &&
                        servicio === "alarma" && (
                          <div className="w-100 ps-3">
                            {unidadesAdicional(extras[i.id]).map(
                              (condicion, indice) => {
                                const opciones = [
                                  [
                                    "bonificados",
                                    "Bonificado · $ 0,00",
                                    !["docta", "nobu"].includes(subcategoria) &&
                                      nivel !== "telefonico",
                                  ],
                                  [
                                    "altos",
                                    "Precio Alto · " + moneda(i.precios.alto),
                                    true,
                                  ],
                                  [
                                    "bajos",
                                    "Precio Bajo · " + moneda(i.precios.bajo),
                                    true,
                                  ],
                                  [
                                    "telefonicos",
                                    "Precio Telefónico · " +
                                      moneda(i.precios.telefonico),
                                    telefonico && nivel === "telefonico",
                                  ],
                                ];
                                return (
                                  <label
                                    key={indice}
                                    className="row align-items-center g-2 mb-2"
                                  >
                                    <span className="col-md-5">
                                      {i.nombre} {indice + 1}
                                    </span>
                                    <span className="col-md-7">
                                      <select
                                        className="form-select"
                                        aria-label={
                                          "Condición de " +
                                          i.nombre +
                                          " " +
                                          (indice + 1)
                                        }
                                        value={condicion}
                                        onChange={(e) => {
                                          const unidades = unidadesAdicional(
                                            extras[i.id],
                                          );
                                          unidades[indice] = e.target.value;
                                          elegirExtras({
                                            ...extras,
                                            [i.id]: {
                                              ...extras[i.id],
                                              unidades,
                                            },
                                          });
                                          invalidar();
                                        }}
                                      >
                                        <option value="">
                                          Seleccioná una condición
                                        </option>
                                        {opciones
                                          .filter(
                                            ([valor, , habilitado]) =>
                                              habilitado || valor === condicion,
                                          )
                                          .map(([valor, texto, habilitado]) => (
                                            <option
                                              key={valor}
                                              value={valor}
                                              disabled={
                                                !habilitado ||
                                                !!disponibilidad?.motivo(
                                                  i.id,
                                                  indice,
                                                  valor,
                                                )
                                              }
                                            >
                                              {texto}
                                              {!habilitado
                                                ? " · No disponible: cambiar"
                                                : disponibilidad?.motivo(
                                                      i.id,
                                                      indice,
                                                      valor,
                                                    )
                                                  ? " · No disponible con la selección actual"
                                                  : ""}
                                            </option>
                                          ))}
                                      </select>
                                    </span>
                                  </label>
                                );
                              },
                            )}
                            {i.precios_pack_2 &&
                              Object.keys(i.precios_pack_2).length > 0 && (
                                <p className="small text-muted mb-1">
                                  Precios por unidad. Al calcular se aplican los
                                  packs disponibles a las unidades de la misma
                                  tarifa.
                                </p>
                              )}
                          </div>
                        )}
                    </div>
                  ))}
                </fieldset>
                <details className="my-3" open>
                  <summary>
                    Ajustar condiciones · precios y congelamiento
                  </summary>
                  {venta && (
                    <p>
                      Precio del kit: Telefónico. Los adicionales se suman
                      también a precio Telefónico. Los componentes incluidos no
                      se cobran nuevamente.
                    </p>
                  )}
                  {conAbono && (
                    <div className="row g-3 mb-3">
                      <label className="col-md-6">
                        Nivel del abono (independiente)
                        <select
                          className="form-select"
                          value={nivelAbono}
                          onChange={(e) => {
                            elegirAbono(e.target.value);
                            invalidar();
                          }}
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
                          onChange={(e) => {
                            elegirMeses(Number(e.target.value));
                            invalidar();
                          }}
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
                </details>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={confirmar}
                >
                  Calcular
                </button>
              </details>
              {!!alternativas.length && !registrando && (
                <div className="my-3">
                  <h3 className="h5">2. Presentar al cliente</h3>
                  <p className="small">
                    Oferta inicial según las condiciones seleccionadas.
                  </p>
                  {alternativas.slice(0, 1).map((a) => (
                    <OfertaComercial
                      referencia={a.ordinal === 1 ? primeraOferta : undefined}
                      key={a.ordinal}
                      alternativa={a}
                      ofrecida={ofertaOfrecida(a, historial, {
                        ciclo: oportunidad.ciclo || 1,
                        catalogo: referencias.catalogo.version,
                        condiciones: referencias.condiciones.version,
                        nivelAbono: conAbono ? nivelAbono : null,
                        meses: conAbono ? meses : 0,
                      })}
                      anterior={
                        baseComparacion.hayOfrecida
                          ? baseComparacion.referencia
                          : alternativas[a.ordinal - 2]
                      }
                      ofrecidaNoComparable={
                        baseComparacion.hayOfrecida &&
                        !baseComparacion.referencia
                      }
                      catalogo={catalogo}
                      kit={kit}
                      revision={revision.current}
                      conAbono={conAbono}
                      nivelAbono={nivelAbono}
                      meses={meses}
                      agregar={agregar}
                    />
                  ))}
                </div>
              )}
            </>
          )}
          {!!conceptos.length && registrando && (
            <div
              className="border rounded p-3 my-3"
              ref={panelPago}
              tabIndex={-1}
            >
              <h3 className="h5">3. Registrar lo ofrecido</h3>
              <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
                <div>
                  {conceptos.map((c, i) => (
                    <div key={i}>
                      <strong>{c.etiqueta}</strong>
                      <p className="mb-1">
                        Abono mensual: <strong>{moneda(c.abono)}</strong>
                        {c.meses_congelamiento > 0 &&
                          " · congelado " + c.meses_congelamiento + " meses"}
                      </p>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-outline-primary align-self-start"
                  onClick={cambiarOferta}
                >
                  Cambiar oferta
                </button>
              </div>
              <PagoOferta
                total={totalConceptos(conceptos)}
                pago={pago}
                error={errorPago}
                baseEfectivo={baseEfectivo}
                medioSaldo={medioSaldo}
                cuotas={cuotas}
                redondeoManual={redondeoManual}
                porcentajeRedondeo={
                  condiciones.redondeo_maximo_porcentaje ?? "1"
                }
                cambiarRedondeo={(valor) => {
                  elegirRedondeo(valor);
                  confirmarOfrecida(false);
                }}
                cambiar={({ base, medio, cantidad }) => {
                  elegirEfectivo(base);
                  elegirMedio(medio);
                  elegirCuotas(cantidad);
                  confirmarOfrecida(false);
                }}
              />
              {oportunidad.preparacion_compartida &&
                (perfil.rol === "vendedor" ? (
                  <p>
                    Al registrar esta primera oferta quedarás como responsable
                    del seguimiento.
                  </p>
                ) : (
                  <label className="d-block mb-3">
                    Vendedor responsable del seguimiento
                    <select
                      className="form-select"
                      value={responsableSeguimiento}
                      onChange={(e) => {
                        elegirResponsableSeguimiento(e.target.value);
                        confirmarOfrecida(false);
                      }}
                    >
                      <option value="">Seleccioná un vendedor…</option>
                      {equipo
                        .filter((p) => p.rol === "vendedor")
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.nombre}
                          </option>
                        ))}
                    </select>
                  </label>
                ))}
              <label className="d-block mb-3">
                <input
                  type="checkbox"
                  checked={ofrecidaConfirmada}
                  onChange={(e) => confirmarOfrecida(e.target.checked)}
                />{" "}
                <strong>Ya se la presenté al cliente</strong> con estos importes
                y forma de pago.
              </label>
              <button
                type="button"
                className="btn btn-primary"
                disabled={
                  !pago ||
                  !ofrecidaConfirmada ||
                  (oportunidad.preparacion_compartida &&
                    perfil.rol === "administrador" &&
                    !responsableSeguimiento)
                }
                onClick={guardar}
              >
                {ocupado ? "Guardando…" : "Registrar ofrecimiento"}
              </button>
              <details className="small mt-3">
                <summary>Qué se registra</summary>
                <p>
                  Esta oferta reemplaza a la anterior como referencia; no suma
                  sus importes. Las anteriores quedan en el historial.
                </p>
                <p className="small mt-2">
                  No registra una venta ni un cobro. El servidor valida precios
                  y permisos vigentes.
                </p>
                {derivar && (
                  <p>
                    Si no avanza, registrá primero lo ofrecido. Después usá{" "}
                    <strong>Derivar a Recuperación comercial</strong> para
                    enviar el contexto al agente.
                  </p>
                )}
              </details>
            </div>
          )}
        </fieldset>
      )}
      <details className="mt-3">
        <summary>
          Historial de ofrecimientos · últimas 20 propuestas accesibles
        </summary>
        {!historial.length && <p>Sin propuestas estructuradas accesibles.</p>}
        {historial.map((p) => (
          <article key={p.id} className="border-bottom py-3">
            <span className="badge bg-secondary me-2">
              Ofrecimiento registrado
            </span>
            <strong>{p.codigo_interno || p.detalle.codigo}</strong>
            <p>
              Ciclo {p.ciclo} · catálogo {p.catalogo_version} · inicial{" "}
              {moneda(p.detalle.total)} · abono {moneda(p.detalle.abono)}
            </p>
            {Number(p.detalle.redondeo_manual) > 0 && (
              <p>Redondeo comercial: {moneda(p.detalle.redondeo_manual)}.</p>
            )}
            {p.detalle.conceptos.map((c, i) => (
              <p key={i}>
                {c.tipo_cambio && (
                  <span className="d-block">
                    Adicionales: lista USD · dólar oficial venta{" "}
                    {moneda(c.tipo_cambio.venta)} ·{" "}
                    {new Date(c.tipo_cambio.fechaActualizacion).toLocaleString(
                      "es-AR",
                      { timeZone: "America/Argentina/Buenos_Aires" },
                    )}{" "}
                    (AR).
                  </span>
                )}
                {c.marca || c.familia} ·{" "}
                {c.modalidad === "plan"
                  ? "Plan (comodato)"
                  : c.modalidad === "kit"
                    ? "Kit (venta directa)"
                    : ""}{" "}
                · {c.kit?.nombre || "Cerco"} · {c.seleccion.nivel} ·{" "}
                {ordenarItemsCotizacion(c.extras, catalogo)
                  .map(
                    (e) =>
                      `${e.cantidad} × ${e.nombre} (${e.distribucion.bonificados || 0} bonificados)${e.propiedad ? ` · ${e.propiedad.comodato} en comodato / ${e.propiedad.cliente} del cliente (${e.propiedad.obsequio} de obsequio)` : ""}`,
                  )
                  .join(", ")}
                {c.extras.flatMap((e) =>
                  (e.packs || []).map((p) => (
                    <span className="d-block" key={e.item_id + p.nivel}>
                      {e.nombre}: {p.packs} pack(s) de 2 · {p.nivel}
                      {p.individuales ? " + 1 individual" : ""} · Ahorro por
                      cantidad: {moneda(p.ahorro)}
                    </span>
                  )),
                )}
                {c.modalidad && (
                  <span className="d-block">
                    Incluidos:{" "}
                    {ordenarItemsCotizacion(c.kit?.incluidos || [], catalogo)
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
