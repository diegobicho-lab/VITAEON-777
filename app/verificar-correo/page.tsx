import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";

export const metadata: Metadata = {
  // El layout raíz ya aplica la plantilla "%s | VITAEON".
  title: "Verificación de correo",
  robots: { index: false, follow: false }
};

const STATES = {
  ok: {
    Icon: CheckCircle2,
    tone: "text-emerald-600",
    ring: "ring-emerald-100 bg-emerald-50",
    title: "Tu correo quedó verificado",
    body: "Ya puedes reservar citas y continuar con pagos en línea. Si tenías una reserva a medias, vuelve a intentarla: el bloqueo desapareció.",
    cta: { href: "/dashboard/patient", label: "Ir a mi panel" }
  },
  expired: {
    Icon: Clock,
    tone: "text-amber-600",
    ring: "ring-amber-100 bg-amber-50",
    title: "Ese enlace ya expiró",
    body: "Los enlaces de verificación duran 24 horas y solo pueden usarse una vez. Entra a tu panel y pide uno nuevo: llega en menos de un minuto.",
    cta: { href: "/dashboard/patient", label: "Reenviar verificación" }
  },
  invalid: {
    Icon: XCircle,
    tone: "text-red-600",
    ring: "ring-red-100 bg-red-50",
    title: "No pudimos leer ese enlace",
    body: "Es posible que el correo haya cortado la dirección en dos líneas. Copia el enlace completo o solicita uno nuevo desde tu panel.",
    cta: { href: "/dashboard/patient", label: "Ir a mi panel" }
  }
} as const;

export default async function VerifyEmailPage({
  searchParams
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const { estado } = await searchParams;
  const state = STATES[estado as keyof typeof STATES] ?? STATES.invalid;
  const { Icon } = state;

  return (
    <main className="flex min-h-[70vh] items-center justify-center px-5 py-16">
      <div className="w-full max-w-md rounded-[1.75rem] border border-silver/70 bg-white p-8 text-center shadow-[0_4px_24px_rgba(8,32,51,0.05)]">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ring-1 ${state.ring}`}>
          <Icon className={`h-7 w-7 ${state.tone}`} aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-semibold text-deep sm:text-2xl">{state.title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">{state.body}</p>
        <Link
          href={state.cta.href}
          className="mt-6 inline-flex w-full items-center justify-center rounded-full bg-[#071726] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0d2638]"
        >
          {state.cta.label}
        </Link>
        <Link href="/" className="mt-3 inline-block text-xs font-semibold text-slate-500 hover:text-deep">
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}
