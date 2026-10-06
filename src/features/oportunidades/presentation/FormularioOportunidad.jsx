import { ordenarAlfabeticamente } from "../../../shared/ui/ordenAlfabetico.js";
import { useEffect, useState } from "react";
import { propuestaVencida, vencimientoPropuesta } from "../domain/vigencia.js";
import { monedaArgentina } from "../../../shared/ui/importe.js";
import { acciones, fechaCordoba } from "../domain/circuito.js";
import { serviciosInteres } from "../domain/interesComercial.js";
import { subcategorias } from "../domain/alternativas.js";

function Campo({
  nombre,
  titulo,
  tipo = "text",
  requerido = true,
  opciones,
  valor,
  ayuda,
}) {
  return (
    <label className="d-block mb-3">
      {titulo}
      {opciones ? (
        <select
          name={nombre}
          className="form-select"
          defaultValue={valor || ""}
          required={requerido}
        >
          <option value="">Seleccionar…</option>
          {opciones.map(([id, texto, deshabilitada]) => (
            <option key={id} value={id} disabled={deshabilitada}>
              {texto}
            </option>
          ))}
        </select>
      ) : tipo === "textarea" ? (
        <textarea
          name={nombre}
          className="form-control"
          required={requerido}
          minLength={requerido ? 5 : undefined}
          maxLength={2000}
          rows={3}
          placeholder={ayuda}
          defaultValue={valor || ""}
        />
      ) : (
        <input
          name={nombre}
          type={tipo}
          className="form-control"
          required={requerido}
          defaultValue={valor || ""}
        />
      )}
    </label>
  );
}
export function FormularioOportunidad({
  oportunidad,
  perfil,
  equipo,
  registros,
  opciones,
  guardar,
  ocupado,
  buscar,
  registroSeleccionado,
  iniciarSinVisita = false,
}) {
  const [accion, cambiar] = useState(
    oportunidad
      ? opciones[0]
      : iniciarSinVisita
        ? "iniciar_cotizacion"
        : "crear",
  );
  const alta = ["crear", "iniciar_cotizacion"].includes(accion);
  const [servicios, elegirServicios] = useState([""]);
  const propuestas = (oportunidad?.propuestas || []).filter(
    (p) => p.ciclo === oportunidad.ciclo,
  );
  const [propuestaId, elegirPropuesta] = useState(propuestas[0]?.id || "");
  const propuesta = propuestas.find((p) => p.id === propuestaId);
  const [ahora, cambiarAhora] = useState(Date.now);
  useEffect(() => {
    const reloj = setInterval(() => cambiarAhora(Date.now()), 30000);
    return () => clearInterval(reloj);
  }, []);
  const vencida = propuesta && propuestaVencida(propuesta, ahora);
  const [contactoSugerido] = useState(() =>
    new Date(Date.now() + 24 * 3600000 - 3 * 3600000)
      .toISOString()
      .slice(0, 16),
  );
  const recuperacion = oportunidad?.estado === "recuperacion";
  return (
    <>
      {oportunidad && opciones.length > 1 && (
        <label className="d-block mb-3">
          Acción
          <select
            className="form-select"
            value={accion}
            onChange={(e) => cambiar(e.target.value)}
            disabled={ocupado}
          >
            {opciones.map((a) => (
              <option key={a} value={a}>
                {acciones[a]}
              </option>
            ))}
          </select>
        </label>
      )}
      <form
        key={accion}
        onChange={(e) => {
          if (e.target.name === "propuesta_id") elegirPropuesta(e.target.value);
        }}
        onSubmit={(e) => {
          e.preventDefault();
          const datos = Object.fromEntries(new FormData(e.currentTarget));
          if (alta) {
            datos.interes_comercial = {
              servicios: servicios.filter(Boolean),
              tipo_alarma: datos.tipo_alarma || null,
            };
            delete datos.tipo_alarma;
          }
          if (datos.plazo) datos.plazo = fechaCordoba(datos.plazo);
          if (datos.confirmado_en)
            datos.confirmado_en = fechaCordoba(datos.confirmado_en);
          guardar(accion, datos);
        }}
      >
        <fieldset disabled={ocupado}>
          {["crear", "iniciar_cotizacion", "reactivar"].includes(accion) && (
            <Campo
              nombre="origen_comercial"
              titulo="Origen de este ciclo comercial"
              valor={
                perfil.rol === "vendedor"
                  ? "propio"
                  : perfil.rol === "agente"
                    ? "asignado_agente"
                    : ""
              }
              requerido={false}
              opciones={[
                ...(perfil.rol !== "agente"
                  ? [["propio", "Prospecto propio del vendedor"]]
                  : []),
                ...(perfil.rol !== "vendedor"
                  ? [["asignado_agente", "Asignado por agente"]]
                  : []),
              ]}
            />
          )}
          {accion === "corregir_perdida" && (
            <p>
              Solo corrige un error de carga. Conserva el ciclo, sus visitas y
              la evidencia de la pérdida original. Para interés retomado, usá
              Reactivar.
            </p>
          )}
          {["ganar", "derivar"].includes(accion) && (
            <Campo
              nombre="propuesta_id"
              valor={propuestaId}
              titulo={
                accion === "ganar"
                  ? "Propuesta aceptada por el cliente"
                  : "Última propuesta efectivamente ofrecida"
              }
              requerido={(oportunidad?.propuestas || []).some(
                (p) => p.ciclo === oportunidad.ciclo,
              )}
              opciones={(oportunidad?.propuestas || [])
                .filter((p) => p.ciclo === oportunidad.ciclo)
                .map((p) => [
                  p.id,
                  `${p.codigo_interno || p.detalle.codigo} · Inicial ${monedaArgentina(p.detalle.total)} · ${propuestaVencida(p, ahora) ? "Vencida: recalcular" : `Válida hasta ${new Date(vencimientoPropuesta(p)).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })}`}`,
                  accion === "ganar" && propuestaVencida(p, ahora),
                ])}
            />
          )}
          {accion === "derivar" && (
            <>
              <p className="alert alert-info">
                Adjuntamos la propuesta ofrecida con equipos, adicionales,
                precios, abono y pago. Completá lo que el agente necesita saber
                para retomar la conversación.
              </p>
              <Campo
                nombre="objecion"
                titulo="¿Qué impidió cerrar la venta? Objeción concreta para el agente"
                tipo="textarea"
                ayuda="Qué dijo el prospecto: precio inicial, abono, comparación con otra empresa, decisión pendiente… Evitá escribir solo 'caro'."
              />
              <Campo
                nombre="contacto_preferido"
                titulo="Cómo y cuándo conviene contactar al prospecto"
                tipo="textarea"
                ayuda="Canal y horario que prefiere, con quién hablar y si está esperando la llamada. Si no se acordó, indicalo."
              />
              <Campo
                nombre="decision_pendiente"
                titulo="Información adicional para el cierre (opcional)"
                tipo="textarea"
                requerido={false}
                ayuda="Quién decide, urgencia, presupuesto mencionado, competencia, compromisos asumidos o particularidades de la instalación. Solo datos confirmados."
              />
            </>
          )}
          {accion === "reactivar" && (
            <label className="d-block mb-3">
              <input
                type="checkbox"
                name="negociacion_confirmada"
                value="si"
                required
              />{" "}
              El cliente retomó interés o aceptó evaluar una propuesta nueva. No
              es solo una llamada sin respuesta.
            </label>
          )}
          {alta && (
            <>
              <p>
                Elegí qué necesita el prospecto para preparar la cotización.
                Podés coordinar una visita después; este paso no registra una
                visita realizada.
              </p>
              {registroSeleccionado ? (
                <input
                  type="hidden"
                  name="registro_id"
                  value={registroSeleccionado.id}
                />
              ) : (
                <>
                  <label className="d-block mb-3">
                    Buscar registro por nombre
                    <input
                      type="search"
                      className="form-control"
                      onChange={(e) => buscar(e.target.value)}
                    />
                  </label>
                  <Campo
                    nombre="registro_id"
                    titulo="Registro inicial (hasta 100 coincidencias recientes)"
                    opciones={registros.map((r) => [
                      r.id,
                      `${r.nombre} · ${r.telefono || "sin teléfono"} · ${r.ubicacion || "sin dirección"}`,
                    ])}
                  />
                </>
              )}
              {!iniciarSinVisita && (
                <label className="d-block mb-3">
                  <input
                    type="checkbox"
                    name="contacto_confirmado"
                    value="si"
                    required
                  />{" "}
                  Hubo respuesta humana y existe una posibilidad comercial real.
                </label>
              )}
              <fieldset className="mb-3">
                <legend className="h6">Servicio de interés</legend>
                {servicios.map((servicio, indice) => (
                  <div className="d-flex gap-2 mb-2" key={indice}>
                    <label className="flex-grow-1">
                      {indice > 0 ? "Otro servicio" : "Servicio"}
                      <select
                        className="form-select"
                        required
                        value={servicio}
                        onChange={(e) =>
                          elegirServicios(
                            servicios.map((s, i) =>
                              i === indice ? e.target.value : s,
                            ),
                          )
                        }
                      >
                        <option value="">Seleccionar…</option>
                        {Object.entries(serviciosInteres)
                          .filter(
                            ([id]) =>
                              id === servicio || !servicios.includes(id),
                          )
                          .map(([id, texto]) => (
                            <option key={id} value={id}>
                              {texto}
                            </option>
                          ))}
                      </select>
                    </label>
                    {indice > 0 && (
                      <button
                        type="button"
                        className="btn btn-outline-secondary align-self-end"
                        onClick={() =>
                          elegirServicios(
                            servicios.filter((_, i) => i !== indice),
                          )
                        }
                      >
                        Quitar servicio
                      </button>
                    )}
                  </div>
                ))}
                {servicios.length < 3 && (
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    disabled={servicios.includes("")}
                    onClick={() => elegirServicios([...servicios, ""])}
                  >
                    Agregar otro servicio
                  </button>
                )}
              </fieldset>
              {servicios.includes("alarma") && (
                <Campo
                  nombre="tipo_alarma"
                  titulo="Tipo de alarma"
                  valor="a_definir"
                  opciones={[
                    ["a_definir", "A definir en la visita"],
                    ...Object.entries(subcategorias),
                  ]}
                />
              )}
              <Campo
                nombre="canal_contacto"
                titulo="Medio de contacto"
                requerido={!iniciarSinVisita}
                opciones={[
                  ["whatsapp", "WhatsApp"],
                  ["llamada", "Llamada"],
                  ["presencial", "Presencial"],
                  ["correo", "Correo electrónico"],
                  ["otro", "Otro"],
                ]}
              />
              {!iniciarSinVisita && (
                <Campo
                  nombre="vendedor_id"
                  titulo={
                    iniciarSinVisita
                      ? "Vendedor responsable"
                      : "Vendedor que realizará la visita"
                  }
                  valor={perfil.rol === "vendedor" ? perfil.id : ""}
                  opciones={ordenarAlfabeticamente(equipo)
                    .filter(
                      (p) =>
                        p.rol === "vendedor" &&
                        (perfil.rol !== "vendedor" || p.id === perfil.id),
                    )
                    .map((p) => [p.id, p.nombre])}
                />
              )}
            </>
          )}
          {accion === "derivar" && (
            <p>
              Conserva la misma oportunidad y la deriva al agente operativo con
              menos recuperaciones pendientes. Sin agentes disponibles quedará
              pendiente de asignación.
            </p>
          )}
          {accion === "reasignar" && (
            <Campo
              nombre="responsable_id"
              titulo="Nuevo responsable"
              opciones={ordenarAlfabeticamente(equipo)
                .filter((p) =>
                  recuperacion
                    ? p.rol === "agente" && p.disponible
                    : p.rol === "vendedor",
                )
                .map((p) => [p.id, p.nombre])}
            />
          )}
          {accion === "reactivar" && (
            <p>
              Inicia un nuevo ciclo de seguimiento. Conserva el cierre perdido
              anterior y su historial; no modifica el resultado histórico.
              Indicá por qué se retoma el contacto.
            </p>
          )}
          {[
            "crear",
            "reprogramar",
            "seguimiento",
            "derivar",
            "reactivar",
            "corregir_perdida",
          ].includes(accion) && (
            <Campo
              nombre="plazo"
              titulo={
                accion === "crear" || accion === "reprogramar"
                  ? "Fecha y hora de visita · Córdoba"
                  : "Próximo contacto · Córdoba"
              }
              tipo="datetime-local"
              valor={accion === "derivar" ? contactoSugerido : undefined}
            />
          )}
          {accion === "derivar" && (
            <p className="small">
              Objetivo sugerido: contactar el mismo día o dentro de 24 horas.
              Revisá la fecha según la disponibilidad del prospecto; usá 48
              horas si así lo acordaron. La fecha indicada queda como próxima
              acción para Recuperación.
            </p>
          )}
          {["derivar", "seguimiento", "ganar", "perder"].includes(accion) && (
            <Campo
              key={accion === "derivar" ? propuestaId : accion}
              nombre="condiciones"
              titulo={
                recuperacion
                  ? "Propuesta final: condiciones y bonificaciones"
                  : "Condiciones finales ofrecidas y bonificaciones"
              }
              tipo="textarea"
              valor={
                accion === "derivar" && propuesta
                  ? `Propuesta ofrecida ${propuesta.codigo_interno || propuesta.detalle.codigo}. Inicial: ${monedaArgentina(propuesta.detalle.total)}. Abono: ${monedaArgentina(propuesta.detalle.abono, "no corresponde")}. Pago: ${propuesta.detalle.pago?.medio_saldo || "ver propuesta"}.`
                  : undefined
              }
              ayuda={
                accion === "derivar"
                  ? "Aclaraciones de la oferta y compromisos conversados. El detalle de equipos y precios se adjunta automáticamente."
                  : undefined
              }
              requerido={
                accion === "derivar" ||
                accion === "ganar" ||
                (accion === "perder" && recuperacion)
              }
            />
          )}
          <Campo
            nombre={alta ? "observaciones" : "resumen"}
            titulo={
              alta
                ? "Observaciones de la negociación (opcional)"
                : accion === "derivar"
                  ? "Contexto del caso y qué necesita el prospecto"
                  : "Resumen, resultado, objeciones o motivo del cambio"
            }
            tipo="textarea"
            requerido={!alta}
            ayuda={
              accion === "crear"
                ? "Por ejemplo: avisar antes de llegar, ingresar por la cochera o consultar por cámaras para el patio."
                : accion === "derivar"
                  ? "Qué quiere proteger, situación actual, interés y próximos pasos conversados. El agente debería poder continuar sin pedirle que repita todo."
                  : undefined
            }
          />
          {accion === "ganar" && (
            <>
              <label className="d-block mb-3">
                <input
                  type="checkbox"
                  name="aceptacion_confirmada"
                  value="si"
                  required
                />{" "}
                El prospecto aceptó expresamente la propuesta. No indica
                instalación realizada.
              </label>
              <Campo
                nombre="canal"
                titulo="Canal de confirmación"
                opciones={[
                  ["presencial", "Presencial"],
                  ["llamada", "Llamada"],
                  ["whatsapp", "WhatsApp"],
                  ["correo", "Correo electrónico"],
                  ["otro", "Otro"],
                ]}
              />
              <Campo
                nombre="confirmado_en"
                titulo="Fecha y hora de aceptación · Córdoba"
                tipo="datetime-local"
              />
            </>
          )}
          {accion === "perder" && (
            <>
              {!recuperacion && (
                <p>
                  Para objeciones comerciales, usá Derivar a recuperación. La
                  pérdida directa se limita a impedimentos no recuperables.
                </p>
              )}
              <Campo
                nombre="motivo"
                titulo="Motivo de pérdida (explicalo en el resumen)"
                opciones={[
                  ...(recuperacion
                    ? [
                        ["precio", "Precio"],
                        ["competencia", "Eligió competencia"],
                        ["no_interesado", "No interesado"],
                        ["otro", "Otro"],
                      ]
                    : []),
                  ["fuera_de_zona", "Fuera de zona"],
                  ["no_cumple_requisitos", "No cumple requisitos"],
                ]}
              />
              {recuperacion && (
                <label className="d-block mb-3">
                  <input
                    type="checkbox"
                    name="rechazo_confirmado"
                    value="si"
                    required
                  />{" "}
                  El prospecto rechazó la propuesta final; no es solamente falta
                  de respuesta.
                </label>
              )}
            </>
          )}
          {accion === "ganar" && vencida && (
            <p role="alert" className="alert alert-warning">
              Cotización vencida. Recalculá los precios y registrá una nueva
              propuesta ofrecida para confirmar la venta.
            </p>
          )}
          <button
            className="btn btn-primary"
            type="submit"
            disabled={accion === "ganar" && !!vencida}
          >
            {ocupado
              ? "Guardando…"
              : accion === "crear"
                ? "Crear prospecto y coordinar visita"
                : acciones[accion]}
          </button>
        </fieldset>
      </form>
    </>
  );
}
