"use client";

import { ArrowUpRight, BookOpenText, Brain, FileSearch, Info, Landmark } from "lucide-react";
import { clinicalResources } from "@/lib/clinical-resources";

const iconByResourceId = {
  "vera-health": Brain,
  pubmed: FileSearch,
  "pubmed-central": BookOpenText,
  "imss-gpc": Landmark
} as const;

export function ClinicalResourcesSection() {
  return (
    <section className="dashboard-card rounded-[1.75rem] border-silver/70">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.32em] text-medical">
            Recursos Clínicos
          </p>
          <h2 className="mt-2 text-2xl font-bold text-deep">
            Directorio externo para apoyo profesional
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Accesos rápidos a herramientas y bibliotecas externas de consulta profesional.
            VITAEON no envía datos del médico, pacientes ni expediente a estos recursos.
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-silver bg-slate-50 px-3.5 py-1.5 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-slate-400">
          <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
          Enlaces externos
        </span>
      </div>

      {/* ── Cards grid ─────────────────────────────────────── */}
      <div className="mt-7 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {clinicalResources.map((resource) => {
          const Icon = iconByResourceId[resource.id as keyof typeof iconByResourceId] ?? BookOpenText;
          return (
            <article
              key={resource.id}
              className="group flex flex-col rounded-[1.5rem] border border-silver/70 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-medical/25 hover:shadow-premium"
            >
              {/* Icon container */}
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-medical ring-1 ring-medical/10 transition-transform duration-200 group-hover:scale-105">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>

              {/* Category pill */}
              <span className="mt-5 inline-flex w-fit rounded-full bg-slate-100 px-2.5 py-0.5 text-[0.62rem] font-bold uppercase tracking-[0.18em] text-slate-500">
                {resource.category}
              </span>

              {/* Title */}
              <h3 className="mt-2.5 text-base font-bold leading-snug text-deep">
                {resource.name}
              </h3>

              {/* Description */}
              <p className="mt-2 flex-1 text-sm leading-[1.7] text-slate-500">
                {resource.description}
              </p>

              {/* CTA */}
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#071726] px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#0d2638] hover:shadow-[0_4px_16px_rgba(7,23,38,0.22)] active:scale-[0.97]"
              >
                Abrir recurso
                <ArrowUpRight
                  className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </a>
            </article>
          );
        })}
      </div>

      {/* ── Disclaimer ─────────────────────────────────────── */}
      <div className="mt-6 flex gap-3 rounded-2xl border border-silver/60 bg-slate-50/80 p-4">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        <p className="text-sm leading-6 text-slate-500">
          Los recursos externos se ofrecen únicamente como herramientas de apoyo profesional.
          VITAEON no controla, valida ni sustituye el contenido clínico de terceros.
          La decisión diagnóstica y terapéutica corresponde exclusivamente al profesional de la salud.
        </p>
      </div>

    </section>
  );
}
