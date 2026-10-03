import { test } from "node:test";
import assert from "node:assert/strict";
import { unificarComponentes } from "./componentes-compartidos.mjs";

test("unificación conserva cantidades, precios e identidades y rechaza copias distintas", () => {
  let secuencia = 0;
  const crearId = () => `nuevo-${++secuencia}`;
  const componente = (id, codigo, marca_id) => ({
    id,
    codigo,
    nombre: "SIM M2M",
    marca_id,
    servicio: "alarma",
    tipo: "adicional",
    modalidad: null,
    estado: "activo",
    unidad: "unidad",
    precios: { alto: "0", bajo: "0", telefonico: "0" },
    abonos: {},
    incluidos: [],
    kits_compatibles: [],
    adicional_habilitado: false,
    validado_tecnicamente: true,
  });
  const datos = {
    esquema: 4,
    marcas: [
      { id: "h", nombre: "HIKVISION", estado: "activo" },
      { id: "g", nombre: "GARNET HIBRIDO", estado: "activo" },
    ],
    familias: [],
    items: [
      componente("a", "HIK-SIM-M2M", "h"),
      componente("b", "GAR-SIM-M2M", "g"),
      {
        ...componente("k", "KIT", "h"),
        tipo: "kit",
        modalidad: "kit",
        precios: { telefonico: "123" },
        incluidos: [
          { item_id: "a", cantidad: 1 },
          { item_id: "b", cantidad: 2 },
        ],
      },
    ],
  };
  const copia = structuredClone(datos);
  const { datos: nuevo, resumen } = unificarComponentes(datos, crearId);
  assert.deepEqual(datos, copia);
  assert.equal(nuevo.items.length, 2);
  assert.deepEqual(nuevo.items[0].marcas_compatibles, ["h", "g"]);
  assert.deepEqual(nuevo.items[1].incluidos, [{ item_id: "a", cantidad: 3 }]);
  assert.equal(nuevo.items[1].precios.telefonico, "123");
  assert.deepEqual(resumen[0].retirados, ["b"]);
  assert.deepEqual(unificarComponentes(nuevo, crearId).datos, nuevo);
  datos.items[1].precios.telefonico = "1";
  assert.throws(() => unificarComponentes(datos, crearId), /diferencias/);
});
