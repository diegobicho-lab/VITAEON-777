import Link from "next/link";
import { HeartPulse } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#faf9f7_0%,#ffffff_55%,#eef5f8_100%)] px-4 py-16">
      <section className="w-full max-w-lg rounded-[2rem] border border-silver/70 bg-white px-8 py-12 text-center shadow-soft">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#071726]">
          <HeartPulse className="h-8 w-8 text-white" />
        </div>
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-medical">VITAEON</p>
        <h1 className="mt-3 text-4xl font-bold text-deep">404</h1>
        <p className="mt-2 text-xl font-semibold text-deep">Página no encontrada</p>
        <p className="mt-4 leading-7 text-slate-500">La ruta solicitada no existe o ya no está disponible en la plataforma.</p>
        <Link
          href="/"
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#071726] px-8 py-4 font-semibold text-white shadow-soft transition hover:-translate-y-0.5 hover:bg-[#0d2638]"
        >
          ← Volver al inicio
        </Link>
      </section>
    </main>
  );
}
