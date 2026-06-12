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
    <section className="overflow-hidden rounded-[1.75rem] border border-silver/70 bg-white shadow-[0_4px_24px_rgba(8,32,51,0.05)]">

      {/* ── Header band ───────────────────────────────────────────── */}
      <div className="border-b border-silver/50 bg-gradient-to-br from-[#fafcff] to-[#eef5fb] px-6 py-7 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-xl">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-medical" />
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.36em] text-medical">
                Recursos Clínicos
              </p>
            </div>
            <h2 className="mt-3 text-2xl font-bold tracking-tight text-deep sm:text-3xl">
              Directorio externo para apoyo profesional
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Accesos rápidos a herramientas y bibliotecas externas. VITAEON no envía datos del médico, pacientes ni expediente a estos recursos.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-3.5 py-1.5 text-[0.62rem] font-bold uppercase tracking-[0.2em] text-sky-500">
            <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
            Enlaces externos
          </span>
        </div>
      </div>

      {/* ── Cards grid ───────────────────────────────────────────── */}
      <div className="p-6 sm:p-7">
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {clinicalResources.map((resource) => {
            const Icon = iconByResourceId[resource.id as keyof typeof iconByResourceId] ?? BookOpenText;
            return (
              <article
                key={resource.id}
                className="group relative flex flex-col overflow-hidden rounded-2xl border border-silver/60 bg-gradient-to-b from-white to-slate-50/60 transition-all duration-300 hover:-translate-y-2 hover:border-medical/35 hover:shadow-[0_20px_56px_rgba(14,165,233,0.11),0_4px_16px_rgba(0,0,0,0.06)]"
              >
                {/* Accent top bar — visible on hover */}
                <div className="h-[3px] w-full bg-gradient-to-r from-sky-400/0 via-medical to-sky-400/0 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

                <div className="flex flex-1 flex-col p-5 pt-4">
                  {/* Icon */}
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-50 to-blue-100/70 text-medical shadow-sm ring-1 ring-medical/10 transition-transform duration-300 group-hover:scale-110">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </div>

                  {/* Category badge */}
                  <span className="mt-4 inline-flex w-fit items-center rounded-full bg-medical/10 px-2.5 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.18em] text-medical">
                    {resource.category}
                  </span>

                  {/* Title */}
                  <h3 className="mt-2 text-base font-bold leading-snug text-deep">
                    {resource.name}
                  </h3>

                  {/* Description */}
                  <p className="mt-2 flex-1 text-[0.82rem] leading-[1.7] text-slate-500">
                    {resource.description}
                  </p>

                  {/* CTA button */}
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#071726] px-4 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#0d2638] hover:shadow-[0_8px_28px_rgba(7,23,38,0.28)] active:scale-[0.97]"
                  >
                    Abrir recurso
                    <ArrowUpRight
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden="true"
                    />
                  </a>
                </div>
              </article>
            );
          })}
        </div>

        {/* ── Disclaimer ─────────────────────────────────────────── */}
        <div className="mt-6 flex gap-3 rounded-2xl border border-sky-100 bg-sky-50/60 p-4">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-400" aria-hidden="true" />
          <p className="text-xs leading-5 text-slate-500">
            Los recursos externos se ofrecen únicamente como herramientas de apoyo profesional.
            VITAEON no controla, valida ni sustituye el contenido clínico de terceros.
            La decisión diagnóstica y terapéutica corresponde exclusivamente al profesional de la salud.
          </p>
        </div>
      </div>

    </section>
  );
}
