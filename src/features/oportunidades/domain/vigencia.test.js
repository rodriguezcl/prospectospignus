import { test } from "node:test";
import assert from "node:assert/strict";
import { propuestaVencida, vencimientoPropuesta } from "./vigencia.js";
test("vigencia: cinco días exactos desde el ofrecimiento, con límite exclusivo", () => {
  const p = { creado_en: "2026-10-05T14:30:00-03:00" };
  const fin = Date.parse("2026-10-10T17:30:00Z");
  assert.equal(vencimientoPropuesta(p), fin);
  assert.equal(propuestaVencida(p, fin - 1), false);
  assert.equal(propuestaVencida(p, fin), true);
  assert.equal(propuestaVencida({}), true);
});
