import { test } from "node:test";
import assert from "node:assert/strict";
import {
  claveBorrador,
  leerBorrador,
  reconstruirConceptos,
  seleccionBorrador,
} from "./borradorCotizacion.js";
import { generarAlternativas } from "../domain/alternativas.js";

const catalogo = {
  esquema: 5,
  familias: [{ id: "f", servicio: "alarma" }],
  items: [
    {
      id: "k",
      nombre: "Inicial",
      familia_id: "f",
      tipo: "kit",
      modalidad: "plan",
      precios: { catalogo: "400", alto: "300", bajo: "100", telefonico: "80" },
      abonos: { alto: "40" },
    },
    {
      id: "p",
      familia_id: "f",
      tipo: "adicional",
      adicional_habilitado: true,
      unidad: "unidad",
      kits_compatibles: [],
      precios: { alto: "60", bajo: "40", telefonico: "30" },
    },
  ],
};
test("el borrador conserva selecciones y recupera la misma oferta sin almacenar precios", () => {
  const opciones = generarAlternativas({
    catalogo,
    familiaId: "f",
    kitId: "k",
    extras: [{ item_id: "p", cantidad: 2 }],
  });
  for (const opcion of opciones) {
    const guardado = seleccionBorrador({
      ...opcion,
      nivel_abono: "alto",
      meses_congelamiento: 4,
    });
    assert.equal(guardado.total, undefined);
    assert.equal(guardado.importe_exacto, undefined);
    const [recuperado] = reconstruirConceptos(
      JSON.parse(JSON.stringify([guardado])),
      catalogo,
      false,
    );
    assert.deepEqual(recuperado.seleccion, opcion.seleccion);
    assert.equal(recuperado.total, opcion.total);
    assert.equal(recuperado.abono, "40");
    assert.equal(recuperado.meses_congelamiento, 4);
  }
});
test("no recupera distribuciones inválidas ni precios Telefónicos sin permiso", () => {
  const c = {
    seleccion: {
      familia_id: "f",
      kit_id: "k",
      nivel: "telefonico",
      extras: [],
    },
    nivel_abono: null,
    meses_congelamiento: 0,
  };
  assert.throws(() => reconstruirConceptos([c], catalogo, false), /habilitado/);
  assert.equal(reconstruirConceptos([c], catalogo, true)[0].total, "80.00");
  c.seleccion.nivel = "catalogo";
  c.seleccion.extras = [{ item_id: "p", cantidad: 1, bonificados: 100 }];
  assert.throws(
    () => reconstruirConceptos([c], catalogo, false),
    /composición/,
  );
});
test("aislamiento por usuario, caso, ciclo y permisos; versiones nuevas invalidan precios", () => {
  const perfil = { id: "u", rol: "vendedor" },
    caso = { id: "o", ciclo: 1, estado: "cotizacion" };
  const clave = claveBorrador(perfil, caso);
  for (const otra of [
    claveBorrador({ ...perfil, id: "otro" }, caso),
    claveBorrador(perfil, { ...caso, id: "otro" }),
    claveBorrador(perfil, { ...caso, ciclo: 2 }),
    claveBorrador({ ...perfil, rol: "agente" }, caso),
  ])
    assert.notEqual(otra, clave);
  const dato = {
    esquema: 1,
    catalogo: 3,
    condiciones: 2,
    seleccion: {
      servicio: "alarma",
      familiaId: "f",
      modalidadEquipo: "plan",
      kitId: "k",
      subcategoria: "sin_monitoreo",
      nivel: "catalogo",
      nivelAbono: "alto",
      extras: {},
      meses: 0,
    },
    conceptos: [],
    pago: { baseEfectivo: "0", medioSaldo: "debito", cuotas: 1 },
  };
  const storage = {
    getItem: (k) => (k === clave ? JSON.stringify(dato) : null),
  };
  assert.equal(
    leerBorrador(storage, clave, {
      catalogo: { version: 3 },
      condiciones: { version: 2 },
    }).vigente,
    true,
  );
  assert.equal(
    leerBorrador(storage, clave, {
      catalogo: { version: 4 },
      condiciones: { version: 2 },
    }).vigente,
    false,
  );
  assert.equal(leerBorrador(storage, "otro", {}), null);
  assert.throws(
    () => leerBorrador({ getItem: () => "{}" }, clave, {}),
    /recuperar/,
  );
});
