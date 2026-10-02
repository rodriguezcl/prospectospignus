import { useState } from "react";
import { leerImporteArgentino, numeroImporte } from "./importe.js";

export function CampoImporte({ value, onChange, decimales = 6, ...props }) {
  const [borrador, editar] = useState(null);
  return (
    <span className="input-group">
      <span className="input-group-text" aria-hidden="true">
        $
      </span>
      <input
        {...props}
        className="form-control"
        type="text"
        inputMode="decimal"
        placeholder="0,00"
        value={borrador ?? numeroImporte(value)}
        onChange={(e) => {
          editar(e.target.value);
          try {
            const valor = leerImporteArgentino(e.target.value, decimales);
            e.target.setCustomValidity("");
            onChange(valor);
          } catch (error) {
            e.target.setCustomValidity(error.message);
            // Impedir calcular con el último valor válido desde botones sin submit.
            onChange("importe inválido");
          }
        }}
        onBlur={(e) => {
          if (e.target.validity.valid) editar(null);
          else e.target.reportValidity();
        }}
      />
    </span>
  );
}
