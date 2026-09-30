import { useState } from "react";
import { acciones, fechaCordoba } from "../domain/circuito.js";

function Campo({
  nombre,
  titulo,
  tipo = "text",
  requerido = true,
  opciones,
  valor,
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
}) {
  const [accion, cambiar] = useState(oportunidad ? opciones[0] : "crear");
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
          if (datos.plazo) datos.plazo = fechaCordoba(datos.plazo);
          if (datos.confirmado_en)
            datos.confirmado_en = fechaCordoba(datos.confirmado_en);
          guardar(accion, datos);
        }}
      >
        <fieldset disabled={ocupado}>
          {accion === "crear" && (
            <>
              <p>
                Primero cargá el contacto en Registros iniciales. Esta acción
                confirma su calificación y coordina una visita. Para una nueva
                necesidad del mismo prospecto, seleccioná nuevamente su
                registro.
              </p>
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
              <label className="d-block mb-3">
                <input
                  type="checkbox"
                  name="contacto_confirmado"
                  value="si"
                  required
                />{" "}
                Hubo respuesta humana y existe una posibilidad comercial real.
              </label>
              <Campo
                nombre="necesidad"
                titulo="Necesidad comercial concreta"
                tipo="textarea"
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
            nombre="resumen"
            titulo={
              accion === "crear"
                ? "Evidencia del contacto efectivo y calificación"
                : "Resumen, resultado, objeciones o motivo del cambio"
            }
            tipo="textarea"
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
            {ocupado ? "Guardando…" : acciones[accion]}
          </button>
        </fieldset>
      </form>
    </>
  );
}
