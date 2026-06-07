import Link from "next/link";
import type { ReactNode } from "react";

export function LegalPage({
  eyebrow,
  title,
  children
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#faf9f7_0%,#ffffff_52%,#eef5f8_100%)] px-4 pb-24 pt-6 text-ink sm:px-5">
      <nav className="glass mx-auto flex max-w-7xl items-center justify-between rounded-full px-6 py-3.5 shadow-glass sm:px-7 sm:py-4">
        <Link href="/" className="text-sm font-bold tracking-[0.42em] text-deep">
          VITAEON
        </Link>
        <Link
          href="/"
          className="rounded-full border border-silver/60 bg-white px-5 py-2.5 text-sm font-semibold text-deep shadow-soft transition hover:-translate-y-0.5 hover:shadow-premium"
        >
          ← Inicio
        </Link>
      </nav>
      <section className="mx-auto mt-12 max-w-4xl rounded-[2rem] border border-silver/70 bg-white px-8 py-10 shadow-soft sm:px-12 sm:py-14">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-medical">{eyebrow}</p>
        <h1 className="mt-4 text-4xl font-bold leading-tight text-deep sm:text-5xl">{title}</h1>
        <div className="mt-10 grid gap-6 text-base leading-8 text-slate-600">{children}</div>
        <p className="mt-10 rounded-2xl border border-amber-100 bg-amber-50/60 px-5 py-4 text-sm leading-7 text-amber-800">
          Nota para beta privada: este contenido requiere revisión jurídica antes de operación pública con pacientes reales.
        </p>
      </section>
    </main>
  );
}
