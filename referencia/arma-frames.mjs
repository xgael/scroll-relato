// Convierte los clips de cada acto en la secuencia numerada que come el canvas.
//   node scripts/arma-frames.mjs [cuadrosPorActo]
//
// Salida: public/frames/frame_0001.jpg …  y lib/secuencia.ts con el total y
// los cortes de acto, para que el componente no tenga números a mano.
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, rm, readdir, rename, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VID = resolve(ROOT, "public", "video");
const FRAMES = resolve(ROOT, "public", "frames");
const POR_ACTO = Number(process.argv[2] ?? 52);
const ANCHO = 1600;

await rm(FRAMES, { recursive: true, force: true });
await mkdir(FRAMES, { recursive: true });

const clips = (await readdir(VID)).filter((f) => /^acto-\d+\.mp4$/.test(f)).sort();
if (!clips.length) {
  console.error("✗ no hay clips en public/video");
  process.exit(1);
}

let n = 0;
const cortes = [];

for (const clip of clips) {
  const tmp = resolve(FRAMES, "_tmp");
  await mkdir(tmp, { recursive: true });

  // La duración manda: se piden POR_ACTO cuadros repartidos por igual, así que
  // clips de distinta duración aportan el mismo peso al relato.
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-show_entries", "format=duration",
    "-of", "default=nw=1:nk=1", resolve(VID, clip),
  ]);
  const dur = parseFloat(stdout.trim());
  const fps = (POR_ACTO / dur).toFixed(4);

  await run("ffmpeg", [
    "-v", "error", "-i", resolve(VID, clip),
    "-vf", `fps=${fps},scale=${ANCHO}:-2`,
    "-frames:v", String(POR_ACTO),
    "-q:v", "4",
    resolve(tmp, "f_%04d.jpg"), "-y",
  ]);

  const salidos = (await readdir(tmp)).sort();
  cortes.push(n);
  for (const f of salidos) {
    n++;
    await rename(resolve(tmp, f), resolve(FRAMES, `frame_${String(n).padStart(4, "0")}.jpg`));
  }
  await rm(tmp, { recursive: true, force: true });
  console.log(`${clip}: ${salidos.length} cuadros (dur ${dur}s) → total ${n}`);
}

await writeFile(
  resolve(ROOT, "lib", "secuencia.ts"),
  `// GENERADO por scripts/arma-frames.mjs. No editar a mano.
export const TOTAL = ${n};

/** Índice del primer cuadro de cada acto, para anclar el copy al montaje. */
export const CORTES = ${JSON.stringify(cortes)} as const;

/** Progreso 0..1 en el que arranca cada acto. */
export const INICIOS = ${JSON.stringify(cortes.map((c) => +(c / n).toFixed(4)))} as const;
`,
);

console.log(`\n${n} cuadros. Cortes de acto en ${cortes.join(", ")}.`);
