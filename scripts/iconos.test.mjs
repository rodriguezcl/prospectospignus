import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const leer = (ruta) => readFileSync(new URL(`../${ruta}`, import.meta.url));
test("iconos: manifiesto, dimensiones PNG y referencias HTML", () => {
  const manifiesto = JSON.parse(leer("public/site.webmanifest"));
  assert.equal(manifiesto.start_url, "/#/inicio");
  assert.equal(manifiesto.scope, "/");
  assert.ok(manifiesto.icons.some((i) => i.purpose === "maskable"));
  for (const icono of [...manifiesto.icons, {src:"/apple-touch-icon.png",sizes:"180x180"}, {src:"/iconos/pignus-32.png",sizes:"32x32"}]) {
    const png = leer(`public${icono.src}`);
    assert.equal(png.subarray(1,4).toString(), "PNG");
    assert.equal(`${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`, icono.sizes);
  }
  const html = leer("index.html").toString();
  for (const ruta of ["/favicon.ico", "/apple-touch-icon.png", "/site.webmanifest"]) assert.ok(html.includes(ruta));
  const ico = leer("public/favicon.ico");
  assert.equal(ico.readUInt16LE(2), 1);
  assert.equal(ico.readUInt16LE(4), 3);
  for (let i=0; i<3; i++) {
    const inicio = 6 + i*16;
    assert.equal(ico[inicio], [16,32,48][i]);
    assert.ok(ico.readUInt32LE(inicio+12)+ico.readUInt32LE(inicio+8)<=ico.length);
  }
});
