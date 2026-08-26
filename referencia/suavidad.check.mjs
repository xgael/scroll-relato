// node tests/suavidad.check.mjs [url]
// La suavidad de este gesto no es cuestión de fps: es de PASO. Se mide cuántos
// cuadros de pantalla pasan entre cambio y cambio de fotograma, a velocidad de
// scroll constante. Si el paso es irregular, se siente duro aunque vaya a 100.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const BASE = process.argv[2] ?? "http://localhost:3015";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForTimeout(5000);

const r = await p.evaluate(async () => {
  const alto = document.body.scrollHeight - innerHeight;
  const hashes = [];
  const deltas = [];
  let last = performance.now();
  let on = true;
  const tick = (t) => { deltas.push(t - last); last = t; if (on) requestAnimationFrame(tick); };
  requestAnimationFrame(tick);

  const t0 = performance.now();
  while (performance.now() - t0 < 6000) {
    window.scrollTo(0, alto * 0.88 * ((performance.now() - t0) / 6000));
    await new Promise((r) => requestAnimationFrame(r));
    const c = document.querySelector("canvas");
    const d = c.getContext("2d").getImageData(c.width >> 1, c.height >> 1, 4, 4).data;
    let h = 0;
    for (let i = 0; i < d.length; i++) h = (h * 31 + d[i]) >>> 0;
    hashes.push(h);
  }
  on = false;

  const huecos = [];
  let ultimo = 0;
  hashes.forEach((h, i) => { if (i && h !== hashes[i - 1]) { huecos.push(i - ultimo); ultimo = i; } });
  const media = huecos.reduce((a, x) => a + x, 0) / huecos.length;
  const desv = Math.sqrt(huecos.reduce((a, x) => a + (x - media) ** 2, 0) / huecos.length);
  const s = deltas.slice(5).sort((a, x) => a - x);
  const c = document.querySelector("canvas");
  return {
    irregularidad: +(desv / media).toFixed(3),
    huecoMedio: +media.toFixed(2),
    fps: +(1000 / (s.reduce((a, x) => a + x, 0) / s.length)).toFixed(1),
    p95: +s[Math.floor(s.length * 0.95)].toFixed(1),
    buffer: c.width,
    css: c.clientWidth,
  };
});

console.log(JSON.stringify(r));
// El paso tiene que ser parejo: sin mezclar cuadros esto daba 0.53.
assert.ok(r.irregularidad < 0.2, `el paso es irregular (${r.irregularidad}); ¿se perdió la mezcla entre cuadros?`);
assert.ok(r.huecoMedio < 1.5, `la película no avanza en cada cuadro de pantalla (${r.huecoMedio})`);
// El buffer nunca por encima de la fuente: es lo que hundió los fps a 39.
assert.ok(r.buffer <= 1600, `el buffer del canvas (${r.buffer}) supera el ancho de los fotogramas`);
assert.ok(r.fps > 55, `va a ${r.fps} fps`);
await b.close();
console.log("suavidad.check ok");
