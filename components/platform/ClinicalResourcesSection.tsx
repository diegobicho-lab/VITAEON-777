"use client";

import { ArrowUpRight, BookOpenText, Brain, FileSearch, Landmark } from "lucide-react";
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
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Recursos Clínicos</p>
          <h2 className="mt-2 text-2xl font-semibold text-deep">Directorio externo para apoyo profesional</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
            Accesos rápidos a herramientas y bibliotecas externas de consulta profesional. VITAEON no envía datos del médico, pacientes ni expediente a estos recursos.
          </p>
        </div>
        <span className="rounded-full border border-silver/70 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Enlaces externos
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {clinicalResources.map((resource) => {
          const Icon = iconByResourceId[resource.id as keyof typeof iconByResourceId] ?? BookOpenText;
          return (
            <article key={resource.id} className="flex min-h-64 flex-col rounded-3xl border border-silver/70 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-medical/30 hover:shadow-premium">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-medical/10 text-medical">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </div>
              <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{resource.category}</p>
              <h3 className="mt-2 text-lg font-semibold text-deep">{resource.name}</h3>
              <p className="mt-3 flex-1 text-sm leading-6 text-slate-600">{resource.description}</p>
              <a
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-5 inline-flex items-center justify-center gap-2 rounded-full bg-[#071726] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0d2638]"
              >
                Abrir recurso
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </article>
          );
        })}
      </div>

      <p className="mt-6 rounded-3xl border border-silver/70 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
        Los recursos externos se ofrecen únicamente como herramientas de apoyo profesional. VITAEON no controla, valida ni sustituye el contenido clínico de terceros. La decisión diagnóstica y terapéutica corresponde exclusivamente al profesional de la salud.
      </p>
    </section>
  );
}
