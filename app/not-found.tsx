import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-5">
      <section className="max-w-xl rounded-[2rem] border border-silver bg-white p-8 text-center shadow-premium">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-medical">VITAEON</p>
        <h1 className="mt-4 text-4xl font-semibold text-deep">Página no encontrada</h1>
        <p className="mt-4 leading-7 text-slate-600">La ruta solicitada no existe o ya no está disponible.</p>
        <Link
          href="/"
          className="mt-7 inline-flex rounded-full bg-black px-7 py-4 font-semibold text-white transition hover:bg-deep"
        >
          Volver al inicio
        </Link>
      </section>
    </main>
  );
}
