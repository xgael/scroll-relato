---
name: scroll-relato
description: >
  Construye una página de relato con scroll anclado: una secuencia de fotogramas
  pintada en canvas que avanza con el scroll mientras el copy entra y sale por
  actos, y que remata en un video o en una pieza final. Cubre el motor
  (GSAP ScrollTrigger pin + scrub sobre Next), la generación de la secuencia con
  Veo, la coreografía del texto, la verificación por barrido y las trampas de
  despliegue. Úsala para scroll-telling, hero de video scrubeado, secuencia de
  imágenes por scroll, o cuando alguien diga "algo tipo Adaline" o "que se
  cuente solo al bajar".
---

# Relato con scroll anclado

Una escena que se queda fija mientras el scroll la recorre: la película avanza
cuadro a cuadro, el texto entra por actos, y al final entra la pieza que paga
el recorrido. Es caro de hacer bien y muy fácil de hacer mal, porque casi todo
lo que falla no se ve en una captura estática.

**No es para**: landings de conversión, páginas con formulario arriba, ni nada
donde el usuario venga a hacer una tarea. Un recorrido de 900dvh es un anuncio,
no una herramienta. Si la página tiene que convertir, esto va antes del embudo,
no dentro.

---

## 1. La forma del relato, antes que el código

Escribe los actos antes de generar un solo fotograma. Un acto es **un plano y
una frase**. Cuatro actos es el punto dulce: menos no cuenta nada, más y el
usuario suelta el scroll.

La estructura que funciona es la del problema que el producto resuelve, contada
sin decir el nombre del producto hasta el final:

| acto | función |
|---|---|
| 1 | La situación normal, con la tensión ya puesta |
| 2 | El fallo. Es el único acto que puede ser casi estático |
| 3 | La entrada de lo que cambia las cosas |
| 4 | El mundo después, y ahí el remate |

**Reusa el copy que ya está vivo.** Si la marca tiene un embudo, un quiz o un
VSL, sus titulares ya están calibrados y el cliente ya los aprobó. Un relato que
estrena eslóganes es un relato que hay que volver a discutir.

**Cierra el guion antes de generar.** Cada acto son minutos de generación y
dinero. Enseñar la tabla de arriba y esperar el visto bueno cuesta un mensaje.

---

## 2. El motor: pin + scrub, y por qué se queda en GSAP

La técnica canónica es `ScrollTrigger` con `pin: true` y `scrub`, con Lenis
enganchado al ticker de GSAP. **Existe la tentación de portarlo a
`useScroll`/`useTransform`. No lo hagas si el proyecto ya tiene GSAP**: el
`pin` con `pinSpacing` y el `scrub` con inercia no tienen equivalente de una
línea, y lo que sale es una reimplementación peor.

Portar un template de Vite a Next es cambiar el envoltorio, no la tecnología.
Cuatro cosas se rompen siempre en ese cambio:

```
DOMContentLoaded          → useEffect. El componente monta después de ese evento.
                            gsap.context() + revert() en la limpieza, o el Fast
                            Refresh apila ScrollTriggers invisibles.

end: innerHeight * 7      → la altura la declara el CSS en dvh, el `end` es una
                            FUNCIÓN y lleva invalidateOnRefresh. En iOS la barra
                            de direcciones cambia innerHeight a media animación
                            y el final del recorrido se va a otro sitio.

context.scale(dpr, dpr)   → setTransform(dpr,0,0,dpr,0,0). scale multiplica
                            sobre la escala vigente: dos resizes y el dibujo
                            sale al doble.

esperar los N fotogramas  → pinta en cuanto llega el cuadro que toca. El patrón
                            original espera a cargar la secuencia entera antes
                            del primer píxel.
```

Y `ResizeObserver` en vez del listener de `resize`: también dispara cuando la
caja cambia sin que cambie la ventana.

### El esqueleto

```
<section escena>            height: 900dvh    ← el recorrido lo declara el CSS
  <div pegado>              height: 100dvh; overflow: hidden   ← esto es lo que se ancla
    <canvas>                la película
    <div velo>              el degradado que sostiene el texto
    <div parlamentos>       grid; todos los actos apilados en la misma celda
    <div panelCaja>         el remate
```

```js
ScrollTrigger.create({
  trigger: escena,
  start: "top top",
  end: () => `+=${escena.offsetHeight - window.innerHeight}`,
  pin: escena.firstElementChild,
  pinSpacing: false,
  scrub: 1,
  invalidateOnRefresh: true,
  onUpdate: (self) => { /* un solo sitio donde vive toda la coreografía */ },
});
```

Con `prefers-reduced-motion`: la escena mide una pantalla, se pinta el último
fotograma, los parlamentos se apilan como texto normal y el remate ya está
puesto. No hay recorrido que anclar, así que no se ancla nada.

---

## 3. La secuencia: generarla, no descargarla

Los templates de este gesto traen 200 jpg de stock y pesan 100 MB. **Se copia el
patrón, nunca el directorio.**

Un clip por acto. Con Veo, 8s a 24fps son ~192 cuadros por clip; se muestrean
~52 y salen ~200 en total, que es lo que pide el gesto.

### Gramática común

Todos los clips comparten una lista de estilo para que los cortes se lean como
montaje y no como cuatro videos distintos: misma localización, misma luz, misma
paleta, cámara lenta y deliberada.

### Dos trampas de Veo, con receta

```
"anamorphic", "35mm"   → dibuja una TIRA DE PELÍCULA, con perforaciones y
                         números de cuadro DENTRO de la imagen. El look se pide
                         por color y profundidad de campo, y se prohíbe el borde:
                         "full bleed frame, no film strip, no sprocket holes,
                          no letterbox, no border"

letreros               → inventa texto y sale basura ("PUENOS METIS" en un
                         taller). Hay que prohibirlo explícitamente:
                         "absolutely no letters, words, signage text or brand
                          names anywhere in frame: all signs are blank panels"
```

**El personaje se describe con palabras, no con imagen semilla.** Pasarle un
render del personaje como primer fotograma parece la forma de mantener la
consistencia, pero si ese render está sobre fondo blanco de estudio, el clip
arranca en el limbo y el corte es peor que la inconsistencia que querías evitar.

### El ensamblador

Un script convierte los clips en jpg numerados en continuo **y escribe un
archivo de constantes**. El componente no lleva números a mano:

```ts
// GENERADO. No editar.
export const TOTAL = 208;
export const CORTES = [0, 52, 104, 156];   // primer cuadro de cada acto
export const INICIOS = [0, 0.25, 0.5, 0.75]; // progreso donde arranca cada acto
```

Presupuesto de peso: **~17 MB** para 200 cuadros a 1600px con `-q:v 4`. Si pasa
de 25 MB, baja el ancho antes que el número de cuadros: la fluidez se nota más
que la resolución.

---

## 4. La coreografía del texto

Todos los parlamentos viven apilados en la misma celda de un grid, y cada uno
tiene su ventana de entrada y de salida en progreso:

```js
const rampa = (p, a, b) => Math.min(1, Math.max(0, (p - a) / (b - a)));
const dentro = rampa(p, x.entra[0], x.entra[1]);
const fuera  = rampa(p, x.sale[0], x.sale[1]);
gsap.set(el, { opacity: dentro * (1 - fuera), y: (1 - dentro) * 40 - fuera * 40 });
```

Sube al entrar y sigue subiendo al salir: el texto **pasa por delante** de la
película, no aparece y desaparece en el sitio.

### Tres trampas de maquetación

**`ch` en el contenedor.** `max-width: 22ch` puesto en el bloque que envuelve al
titular se resuelve contra los 16px que hereda del body, no contra los 96px de
la caja alta. Da ~200px y el titular sale apilado en una columna. **La medida va
en el elemento que tiene el tamaño de fuente grande.**

**El velo pesa en el centro, no arriba y abajo.** El texto vive en medio, y si
un acto amanece, un degradado vertical no lo sostiene. Radial centrado.

**La plancha va como fondo del bloque, no como `::before` con `z-index: -1`.**
Dentro del contexto de apilamiento que crea la opacidad que le pone GSAP, el
pseudo-elemento negativo no llega a pintarse.

### El remate necesita aire

El error más caro: hacer que la pieza final entre en el último 10% del
recorrido. Ahí el pin ya se está soltando y la siguiente sección la pisa, así
que **el remate, que es la razón de toda la página, no llega a verse**. Entra
antes (≈0.86) y se queda puesta el último tramo.

---

## 5. Verificar, que es donde se cae todo

Nada de esto se ve en una captura. **Capturar en fracciones fijas del documento
cae a media transición y parece un problema de contraste que no existe.** Yo me
comí ese fantasma entero: velos, sombras y planchas para un texto que sólo
estaba a la mitad de su fundido.

La prueba recorre el relato en ~100 posiciones y mide:

```
la secuencia avanza      hash de píxeles del centro del canvas en cada posición;
                         el número de hashes distintos tiene que ser alto

cada parlamento se lee   máximo de opacidad POR ACTO a lo largo del recorrido.
                         Si uno no llega a 1, su ventana se solapa con la del
                         siguiente y nadie lo lee nunca

el remate aterriza       opacidad × fracción de pantalla que ocupa. Que exista
                         no basta: tiene que quedarse

la consola limpia        pageerror y console.error
```

Y para las capturas de revisión: **busca el pico de opacidad de cada acto y
captura ahí**, no en fracciones a ojo.

---

## 6. Que se sienta suave, que no es lo mismo que ir a 60fps

**Mide antes de tocar perillas.** La queja "no se siente smooth" casi nunca es
rendimiento. En la pieza donde se escribió esta skill, el recorrido iba a
**94 fps con ocho cuadros lentos en total** y aun así se sentía duro.

Lo que se siente es el **paso**: cuántos cuadros de pantalla pasan entre cambio
y cambio de fotograma. Con 208 cuadros repartidos en 7200px de scroll son 35px
por cuadro, o sea que la película avanza unas 24 veces por segundo contra una
pantalla de 90, y de forma irregular. La métrica es la desviación de ese hueco
dividida entre su media:

```
irregularidad = desviación(huecos) / media(huecos)     0 = paso perfecto
```

### Afinar Lenis y el scrub no lo arregla

Bajar el `lerp` a 0.075 y subir el `scrub` a 1.5 movió la irregularidad de
**0.53 a 0.51**. Nada. Vale la pena por el carácter (y `syncTouch: true` para
que en táctil también suavice), pero no es la palanca.

### Lo que sí: mezclar entre fotogramas

El índice del cuadro se deja **fraccionario**, se dibuja el cuadro entero y
encima el siguiente con la alfa de la parte decimal:

```js
const base = Math.floor(actual);
const mezcla = actual - base;
dibujar(imagenes[base], 1);
if (mezcla > 0 && cargado(imagenes[base + 1])) dibujar(imagenes[base + 1], mezcla);
```

Irregularidad **0.53 → 0.08**, y la película pasa a cambiar en cada cuadro de
pantalla. Si el siguiente todavía no ha cargado, el de abajo se queda a alfa
completa: sin eso se ve un parpadeo a medio camino.

### Y la trampa que se come el doble de fps

Los dos `drawImage` hundieron el escritorio de **94 a 39 fps**. La causa no era
la mezcla:

```
buffer del canvas 2880px  ·  fotogramas de 1600px  →  escalando HACIA ARRIBA
```

Con `devicePixelRatio 2` sobre 1440px de ancho, el buffer sale de 2880 para
pintar jpg de 1600. **El buffer nunca debe ser más grande que la fuente**:

```js
const tope = ANCHO_FUENTE / Math.max(1, canvas.clientWidth);
const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, tope));
```

No se pierde un píxel de calidad, porque la fuente es el límite. Con eso quedan
**109 fps**: más que antes de meter la mezcla.

### La prueba

Va al `check` y falla si alguien quita la mezcla o vuelve a subir el buffer:

```
irregularidad < 0.2      el paso es parejo
hueco medio < 1.5        la película avanza en cada cuadro de pantalla
buffer <= ANCHO_FUENTE   nadie escala hacia arriba
fps > 55
```

---

## 7. Desplegar

```
public/frames en .gitignore  +  sin .vercelignore  =  sitio sin una sola imagen
```

El CLI de Vercel usa `.gitignore` cuando no existe `.vercelignore`. Los
fotogramas están ignorados a propósito (se regeneran), así que hay que escribir
un `.vercelignore` que sí los deje pasar y que de paso deje fuera los clips de
origen, que ya no se sirven.

Verifica **contra el dominio**, no contra local: pide tres o cuatro fotogramas
sueltos por HTTP y corre la prueba de barrido apuntando a producción. Y si el
primer `curl` devuelve lo viejo, es caché del CDN: repite con `Cache-Control:
no-cache` antes de diagnosticar nada.

---

## Lista de verificación

- [ ] El guion está cerrado y aprobado antes de generar fotogramas
- [ ] El copy reusa titulares que ya están vivos en la marca
- [ ] `end` es función, altura en `dvh`, `invalidateOnRefresh`
- [ ] `gsap.context()` con `revert()` en la limpieza
- [ ] `setTransform` y no `scale` al redimensionar el canvas
- [ ] Se pinta el primer cuadro sin esperar a la secuencia entera
- [ ] `prefers-reduced-motion` colapsa la escena a una pantalla
- [ ] La medida del titular está en el elemento con la fuente grande
- [ ] El remate entra con aire y se queda puesto
- [ ] La prueba de barrido verifica: secuencia, cada acto, remate, consola
- [ ] Se mezcla entre fotogramas: el índice es fraccionario, no redondeado
- [ ] El buffer del canvas no supera el ancho de los fotogramas
- [ ] La irregularidad del paso está medida y por debajo de 0.2
- [ ] `.vercelignore` deja pasar los fotogramas
- [ ] Verificado contra el dominio, no contra localhost
