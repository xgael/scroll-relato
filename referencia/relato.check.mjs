// node tests/relato.check.mjs   (con el dev server en :3015)
// Verifica lo que se rompe en silencio en un relato con scroll anclado.
import assert from "node:assert/strict";
import { chromium } from "playwright";
import { TOTAL } from "../lib/secuencia.ts";

const BASE = process.argv[2] ?? "http://localhost:3015";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errores = [];
p.on("pageerror", (e) => errores.push(String(e)));
p.on("console", (m) => m.type() === "error" && errores.push(m.text()));

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForTimeout(4000);

const alto = await p.evaluate(() => document.body.scrollHeight);
const escena = await p.evaluate(() => document.querySelector("section").offsetHeight);
assert.ok(escena > 900 * 7, `la escena debe medir ~900dvh, mide ${escena}`);

const ir = async (f) => {
  await p.evaluate((y) => window.scrollTo(0, y), Math.round((alto - 900) * f));
  await p.waitForTimeout(160);
};

// Cada parlamento tiene que llegar a verse ENTERO en algún punto. Si uno se
// queda a medias, su ventana se solapa con la del siguiente y nadie lo lee.
const picos = [0, 0, 0, 0].map(() => 0);
const lienzos = new Set();
let panel = { o: 0, vis: 0 };

for (let f = 0.02; f < 0.99; f += 0.01) {
  await ir(f);
  const m = await p.evaluate(() => {
    const c = document.querySelector("canvas");
    const g = c.getContext("2d");
    const d = g.getImageData(c.width >> 1, c.height >> 1, 6, 6).data;
    let h = 0;
    for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) >>> 0;
    const pa = document.querySelector('[class*="panelCaja"] > div');
    const r = pa.getBoundingClientRect();
    return {
      lienzo: h,
      ops: [...document.querySelectorAll('[class*="__parlamentos"] > div')].map((e) => +getComputedStyle(e).opacity),
      panel: +getComputedStyle(pa).opacity,
      panelVis: Math.max(0, Math.min(r.bottom, innerHeight) - Math.max(r.top, 0)) / innerHeight,
    };
  });
  lienzos.add(m.lienzo);
  m.ops.forEach((o, i) => (picos[i] = Math.max(picos[i], o)));
  if (m.panel * m.panelVis > panel.o * panel.vis) panel = { o: m.panel, vis: m.panelVis };
}

assert.ok(lienzos.size > 20, `la secuencia apenas avanzó: ${lienzos.size} cuadros distintos`);
picos.forEach((o, i) =>
  assert.ok(o > 0.98, `el parlamento ${i + 1} nunca llega a verse entero (máx ${o})`),
);
// El video es el remate: tiene que quedarse puesto y a la vista, no asomar
// en el último 2% y que el cierre lo pise.
assert.ok(panel.o > 0.98, `el panel del video no llega a opacidad plena (${panel.o})`);
assert.ok(panel.vis > 0.5, `el panel del video apenas se asoma (${panel.vis} de pantalla)`);

assert.deepEqual(errores, [], "la consola debe quedar limpia");
await b.close();
console.log(`relato.check ok · ${TOTAL} cuadros, ${lienzos.size} distintos`);
