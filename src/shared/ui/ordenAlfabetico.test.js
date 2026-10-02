import { test } from "node:test";
import assert from "node:assert/strict";
import { ordenarAlfabeticamente } from "./ordenAlfabetico.js";
import { crearRepositorioRegistros } from "../../features/registros-iniciales/infrastructure/crearRepositorioRegistros.js";
import { crearRepositorioUsuarios } from "../../features/usuarios/infrastructure/crearRepositorioUsuarios.js";
import { crearRepositorioOportunidades } from "../../features/oportunidades/infrastructure/crearRepositorioOportunidades.js";
import { crearRepositorioPromociones } from "../../features/promociones/infrastructure/crearRepositorioPromociones.js";

test("orden español: tildes, mayúsculas, ñ y copia sin mutar", () => {
  const filas = ["ZULMA", "ÓSCAR", "ÑANDÚ", "NORA", "álvaro", "ANA"].map(
    (nombre, id) => ({ nombre, id: String(id) }),
  );
  const antes = structuredClone(filas);
  assert.deepEqual(
    ordenarAlfabeticamente(filas).map((f) => f.nombre),
    ["álvaro", "ANA", "NORA", "ÑANDÚ", "ÓSCAR", "ZULMA"],
  );
  assert.deepEqual(filas, antes);
  assert.deepEqual(
    ordenarAlfabeticamente([
      { id: "b", nombre: "ANA" },
      { id: "a", nombre: "ana" },
    ]).map((f) => f.id),
    ["a", "b"],
  );
});

test("consultas ordenan antes de limitar o paginar, no solo la página visible", async () => {
  for (const [crear, campo] of [
    [crearRepositorioRegistros, "nombre"],
    [crearRepositorioUsuarios, "nombre"],
    [crearRepositorioOportunidades, "prospectos(nombre)"],
    [crearRepositorioPromociones, "titulo"],
  ]) {
    const llamadas = [];
    const consulta = new Proxy(
      {},
      {
        get: (_, metodo) =>
          metodo === "then"
            ? (resolver) => resolver({ data: [], count: 0 })
            : (...args) => {
                llamadas.push([metodo, ...args]);
                return consulta;
              },
      },
    );
    await crear({ from: () => consulta }).listar({ pagina: 1 });
    assert.equal(llamadas.find((c) => c[0] === "order")[1], campo);
    assert.ok(
      llamadas.findIndex((c) => c[0] === "order") <
        llamadas.findIndex((c) => ["range", "limit"].includes(c[0])),
    );
    assert.ok(llamadas.some((c) => c[0] === "order" && c[1] === "id"));
  }
});
