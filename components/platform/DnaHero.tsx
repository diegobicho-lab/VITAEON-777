"use client";

/**
 * DnaHero — Doble hélice ADN con Canvas 2D, efecto de profundidad real.
 *
 * Cero dependencias adicionales. Solo Canvas 2D API nativa del browser.
 *
 * Técnica:
 *  - Painter's algorithm: cada elemento (segmento, escalón, átomo) tiene z.
 *  - Se ordenan back→front cada frame para profundidad correcta.
 *  - La z controla lineWidth, opacity y shadowBlur (solo átomos en frente).
 *  - Mouse/touch parallax con lerp suave.
 *  - HiDPI: canvas buffer escalado por devicePixelRatio.
 *
 * Rendimiento: ~420 elementos/frame → 60 fps estables en Canvas 2D.
 */

import { useRef, useEffect } from "react";

/* ── Paleta RGB ─────────────────────────────────────── */
const C_SA  = [30,  155, 212] as const;   // strand A  #1e9bd4
const C_SB  = [12,  122, 176] as const;   // strand B  #0c7ab0
const C_AA  = [125, 211, 252] as const;   // átomo A   #7dd3fc
const C_AB  = [165, 243, 252] as const;   // átomo B   #a5f3fc
const C_RLO = [139,  92, 246] as const;   // rung bajo #8b5cf6 (violeta)
const C_RHI = [  6, 182, 212] as const;   // rung alto #06b6d4 (cian)

function rgba(
  [r, g, b]: readonly [number, number, number],
  a: number,
): string {
  return `rgba(${r},${g},${b},${a.toFixed(3)})`;
}

function lerpColor(
  lo: readonly [number, number, number],
  hi: readonly [number, number, number],
  t: number,
): readonly [number, number, number] {
  return [
    Math.round(lo[0] + (hi[0] - lo[0]) * t),
    Math.round(lo[1] + (hi[1] - lo[1]) * t),
    Math.round(lo[2] + (hi[2] - lo[2]) * t),
  ];
}

/* ── Partículas flotantes ───────────────────────────── */
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number; alpha: number;
}

function makeParticles(w: number, h: number, n: number): Particle[] {
  return Array.from({ length: n }, () => ({
    x:     Math.random() * w,
    y:     Math.random() * h,
    vx:    (Math.random() - 0.5) * 0.22,
    vy:    (Math.random() - 0.5) * 0.22,
    r:     Math.random() * 1.6 + 0.4,
    alpha: Math.random() * 0.30 + 0.07,
  }));
}

/* ── Componente ─────────────────────────────────────── */
export default function DnaHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    /* Parámetros según dispositivo */
    const isMobile = window.innerWidth < 768;
    const dpr      = Math.min(window.devicePixelRatio, 2);
    const TURNS    = 2.5;
    const SEGS     = isMobile ? 130 : 200;   // suavidad del backbone
    const N_RUNGS  = isMobile ? 16  : 22;    // escalones
    const N_PARTS  = isMobile ? 18  : 32;    // partículas
    const ROT_SPD  = 0.009;                  // rad por frame (≈30°/s)

    let t          = 0;
    let animId     = 0;
    let mouseX     = 0;
    let targetMX   = 0;
    let parts: Particle[] = [];

    /* ── Setup canvas ───────────────────────────────── */
    function setup() {
      const w = canvas!.offsetWidth;
      const h = canvas!.offsetHeight;
      if (!w || !h) return;
      canvas!.width  = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.scale(dpr, dpr);
      parts = makeParticles(w, h, N_PARTS);
    }
    setup();

    const ro = new ResizeObserver(setup);
    ro.observe(canvas);

    /* ── Eventos de cursor ──────────────────────────── */
    const onMM = (e: MouseEvent) => {
      const r = canvas!.getBoundingClientRect();
      targetMX = (e.clientX - r.left) / r.width - 0.5;
    };
    const onTM = (e: TouchEvent) => {
      const r = canvas!.getBoundingClientRect();
      const touch = e.touches[0];
      if (touch) targetMX = (touch.clientX - r.left) / r.width - 0.5;
    };
    const onLeave = () => { targetMX = 0; };

    canvas.addEventListener("mousemove", onMM,     { passive: true });
    canvas.addEventListener("touchmove", onTM,     { passive: true });
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("touchend",  onLeave);

    /* ── Loop principal ─────────────────────────────── */
    function draw() {
      const W = canvas!.offsetWidth;
      const H = canvas!.offsetHeight;
      if (!W || !H) { animId = requestAnimationFrame(draw); return; }

      /* Lerp del mouse — suave, nunca brusco */
      mouseX += (targetMX - mouseX) * 0.055;

      ctx!.clearRect(0, 0, W, H);

      const cx   = W * 0.5;
      const amp  = W * 0.27;               // amplitud x de la hélice
      const tilt = mouseX * Math.PI * 0.5; // fase extra del mouse

      /* ── Lista de elementos con profundidad ───────── */
      type Elem = { z: number; fn: () => void };
      const elems: Elem[] = [];

      /* Segmentos de backbone */
      for (let i = 0; i < SEGS; i++) {
        const f0  = i       / SEGS;
        const f1  = (i + 1) / SEGS;
        const ph0 = f0 * Math.PI * 2 * TURNS + t + tilt;
        const ph1 = f1 * Math.PI * 2 * TURNS + t + tilt;
        const y0  = f0 * H;
        const y1  = f1 * H;
        const s0  = Math.sin(ph0);
        const s1  = Math.sin(ph1);
        const z   = (Math.cos(ph0) + Math.cos(ph1)) * 0.5;

        /* Strand A */
        const ax0 = cx + amp * s0;
        const ax1 = cx + amp * s1;
        const zA  = z;
        elems.push({ z: zA, fn: () => {
          const d  = (zA + 1) * 0.5;
          ctx!.beginPath();
          ctx!.moveTo(ax0, y0);
          ctx!.lineTo(ax1, y1);
          ctx!.strokeStyle = rgba(C_SA, 0.18 + d * 0.82);
          ctx!.lineWidth   = 0.5 + d * 2.5;
          ctx!.stroke();
        }});

        /* Strand B (opuesto: -sin) */
        const bx0 = cx - amp * s0;
        const bx1 = cx - amp * s1;
        const zB  = -z;
        elems.push({ z: zB, fn: () => {
          const d  = (zB + 1) * 0.5;
          ctx!.beginPath();
          ctx!.moveTo(bx0, y0);
          ctx!.lineTo(bx1, y1);
          ctx!.strokeStyle = rgba(C_SB, 0.18 + d * 0.82);
          ctx!.lineWidth   = 0.5 + d * 2.5;
          ctx!.stroke();
        }});
      }

      /* Escalones (base pairs) + átomos terminales */
      for (let i = 0; i < N_RUNGS; i++) {
        const f   = i / (N_RUNGS - 1);
        const ph  = f * Math.PI * 2 * TURNS + t + tilt;
        const y   = f * H;
        const ax  = cx + amp * Math.sin(ph);
        const bx  = cx - amp * Math.sin(ph);
        const zR  = Math.cos(ph);
        const col = lerpColor(C_RLO, C_RHI, f);

        elems.push({ z: zR, fn: () => {
          const d   = (zR + 1) * 0.5;
          const lw  = 0.6 + d * 1.8;
          const ar  = 1.6 + d * 4.0;   // radio del átomo

          /* Línea del escalón */
          ctx!.beginPath();
          ctx!.moveTo(ax, y);
          ctx!.lineTo(bx, y);
          ctx!.strokeStyle = rgba(col, 0.15 + d * 0.72);
          ctx!.lineWidth   = lw;
          ctx!.stroke();

          /* Átomo strand A — glow solo si está en frente */
          ctx!.shadowBlur  = d > 0.58 ? d * 14 : 0;
          ctx!.shadowColor = rgba(C_AA, 0.9);
          ctx!.beginPath();
          ctx!.arc(ax, y, ar, 0, Math.PI * 2);
          ctx!.fillStyle = rgba(C_AA, 0.25 + d * 0.68);
          ctx!.fill();
          ctx!.shadowBlur = 0;

          /* Átomo strand B */
          ctx!.shadowBlur  = d > 0.58 ? d * 14 : 0;
          ctx!.shadowColor = rgba(C_AB, 0.9);
          ctx!.beginPath();
          ctx!.arc(bx, y, ar, 0, Math.PI * 2);
          ctx!.fillStyle = rgba(C_AB, 0.25 + d * 0.68);
          ctx!.fill();
          ctx!.shadowBlur = 0;
        }});
      }

      /* Ordenar back→front y renderizar */
      elems.sort((a, b) => a.z - b.z);
      for (const el of elems) el.fn();

      /* ── Partículas flotantes ────────────────────── */
      for (const p of parts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = W;
        else if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H;
        else if (p.y > H) p.y = 0;

        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = rgba(C_AB, p.alpha);
        ctx!.fill();
      }

      /* Avanzar tiempo */
      t += ROT_SPD;
      animId = requestAnimationFrame(draw);
    }

    draw();

    /* Cleanup */
    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMM);
      canvas.removeEventListener("touchmove", onTM);
      canvas.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("touchend",  onLeave);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="h-full w-full"
      style={{ display: "block" }}
      aria-hidden="true"
    />
  );
}
