import { useEffect, useState, useRef } from "react";
import { EncabezadoPagina } from "../../../shared/ui/contenido/EncabezadoPagina.jsx";
export function ConfiguracionPagina({ gestion }) {
  const [valor, setValor] = useState(null),
    [meses, setMeses] = useState(""),
    [error, setError] = useState(""),
    [aviso, setAviso] = useState(""),
    [ocupado, setOcupado] = useState(false);
  const operacion = useRef(null);
  useEffect(() => {
    let vigente = true;
    gestion
      .leer()
      .then((v) => {
        if (vigente) {
          setValor(v);
          setMeses(v.datos.meses_congelamiento.join(", "));
        }
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
    try {
      const v = await gestion.leer();
      setValor(v);
      setMeses(v.datos.meses_congelamiento.join(", "));
      setError("");
      operacion.current = null;
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }
  async function guardar(e) {
    e.preventDefault();
    if (ocupado) return;
    setError("");
    setAviso("");
    if (meses.trim() && !/^\d+(\s*,\s*\d+)*$/.test(meses.trim())) {
      setError("Ingresá meses enteros separados por coma.");
      return;
    }
    const plazos = meses.trim()
      ? meses.split(",").map((v) => Number(v.trim()))
      : [];
    if (
      plazos.some((n) => n < 1 || n > 99) ||
      new Set(plazos).size !== plazos.length
    ) {
      setError("Los plazos deben ser únicos, entre 1 y 99 meses.");
      return;
    }
    setOcupado(true);
    operacion.current ||= crypto.randomUUID();
    const datos = { ...valor.datos, meses_congelamiento: plazos };
    try {
      const version = await gestion.guardar({
        version: valor.version,
        operacion: operacion.current,
        datos,
      });
      setValor({ version, datos });
      operacion.current = null;
      setAviso("Condiciones guardadas. No cambian acuerdos ya aceptados.");
    } catch (e) {
      setError(e.message);
    } finally {
      setOcupado(false);
    }
  }
  return (
    <>
      <EncabezadoPagina
        titulo="Configuración"
        descripcion="Condiciones comerciales"
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
      <button
        className="btn btn-outline-primary mb-3"
        disabled={ocupado}
        onClick={actualizar}
      >
        Actualizar condiciones
      </button>
      {valor && (
        <form onSubmit={guardar} className="card card-body">
          <fieldset disabled={ocupado}>
            <h2 className="h4">Formas de pago</h2>
            <p>
              Débito y transferencia: mismo total. Efectivo: 10 % acumulable con
              bonificaciones. Crédito: 1, 3 o 6 cuotas sin interés. El descuento
              no afecta el abono.
            </p>
            <h2 className="h4">Congelamiento del abono</h2>
            <label className="d-block mb-3">
              Plazos disponibles en meses
              <input
                className="form-control"
                value={meses}
                onChange={(e) => {
                  setMeses(e.target.value);
                  operacion.current = null;
                }}
                placeholder="4, 6"
              />
            </label>
            {["vendedor", "agente"].map((rol) => (
              <label className="d-block mb-3" key={rol}>
                <input
                  type="checkbox"
                  className="form-check-input me-2"
                  checked={valor.datos[`congelamiento_${rol}`]}
                  onChange={(e) => {
                    setValor({
                      ...valor,
                      datos: {
                        ...valor.datos,
                        [`congelamiento_${rol}`]: e.target.checked,
                      },
                    });
                    operacion.current = null;
                  }}
                />
                Puede ofrecer congelamiento: {rol}
              </label>
            ))}
            <p>
              Desde la instalación efectiva. No son meses gratis. Facturación e
              IPC automáticos siguen fuera de alcance.
            </p>
            <button className="btn btn-primary">Guardar condiciones</button>
          </fieldset>
        </form>
      )}
    </>
  );
}
