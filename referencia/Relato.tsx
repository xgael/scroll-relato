"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";
import { TOTAL } from "@/lib/secuencia";
import { VIDEO } from "@/lib/video";
import s from "./relato.module.css";

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
    let actual = 0;

    const dimensionar = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.clientWidth * dpr);
      canvas.height = Math.round(canvas.clientHeight * dpr);
      // setTransform y no scale: scale multiplica sobre la escala anterior.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const pintar = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const img = imagenes[actual];
      if (!img?.complete || !img.naturalWidth) return;
      const rImg = img.naturalWidth / img.naturalHeight;
      const rBox = w / h;
      const dw = rImg > rBox ? h * rImg : w;
      const dh = rImg > rBox ? h : w / rImg;
      ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    };

    for (let i = 0; i < TOTAL; i++) {
      const img = new Image();
      const hecho = () => {
        // Se pinta en cuanto llega el cuadro que toca, sin esperar a la
        // secuencia entera.
        if (i === actual) pintar();
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

    const lenis = new Lenis();
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
        scrub: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const p = self.progress;

          const cuadro = Math.round(Math.min(p / 0.88, 1) * (TOTAL - 1));
          if (cuadro !== actual) {
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
