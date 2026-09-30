import { test } from "node:test";
import assert from "node:assert/strict";
import { resumirMes, seleccionarRegistros, validarMes } from "./resumen.js";
import { crearRepositorioResumen } from "../infrastructure/crearRepositorioResumen.js";
test("mes completo, ceros, creador y detalle coincidente", () => {
  const filas = [
    {
      id: "1",
      dia: "2026-09-01",
      origen: "oficina",
      creado_por: "a",
      responsable_id: "b",
      lote_demostracion: "demo",
    },
    {
      id: "2",
      dia: "2026-09-30",
      origen: "oficina",
      creado_por: "a",
      responsable_id: null,
    },
  ];
  const resumen = resumirMes("2026-09", filas);
  assert.equal(resumen.total, 2);
  assert.equal(resumen.demostracion, 1);
  assert.equal(resumen.sinAsignar, 1);
  assert.equal(resumen.porDia.length, 30);
  assert.equal(resumen.porDia[1].cantidad, 0);
  assert.deepEqual(resumen.porCreador, [{ valor: "a", cantidad: 2 }]);
  assert.deepEqual(resumen.porResponsable, [
    { valor: null, cantidad: 1 },
    { valor: "b", cantidad: 1 },
  ]);
  assert.equal(
    seleccionarRegistros(filas, { campo: "creado_por", valor: "a" }).length,
    2,
  );
  assert.equal(
    seleccionarRegistros(filas, { campo: "demostracion" }).length,
    1,
  );
  assert.equal(seleccionarRegistros(filas, { campo: "reales" }).length, 1);
  assert.equal(resumirMes("2024-02", []).porDia.length, 29);
  assert.throws(() => validarMes("2026-13"));
  assert.throws(() => resumirMes("2026-08", filas));
});
test("repositorio pagina más de mil filas sin truncar estadísticas", async () => {
  const filas = Array.from({ length: 1001 }, (_, i) => ({ id: String(i) }));
  const rangos = [];
  const cliente = {
    rpc: (nombre, parametros) => {
      if (nombre === "listar_historico_mensual")
        return { range: async () => ({ data: [] }) };
      assert.equal(nombre, "listar_cargas_mensuales");
      assert.equal(parametros.p_mes, "2026-09-01");
      return {
        range: async (desde, hasta) => {
          rangos.push(desde);
          return { data: filas.slice(desde, hasta + 1) };
        },
      };
    },
    from: () => ({ select: async () => ({ data: [] }) }),
  };
  assert.equal(
    (await crearRepositorioResumen(cliente).cargar("2026-09")).registros.length,
    1001,
  );
  assert.deepEqual(rangos, [0, 500, 1000]);
});
