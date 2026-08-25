// Genera la secuencia de un relato con scroll anclado usando Veo.
//   node scripts/gen-secuencia.mjs            # los cuatro actos
//   node scripts/gen-secuencia.mjs --only=1   # sólo el acto 1
// Salida: public/video/acto-N.mp4
import { GoogleGenAI } from "@google/genai";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const VID = resolve(ROOT, "public", "video");

if (!process.env.GEMINI_API_KEY && existsSync(resolve(ROOT, ".env.local"))) {
  for (const l of (await readFile(resolve(ROOT, ".env.local"), "utf8")).split("\n")) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m) process.env[m[1]] ??= m[2].replace(/^["']|["']$/g, "");
  }
}

// Gramática común: el mismo taller y la misma luz, para que los cuatro cortes
// se lean como montaje y no como cuatro videos distintos.
// Ojo: pedir "anamorphic" y "35mm" hizo que Veo dibujara una TIRA DE PELICULA
// con perforaciones y numeros de cuadro dentro de la imagen. El look se pide
// por color y profundidad, y se prohibe el borde explicitamente.
const ESTILO = [
  "cinematic documentary look, shallow depth of field, subtle grain",
  "full bleed frame, no film strip, no sprocket holes, no letterbox, no border",
  "one single Mexican tire shop and mechanic workshop location throughout",
  "palette of warm near-black, concrete grey, rubber, and red shop signage",
  "slow deliberate camera, no cuts inside the shot",
  "absolutely no letters, words, signage text, brand names or captions anywhere in frame: all signs and banners are blank painted panels",
];

// Un acto = un plano y una frase. Cambia estas cuatro descripciones por las
// de tu relato; lo que NO se toca son las dos prohibiciones del ESTILO de
// arriba, que son las que evitan la tira de película y los letreros inventados.
const ACTOS = [
  {
    n: 1,
    prompt:
      "Acto 1: la situación normal, con la tensión ya puesta. Un plano lento que entra hacia el objeto que va a fallar. Nadie en cuadro.",
  },
  {
    n: 2,
    prompt:
      "Acto 2: el fallo. El mismo encuadre del acto 1, ahora más quieto y más oscuro. Es el acto que puede ser casi estático.",
  },
  {
    n: 3,
    prompt:
      "Acto 3: entra lo que cambia las cosas. Misma localización, se enciende algo. Órbita lenta. Sin efectismo.",
  },
  {
    n: 4,
    prompt:
      "Acto 4: el mundo después. Misma localización a plena luz y en marcha, con gente. Grúa lenta que abre el plano.",
  },
];

const soloArg = process.argv.find((a) => a.startsWith("--only="));
const solo = soloArg ? new Set(soloArg.slice(7).split(",").map(Number)) : null;
const cola = solo ? ACTOS.filter((a) => solo.has(a.n)) : ACTOS;

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error("✗ falta GEMINI_API_KEY");
  process.exit(1);
}
const ai = new GoogleGenAI({ apiKey });
const MODELOS = ["veo-3.1-fast-generate-preview", "veo-3.1-generate-preview"];

await mkdir(VID, { recursive: true });

for (const acto of cola) {
  const salida = resolve(VID, `acto-${acto.n}.mp4`);
  let hecho = false;

  for (const model of MODELOS) {
    try {
      process.stdout.write(`-> acto ${acto.n} con ${model} `);
      const peticion = {
        model,
        prompt: `${acto.prompt} ${ESTILO.join(", ")}.`,
        config: { aspectRatio: "16:9", numberOfVideos: 1 },
      };

      // El robot es el mismo personaje en los cuatro actos: cuando aparece se
      // le pasa su render de marca como primer fotograma para que no cambie.
      if (acto.robot) {
        const bytes = await readFile(resolve(ROOT, "public", "robots", acto.robot));
        peticion.image = { imageBytes: bytes.toString("base64"), mimeType: "image/png" };
      }

      let op = await ai.models.generateVideos(peticion);
      const t0 = Date.now();
      while (!op.done) {
        if (Date.now() - t0 > 9 * 60 * 1000) throw new Error("se agoto la espera (9m)");
        await new Promise((r) => setTimeout(r, 10000));
        process.stdout.write(".");
        op = await ai.operations.getVideosOperation({ operation: op });
      }
      const video = op.response?.generatedVideos?.[0]?.video;
      if (!video) throw new Error("la respuesta no trae video");
      await ai.files.download({ file: video, downloadPath: salida });
      console.log(` ok -> acto-${acto.n}.mp4`);
      hecho = true;
      break;
    } catch (e) {
      console.log(` fallo: ${e.message ?? e}`);
    }
  }
  if (!hecho) console.error(`AVISO: acto ${acto.n} sin video`);
}
