import { test } from "node:test";
import assert from "node:assert/strict";
import { crearRepositorioRegistros } from "./crearRepositorioRegistros.js";

test("alta con visita usa RPC transaccional y la misma identidad al reintentar", async () => {
  const llamadas = [];
  const repo = crearRepositorioRegistros({
    rpc: async (rpc, args) => {
      llamadas.push({ rpc, args });
      return { data: { id: args.p_id, visita_id: args.p_id } };
    },
  });
  const datos = { nombre: "PRUEBA" },
    visita = {
      inicio_previsto: "2099-10-19T13:00:00Z",
      fin_previsto: null,
      nota: "",
    };
  await repo.guardarConVisita("estable", datos, visita);
  await repo.guardarConVisita("estable", datos, visita);
  assert.deepEqual(llamadas[0], {
    rpc: "guardar_prospecto_con_visita_042",
    args: { p_id: "estable", p_datos: datos, p_visita: visita },
  });
  assert.deepEqual(llamadas[0], llamadas[1]);
});

test("alta con visita no informa éxito parcial ni guarda sin agenda ante errores", async () => {
  for (const [respuesta, mensaje] of [
    [{ data: { id: "id" } }, /No pudimos confirmar/],
    [{ data: { id: "otro", visita_id: "otro" } }, /No pudimos confirmar/],
    [{ error: { code: "PGRST202" } }, /202610130042/],
    [{ error: { message: "AGENDA_FECHA" } }, /fecha y hora futura/],
    [{ error: { message: "ALTA_VISITA_CONFLICTO" } }, /ya fue guardado/],
    [{ error: { message: "AGENDA_ACCESO" } }, /vendedor activo/],
  ]) {
    let llamadas = 0;
    const repo = crearRepositorioRegistros({
      rpc: async () => {
        llamadas++;
        return respuesta;
      },
    });
    await assert.rejects(repo.guardarConVisita("id", {}, {}), mensaje);
    assert.equal(llamadas, 1);
  }
});
