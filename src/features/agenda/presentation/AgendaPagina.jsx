import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  actividadesDelDia,
  diasVista,
  estadosActividad,
  estadoVisible,
  fechaCordoba,
  fechaHoraLocal,
  franjaActividad,
  inicioActividad,
  instanteCordoba,
  sumarDias,
  tiposActividad,
  zonaAgenda,
} from "../domain/actividad.js";
import "./agenda.css";

const mostrar = (valor) =>
  valor
    ? new Intl.DateTimeFormat("es-AR", {
        timeZone: zonaAgenda,
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(valor))
    : "Sin indicar";
const hora = (valor) =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: zonaAgenda,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(valor));

export function FormularioActividad({ seleccion, guardar, cerrar, gestion }) {
  const { actividad: a, accion } = seleccion;
  const [modo, setModo] = useState(a?.estado || "programada");
  const [ocupado, setOcupado] = useState(false),
    [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState(""),
    [coincidencias, setCoincidencias] = useState([]),
    [buscando, setBuscando] = useState(false);
  const [vinculo, setVinculo] = useState(a?.oportunidad_id || "");
  const identidad = useRef(null),
    intento = useRef(null),
    titulo = useRef(null);
  useEffect(() => {
    titulo.current?.focus();
  }, []);
  const general = ["crear", "editar"].includes(accion);
  const realizadas =
    ["finalizar", "corregir"].includes(accion) ||
    (accion === "crear" && modo === "realizada");
  async function buscar() {
    setBuscando(true);
    setError("");
    try {
      setCoincidencias(await gestion.prospectos(busqueda));
    } catch (e) {
      setError(e.message);
    } finally {
      setBuscando(false);
    }
  }
  async function enviar(e) {
    e.preventDefault();
    if (ocupado) return;
    setOcupado(true);
    setError("");
    try {
      const datos = Object.fromEntries(new FormData(e.currentTarget));
      if (general) {
        datos.estado = modo;
        datos.oportunidad_id = vinculo;
      }
      for (const campo of [
        "inicio_previsto",
        "fin_previsto",
        "inicio_real",
        "fin_real",
      ])
        if (campo in datos) datos[campo] = instanteCordoba(datos[campo]);
      if (accion === "finalizar" && a.inicio_real)
        datos.inicio_real = a.inicio_real;
      identidad.current ||= a?.id || crypto.randomUUID();
      const firma = JSON.stringify(datos);
      if (intento.current?.firma !== firma)
        intento.current = { firma, operacion: crypto.randomUUID() };
      await guardar({
        id: identidad.current,
        version: a?.version || 0,
        operacion: intento.current.operacion,
        accion,
        datos,
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }
  const nombres = {
    crear: "Registrar actividad",
    editar: "Editar o reprogramar",
    iniciar: "Iniciar actividad ahora",
    finalizar: "Registrar finalización",
    corregir: "Corregir actividad realizada",
    cancelar: "Cancelar actividad",
  };
  return (
    <section
      className="card agenda-formulario"
      aria-labelledby="titulo-formulario-agenda"
    >
      <div className="card-body">
        <h2
          id="titulo-formulario-agenda"
          className="h4"
          tabIndex={-1}
          ref={titulo}
        >
          {nombres[accion]}
        </h2>
        {a && (
          <p>
            {a.titulo} · {mostrar(a.inicio_previsto || a.inicio_real)}
          </p>
        )}
        <p>
          Horarios de Córdoba. Sin restricciones de 08:00 a 17:00. La
          información es compartida con administración.
        </p>
        <form onSubmit={enviar}>
          <fieldset disabled={ocupado}>
            {accion === "crear" && (
              <label className="d-block mb-3">
                ¿Qué querés registrar?
                <select
                  className="form-select"
                  value={modo}
                  onChange={(e) => setModo(e.target.value)}
                >
                  <option value="programada">
                    Programar una actividad futura
                  </option>
                  <option value="realizada">
                    Registrar una actividad ya realizada
                  </option>
                </select>
              </label>
            )}
            {general && (
              <>
                <label className="d-block mb-3">
                  Tipo
                  <select
                    className="form-select"
                    name="tipo"
                    defaultValue={a?.tipo || "visita"}
                  >
                    {Object.entries(tiposActividad).map(([valor, etiqueta]) => (
                      <option key={valor} value={valor}>
                        {etiqueta}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="d-block mb-3">
                  Título
                  <input
                    className="form-control"
                    name="titulo"
                    minLength={3}
                    maxLength={160}
                    required
                    defaultValue={a?.titulo || ""}
                  />
                </label>
                <label className="d-block mb-3">
                  Nota / lugar o zona
                  <textarea
                    className="form-control"
                    name="nota"
                    maxLength={2000}
                    defaultValue={a?.nota || ""}
                  />
                </label>
                <div className="mb-3">
                  <label className="d-block">
                    Vincular prospecto (opcional)
                    <input
                      className="form-control"
                      value={busqueda}
                      onChange={(e) => setBusqueda(e.target.value)}
                      placeholder="Buscar por nombre, mínimo 2 caracteres"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-outline-secondary btn-sm mt-1"
                    disabled={buscando || busqueda.trim().length < 2}
                    onClick={buscar}
                  >
                    {buscando ? "Buscando…" : "Buscar prospecto"}
                  </button>
                  <label className="d-block mt-2">
                    Prospecto vinculado
                    <select
                      className="form-select"
                      value={vinculo}
                      onChange={(e) => setVinculo(e.target.value)}
                    >
                      <option value="">Sin vínculo</option>
                      {vinculo &&
                        !coincidencias.some((c) => c.id === vinculo) && (
                          <option value={vinculo}>
                            Vínculo seleccionado · {vinculo}
                          </option>
                        )}
                      {coincidencias.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.prospectos.nombre} · {c.necesidad}
                        </option>
                      ))}
                    </select>
                  </label>
                  <small>
                    Hasta 20 coincidencias autorizadas; afiná el nombre si no
                    aparece. No crea un prospecto nuevo.
                  </small>
                </div>
              </>
            )}
            {general && modo === "programada" && (
              <div className="row">
                <label className="col-md-6 mb-3">
                  Inicio previsto
                  <input
                    className="form-control"
                    type="datetime-local"
                    name="inicio_previsto"
                    required
                    defaultValue={fechaHoraLocal(a?.inicio_previsto)}
                  />
                </label>
                <label className="col-md-6 mb-3">
                  Fin previsto (opcional)
                  <input
                    className="form-control"
                    type="datetime-local"
                    name="fin_previsto"
                    defaultValue={fechaHoraLocal(a?.fin_previsto)}
                  />
                </label>
              </div>
            )}
            {realizadas && (
              <>
                <div className="row">
                  <label className="col-md-6 mb-3">
                    Inicio declarado
                    <input
                      className="form-control"
                      type="datetime-local"
                      name="inicio_real"
                      required
                      readOnly={accion === "finalizar" && !!a.inicio_real}
                      defaultValue={fechaHoraLocal(
                        a?.inicio_real || a?.inicio_previsto,
                      )}
                    />
                  </label>
                  <label className="col-md-6 mb-3">
                    Fin declarado
                    <input
                      className="form-control"
                      type="datetime-local"
                      name="fin_real"
                      required
                      defaultValue={fechaHoraLocal(a?.fin_real || new Date())}
                    />
                  </label>
                </div>
                <label className="d-block mb-3">
                  Resultado / anotación
                  <textarea
                    className="form-control"
                    name="resultado"
                    minLength={3}
                    maxLength={2000}
                    required
                    defaultValue={a?.resultado || ""}
                  />
                </label>
              </>
            )}
            {["editar", "cancelar", "corregir"].includes(accion) && (
              <label className="d-block mb-3">
                Motivo del cambio
                <textarea
                  className="form-control"
                  name="motivo"
                  minLength={3}
                  maxLength={2000}
                  required
                />
              </label>
            )}
            {accion === "iniciar" && (
              <p>
                Se registrará el horario actual como inicio declarado. Esto no
                comprueba presencia ni ubicación.
              </p>
            )}
            {accion === "cancelar" && a?.origen === "visita" && (
              <p>
                Cancelar esta actividad no cambia el estado comercial de
                Prospectos. Revisá también esa ficha si corresponde.
              </p>
            )}
            {error && (
              <p className="alert alert-danger" role="alert">
                {error}
              </p>
            )}
            <div className="d-flex gap-2">
              <button className="btn btn-primary" type="submit">
                {ocupado ? "Guardando…" : "Guardar actividad"}
              </button>
              <button
                className="btn btn-outline-secondary"
                type="button"
                onClick={cerrar}
              >
                Cerrar sin guardar
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </section>
  );
}

export function TimelineDia({
  filas,
  dia,
  ahora,
  vendedor,
  seleccionar,
  historial,
}) {
  const actividades = actividadesDelDia(filas, dia, ahora);
  const realizadas = actividades.filter((a) => a.estado === "realizada");
  const nodos = actividades.map((a) => ({
    instante: inicioActividad(a),
    actividad: a,
  }));
  if (fechaCordoba(ahora) === dia)
    nodos.push({ instante: ahora.toISOString(), actual: true });
  nodos.sort((a, b) => new Date(a.instante) - new Date(b.instante));
  return (
    <section className="agenda-dia" aria-label={`Actividades del ${dia}`}>
      <h2 className="h4">
        {new Intl.DateTimeFormat("es-AR", {
          timeZone: zonaAgenda,
          weekday: "long",
          day: "numeric",
          month: "long",
        }).format(new Date(`${dia}T12:00:00-03:00`))}
      </h2>
      <p className="agenda-referencia">
        Referencia laboral 08:00–17:00 ·{" "}
        {actividades.filter((a) => a.estado === "realizada").length} realizadas
        · {actividades.filter((a) => a.estado === "programada").length}{" "}
        programadas
      </p>
      <p className="small">
        Realizadas:{" "}
        {
          realizadas.filter(
            (a) => franjaActividad(a, dia, ahora) === "Dentro de referencia",
          ).length
        }{" "}
        dentro de referencia ·{" "}
        {
          realizadas.filter(
            (a) => franjaActividad(a, dia, ahora) === "Fuera de referencia",
          ).length
        }{" "}
        fuera ·{" "}
        {
          realizadas.filter(
            (a) => franjaActividad(a, dia, ahora) === "Abarca ambos períodos",
          ).length
        }{" "}
        abarcan ambos períodos. Cada actividad se cuenta una sola vez por día;
        no se calculan horas trabajadas.
      </p>
      <p className="small">
        Orden cronológico, sin escala proporcional. Las franjas se calculan
        sobre horarios declarados si existen; en caso contrario, sobre los
        previstos.
      </p>
      {!actividades.length && (
        <p className="alert alert-light">
          Sin actividad registrada para este día. Esto no acredita inactividad
          laboral.
        </p>
      )}
      <ol className="agenda-timeline">
        {nodos.map((n) =>
          n.actual ? (
            <li key="ahora" className="agenda-ahora">
              Ahora · {hora(ahora)}
            </li>
          ) : (
            <li
              key={n.actividad.id}
              className={`agenda-hito agenda-${n.actividad.estado}`}
            >
              <article className="card">
                <div className="card-body">
                  <div className="d-flex flex-wrap gap-2 justify-content-between">
                    <strong>{hora(n.instante)}</strong>
                    <span className="badge bg-light-primary">
                      {estadoVisible(n.actividad, ahora)}
                    </span>
                  </div>
                  <h3 className="h5 mt-2">{n.actividad.titulo}</h3>
                  <p className="mb-1">
                    {tiposActividad[n.actividad.tipo]} ·{" "}
                    {franjaActividad(n.actividad, dia, ahora)}
                  </p>
                  <small className="d-block">
                    {n.actividad.origen === "visita"
                      ? "Coordinada desde Prospectos"
                      : "Anotación del vendedor"}
                  </small>
                  <dl className="small mt-2 mb-2">
                    <dt>Horario previsto</dt>
                    <dd>
                      {mostrar(n.actividad.inicio_previsto)}
                      {n.actividad.fin_previsto &&
                        ` → ${mostrar(n.actividad.fin_previsto)}`}
                    </dd>
                    <dt>Horario declarado</dt>
                    <dd>
                      {mostrar(n.actividad.inicio_real)}
                      {n.actividad.fin_real &&
                        ` → ${mostrar(n.actividad.fin_real)}`}
                    </dd>
                    <dt>Carga / última modificación</dt>
                    <dd>
                      {mostrar(n.actividad.creado_en)} /{" "}
                      {mostrar(n.actividad.actualizado_en)}
                    </dd>
                  </dl>
                  {n.actividad.nota && (
                    <p className="agenda-texto">{n.actividad.nota}</p>
                  )}
                  {n.actividad.resultado && (
                    <p className="agenda-texto">
                      <strong>Resultado o motivo: </strong>
                      {n.actividad.resultado}
                    </p>
                  )}
                  {n.actividad.oportunidad_id && (
                    <Link
                      className="d-block mb-2"
                      to={`/prospectos?id=${n.actividad.oportunidad_id}`}
                    >
                      Abrir prospecto
                      {n.actividad.origen === "visita"
                        ? " / reprogramar visita"
                        : ""}
                    </Link>
                  )}
                  <div className="d-flex flex-wrap gap-2">
                    {vendedor && n.actividad.estado === "programada" && (
                      <>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => seleccionar(n.actividad, "iniciar")}
                        >
                          Iniciar
                        </button>
                        {n.actividad.origen === "manual" && (
                          <button
                            className="btn btn-outline-primary btn-sm"
                            onClick={() => seleccionar(n.actividad, "editar")}
                          >
                            Editar / reprogramar
                          </button>
                        )}
                      </>
                    )}
                    {vendedor &&
                      ["programada", "en_curso"].includes(
                        n.actividad.estado,
                      ) && (
                        <button
                          className="btn btn-outline-primary btn-sm"
                          onClick={() => seleccionar(n.actividad, "finalizar")}
                        >
                          Finalizar
                        </button>
                      )}
                    {vendedor && n.actividad.estado === "realizada" && (
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => seleccionar(n.actividad, "corregir")}
                      >
                        Corregir con motivo
                      </button>
                    )}
                    {["programada", "en_curso"].includes(
                      n.actividad.estado,
                    ) && (
                      <button
                        className="btn btn-outline-secondary btn-sm"
                        onClick={() => seleccionar(n.actividad, "cancelar")}
                      >
                        Cancelar con motivo
                      </button>
                    )}
                    <button
                      className="btn btn-link btn-sm"
                      onClick={() => historial(n.actividad)}
                    >
                      Historial
                    </button>
                  </div>
                </div>
              </article>
            </li>
          ),
        )}
      </ol>
    </section>
  );
}

function HistorialActividad({ actividad, gestion, cerrar }) {
  const [eventos, setEventos] = useState([]),
    [pagina, setPagina] = useState(0),
    [error, setError] = useState(""),
    [cargando, setCargando] = useState(true);
  const titulo = useRef(null);
  useEffect(() => {
    titulo.current?.focus();
  }, []);
  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setError("");
    gestion
      .historial(actividad.id, pagina)
      .then((r) => {
        if (vigente) setEventos(r);
      })
      .catch((e) => {
        if (vigente) setError(e.message);
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, [actividad.id, gestion, pagina]);
  return (
    <section className="card">
      <div className="card-body">
        <h2 className="h4" tabIndex={-1} ref={titulo}>
          Historial · {actividad.titulo}
        </h2>
        <button className="btn btn-outline-secondary mb-3" onClick={cerrar}>
          Cerrar historial
        </button>
        {error && <p role="alert">{error}</p>}
        {cargando ? (
          <p role="status">Cargando historial…</p>
        ) : (
          eventos.map((e) => (
            <details key={e.id} className="border-bottom py-2">
              <summary>
                {mostrar(e.ocurrido_en)} · {e.tipo.replaceAll("_", " ")} ·
                versión {e.nuevo.version}
              </summary>
              <p>Actor: {e.actor_id}</p>
              {e.solicitud.datos?.motivo && (
                <p>Motivo: {e.solicitud.datos.motivo}</p>
              )}
              {[
                ["Anterior", e.anterior],
                ["Registrado", e.nuevo],
              ].map(
                ([nombre, s]) =>
                  s && (
                    <div key={nombre}>
                      <strong>{nombre}</strong>
                      <p>
                        {s.titulo} · {estadosActividad[s.estado]}
                        <br />
                        Previsto: {mostrar(s.inicio_previsto)} →{" "}
                        {mostrar(s.fin_previsto)}
                        <br />
                        Declarado: {mostrar(s.inicio_real)} →{" "}
                        {mostrar(s.fin_real)}
                      </p>
                      <p className="agenda-texto">{s.nota}</p>
                      <p className="agenda-texto">{s.resultado}</p>
                    </div>
                  ),
              )}
            </details>
          ))
        )}
        <div className="d-flex gap-2 mt-3">
          <button
            className="btn btn-outline-secondary"
            disabled={cargando || pagina === 0}
            onClick={() => setPagina(pagina - 1)}
          >
            Anteriores
          </button>
          <button
            className="btn btn-outline-secondary"
            disabled={cargando || eventos.length < 20}
            onClick={() => setPagina(pagina + 1)}
          >
            Más antiguos
          </button>
        </div>
      </div>
    </section>
  );
}

export function AgendaPagina({ gestion, perfil }) {
  const permitido =
    perfil?.activo === true &&
    ["administrador", "vendedor"].includes(perfil.rol);
  return permitido ? (
    <AgendaAutorizada gestion={gestion} perfil={perfil} />
  ) : (
    <div className="alert alert-warning">
      Agenda está disponible para vendedores y administración. Las visitas se
      coordinan desde Prospectos.
    </div>
  );
}
function AgendaAutorizada({ gestion, perfil }) {
  const esVendedor = perfil.rol === "vendedor";
  const [parametros] = useSearchParams(),
    enlace = parametros.get("id");
  const [fecha, setFecha] = useState(fechaCordoba()),
    [semanal, setSemanal] = useState(false),
    [vendedor, setVendedor] = useState(esVendedor ? perfil.id : "");
  const [equipo, setEquipo] = useState([]),
    [filas, setFilas] = useState([]),
    [error, setError] = useState(""),
    [errorEquipo, setErrorEquipo] = useState("");
  const [cargando, setCargando] = useState(false),
    [actualizacion, setActualizacion] = useState(null),
    [revision, setRevision] = useState(0),
    [ahora, setAhora] = useState(new Date());
  const [seleccion, setSeleccion] = useState(null),
    [historial, setHistorial] = useState(null),
    [mensaje, setMensaje] = useState("");
  const dias = diasVista(fecha, semanal),
    desde = dias[0],
    hasta = dias.at(-1);
  useEffect(() => {
    let vigente = true;
    gestion
      .equipo()
      .then((r) => {
        if (vigente) {
          setEquipo(r);
          setErrorEquipo("");
          if (!esVendedor) setVendedor((v) => v || r[0]?.id || "");
        }
      })
      .catch((e) => {
        if (vigente) setErrorEquipo(e.message);
      });
    return () => {
      vigente = false;
    };
  }, [gestion, esVendedor, revision]);
  useEffect(() => {
    if (!enlace) return;
    let vigente = true;
    gestion
      .actividad(enlace)
      .then((a) => {
        if (!vigente) return;
        if (!a) {
          setMensaje("La actividad no está disponible para tu cuenta.");
          return;
        }
        setFecha(fechaCordoba(inicioActividad(a)));
        setSemanal(false);
        setVendedor(a.vendedor_id);
        setMensaje(`Actividad: ${a.titulo}`);
      })
      .catch((e) => {
        if (vigente) setMensaje(e.message);
      });
    return () => {
      vigente = false;
    };
  }, [gestion, enlace]);
  useEffect(() => {
    let vigente = true,
      solicitando = false;
    setFilas([]);
    setActualizacion(null);
    setError("");
    async function cargar() {
      if (!vendedor || solicitando) return;
      solicitando = true;
      setCargando(true);
      try {
        const r = await gestion.listar({ vendedor, desde, hasta });
        if (vigente) {
          setFilas(r);
          setError("");
          setActualizacion(new Date());
        }
      } catch (e) {
        if (vigente) setError(e.message);
      } finally {
        solicitando = false;
        if (vigente) {
          setCargando(false);
          setAhora(new Date());
        }
      }
    }
    cargar();
    const intervalo = setInterval(cargar, 30000);
    window.addEventListener("focus", cargar);
    return () => {
      vigente = false;
      clearInterval(intervalo);
      window.removeEventListener("focus", cargar);
    };
  }, [gestion, vendedor, desde, hasta, revision]);
  function seleccionar(actividad, accion) {
    setHistorial(null);
    setSeleccion({ actividad, accion });
    setMensaje("");
  }
  async function guardar(entrada) {
    await gestion.guardar(entrada);
    setSeleccion(null);
    setMensaje("Actividad guardada.");
    setRevision((r) => r + 1);
  }
  function cambiarContexto(fn) {
    setSeleccion(null);
    setHistorial(null);
    setMensaje("");
    fn();
  }
  return (
    <div className="agenda-pagina">
      <header className="mb-4">
        <p className="text-uppercase small">Organización comercial</p>
        <h1>Agenda{!esVendedor && " · Timeline del equipo"}</h1>
        <p>
          Agenda de trabajo compartida con administración. Las actividades son
          declaradas: no acreditan presencia ni ubicación.
        </p>
      </header>
      <section className="card">
        <div className="card-body">
          <div className="agenda-controles">
            {!esVendedor && (
              <label>
                Vendedor
                <select
                  className="form-select"
                  value={vendedor}
                  onChange={(e) =>
                    cambiarContexto(() => setVendedor(e.target.value))
                  }
                >
                  <option value="">Seleccioná un vendedor</option>
                  {equipo.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                      {!p.activo ? " · Inactivo" : ""}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label>
              Fecha
              <input
                className="form-control"
                type="date"
                required
                value={fecha}
                onChange={(e) => {
                  if (e.target.value)
                    cambiarContexto(() => setFecha(e.target.value));
                }}
              />
            </label>
            <label>
              Vista
              <select
                className="form-select"
                value={semanal ? "semana" : "dia"}
                onChange={(e) =>
                  cambiarContexto(() => setSemanal(e.target.value === "semana"))
                }
              >
                <option value="dia">Día · Timeline</option>
                <option value="semana">Semana · Lunes a domingo</option>
              </select>
            </label>
          </div>
          <div className="d-flex flex-wrap gap-2 mt-3">
            <button
              className="btn btn-outline-secondary"
              onClick={() =>
                cambiarContexto(() =>
                  setFecha(sumarDias(fecha, semanal ? -7 : -1)),
                )
              }
            >
              Anterior
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={() => cambiarContexto(() => setFecha(fechaCordoba()))}
            >
              Hoy
            </button>
            <button
              className="btn btn-outline-secondary"
              onClick={() =>
                cambiarContexto(() =>
                  setFecha(sumarDias(fecha, semanal ? 7 : 1)),
                )
              }
            >
              Siguiente
            </button>
            <button
              className="btn btn-outline-primary"
              onClick={() => setRevision((r) => r + 1)}
              disabled={cargando}
            >
              Actualizar
            </button>
            {esVendedor && (
              <button
                className="btn btn-primary"
                onClick={() => seleccionar(null, "crear")}
              >
                Registrar actividad
              </button>
            )}
          </div>
          <p className="small mt-3 mb-0">
            Actualización cada 30 segundos y al volver a la ventana.{" "}
            {actualizacion && `Última consulta: ${mostrar(actualizacion)}.`} Los
            recordatorios aparecen en la campana con la plataforma abierta,
            desde 30 minutos antes y hasta 24 horas después. No se envían avisos
            externos.
          </p>
        </div>
      </section>
      {mensaje && (
        <p className="alert alert-info" role="status">
          {mensaje}
        </p>
      )}
      {(error || errorEquipo) && (
        <p className="alert alert-danger" role="alert">
          {error || errorEquipo} La información puede no estar actualizada.
        </p>
      )}
      {seleccion && (
        <FormularioActividad
          key={`${seleccion.actividad?.id || "nueva"}-${seleccion.accion}`}
          seleccion={seleccion}
          gestion={gestion}
          guardar={guardar}
          cerrar={() => setSeleccion(null)}
        />
      )}
      {historial && (
        <HistorialActividad
          key={historial.id}
          actividad={historial}
          gestion={gestion}
          cerrar={() => setHistorial(null)}
        />
      )}
      {cargando && !actualizacion && <p role="status">Cargando agenda…</p>}
      {vendedor && actualizacion && (
        <div className={semanal ? "agenda-semana" : ""}>
          {dias.map((dia) => (
            <TimelineDia
              key={dia}
              filas={filas}
              dia={dia}
              ahora={ahora}
              vendedor={esVendedor}
              seleccionar={seleccionar}
              historial={(a) => {
                setSeleccion(null);
                setHistorial(a);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
