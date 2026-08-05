"use client";

import { ArrowUpRight, BookOpenText, Brain, FileSearch, Info, Landmark, ShieldCheck } from "lucide-react";
import { clinicalResources } from "@/lib/clinical-resources";

const iconByResourceId = {
  "vera-health": Brain,
  pubmed: FileSearch,
  "pubmed-central": BookOpenText,
  "imss-gpc": Landmark
} as const;

/** Etiqueta corta de tipo de recurso, útil para escanear la lista de un vistazo. */
const kindByResourceId: Record<string, string> = {
  "vera-health": "Herramienta",
  pubmed: "Buscador",
  "pubmed-central": "Biblioteca",
  "imss-gpc": "Normativa"
};

export function ClinicalResourcesSection() {
  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-silver/70 bg-white shadow-[0_4px_24px_rgba(8,32,51,0.05)]">

      {/* ── Encabezado ────────────────────────────────────────────── */}
      <div className="border-b border-silver/50 px-6 py-6 sm:px-8 sm:py-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="text-[0.65rem] font-bold uppercase tracking-[0.32em] text-medical">
              Recursos clínicos
            </p>
            <h2 className="mt-2.5 text-2xl font-bold tracking-tight text-deep">
              Directorio de apoyo profesional
            </h2>
            <p className="mt-2.5 text-sm leading-6 text-slate-500">
              Herramientas y bibliotecas externas de consulta rápida.
            </p>
          </div>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[0.68rem] font-semibold text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            No compartimos datos
          </span>
        </div>
      </div>

      {/* ── Lista de recursos ─────────────────────────────────────── */}
      <ul className="grid gap-4 p-6 sm:grid-cols-2 sm:p-7 xl:grid-cols-4">
        {clinicalResources.map((resource) => {
          const Icon = iconByResourceId[resource.id as keyof typeof iconByResourceId] ?? BookOpenText;
          const kind = kindByResourceId[resource.id] ?? "Recurso";
          const host = new URL(resource.url).hostname.replace(/^www\./, "");

          return (
            <li key={resource.id} className="h-full">
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-full flex-col rounded-2xl border border-silver/70 bg-white p-5 transition-colors duration-200 hover:border-medical/50 hover:bg-slate-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-medical/40 focus-visible:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-medical/10 text-medical">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="rounded-full border border-silver/70 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-500">
                    {kind}
                  </span>
                </div>

                <h3 className="mt-4 text-base font-bold leading-snug text-deep">
                  {resource.name}
                </h3>
                <p className="mt-1.5 text-xs font-semibold text-medical">{resource.category}</p>

                <p className="mt-2.5 flex-1 text-sm leading-6 text-slate-600">
                  {resource.description}
                </p>

                <span className="mt-4 flex items-center justify-between gap-2 border-t border-silver/60 pt-3.5">
                  <span className="truncate text-xs text-slate-400">{host}</span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-deep">
                    Abrir
                    <ArrowUpRight
                      className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                      aria-hidden="true"
                    />
                  </span>
                </span>

                <span className="sr-only">(se abre en una pestaña nueva)</span>
              </a>
            </li>
          );
        })}
      </ul>

      {/* ── Aviso legal ───────────────────────────────────────────── */}
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
