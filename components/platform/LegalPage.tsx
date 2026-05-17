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
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbfd_0%,#ffffff_52%,#eef5f8_100%)] px-5 pb-24 pt-8 text-ink">
      <nav className="glass mx-auto flex max-w-7xl items-center justify-between rounded-full px-7 py-4 shadow-glass">
        <Link href="/" className="font-semibold tracking-[0.45em] text-deep">
          VITAEON
        </Link>
        <Link href="/" className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">
          Volver
        </Link>
      </nav>
      <section className="mx-auto mt-16 max-w-5xl rounded-[2rem] border border-silver bg-white p-8 shadow-premium">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-medical">{eyebrow}</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight text-deep md:text-6xl">{title}</h1>
        <div className="mt-8 grid gap-6 text-lg leading-8 text-slate-600">{children}</div>
        <p className="mt-8 rounded-3xl bg-slate-50 p-5 text-sm leading-6 text-slate-600">
          Nota para beta privada: este contenido requiere revisión jurídica antes de operación pública con pacientes reales.
        </p>
      </section>
    </main>
  );
}
