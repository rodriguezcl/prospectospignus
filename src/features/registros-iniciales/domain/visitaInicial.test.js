import { test } from "node:test";
import assert from "node:assert/strict";
import { prepararVisitaInicial } from "./visitaInicial.js";
import { crearGestionRegistros } from "../application/crearGestionRegistros.js";

test("visita inicial: convierte el horario de Córdoba sin depender del dispositivo", () => {
  assert.deepEqual(
    prepararVisitaInicial({
      visita_inicio: "2026-10-19T10:00",
      visita_fin: "2026-10-19T11:30",
      visita_nota: "  Llamar al llegar  ",
    }),
    {
      inicio_previsto: "2026-10-19T13:00:00.000Z",
      fin_previsto: "2026-10-19T14:30:00.000Z",
      nota: "Llamar al llegar",
    },
  );
  assert.equal(
    prepararVisitaInicial({ visita_inicio: "2026-10-19T10:00" }).fin_previsto,
    null,
  );
});

test("visita inicial: exige inicio y fin posterior, sin normalizar fechas imposibles", () => {
  for (const entrada of [
    {},
    { visita_inicio: "2027-02-30T09:00" },
    { visita_inicio: "2026-10-19T10:00", visita_fin: "2026-10-19T09:59" },
    { visita_inicio: "2026-10-19T10:00", visita_fin: "2026-10-19T10:00" },
    { visita_inicio: "2026-10-19T10:00", visita_nota: "a".repeat(2001) },
  ])
    assert.throws(() => prepararVisitaInicial(entrada));
});

test("reintentos: la fecha futura se valida en servidor para poder confirmar un alta previa", () => {
  assert.equal(
    prepararVisitaInicial({ visita_inicio: "2020-01-01T10:00" })
      .inicio_previsto,
    "2020-01-01T13:00:00.000Z",
  );
});

test("alta con visita envía una sola operación con contacto validado y sin autor inyectado", async () => {
  const llamadas = [];
  const gestion = crearGestionRegistros({
    guardarConVisita: (...args) => {
      llamadas.push(args);
      return { id: args[0], visita_id: args[0] };
    },
    guardar: () => assert.fail("No debe guardar el contacto por separado"),
  });
  const entrada = {
    nombre: "  Persona de prueba  ",
    origen: "oficina",
    ubicacion_comercial: "docta",
    visita_inicio: "2099-10-19T10:00",
    visita_nota: " Avisar ",
    creado_por: "otro",
    vendedor_id: "otro",
  };
  assert.deepEqual(await gestion.guardarConVisita("estable", entrada), {
    id: "estable",
    visita_id: "estable",
  });
  const [id, datos, visita] = llamadas[0];
  assert.equal(llamadas.length, 1);
  assert.equal(id, "estable");
  assert.equal(datos.nombre, "PERSONA DE PRUEBA");
  assert.equal(datos.ubicacion_comercial, "docta");
  assert.equal(datos.visita_inicio, undefined);
  assert.equal(datos.creado_por, undefined);
  assert.deepEqual(visita, {
    inicio_previsto: "2099-10-19T13:00:00.000Z",
    fin_previsto: null,
    nota: "Avisar",
  });
  assert.throws(() =>
    gestion.guardarConVisita("id", { ...entrada, origen: "" }),
  );
  assert.throws(() =>
    gestion.guardarConVisita("id", { ...entrada, visita_inicio: "" }),
  );
  assert.equal(llamadas.length, 1);
});

test("alta sin visita sigue guardando contactos incompletos sin exigir fecha", async () => {
  let llamadas = 0;
  const gestion = crearGestionRegistros({
    guardar(id, version, datos) {
      llamadas++;
      assert.equal(version, 0);
      assert.equal(datos.nombre, "PERSONA");
      return { id };
    },
  });
  assert.deepEqual(
    await gestion.guardar("sin-visita", 0, {
      nombre: "Persona",
      origen: "oficina",
    }),
    { id: "sin-visita" },
  );
  assert.equal(llamadas, 1);
});
