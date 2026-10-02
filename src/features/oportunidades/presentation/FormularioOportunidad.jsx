import { useState } from "react";
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
          {opciones.map(([id, texto]) => (
            <option key={id} value={id}>
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
        />
      ) : (
        <input
          name={nombre}
          type={tipo}
          className="form-control"
          required={requerido}
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
}) {
  const [accion, cambiar] = useState(oportunidad ? opciones[0] : "crear");
  const [servicios, elegirServicios] = useState([""]);
  const recuperacion = oportunidad?.estado === "recuperacion";
  return (
    <>
      {oportunidad && (
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
        onSubmit={(e) => {
          e.preventDefault();
          const datos = Object.fromEntries(new FormData(e.currentTarget));
          if (accion === "crear") {
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
          {["crear", "reactivar"].includes(accion) && (
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
                  `${p.detalle.codigo} · Inicial $${p.detalle.total} · Abono ${p.detalle.abono ?? "no corresponde"}`,
                ])}
            />
          )}
          {accion === "derivar" && (
            <Campo
              nombre="objecion"
              titulo="¿Qué impidió cerrar la venta? Objeción concreta para el agente"
              tipo="textarea"
            />
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
          {accion === "crear" && (
            <>
              <p>
                Los datos del contacto se toman del registro guardado. Confirmá
                su necesidad y coordiná la visita; después podrás preparar la
                cotización en su ficha.
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
              <label className="d-block mb-3">
                <input
                  type="checkbox"
                  name="contacto_confirmado"
                  value="si"
                  required
                />{" "}
                Hubo respuesta humana y existe una posibilidad comercial real.
              </label>
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
                opciones={[
                  ["whatsapp", "WhatsApp"],
                  ["llamada", "Llamada"],
                  ["presencial", "Presencial"],
                  ["correo", "Correo electrónico"],
                  ["otro", "Otro"],
                ]}
              />
              <Campo
                nombre="vendedor_id"
                titulo="Vendedor que realizará la visita"
                valor={perfil.rol === "vendedor" ? perfil.id : ""}
                opciones={equipo
                  .filter(
                    (p) =>
                      p.rol === "vendedor" &&
                      (perfil.rol !== "vendedor" || p.id === perfil.id),
                  )
                  .map((p) => [p.id, p.nombre])}
              />
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
              opciones={equipo
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
            />
          )}
          {["derivar", "seguimiento", "ganar", "perder"].includes(accion) && (
            <Campo
              nombre="condiciones"
              titulo={
                recuperacion
                  ? "Propuesta final: condiciones y bonificaciones"
                  : "Condiciones finales ofrecidas y bonificaciones"
              }
              tipo="textarea"
              requerido={
                accion === "derivar" ||
                accion === "ganar" ||
                (accion === "perder" && recuperacion)
              }
            />
          )}
          <Campo
            nombre={accion === "crear" ? "observaciones" : "resumen"}
            titulo={
              accion === "crear"
                ? "Observaciones para la visita (opcional)"
                : "Resumen, resultado, objeciones o motivo del cambio"
            }
            tipo="textarea"
            requerido={accion !== "crear"}
            ayuda={
              accion === "crear"
                ? "Por ejemplo: avisar antes de llegar, ingresar por la cochera o consultar por cámaras para el patio."
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
          <button className="btn btn-primary" type="submit">
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
