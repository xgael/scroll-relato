"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { TOTAL } from "@/lib/secuencia";
import { VIDEO } from "@/lib/video";
import s from "./relato.module.css";

/** Ancho real de los jpg que escribe scripts/arma-frames.mjs. */
const ANCHO_FUENTE = 1600;

const rutaFotograma = (i: number) =>
  `/frames/frame_${(i + 1).toString().padStart(4, "0")}.jpg`;

/**
 * Los cuatro actos ocupan un cuarto del recorrido cada uno, igual que los
 * cortes de `CORTES` en lib/secuencia.ts (52 cuadros por acto). Cada
 * parlamento entra y sale dentro de su acto; el último se va antes para
 * dejarle el sitio al panel del video.
 */
const PARLAMENTOS = [
  {
    linea: <>La situación normal.</>,
    apunte: "El apunte que pone la tensión",
    entra: [0.02, 0.08],
    sale: [0.18, 0.23],
  },
  {
    linea: (
      <>
        Y aquí <em>falla</em>.
      </>
    ),
    apunte: "El acto más quieto de los cuatro",
    entra: [0.28, 0.34],
    sale: [0.43, 0.48],
  },
  {
    linea: <>Entra lo que lo cambia.</>,
    apunte: "Sin decir todavía el nombre del producto",
    entra: [0.53, 0.59],
    sale: [0.68, 0.72],
  },
  {
    linea: (
      <>
        Y el mundo <em>después</em>.
      </>
    ),
    apunte: "Aquí sí, y de aquí sale el remate",
    entra: [0.76, 0.81],
    sale: [0.84, 0.88],
  },
];

/** Rampa lineal acotada: 0 antes de `a`, 1 después de `b`. */
const rampa = (p: number, a: number, b: number) =>
  Math.min(1, Math.max(0, (p - a) / (b - a)));

export default function Relato() {
  const raiz = useRef<HTMLDivElement>(null);
  const marca = useRef<HTMLDivElement>(null);
  const escena = useRef<HTMLDivElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  const parlamentos = useRef<(HTMLDivElement | null)[]>([]);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    gsap.registerPlugin(ScrollTrigger);

    const canvas = lienzo.current!;
    const ctx = canvas.getContext("2d")!;
    const imagenes: HTMLImageElement[] = [];
    // Indice FRACCIONARIO: entre dos cuadros se mezcla, no se salta.
    let actual = 0;

    /*
     * El buffer del canvas NUNCA debe ser mas grande que el fotograma de
     * origen. Con devicePixelRatio 2 sobre 1440px salia un buffer de 2880 para
     * pintar jpg de 1600: se escalaba hacia arriba, y con la mezcla de dos
     * cuadros eso costo la mitad de los fps (94 -> 39). Capado al ancho real
     * de la fuente no se pierde un pixel de calidad, porque la fuente es el
     * limite.
     */
    const dimensionar = () => {
      const tope = ANCHO_FUENTE / Math.max(1, canvas.clientWidth);
      const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, tope));
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      // setTransform y no scale: scale multiplica sobre la escala anterior.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /** Dibuja un fotograma en modo cover. Devuelve false si aun no ha cargado. */
    const dibujar = (img: HTMLImageElement | undefined, alfa: number) => {
      if (!img?.complete || !img.naturalWidth || alfa <= 0) return false;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const rImg = img.naturalWidth / img.naturalHeight;
      const rBox = w / h;
      const dw = rImg > rBox ? h * rImg : w;
      const dh = rImg > rBox ? h : w / rImg;
      ctx.globalAlpha = alfa;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
      ctx.globalAlpha = 1;
      return true;
    };

    /*
     * La secuencia son 208 cuadros repartidos en ~7200px de scroll: 35px por
     * cuadro, o sea que la pelicula avanza unas 24 veces por segundo contra
     * una pantalla que va a 90. Ese escalon es lo que se siente duro, y no se
     * arregla con Lenis ni con el scrub (probado: la irregularidad bajo de
     * 0.53 a 0.51, nada).
     *
     * Se arregla mezclando: se dibuja el cuadro entero y encima el siguiente
     * con la alfa de la parte fraccionaria. El canvas tiene sitio de sobra
     * para los dos drawImage.
     */
    const pintar = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);

      const base = Math.floor(actual);
      const mezcla = actual - base;

      // Si el siguiente aun no carga, el de abajo se queda a alfa completa y
      // no se ve un parpadeo a medio camino.
      const hayNext = imagenes[base + 1]?.complete && imagenes[base + 1].naturalWidth > 0;
      dibujar(imagenes[base], 1);
      if (mezcla > 0 && hayNext) dibujar(imagenes[base + 1], mezcla);
    };

    for (let i = 0; i < TOTAL; i++) {
      const img = new Image();
      const hecho = () => {
        // Se pinta en cuanto llega el cuadro que toca, sin esperar a la
        // secuencia entera.
        if (Math.floor(actual) === i || Math.floor(actual) + 1 === i) pintar();
      };
      img.onload = hecho;
      img.onerror = hecho;
      img.src = rutaFotograma(i);
      imagenes.push(img);
    }

    dimensionar();
    pintar();

    const ro = new ResizeObserver(() => {
      dimensionar();
      pintar();
      ScrollTrigger.refresh();
    });
    ro.observe(canvas);

    if (quieto) {
      actual = TOTAL - 1;
      pintar();
      return () => ro.disconnect();
    }

    /*
     * Medido, no elegido a ojo. Con los valores por defecto (lerp 0.1,
     * scrub 1) la pelicula avanzaba a veces cada cuadro de pantalla y a
     * veces cada seis: irregularidad 0.53. Los fps estaban bien; lo que se
     * sentia duro era el PASO, no el rendimiento.
     *
     * lerp mas bajo alisa la velocidad del scroll, y un scrub mas alto alisa
     * la curva de progreso que come el canvas. Bajar de estos valores empieza
     * a sentirse despegado del dedo, que es la sobrecorreccion tipica.
     */
    const lenis = new Lenis({
      lerp: 0.075,
      wheelMultiplier: 0.9, // 900dvh no deberian pasar volando
      syncTouch: true, // en tactil, Lenis no suaviza por defecto
    });
    lenis.on("scroll", ScrollTrigger.update);
    const ticker = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(ticker);
    gsap.ticker.lagSmoothing(0);

    const contexto = gsap.context(() => {
      ScrollTrigger.create({
        trigger: escena.current,
        start: "top top",
        end: () => `+=${escena.current!.offsetHeight - window.innerHeight}`,
        pin: escena.current!.firstElementChild as HTMLElement,
        pinSpacing: false,
        scrub: 1.5,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const p = self.progress;

          // Sin redondear: el valor fraccionario es lo que permite mezclar.
          const cuadro = Math.min(p / 0.88, 1) * (TOTAL - 1);
          if (Math.abs(cuadro - actual) > 0.004) {
            actual = cuadro;
            pintar();
          }

          // La marca se va en cuanto arranca el relato y vuelve al final.
          gsap.set(marca.current, {
            opacity: p < 0.06 ? 1 - rampa(p, 0.02, 0.06) : rampa(p, 0.9, 0.96),
          });

          PARLAMENTOS.forEach((x, i) => {
            const el = parlamentos.current[i];
            if (!el) return;
            const dentro = rampa(p, x.entra[0], x.entra[1]);
            const fuera = rampa(p, x.sale[0], x.sale[1]);
            const o = dentro * (1 - fuera);
            gsap.set(el, {
              opacity: o,
              // Sube un poco al entrar y sigue subiendo al salir: el texto
              // pasa por delante de la película, no aparece y desaparece.
              y: (1 - dentro) * 40 - fuera * 40,
            });
          });

          // El panel entra antes de que acabe el pin y se queda puesto el
          // ultimo tramo: si entra en el 10% final, el cierre lo pisa y el
          // video, que es el remate, no llega a verse.
          const entrada = rampa(p, 0.86, 0.95);
          gsap.set(panel.current, {
            transform: `translateZ(${(1 - entrada) * 900}px)`,
            opacity: entrada,
          });
        },
      });
    }, raiz);

    return () => {
      contexto.revert();
      ro.disconnect();
      gsap.ticker.remove(ticker);
      lenis.destroy();
    };
  }, []);

  return (
    <div ref={raiz}>
      {/* Sustituye por la marca del proyecto. Se desvanece al arrancar el
          relato y vuelve al final. */}
      <div className={s.marca} ref={marca}>
        <span>Marca</span>
      </div>

      <section className={s.escena} ref={escena}>
        <div className={s.pegado}>
          <canvas className={s.lienzo} ref={lienzo} aria-hidden="true" />
          <div className={s.velo} aria-hidden="true" />

          <div className={s.parlamentos}>
            {PARLAMENTOS.map((x, i) => (
              <div
                className={s.parlamento}
                key={i}
                ref={(el) => {
                  parlamentos.current[i] = el;
                }}
              >
                <h2 className={s.linea}>{x.linea}</h2>
                <p className={s.apunte}>{x.apunte}</p>
              </div>
            ))}
          </div>

          <div className={s.panelCaja}>
            <div className={s.panel} ref={panel}>
              {!VIDEO.src ? (
                <div className={s.panelVacio}>
                  <strong>Aquí va el video</strong>
                  <span>Pendiente del cliente</span>
                </div>
              ) : VIDEO.tipo === "youtube" ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${VIDEO.src}?rel=0`}
                  title={VIDEO.titulo}
                  loading="lazy"
                  allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              ) : (
                <video src={VIDEO.src} controls playsInline preload="none" title={VIDEO.titulo} />
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
