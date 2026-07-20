import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Planes y precios | VITAEON",
  description:
    "Conoce los planes para médicos y representantes médicos en VITAEON. Desde perfil gratuito hasta asistente IA real con agenda premium en León, Guanajuato.",
  robots: { index: true, follow: true }
};

const doctorPlans = [
  {
    name: "Oro",
    price: "Gratis",
    period: "para siempre",
    color: "border-amber-200 bg-amber-50/40",
    badge: "bg-amber-100 text-amber-700",
    cta: "Crear cuenta gratuita",
    features: [
      { label: "Perfil médico público verificado",    included: true },
      { label: "Una especialidad",                    included: true },
      { label: "Un hospital / consultorio",           included: true },
      { label: "Fotografía personal y de consultorio",included: true },
      { label: "Cédula profesional registrada",       included: true },
      { label: "Visibilidad normal en resultados",    included: true },
      { label: "Prioridad en búsquedas",              included: false },
      { label: "Agenda mensual online",               included: false },
      { label: "Asistente IA (Claude)",               included: false },
      { label: "Chat cifrado de derivaciones",        included: false }
    ]
  },
  {
    name: "Diamante",
    price: "$499",
    period: "MXN / mes",
    color: "border-sky-200 bg-sky-50/40",
    badge: "bg-sky-100 text-sky-700",
    cta: "Activar plan Diamante",
    features: [
      { label: "Perfil médico público verificado",    included: true },
      { label: "Una especialidad",                    included: true },
      { label: "Un hospital / consultorio",           included: true },
      { label: "Fotografía personal y de consultorio",included: true },
      { label: "Cédula profesional registrada",       included: true },
      { label: "Prioridad en búsquedas sobre Oro",    included: true },
      { label: "Agenda mensual online",               included: true },
      { label: "Asistente IA (Claude)",               included: false },
      { label: "Chat cifrado de derivaciones",        included: false },
      { label: "Secretaria virtual con IA",           included: false }
    ]
  },
  {
    name: "Amatista",
    price: "$999",
    period: "MXN / mes",
    color: "border-violet-200 bg-violet-50/40 ring-2 ring-violet-300",
    badge: "bg-violet-600 text-white",
    cta: "Activar plan Amatista",
    recommended: true,
    features: [
      { label: "Perfil médico público verificado",    included: true },
      { label: "Una especialidad",                    included: true },
      { label: "Un hospital / consultorio",           included: true },
      { label: "Fotografía personal y de consultorio",included: true },
      { label: "Cédula profesional registrada",       included: true },
      { label: "Prioridad máxima — aparece primero",  included: true },
      { label: "Agenda mensual online",               included: true },
      { label: "Asistente IA real (Claude)",          included: true },
      { label: "Chat cifrado de derivaciones",        included: true },
      { label: "Secretaria virtual con resumen diario",included: true }
    ]
  }
];

const commercialPlan = {
  name: "Obsidiana",
  price: "$499",
  period: "MXN / mes",
  description:
    "Para representantes médicos y empresas de catering que desean aparecer en el directorio comercial de VITAEON.",
  features: [
    "Ficha comercial en la sección Representantes / Catering",
    "Nombre, descripción, zona y rango de precios",
    "Datos de contacto visibles para médicos suscritos",
    "Revisión y aprobación administrativa",
    "Renovación mensual automática con Stripe"
  ]
};

const faqs = [
  {
    q: "¿Cuándo se cobra el primer mes?",
    a: "Al activar tu plan Diamante o Amatista desde tu panel médico. Stripe procesa el pago de forma segura y VITAEON no almacena datos de tarjeta."
  },
  {
    q: "¿Puedo cancelar en cualquier momento?",
    a: "Sí. Desde tu panel médico puedes cancelar la renovación. El plan sigue activo hasta el final del periodo pagado."
  },
  {
    q: "¿El plan Oro es realmente gratis?",
    a: "Sí, sin límite de tiempo. El plan Oro te da perfil público verificado y visibilidad normal. Puedes actualizar cuando quieras."
  },
  {
    q: "¿Qué es el asistente IA?",
    a: "Es un asistente impulsado por Claude (Anthropic) integrado en tu panel. Analiza tu agenda real y responde preguntas sobre tu siguiente cita, huecos disponibles y prioridades del día."
  },
  {
    q: "¿Hay descuento para médicos recién egresados?",
    a: "Durante la beta privada el plan Oro es completamente gratuito. Escríbenos por WhatsApp si tienes alguna situación especial."
  }
];

export default function PreciosPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbfd_0%,#ffffff_52%,#eef5f8_100%)] px-5 pb-24 pt-8 text-[#0f1d2b]">
      {/* Nav */}
      <nav className="mx-auto flex max-w-7xl items-center justify-between rounded-full border border-slate-200/80 bg-white/80 px-7 py-4 shadow-sm backdrop-blur-sm">
        <Link href="/" className="font-semibold tracking-[0.45em] text-[#071726]">VITAEON</Link>
        <Link href="/#busqueda" className="rounded-full bg-[#071726] px-5 py-3 text-sm font-semibold text-white">
          Agendar cita
        </Link>
      </nav>

      {/* Header */}
      <section className="mx-auto mt-16 max-w-7xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-[#1e9bd4]">Planes médicos</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight text-[#071726] sm:text-5xl lg:text-6xl">
          Planes y precios
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-slate-500">
          Desde perfil gratuito hasta asistente IA real. Todos los planes incluyen perfil verificado y agenda online en León, Guanajuato.
        </p>
      </section>

      {/* Planes médicos */}
      <section className="mx-auto mt-16 max-w-7xl">
        <h2 className="mb-8 text-xl font-semibold text-[#071726]">Planes para médicos</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {doctorPlans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-[2rem] border bg-white p-7 shadow-sm ${plan.color}`}
            >
              {plan.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-violet-600 px-4 py-1 text-xs font-semibold text-white shadow">
                    Más completo
                  </span>
                </div>
              )}
              <span className={`inline-block rounded-full px-3 py-1 text-xs font-semibold ${plan.badge}`}>
                {plan.name}
              </span>
              <div className="mt-4">
                <span className="text-3xl font-bold text-[#071726]">{plan.price}</span>
                <span className="ml-2 text-sm text-slate-500">{plan.period}</span>
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f.label} className="flex items-start gap-2.5 text-sm">
                    {f.included ? (
                      <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                        <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5">
                          <path d="M10 3L5 8.5 2 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </span>
                    ) : (
                      <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                        <svg viewBox="0 0 12 12" fill="currentColor" className="h-2.5 w-2.5">
                          <path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                        </svg>
                      </span>
                    )}
                    <span className={f.included ? "text-slate-700" : "text-slate-400"}>{f.label}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/"
                className={`mt-8 flex w-full items-center justify-center rounded-full py-3.5 text-sm font-semibold transition hover:-translate-y-0.5 ${
                  plan.recommended
                    ? "bg-[#071726] text-white shadow hover:bg-[#0d2638]"
                    : "border border-slate-200 bg-white text-[#071726] hover:border-slate-300 hover:shadow-sm"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Plan comercial */}
      <section className="mx-auto mt-14 max-w-7xl">
        <h2 className="mb-6 text-xl font-semibold text-[#071726]">Plan comercial — Representantes y catering</h2>
        <div className="rounded-[2rem] border border-slate-200/80 bg-white p-7 shadow-sm sm:flex sm:items-start sm:gap-10">
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                {commercialPlan.name}
              </span>
              <span className="text-2xl font-bold text-[#071726]">{commercialPlan.price}</span>
              <span className="text-sm text-slate-500">{commercialPlan.period}</span>
            </div>
            <p className="mt-4 max-w-lg leading-relaxed text-slate-500">{commercialPlan.description}</p>
          </div>
          <ul className="mt-6 space-y-2 sm:mt-0 sm:min-w-[280px]">
            {commercialPlan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm text-slate-600">
                <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#1e9bd4]" />
                {f}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto mt-14 max-w-7xl">
        <h2 className="mb-6 text-xl font-semibold text-[#071726]">Preguntas frecuentes</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {faqs.map(({ q, a }) => (
            <div key={q} className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm">
              <h3 className="font-semibold leading-6 text-[#071726]">{q}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-500">{a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mx-auto mt-16 max-w-7xl">
        <div className="rounded-[2.5rem] bg-[#071726] px-8 py-12 text-center">
          <h2 className="text-2xl font-semibold text-white sm:text-3xl">
            Empieza gratis hoy mismo
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-base text-white/60">
            El plan Oro es gratuito sin límite de tiempo. Crea tu perfil, publica disponibilidad y empieza a recibir pacientes en León.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/"
              className="inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-4 font-semibold text-[#071726] shadow-lg transition hover:-translate-y-0.5 hover:bg-slate-50"
            >
              Crear perfil gratuito
            </Link>
            <a
              href={`https://wa.me/${process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "5214771234567"}?text=${encodeURIComponent("Hola, quiero saber más sobre VITAEON para médicos.")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/20 px-8 py-4 text-sm font-semibold text-white/80 transition hover:border-white/40 hover:text-white"
            >
              Hablar por WhatsApp
            </a>
          </div>
        </div>
      </section>

      {/* Footer mínimo */}
      <footer className="mx-auto mt-16 max-w-7xl border-t border-slate-200/70 pt-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className="font-semibold tracking-[0.45em] text-[#071726]">VITAEON</span>
          <div className="flex flex-wrap gap-5 text-sm text-slate-400">
            <Link href="/aviso-de-privacidad" className="hover:text-slate-600">Privacidad</Link>
            <Link href="/terminos" className="hover:text-slate-600">Términos</Link>
            <Link href="/soporte" className="hover:text-slate-600">Soporte</Link>
          </div>
        </div>
        <p className="mt-4 text-xs text-slate-400">
          © {new Date().getFullYear()} VITAEON · Red médica privada · León, Guanajuato, México
        </p>
      </footer>
    </main>
  );
}
