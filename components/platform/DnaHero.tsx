"use client";

/**
 * DnaHero — Doble hélice ADN 3D premium para la hero section de VITAEON
 *
 * Stack: React Three Fiber v8 · Three.js r168 · @react-three/drei v9
 *        @react-three/postprocessing v2
 *
 * Decisiones de diseño:
 * ─ InstancedMesh para rungs y átomos → mínimo draw-calls (2 vs 48+)
 * ─ CatmullRomCurve3 + TubeGeometry  → backbone suave sin aristas
 * ─ Canvas alpha:true                 → el blob CSS es visible detrás
 * ─ Bloom post-processing             → glow premium sin geometría extra
 * ─ dpr:[1,2]                         → retina sin destruir GPU móvil
 * ─ Mouse parallax con lerp 0.04      → movimiento elegante, nunca brusco
 * ─ useMemo + useEffect               → sin re-cómputos costosos
 */

import { useRef, useMemo, useEffect, Suspense } from "react";
import type { MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import { EffectComposer, Bloom } from "@react-three/postprocessing";
import * as THREE from "three";

/* ═══════════════════════════════════════════════════════════
   Parámetros geométricos (desktop). Móvil los reduce.
═══════════════════════════════════════════════════════════ */
const TURNS      = 2.5;   // vueltas de la hélice
const RADIUS     = 0.88;  // radio helix
const HEIGHT     = 4.8;   // altura total (world units)
const BP_D       = 24;    // base-pairs desktop
const TS_D       = 200;   // tube segments desktop
const TUBE_R     = 0.050; // radio tubo backbone
const RUNG_R     = 0.023; // radio cilindro escalón
const ATOM_R     = 0.073; // radio esfera átomo
const SPARKS_D   = 64;    // partículas desktop

/* ═══════════════════════════════════════════════════════════
   Paleta — azul médico · violeta suave · cian
═══════════════════════════════════════════════════════════ */
const PAL = {
  sA:     "#1e9bd4",  // strand A — azul médico
  sAemi:  "#0ea5e9",  // emissive A
  sB:     "#0c7ab0",  // strand B — azul profundo
  sBemi:  "#0284c7",  // emissive B
  rLo:    "#8b5cf6",  // rung inferior — violeta
  rHi:    "#06b6d4",  // rung superior — cian
  rEmi:   "#6d28d9",  // emissive rung
  atA:    "#7dd3fc",  // átomo strand A
  atB:    "#a5f3fc",  // átomo strand B
} as const;

/* ═══════════════════════════════════════════════════════════
   HelixBackbone — tubo suave que sigue una hélice
═══════════════════════════════════════════════════════════ */
interface BackboneProps {
  phase:   number;
  color:   string;
  emissive: string;
  segs:    number;
}

function HelixBackbone({ phase, color, emissive, segs }: BackboneProps) {
  const geo = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= segs; i++) {
      const t = (i / segs) * Math.PI * 2 * TURNS;
      const y = (i / segs) * HEIGHT - HEIGHT / 2;
      pts.push(new THREE.Vector3(
        RADIUS * Math.cos(t + phase),
        y,
        RADIUS * Math.sin(t + phase),
      ));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, "catmullrom", 0.5);
    return new THREE.TubeGeometry(curve, segs, TUBE_R, 7, false);
  }, [phase, segs]);

  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.55,
    metalness: 0.35,
    roughness: 0.28,
  }), [color, emissive]);

  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);

  return <mesh geometry={geo} material={mat} />;
}

/* ═══════════════════════════════════════════════════════════
   HelixRungs — escalones del ADN (InstancedMesh, 1 draw-call)
═══════════════════════════════════════════════════════════ */
function HelixRungs({ bp }: { bp: number }) {
  const ref = useRef<THREE.InstancedMesh>(null);

  const geo = useMemo(
    () => new THREE.CylinderGeometry(RUNG_R, RUNG_R, RADIUS * 2, 7, 1),
    [],
  );
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    vertexColors: true,
    emissive:          PAL.rEmi,
    emissiveIntensity: 0.22,
    metalness:  0.10,
    roughness:  0.55,
    transparent: true,
    opacity:     0.88,
  }), []);

  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const lo    = new THREE.Color(PAL.rLo);
    const hi    = new THREE.Color(PAL.rHi);
    const col   = new THREE.Color();

    for (let i = 0; i < bp; i++) {
      const f   = i / (bp - 1);
      const t   = f * Math.PI * 2 * TURNS;
      const y   = f * HEIGHT - HEIGHT / 2;

      // El escalón conecta A=(R·cos t, y, R·sin t) con B=(-R·cos t, y, -R·sin t).
      // Dirección del cilindro: (-cos t, 0, -sin t).
      const dir  = new THREE.Vector3(-Math.cos(t), 0, -Math.sin(t));
      const quat = new THREE.Quaternion().setFromUnitVectors(yAxis, dir);

      dummy.position.set(0, y, 0);
      dummy.quaternion.copy(quat);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      mesh.setColorAt(i, col.lerpColors(lo, hi, f));
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [bp]);

  return <instancedMesh ref={ref} args={[geo, mat, bp]} />;
}

/* ═══════════════════════════════════════════════════════════
   HelixAtoms — esferas terminales (InstancedMesh, 1 draw-call)
═══════════════════════════════════════════════════════════ */
interface AtomsProps {
  phase:   number;
  color:   string;
  emissive: string;
  bp:      number;
}

function HelixAtoms({ phase, color, emissive, bp }: AtomsProps) {
  const ref = useRef<THREE.InstancedMesh>(null);

  const geo = useMemo(() => new THREE.SphereGeometry(ATOM_R, 7, 7), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({
    color,
    emissive,
    emissiveIntensity: 0.65,
    metalness: 0.20,
    roughness: 0.25,
    transparent: true,
    opacity:     0.92,
  }), [color, emissive]);

  useEffect(() => () => { geo.dispose(); mat.dispose(); }, [geo, mat]);

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;

    const dummy = new THREE.Object3D();
    for (let i = 0; i < bp; i++) {
      const f = i / (bp - 1);
      const t = f * Math.PI * 2 * TURNS;
      const y = f * HEIGHT - HEIGHT / 2;
      dummy.position.set(
        RADIUS * Math.cos(t + phase),
        y,
        RADIUS * Math.sin(t + phase),
      );
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, [phase, bp]);

  return <instancedMesh ref={ref} args={[geo, mat, bp]} />;
}

/* ═══════════════════════════════════════════════════════════
   DnaDouble — grupo animado: rotación + parallax del mouse
═══════════════════════════════════════════════════════════ */
interface DnaDoubleProps {
  mouseRef: MutableRefObject<{ x: number; y: number }>;
  bp:       number;
  segs:     number;
}

function DnaDouble({ mouseRef, bp, segs }: DnaDoubleProps) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const g = groupRef.current;
    if (!g) return;

    // Rotación continua lenta sobre el eje Y — nunca se detiene
    g.rotation.y += delta * 0.38;

    // Inclinación suave siguiendo el cursor (máx ±0.16 rad ≈ ±9°)
    const mx = mouseRef.current.x;
    const my = mouseRef.current.y;
    g.rotation.x = THREE.MathUtils.lerp(g.rotation.x, my * 0.16, 0.04);
    g.rotation.z = THREE.MathUtils.lerp(g.rotation.z, -mx * 0.06, 0.04);
  });

  return (
    <group ref={groupRef}>
      {/* Strand A — azul médico vivo */}
      <HelixBackbone phase={0}       color={PAL.sA} emissive={PAL.sAemi} segs={segs} />
      {/* Strand B — azul profundo (desfasado π) */}
      <HelixBackbone phase={Math.PI} color={PAL.sB} emissive={PAL.sBemi} segs={segs} />
      {/* Escalones / base pairs */}
      <HelixRungs bp={bp} />
      {/* Átomos terminales strand A */}
      <HelixAtoms phase={0}       color={PAL.atA} emissive={PAL.sAemi} bp={bp} />
      {/* Átomos terminales strand B */}
      <HelixAtoms phase={Math.PI} color={PAL.atB} emissive={PAL.sBemi} bp={bp} />
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   DnaHero — componente principal exportado.
   Se importa con next/dynamic + ssr:false para evitar que
   Three.js intente acceder a WebGL durante el SSR de Next.js.
═══════════════════════════════════════════════════════════ */
export default function DnaHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef     = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Detectar móvil una sola vez al montar (no state → sin re-renders)
  const isMobile = useRef(
    typeof window !== "undefined" && window.innerWidth < 768,
  ).current;

  const cfg = {
    bp:     isMobile ? 16  : BP_D,
    segs:   isMobile ? 120 : TS_D,
    sparks: isMobile ? 28  : SPARKS_D,
    dpr:    (isMobile ? [1, 1.5] : [1, 2]) as [number, number],
    fov:    isMobile ? 50 : 44,
    bloom:  isMobile ? 0.5 : 0.75,
  };

  function onMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    mouseRef.current.x =  ((e.clientX - r.left) / r.width  - 0.5) * 2;
    mouseRef.current.y = -((e.clientY - r.top)  / r.height - 0.5) * 2;
  }

  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    const touch = e.touches[0];
    if (!touch) return;
    const r = containerRef.current?.getBoundingClientRect();
    if (!r) return;
    mouseRef.current.x =  ((touch.clientX - r.left) / r.width  - 0.5) * 2;
    mouseRef.current.y = -((touch.clientY - r.top)  / r.height - 0.5) * 2;
  }

  function onLeave() {
    // Volver al centro suavemente (el lerp en useFrame hace la transición)
    mouseRef.current.x = 0;
    mouseRef.current.y = 0;
  }

  return (
    <div
      ref={containerRef}
      className="h-full w-full"
      onMouseMove={onMouseMove}
      onTouchMove={onTouchMove}
      onMouseLeave={onLeave}
      onTouchEnd={onLeave}
      aria-hidden="true"  /* decorativo, no transmite información semántica */
    >
      <Canvas
        gl={{
          alpha:                true,   // fondo transparente → blob CSS visible detrás
          antialias:            !isMobile,
          powerPreference:      "high-performance",
          preserveDrawingBuffer: false,
        }}
        camera={{ position: [0, 0, 8], fov: cfg.fov }}
        dpr={cfg.dpr}
        style={{ background: "transparent" }}
      >
        {/* ── Iluminación: 3 puntos para simular volumen ── */}
        <ambientLight intensity={0.30} />
        {/* Fill frontal — cian brillante */}
        <pointLight position={[ 4,  4, 5]} color="#4fc3f7" intensity={3.5} />
        {/* Fill trasero-izquierdo — violeta suave */}
        <pointLight position={[-3, -2, 4]} color="#a78bfa" intensity={2.5} />
        {/* Rim superior — blanco frío */}
        <pointLight position={[ 0,  5, -1]} color="#e0f2fe" intensity={1.2} />

        <Suspense fallback={null}>
          {/* ── Doble hélice ADN ── */}
          <DnaDouble mouseRef={mouseRef} bp={cfg.bp} segs={cfg.segs} />

          {/* ── Partículas biomoleculares flotantes ── */}
          <Sparkles
            count={cfg.sparks}
            scale={6}
            size={isMobile ? 1.0 : 1.5}
            speed={0.25}
            noise={0.6}
            color="#a5f3fc"
            opacity={0.42}
          />

          {/* ── Bloom — el glow premium que lo diferencia ── */}
          <EffectComposer enableNormalPass={false}>
            <Bloom
              luminanceThreshold={0.22}
              luminanceSmoothing={0.9}
              intensity={cfg.bloom}
              mipmapBlur
            />
          </EffectComposer>
        </Suspense>
      </Canvas>
    </div>
  );
}
