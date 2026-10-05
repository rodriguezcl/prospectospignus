import { test } from "node:test";
import assert from "node:assert/strict";
import { crearSeguimientoDolar } from "./crearSeguimientoDolar.js";
import { agregarAvisosDolar } from "../../../app/configuracion/agregarAvisosDolar.js";

function escenario() {
  const datos = new Map();
  let respuesta;
  const almacenamiento = {
    getItem: (k) => datos.get(k),
    setItem: (k, v) => datos.set(k, v),
  };
  const crear = (usuario = "uno") =>
    crearSeguimientoDolar({
      usuario,
      almacenamiento,
      consultar: async () => respuesta,
    });
  const fijar = (venta, minuto) => {
    respuesta = {
      venta,
      fechaActualizacion: `2026-10-05T14:${String(minuto).padStart(2, "0")}:00.000Z`,
    };
  };
  return { crear, fijar };
}
test("primera lectura sin aviso, subas únicas, bajas actualizan la referencia y lectura persiste", async () => {
  const { crear, fijar } = escenario();
  const seguimiento = crear();
  fijar(1500, 0);
  await seguimiento.consultar("oficial");
  assert.equal((await seguimiento.notificaciones()).length, 0);
  fijar(1510, 5);
  await seguimiento.consultar("oficial");
  await seguimiento.consultar("oficial");
  assert.equal((await seguimiento.notificaciones()).length, 1);
  assert.match(
    (await seguimiento.notificaciones())[0].mensaje,
    /1\.500,00.*1\.510,00/,
  );
  assert.equal((await crear("otro").notificaciones()).length, 0);
  const recargado = crear();
  const [aviso] = await recargado.notificaciones();
  await recargado.leer(aviso.id);
  assert.equal((await seguimiento.notificaciones()).length, 0);
  fijar(1490, 10);
  await seguimiento.consultar("oficial");
  fijar(1500, 15);
  await seguimiento.consultar("oficial");
  assert.match(
    (await seguimiento.notificaciones())[0].mensaje,
    /1\.490,00.*1\.500,00/,
  );
  fijar(1600, 5);
  assert.equal((await seguimiento.consultar("oficial")).venta, 1500);
  assert.equal((await seguimiento.notificaciones()).length, 1);
});
test("cancelar no genera avisos; almacenamiento bloqueado permite seguimiento en memoria", async () => {
  let venta = 1500;
  let minuto = 0;
  const seguimiento = crearSeguimientoDolar({
    usuario: "uno",
    almacenamiento: {
      getItem() {
        throw Error();
      },
      setItem() {
        throw Error();
      },
    },
    consultar: async () => ({
      venta,
      fechaActualizacion: `2026-10-05T14:0${minuto}:00.000Z`,
    }),
  });
  await seguimiento.consultar("oficial");
  venta = 1550;
  minuto = 1;
  const cancelacion = new AbortController();
  cancelacion.abort();
  await seguimiento.consultar("oficial", cancelacion.signal);
  assert.equal((await seguimiento.notificaciones()).length, 0);
  await seguimiento.consultar("oficial");
  assert.equal((await seguimiento.notificaciones()).length, 1);
});
test("mezcla avisos del dólar con los existentes y dirige correctamente la lectura", async () => {
  const leidos = [];
  const gestion = agregarAvisosDolar(
    {
      notificaciones: async () => [{ id: "caso:1", creado_en: "2026-10-04" }],
      leer: (id) => leidos.push(id),
    },
    {
      notificaciones: async () => [
        { id: "dolar:123", creado_en: "2026-10-05" },
      ],
      leer: (id) => leidos.push(id),
    },
  );
  assert.deepEqual(
    (await gestion.notificaciones()).map((x) => x.id),
    ["dolar:123", "caso:1"],
  );
  gestion.leer("dolar:123");
  gestion.leer("caso:1");
  assert.deepEqual(leidos, ["dolar:123", "caso:1"]);
});
