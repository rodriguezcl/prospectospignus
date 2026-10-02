import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  accionesPermitidas,
  estados,
  acciones,
  mostrarFecha,
} from "../domain/circuito.js";
import { FormularioOportunidad } from "./FormularioOportunidad.jsx";
import { PropuestaComercial } from "./PropuestaComercial.jsx";
import { CrearProspecto } from "./CrearProspecto.jsx";

export function OportunidadesPagina({
  gestion,
  perfil,
  soloRecuperacion = false,
}) {
  const rutaBandeja = soloRecuperacion ? "/recuperacion" : "/prospectos";
  const [parametros, navegar] = useSearchParams();
  const id = parametros.get("id");
  const nueva = !soloRecuperacion && parametros.has("nueva");
  const [pagina, paginar] = useState(0);
  const [estado, filtrar] = useState(soloRecuperacion ? "recuperacion" : "");
  const [revision, revisar] = useState(0);
  const [busqueda, buscar] = useState("");
  const [lista, listar] = useState({ filas: [], total: 0 });
  const [equipo, guardarEquipo] = useState([]);
  const [detalle, detallar] = useState(null);
  const [error, fallar] = useState("");
  const [mensaje, informar] = useState("");
  const [cargando, cargar] = useState(true);
  const [ocupado, ocupar] = useState(false);
  const intento = useRef(null);
  const idNuevo = useRef(crypto.randomUUID());
  useEffect(() => {
    let vigente = true;
    cargar(true);
    fallar("");
    detallar(null);
    Promise.all([
      gestion.listar({ pagina, estado, busqueda }),
      gestion.equipo(),
      id ? gestion.detalle(id) : null,
    ])
      .then(([l, e, d]) => {
        if (vigente) {
          listar(l);
          guardarEquipo(e);
          detallar(d);
        }
      })
      .catch((e) => {
        if (vigente) fallar(e.message);
      })
      .finally(() => {
        if (vigente) cargar(false);
      });
    return () => {
      vigente = false;
    };
  }, [gestion, id, pagina, estado, busqueda, revision]);
  async function guardar(accion, datos) {
    ocupar(true);
    fallar("");
    informar("");
    const entrada = {
      id: detalle?.id || idNuevo.current,
      version: detalle?.version || 0,
      accion,
      datos,
    };
    const clave = JSON.stringify(entrada);
    if (intento.current?.clave !== clave)
      intento.current = { clave, operacion: crypto.randomUUID() };
    try {
      const resultado = await gestion.guardar({
        ...entrada,
        operacion: intento.current.operacion,
      });
      intento.current = null;
      idNuevo.current = crypto.randomUUID();
      informar(
        accion === "crear"
          ? "Prospecto creado y visita coordinada. Abrí Preparar cotización para armar la propuesta."
          : accion === "ganar"
            ? "Venta confirmada. Ya aparece en Ventas concretadas para el responsable del cierre y administración."
            : "Cambio confirmado y guardado en el historial.",
      );
      navegar({ id: resultado });
      revisar((n) => n + 1);
    } catch (e) {
      fallar(e.message);
    } finally {
      ocupar(false);
    }
  }
  async function disponibilidad(valor) {
    ocupar(true);
    fallar("");
    try {
      await gestion.disponibilidad(valor);
      revisar((n) => n + 1);
      informar(
        "Disponibilidad actualizada. Los casos ya asignados conservan su responsable.",
      );
    } catch (e) {
      fallar(e.message);
    } finally {
      ocupar(false);
    }
  }
  const nombre = (id) =>
    equipo.find((p) => p.id === id)?.nombre ||
    (id ? "Participante histórico" : "Pendiente de asignación");
  const opciones = accionesPermitidas(detalle, perfil);
  return (
    <section aria-labelledby="titulo-oportunidades">
      <h1 id="titulo-oportunidades">
        {soloRecuperacion ? "Recuperación comercial" : "Prospectos"}
      </h1>
      <p className="text-muted">
        {soloRecuperacion
          ? "Retomá los casos derivados y registrá la propuesta final."
          : "Abrí un prospecto para cotizar, coordinar visitas o registrar el resultado comercial."}
      </p>
      <details className="detalle-secundario mb-3">
        <summary>Cómo funciona esta bandeja</summary>
        <p>
          Una ficha por necesidad comercial; un mismo prospecto puede tener
          varios casos. El historial y las acciones se consultan al abrir la
          ficha. Ganada significa aceptación comercial, no instalación.
        </p>
      </details>
      {perfil.rol === "agente" && (
        <label className="alert alert-light d-block">
          <input
            type="checkbox"
            disabled={ocupado || cargando}
            checked={
              equipo.find((p) => p.id === perfil.id)?.disponible || false
            }
            onChange={(e) => disponibilidad(e.target.checked)}
          />{" "}
          Disponible para recibir recuperaciones
        </label>
      )}
      <div className="d-flex flex-wrap gap-2 mb-3">
        <Link to="/prospectos?nueva=si" className="btn btn-primary">
          Crear desde un registro inicial
        </Link>
        <Link to="/registros?nuevo=1" className="btn btn-outline-secondary">
          Cargar registro inicial
        </Link>
        <button
          className="btn btn-outline-primary"
          disabled={ocupado}
          onClick={() => revisar((n) => n + 1)}
        >
          Actualizar
        </button>
      </div>
      {error && (
        <p role="alert" className="alert alert-danger">
          {error}
        </p>
      )}
      {mensaje && (
        <p role="status" className="alert alert-success">
          {mensaje}
        </p>
      )}
      {cargando && <p role="status">Cargando prospectos…</p>}
      {!cargando && nueva && (
        <div className="card">
          <div className="card-body">
            <CrearProspecto
              key={parametros.get("registro") || "buscar"}
              gestion={gestion}
              registroId={parametros.get("registro")}
              perfil={perfil}
              equipo={equipo}
              guardar={guardar}
              ocupado={ocupado}
            />
            <Link to={rutaBandeja}>Cancelar</Link>
          </div>
        </div>
      )}
      {!cargando && detalle && !nueva && (
        <div className="card">
          <div className="card-body">
            <h2 className="h4">
              {detalle.prospectos.nombre} · {estados[detalle.estado]}
            </h2>
            <p>
              {detalle.prospectos.telefono} · {detalle.prospectos.direccion}
            </p>
            <p>{detalle.necesidad}</p>
            {detalle.estado === "ganada" && (
              <p className="alert alert-success">
                Venta concretada. No la vuelvas a cargar.{" "}
                {perfil.rol === "administrador" ||
                detalle.cerrado_por === perfil.id ? (
                  <Link to="/ventas">Consultar en Ventas concretadas</Link>
                ) : (
                  "El cierre se consulta por su responsable y administración."
                )}
              </p>
            )}
            {detalle.periodo_historico && (
              <p className="alert alert-info">
                Importación histórica de {detalle.periodo_historico.slice(0, 7)}
                . Fechas de visita, canal de aceptación y motivo individual no
                informados. El historial conserva el resultado original del mes.
              </p>
            )}
            <dl>
              <dt>Ciclo comercial</dt>
              <dd>{detalle.ciclo || 1}</dd>
              {detalle.responsable_historico_id && (
                <>
                  <dt>Vendedor del histórico</dt>
                  <dd>{nombre(detalle.responsable_historico_id)}</dd>
                </>
              )}
              <dt>Responsable actual</dt>
              <dd>{nombre(detalle.responsable_id)}</dd>
              <dt>Captador / vendedor de visita / responsable al cierre</dt>
              <dd>
                {detalle.prospectos.captado_por
                  ? nombre(detalle.prospectos.captado_por)
                  : "No informado"}{" "}
                /{" "}
                {detalle.vendedor_visita_id
                  ? nombre(detalle.vendedor_visita_id)
                  : "No informado"}{" "}
                /{" "}
                {detalle.cerrado_por
                  ? nombre(detalle.cerrado_por)
                  : "Sin cierre"}
              </dd>
              <dt>Próxima acción · Córdoba</dt>
              <dd>
                {mostrarFecha(detalle.proxima_accion_en)}
                {detalle.proxima_accion_en &&
                new Date(detalle.proxima_accion_en) < new Date()
                  ? " · Vencida"
                  : ""}
              </dd>
              <dt>Último resumen</dt>
              <dd className="texto-con-saltos">{detalle.resumen}</dd>
              {detalle.interes_comercial && (
                <>
                  <dt>Medio de contacto inicial</dt>
                  <dd>
                    {{
                      whatsapp: "WhatsApp",
                      llamada: "Llamada",
                      presencial: "Presencial",
                      correo: "Correo electrónico",
                      otro: "Otro",
                    }[detalle.canal_contacto] || "Sin registrar"}
                  </dd>
                  <dt>Observaciones para la visita</dt>
                  <dd className="texto-con-saltos">
                    {detalle.observaciones_visita || "Sin observaciones"}
                  </dd>
                </>
              )}
              <dt>Condiciones finales</dt>
              <dd className="texto-con-saltos">
                {detalle.condiciones || "Sin registrar"}
              </dd>
            </dl>
            <PropuestaComercial
              key={`propuesta-${detalle.id}-${detalle.version}`}
              gestion={gestion}
              oportunidad={detalle}
              perfil={perfil}
              actualizada={() => {
                informar("Propuesta ofrecida guardada.");
                revisar((n) => n + 1);
              }}
            />
            {opciones.length ? (
              <FormularioOportunidad
                key={`${detalle.id}-${detalle.version}`}
                oportunidad={detalle}
                perfil={perfil}
                equipo={equipo}
                opciones={opciones}
                guardar={guardar}
                ocupado={ocupado}
              />
            ) : (
              <p>
                Consulta de solo lectura: el caso está cerrado o pertenece a
                otro responsable.
              </p>
            )}
            <details className="mt-4">
              <summary>Historial · últimos 100 eventos</summary>
              {detalle.eventos.map((e) => (
                <article className="border-bottom py-3" key={e.id}>
                  <strong>{acciones[e.tipo] || e.tipo}</strong>
                  <p>
                    {mostrarFecha(e.ocurrido_en)} · {nombre(e.actor_id)} ·
                    versión {e.nuevo.version}
                  </p>
                  <p>
                    {estados[e.anterior?.estado] || "Inicio"} →{" "}
                    {estados[e.nuevo.estado]} · {nombre(e.nuevo.responsable_id)}
                  </p>
                  <p className="texto-con-saltos">{e.nuevo.resumen}</p>
                  <p className="texto-con-saltos">{e.nuevo.condiciones}</p>
                  {e.solicitud?.datos?.objecion && (
                    <p>Objeción: {e.solicitud.datos.objecion}</p>
                  )}
                </article>
              ))}
            </details>
            <Link to={rutaBandeja} className="d-inline-block mt-3">
              Volver a la bandeja
            </Link>
          </div>
        </div>
      )}
      {!nueva && !id && (
        <div className="card">
          <div className="card-body">
            <form
              className="d-flex flex-wrap align-items-end gap-2 mb-3"
              onSubmit={(e) => {
                e.preventDefault();
                buscar(new FormData(e.currentTarget).get("nombre") || "");
                paginar(0);
              }}
            >
              <label>
                Buscar prospecto por nombre
                <input
                  type="search"
                  name="nombre"
                  className="form-control"
                  maxLength={150}
                />
              </label>
              <button className="btn btn-outline-primary">Buscar</button>
            </form>
            <label className="mb-3">
              Filtrar etapa
              <select
                className="form-select"
                value={estado}
                onChange={(e) => {
                  filtrar(e.target.value);
                  paginar(0);
                }}
              >
                {!soloRecuperacion && (
                  <option value="">Todas las etapas accesibles</option>
                )}
                <option value="sin_asignar">
                  Recuperaciones pendientes de asignación
                </option>
                {Object.entries(estados)
                  .filter(([id]) => !soloRecuperacion || id === "recuperacion")
                  .map(([id, texto]) => (
                    <option key={id} value={id}>
                      {texto}
                    </option>
                  ))}
              </select>
            </label>
            {perfil.rol === "agente" && soloRecuperacion && (
              <p className="small text-muted">
                Recuperación es una bandeja común. Solo podés gestionar tus
                casos; los pendientes se distribuyen equilibradamente.
              </p>
            )}
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Prospecto / necesidad</th>
                    <th>Etapa</th>
                    <th>Responsable</th>
                    <th>Próxima acción · Córdoba</th>
                    <th>Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.filas.map((o) => (
                    <tr key={o.id}>
                      <td>
                        {o.prospectos.nombre}
                        <small className="d-block">{o.necesidad}</small>
                      </td>
                      <td>{estados[o.estado]}</td>
                      <td>{nombre(o.responsable_id)}</td>
                      <td>
                        {mostrarFecha(o.proxima_accion_en)}
                        {o.proxima_accion_en &&
                          new Date(o.proxima_accion_en) < new Date() && (
                            <span className="d-block text-danger">Vencida</span>
                          )}
                      </td>
                      <td>
                        <Link to={`${rutaBandeja}?id=${o.id}`}>Abrir</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!cargando && !lista.filas.length && (
              <p>No hay prospectos para este filtro.</p>
            )}
            <div className="d-flex gap-3 align-items-center">
              <button
                className="btn btn-outline-secondary"
                disabled={!pagina || cargando}
                onClick={() => paginar(pagina - 1)}
              >
                Anterior
              </button>
              <span>
                {lista.total} casos comerciales · página {pagina + 1}
              </span>
              <button
                className="btn btn-outline-secondary"
                disabled={(pagina + 1) * 20 >= lista.total || cargando}
                onClick={() => paginar(pagina + 1)}
              >
                Siguiente
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
