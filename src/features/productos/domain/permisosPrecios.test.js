import { test } from "node:test";
import assert from "node:assert/strict";
import {
  permisosPreciosIniciales,
  validarPermisosPrecios,
} from "./permisosPrecios.js";
import { prepararCatalogo } from "./catalogo.js";

test("permisos iniciales conservan vendedor sin Telefónico y agente con todos", () => {
  const permisos = permisosPreciosIniciales();
  assert.deepEqual(permisos.vendedor, ["catalogo", "alto", "medio", "bajo"]);
  assert.deepEqual(permisos.agente, [...permisos.vendedor, "telefonico"]);
  permisos.vendedor.length = 0;
  assert.equal(permisosPreciosIniciales().vendedor.length, 4);
});

test("permisos validan roles y niveles, conservan la revocación total sin reinstalar defaults", () => {
  const inicial = permisosPreciosIniciales();
  assert.deepEqual(
    validarPermisosPrecios({ ...inicial, vendedor: [] }).vendedor,
    [],
  );
  for (const valor of [
    null,
    [],
    {},
    { vendedor: [] },
    { ...inicial, administrador: [] },
    { ...inicial, agente: ["alto", "alto"] },
    { ...inicial, vendedor: ["unico"] },
  ]) {
    assert.throws(() => validarPermisosPrecios(valor), /niveles habilitados/);
  }
  const datos = {
    esquema: 7,
    marcas: [],
    familias: [],
    items: [],
    permisos_precios: { vendedor: [], agente: ["bajo", "alto"] },
    niveles_habilitados: ["alto"],
    calculo_remoto: true,
  };
  const preparado = prepararCatalogo(datos);
  assert.equal(preparado.permisos_precios_version, 1);
  assert.deepEqual(preparado.permisos_precios, {
    vendedor: [],
    agente: ["alto", "bajo"],
  });
  assert.equal("niveles_habilitados" in preparado, false);
  assert.equal("calculo_remoto" in preparado, false);
  assert.deepEqual(datos.permisos_precios.agente, ["bajo", "alto"]);
});
