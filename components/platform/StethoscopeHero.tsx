"use client";

/**
 * StethoscopeHero — Estetoscopio médico premium con Canvas 2D.
 *
 * - Tubo con curvas bezier suaves (forma omega característica)
 * - Piezade tórax (diafragma) con anillos de pulso tipo latido
 * - Float suave + parallax leve con mouse/touch
 * - Partículas flotantes ambientales
 * - HiDPI: canvas escalado por devicePixelRatio
 */

import { useRef, useEffect } from "react";

interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  r: number; alpha: number;
}

function makeParticles(w: number, h: number, n: number): Particle[] {
  return Array.from({ length: n }, () => ({
    x:     Math.random() * w,
    y:     Math.random() * h,
    vx:    (Math.random() - 0.5) * 0.16,
    vy:    (Math.random() - 0.5) * 0.16,
    r:     Math.random() * 1.5 + 0.3,
    alpha: Math.random() * 0.22 + 0.05,
  }));
}

/* ── Color helpers ──────────────────────────────────────── */
const TUBE_COLOR    = "rgba(195, 228, 248, 0.93)";
const GLOW_COLOR    = "rgba(125, 211, 252, 0.70)";
const PARTICLE_COL  = "rgba(165, 243, 252, ";
const CHEST_HI      = "rgba(220, 242, 255, 0.97)";
const CHEST_MID     = "rgba(125, 211, 252, 0.82)";
const CHEST_LO      = "rgba(30,  155, 212, 0.72)";
const EAR_COLOR     = "rgba(210, 236, 252, 0.95)";

export default function StethoscopeHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio, 2);
    let animId = 0;
    let t      = 0;
    let parts: Particle[] = [];

    /* Parallax */
    let mouseX  = 0;
    let targetX = 0;

    function setup() {
      const w = canvas!.offsetWidth;
      const h = canvas!.offsetHeight;
      if (!w || !h) return;
      canvas!.width  = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(1, 0, 0, 1, 0, 0);
      ctx!.scale(dpr, dpr);
      const isMobile = w < 480;
      parts = makeParticles(w, h, isMobile ? 14 : 22);
    }
    setup();

    const ro = new ResizeObserver(setup);
    ro.observe(canvas);

    const onMM  = (e: MouseEvent) => { const r = canvas!.getBoundingClientRect(); targetX = (e.clientX - r.left) / r.width - 0.5; };
    const onTM  = (e: TouchEvent) => { const r = canvas!.getBoundingClientRect(); const touch = e.touches[0]; if (touch) targetX = (touch.clientX - r.left) / r.width - 0.5; };
    const onOut = () => { targetX = 0; };
    canvas.addEventListener("mousemove",  onMM,  { passive: true });
    canvas.addEventListener("touchmove",  onTM,  { passive: true });
    canvas.addEventListener("mouseleave", onOut);
    canvas.addEventListener("touchend",   onOut);

    /* ── Dibujo principal ───────────────────────────────── */
    function draw() {
      const W = canvas!.offsetWidth;
      const H = canvas!.offsetHeight;
      if (!W || !H) { animId = requestAnimationFrame(draw); return; }

      mouseX += (targetX - mouseX) * 0.055;
      ctx!.clearRect(0, 0, W, H);

      /* Float vertical + parallax horizontal */
      const floatY = Math.sin(t * 0.55) * (H * 0.022);
      const px     = mouseX * W * 0.04;

      /* Escala adaptativa — el estetoscopio ocupa ~60 % del alto */
      const s = Math.min(W, H) / 310;

      /* Centro */
      const cx = W * 0.5 + px;
      const cy = H * 0.5 + floatY;

      /* ── Puntos clave (en unidades de s) ── */
      const earLX = cx - 48 * s;   const earLY = cy - 115 * s;
      const earRX = cx + 48 * s;   const earRY = cy - 115 * s;
      const yJX   = cx;            const yJY   = cy -  78 * s;   // Y-junction

      /* Loop omega: baja, curva izq, baja, curva der, sube hasta pieza */
      const p1X = cx;              const p1Y  = cy - 28 * s;  // tramo recto post-Y
      const lTopX = cx - 62 * s;  const lTopY = cy -  5 * s;  // inicio col. izq
      const lBotX = cx - 62 * s;  const lBotY = cy + 68 * s;  // base col. izq
      const rBotX = cx + 50 * s;  const rBotY = cy + 68 * s;  // base col. der
      const rTopX = cx + 50 * s;  const rTopY = cy +  8 * s;  // cima col. der
      /* Pieza de tórax (diafragma) */
      const chX   = cx;            const chY   = cy + 108 * s;
      const chR   = 28 * s;

      /* ── Tubo principal ─────────────────────────────── */
      ctx!.save();
      ctx!.lineCap    = "round";
      ctx!.lineJoin   = "round";
      ctx!.lineWidth  = 5.5 * s;
      ctx!.shadowBlur = 18;
      ctx!.shadowColor = GLOW_COLOR;
      ctx!.strokeStyle = TUBE_COLOR;

      ctx!.beginPath();
      /* Baja desde Y-junction */
      ctx!.moveTo(yJX, yJY);
      ctx!.lineTo(p1X, p1Y);
      /* Curva hacia la columna izquierda */
      ctx!.bezierCurveTo(
        p1X, p1Y + 22 * s,
        lTopX, lTopY - 20 * s,
        lTopX, lTopY,
      );
      /* Columna izquierda baja */
      ctx!.bezierCurveTo(
        lTopX, lTopY + 36 * s,
        lBotX, lBotY - 30 * s,
        lBotX, lBotY,
      );
      /* Curva base (parte inferior del omega) */
      ctx!.bezierCurveTo(
        lBotX, lBotY + 26 * s,
        rBotX, rBotY + 26 * s,
        rBotX, rBotY,
      );
      /* Columna derecha sube */
      ctx!.bezierCurveTo(
        rBotX, rBotY - 32 * s,
        rTopX, rTopY + 30 * s,
        rTopX, rTopY,
      );
      /* Curva final hacia la pieza de tórax */
      ctx!.bezierCurveTo(
        rTopX, rTopY - 22 * s,
        chX + 28 * s, chY - chR - 40 * s,
        chX, chY - chR,
      );
      ctx!.stroke();

      /* ── Tubos auditivos (izq y der → Y-junction) ── */
      ctx!.lineWidth  = 4.5 * s;
      ctx!.shadowBlur = 12;

      ctx!.beginPath();
      ctx!.moveTo(earLX, earLY);
      ctx!.bezierCurveTo(
        earLX + 12 * s, earLY + 28 * s,
        yJX   - 14 * s, yJY   - 22 * s,
        yJX,             yJY,
      );
      ctx!.stroke();

      ctx!.beginPath();
      ctx!.moveTo(earRX, earRY);
      ctx!.bezierCurveTo(
        earRX - 12 * s, earRY + 28 * s,
        yJX   + 14 * s, yJY   - 22 * s,
        yJX,             yJY,
      );
      ctx!.stroke();

      /* ── Puntas auditivas (ear tips) ─────────────────── */
      ctx!.shadowBlur  = 16;
      ctx!.shadowColor = GLOW_COLOR;
      ctx!.fillStyle   = EAR_COLOR;
      for (const [ex, ey] of [[earLX, earLY], [earRX, earRY]] as [number, number][]) {
        ctx!.beginPath();
        ctx!.arc(ex, ey, 9 * s, 0, Math.PI * 2);
        ctx!.fill();
        /* Anillo exterior de la punta */
        ctx!.beginPath();
        ctx!.arc(ex, ey, 13 * s, 0, Math.PI * 2);
        ctx!.strokeStyle = "rgba(195, 228, 248, 0.35)";
        ctx!.lineWidth   = 1.5 * s;
        ctx!.stroke();
      }

      /* ── Y-junction dot ─────────────────────────────── */
      ctx!.shadowBlur  = 14;
      ctx!.shadowColor = GLOW_COLOR;
      ctx!.fillStyle   = "rgba(220, 242, 255, 0.88)";
      ctx!.beginPath();
      ctx!.arc(yJX, yJY, 7 * s, 0, Math.PI * 2);
      ctx!.fill();

      /* ── Pieza de tórax (diafragma) ──────────────────── */
      /* Anillo de pulso exterior — latido */
      const pulse1 = (Math.sin(t * 2.0)       + 1) * 0.5;
      const pulse2 = (Math.sin(t * 2.0 - 1.1) + 1) * 0.5;

      ctx!.beginPath();
      ctx!.arc(chX, chY, chR + (18 * s) * pulse1, 0, Math.PI * 2);
      ctx!.strokeStyle = `rgba(125, 211, 252, ${pulse1 * 0.50})`;
      ctx!.lineWidth   = 1.8 * s;
      ctx!.shadowBlur  = 24;
      ctx!.shadowColor = GLOW_COLOR;
      ctx!.stroke();

      ctx!.beginPath();
      ctx!.arc(chX, chY, chR + (32 * s) * pulse2, 0, Math.PI * 2);
      ctx!.strokeStyle = `rgba(125, 211, 252, ${pulse2 * 0.22})`;
      ctx!.lineWidth   = 1.2 * s;
      ctx!.stroke();

      /* Disco principal del diafragma */
      ctx!.shadowBlur  = 28;
      ctx!.shadowColor = "rgba(125, 211, 252, 0.75)";
      ctx!.beginPath();
      ctx!.arc(chX, chY, chR, 0, Math.PI * 2);
      const grad = ctx!.createRadialGradient(
        chX - chR * 0.35, chY - chR * 0.35, 0,
        chX, chY, chR,
      );
      grad.addColorStop(0,   CHEST_HI);
      grad.addColorStop(0.55, CHEST_MID);
      grad.addColorStop(1,   CHEST_LO);
      ctx!.fillStyle = grad;
      ctx!.fill();

      /* Borde del diafragma */
      ctx!.beginPath();
      ctx!.arc(chX, chY, chR, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(200, 235, 252, 0.70)";
      ctx!.lineWidth   = 2.2 * s;
      ctx!.shadowBlur  = 10;
      ctx!.stroke();

      /* Anillo interior (detalle diafragma) */
      ctx!.beginPath();
      ctx!.arc(chX, chY, chR * 0.52, 0, Math.PI * 2);
      ctx!.strokeStyle = "rgba(220, 244, 255, 0.45)";
      ctx!.lineWidth   = 1.5 * s;
      ctx!.shadowBlur  = 0;
      ctx!.stroke();

      /* Punto central del diafragma */
      ctx!.beginPath();
      ctx!.arc(chX, chY, 4 * s, 0, Math.PI * 2);
      ctx!.fillStyle = "rgba(240, 250, 255, 0.90)";
      ctx!.shadowBlur = 8;
      ctx!.shadowColor = "rgba(200, 240, 255, 0.9)";
      ctx!.fill();

      ctx!.restore();

      /* ── Partículas ambientales ──────────────────────── */
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; else if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; else if (p.y > H) p.y = 0;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx!.fillStyle = PARTICLE_COL + p.alpha + ")";
        ctx!.fill();
      }

      t += 0.016;
      animId = requestAnimationFrame(draw);
    }

    draw();

    return () => {
      cancelAnimationFrame(animId);
      ro.disconnect();
      canvas.removeEventListener("mousemove",  onMM);
      canvas.removeEventListener("touchmove",  onTM);
      canvas.removeEventListener("mouseleave", onOut);
      canvas.removeEventListener("touchend",   onOut);
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
