import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizarHash } from "./compatibilidadHash.js";

test("conserva marcadores anteriores y consultas al normalizar", () => {
  assert.equal(normalizarHash("#prospectos"), "#/prospectos");
  assert.equal(
    normalizarHash("#acciones?estado=pendiente"),
    "#/acciones?estado=pendiente",
  );
});
test("no altera rutas canónicas ni oculta destinos desconocidos", () => {
  assert.equal(normalizarHash("#/oportunidades"), "#/oportunidades");
  assert.equal(normalizarHash("#inexistente"), "#/inexistente");
  assert.equal(normalizarHash(""), "#/inicio");
});
