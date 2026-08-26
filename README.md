# scroll-relato

Skill de Claude Code para construir **páginas de relato con scroll anclado**:
una secuencia de fotogramas pintada en canvas que avanza con el scroll mientras
el copy entra y sale por actos, y que remata en un video o en una pieza final.

El gesto es el de Adaline y compañía. Está por todos lados y casi siempre mal
hecho, porque **lo que falla no se ve en una captura estática**.

## Qué cubre

- **El motor**: GSAP ScrollTrigger con `pin` y `scrub` sobre Next, y por qué no
  conviene portarlo a `useScroll` si el proyecto ya tiene GSAP.
- **La secuencia**: generarla con Veo, un clip por acto, en vez de arrastrar
  100 MB de fotogramas de stock.
- **La coreografía** del texto por ventanas de progreso.
- **La verificación**: un barrido que recorre el relato y mide lo que una
  captura no puede.
- **Que se sienta suave**, que no es lo mismo que ir a 60fps.
- **Las trampas de despliegue**, que se comen el trabajo entero.

## Instalar

```bash
git clone https://github.com/xgael/scroll-relato ~/.claude/skills/scroll-relato
```

Y se invoca con `/scroll-relato`.

## Las trampas que documenta

Todas cobradas en producción, con su síntoma exacto:

- Pedirle a Veo *anamorphic* o *35mm* le hace dibujar **una tira de película**,
  con perforaciones y números de cuadro dentro de la imagen.
- Sin prohibírselo, **inventa letreros**: un taller acabó diciendo
  "PUENOS METIS".
- `max-width: 22ch` en el contenedor del titular se resuelve contra los 16px del
  body y no contra los 96px de la caja alta: da 200px y el titular sale apilado
  en una columna.
- Si la pieza final entra en el último 10% del recorrido, **la siguiente sección
  la pisa** y el remate no llega a verse.
- `public/frames` en `.gitignore` y sin `.vercelignore`: el CLI de Vercel usa el
  primero y **el sitio sale sin una sola imagen**.
- Capturar en fracciones fijas del documento cae a media transición y parece un
  problema de contraste que no existe.
- "No se siente smooth" a **94 fps**: no era rendimiento, era el escalón entre
  fotogramas. Afinar Lenis y el scrub no lo arregla (0.53 → 0.51); mezclar entre
  cuadros sí (0.53 → **0.08**).
- Un buffer de canvas de 2880px para pintar fotogramas de 1600 escala **hacia
  arriba** y cuesta la mitad de los fps.

## Contenido

```
SKILL.md          la skill
referencia/       implementación real, vaciada de contenido de cliente
```

`referencia/` sale de una pieza en producción, con el guion, los prompts y los
tokens sustituidos por marcadores.

## Licencia

MIT.
