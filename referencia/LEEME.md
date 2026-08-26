# Implementación de referencia

Extraído de una pieza real en producción y **vaciado de su contenido**: el
guion, los prompts y los tokens son marcadores. Son archivos para leer y
adaptar, no una librería.

Lo que hay que cambiar sí o sí: los cuatro `PARLAMENTOS` de `Relato.tsx`, los
cuatro `ACTOS` de `gen-secuencia.mjs`, y los tokens `--acento` / `--acento-claro`
/ `--black` / `--paper` del CSS.

| archivo | qué es |
|---|---|
| `Relato.tsx` | El componente completo: pin, scrub, canvas, coreografía y remate |
| `relato.module.css` | La escena en dvh, el velo radial, la plancha del texto, reduced-motion |
| `gen-secuencia.mjs` | Un clip de Veo por acto, con la gramática común y las dos prohibiciones |
| `arma-frames.mjs` | Los clips a jpg numerados + el archivo de constantes generado |
| `relato.check.mjs` | El barrido que verifica secuencia, cada acto, el remate y la consola |
| `suavidad.check.mjs` | Mide el paso: irregularidad, hueco medio, fps y tamaño del buffer |

Dependencias: `gsap`, `lenis`, `@google/genai` (sólo para generar), `playwright`
(sólo para la prueba), y `ffmpeg` en el sistema.

Orden de trabajo:

```
1. cerrar el guion con el cliente
2. npm run secuencia    # los clips
3. npm run frames       # jpg + lib/secuencia.ts
4. ajustar las ventanas de cada parlamento en Relato.tsx
5. npm run check        # relato + suavidad, y sólo entonces enseñarlo
```
