"use client";

import { ArrowUpRight, BookOpenText, Brain, FileSearch, Info, Landmark, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { clinicalResources } from "@/lib/clinical-resources";

const iconByResourceId = {
  "vera-health": Brain,
  pubmed: FileSearch,
  "pubmed-central": BookOpenText,
  "imss-gpc": Landmark
} as const;

/** Qué aporta cada recurso, más concreto que la descripción del catálogo. */
const utilityByResourceId: Record<string, string> = {
  "vera-health": "Consulta rápida de evidencia para decisiones clínicas puntuales.",
  pubmed: "Localiza estudios y referencias por tema, autor o año.",
  "pubmed-central": "Descarga artículos completos sin muro de pago.",
  "imss-gpc": "Consulta la guía oficial mexicana aplicable al caso."
};

const kindByResourceId: Record<string, string> = {
  "vera-health": "Herramienta",
  pubmed: "Buscador",
  "pubmed-central": "Biblioteca",
  "imss-gpc": "Normativa"
};

/**
 * Recursos presentados como portadas cuadradas tipo vinilo.
 *
 * La información adicional se revela al pasar el cursor, al enfocar con teclado
 * y al tocar en pantallas táctiles: nunca depende solo de hover, porque en móvil
 * el hover no existe y el contenido quedaría inaccesible.
 */
export function ClinicalResourcesSection() {
  // Tarjeta abierta por toque. En escritorio hover/focus la revelan sin estado.
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-silver/70 bg-white shadow-[0_4px_24px_rgba(8,32,51,0.05)]">

      <div className="border-b border-silver/50 px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.32em] text-medical">Recursos clínicos</p>
            <h2 className="mt-2.5 text-2xl font-bold tracking-tight text-deep">Directorio de apoyo profesional</h2>
            <p className="mt-2.5 text-sm leading-6 text-slate-500">
              Toca o enfoca una portada para ver qué contiene cada recurso.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[0.68rem] font-semibold text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            No compartimos datos
          </span>
        </div>
      </div>

      <ul className="grid grid-cols-2 gap-4 p-6 sm:p-7 lg:grid-cols-4">
        {clinicalResources.map((resource) => {
          const Icon = iconByResourceId[resource.id as keyof typeof iconByResourceId] ?? BookOpenText;
          const kind = kindByResourceId[resource.id] ?? "Recurso";
          const utility = utilityByResourceId[resource.id] ?? resource.description;
          const host = new URL(resource.url).hostname.replace(/^www\./, "");
          const isOpen = openId === resource.id;

          return (
            <li key={resource.id}>
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  // Primer toque revela; el segundo abre. En escritorio el hover
                  // ya mostró la información, así que el primer clic abre directo.
                  if (window.matchMedia("(hover: none)").matches && !isOpen) {
                    event.preventDefault();
                    setOpenId(resource.id);
                  }
                }}
                // El revelado por teclado se maneja con estado en lugar de
                // `group-focus-visible`: la variante CSS no se aplica de forma
                // fiable cuando el foco llega por vías distintas al tabulador.
                onFocus={() => setOpenId(resource.id)}
                onBlur={() => setOpenId((current) => (current === resource.id ? null : current))}
                className="group relative block aspect-square w-full overflow-hidden rounded-2xl border border-silver/70 bg-gradient-to-br from-[#0d2233] to-[#071726] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical focus-visible:ring-offset-2"
              >
                {/* Surco del vinilo: círculos concéntricos sutiles, sin animación. */}
                <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full border border-white/10" />
                <span aria-hidden="true" className="pointer-events-none absolute -right-6 -top-6 h-32 w-32 rounded-full border border-white/[0.07]" />
                <span aria-hidden="true" className="pointer-events-none absolute right-6 top-6 h-14 w-14 rounded-full bg-white/[0.06]" />

                {/* Cara frontal */}
                <span className="relative flex h-full flex-col justify-between p-4">
                  <span className="flex items-start justify-between gap-2">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="rounded-full border border-white/20 px-2 py-0.5 text-[0.58rem] font-semibold uppercase tracking-[0.12em] text-white/70">
                      {kind}
                    </span>
                  </span>
                  <span>
                    <span className="block text-sm font-bold leading-snug text-white">{resource.name}</span>
                    <span className="mt-0.5 block truncate text-[0.68rem] text-white/50">{host}</span>
                  </span>
                </span>

                {/* Reverso: se revela con hover, focus o toque previo. */}
                <span
                  // Fondo totalmente opaco: con `bg-[#071726]/97` Tailwind no
                  // generaba fondo alguno, y con 0.97 el título de la cara
                  // frontal se transparentaba detrás del texto del reverso.
                  className={`absolute inset-0 flex flex-col justify-between bg-[#071726] p-4 transition-opacity duration-200 group-hover:opacity-100 ${
                    isOpen ? "opacity-100" : "opacity-0"
                  }`}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold leading-snug text-white">{resource.name}</span>
                    {/* Categorías largas ("Artículos de texto completo") ocupan
                        3 líneas en la portada cuadrada de móvil y empujan el CTA
                        fuera de la tarjeta. El texto sigue disponible en sr-only. */}
                    <span className="mt-1 hidden text-[0.68rem] font-semibold uppercase tracking-[0.14em] text-sky-300 sm:block">
                      {resource.category}
                    </span>
                    {/* En móvil la portada cuadrada no da altura para la frase
                        completa y se cortaba a media línea. Se muestra desde sm. */}
                    <span className="mt-2 hidden text-xs leading-5 text-white/75 sm:block">{utility}</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-white">
                    Abrir recurso
                    <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </span>

                {/* Texto completo siempre disponible para lectores de pantalla. */}
                <span className="sr-only">
                  {resource.name}. {resource.category}. {utility} Se abre en una pestaña nueva.
                </span>
              </a>
            </li>
          );
        })}
      </ul>

      <div className="border-t border-silver/50 bg-slate-50/70 px-6 py-5 sm:px-7">
        <div className="flex gap-3">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          <p className="text-xs leading-5 text-slate-500">
            Recursos externos ofrecidos como apoyo profesional. VITAEON no controla ni valida su contenido clínico,
            y no envía datos del médico, pacientes ni expediente a estos sitios. La decisión diagnóstica y
            terapéutica corresponde exclusivamente al profesional de la salud.
          </p>
        </div>
      </div>

    </section>
  );
}
