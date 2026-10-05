import { useEffect, useState } from "react";
import "./dolar.css";

const pesos = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 2,
});
const fecha = new Intl.DateTimeFormat("es-AR", {
  timeZone: "America/Argentina/Buenos_Aires",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const intervalo = 5 * 60 * 1000;

export function CotizacionDolar({ consultar, tipo = "oficial" }) {
  const [dato, cambiarDato] = useState(null);
  const [error, cambiarError] = useState(false);
  useEffect(() => {
    let vigente = true;
    let pendiente = false;
    let ultimoIntento = 0;
    let controlador;
    cambiarDato(null);
    cambiarError(false);
    async function actualizar() {
      if (
        document.hidden ||
        pendiente ||
        Date.now() - ultimoIntento < intervalo
      )
        return;
      pendiente = true;
      ultimoIntento = Date.now();
      controlador = new AbortController();
      const limite = setTimeout(() => controlador.abort(), 10000);
      try {
        const resultado = await consultar(tipo, controlador.signal);
        if (vigente) {
          cambiarDato(resultado);
          cambiarError(false);
        }
      } catch {
        if (vigente) cambiarError(true);
      } finally {
        clearTimeout(limite);
        pendiente = false;
      }
    }
    actualizar();
    const reloj = setInterval(actualizar, intervalo);
    document.addEventListener("visibilitychange", actualizar);
    window.addEventListener("focus", actualizar);
    return () => {
      vigente = false;
      controlador?.abort();
      clearInterval(reloj);
      document.removeEventListener("visibilitychange", actualizar);
      window.removeEventListener("focus", actualizar);
    };
  }, [consultar, tipo]);

  return (
    <div className="cotizacion-dolar" aria-live="polite" aria-atomic="true">
      <span>
        Dólar {tipo === "blue" ? "blue" : "oficial"} · Venta{" "}
        <strong>{dato ? pesos.format(dato.venta) : "—"}</strong>
      </span>
      {dato ? (
        <small>
          Actualizado{" "}
          <time dateTime={dato.fechaActualizacion}>
            {fecha.format(new Date(dato.fechaActualizacion))}
          </time>{" "}
          (AR)
          {error && (
            <span className="dolar-error">
              {" "}
              · Sin conexión; último dato disponible
            </span>
          )}
        </small>
      ) : (
        <small>
          {error ? "Cotización no disponible" : "Consultando cotización…"}
        </small>
      )}
      <a
        href="https://dolarapi.com/docs/argentina/"
        target="_blank"
        rel="noreferrer"
        className="dolar-fuente"
      >
        DolarAPI
      </a>
    </div>
  );
}
