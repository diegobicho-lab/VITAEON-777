import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Urgencias médicas | VITAEON",
  description: "VITAEON no es un servicio de urgencias. Si estás en peligro, llama al 911 o acude a la sala de emergencias más cercana en León, Guanajuato."
};

const RED_FLAGS = [
  "Dolor fuerte en el pecho o brazo izquierdo",
  "Dificultad para respirar súbita",
  "Pérdida de conciencia o desmayo",
  "Sangrado abundante que no cesa",
  "Debilidad o entumecimiento repentino en cara, brazo o pierna",
  "Confusión mental o dificultad para hablar",
  "Visión borrosa o pérdida repentina de la vista",
  "Convulsiones",
  "Fiebre muy alta con rigidez de nuca",
  "Sobredosis o intoxicación",
  "Pensamientos de hacerse daño o hacerle daño a otros"
];

const EMERGENCY_CONTACTS = [
  { name: "Emergencias nacionales", number: "911", color: "bg-red-600 text-white", bold: true },
  { name: "Cruz Roja León", number: "477 714 3636", color: "bg-rose-50 text-rose-700", bold: false },
  { name: "IMSS Urgencias León", number: "477 788 4600", color: "bg-rose-50 text-rose-700", bold: false },
  { name: "Hospital General León", number: "477 716 0900", color: "bg-rose-50 text-rose-700", bold: false }
];

export default function UrgenciasPage() {
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#fff5f5_0%,#fff_60%,#eef5f8_100%)] px-5 pb-24 pt-8 text-[#071726]">
      {/* Nav */}
      <nav className="mx-auto flex max-w-3xl items-center justify-between">
        <Link href="/" className="font-semibold tracking-[0.45em] text-[#071726]">VITAEON</Link>
        <Link href="/" className="rounded-full bg-[#071726] px-5 py-2.5 text-sm font-semibold text-white">
          Ir al inicio
        </Link>
      </nav>

      <div className="mx-auto mt-12 max-w-3xl">
        {/* Alerta principal */}
        <div className="rounded-[2rem] border-2 border-red-200 bg-red-50 p-8 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-red-600">Aviso importante</p>
          <h1 className="mt-3 text-3xl font-bold text-red-700 sm:text-4xl">
            VITAEON no es servicio de urgencias
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-base leading-7 text-red-800">
            Si estás en peligro inmediato o presencias una emergencia médica, llama ahora al <strong>911</strong> o ve a la sala de urgencias más cercana.
          </p>
          <a
            href="tel:911"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-red-600 px-8 py-4 text-lg font-bold text-white shadow-lg transition hover:bg-red-700 active:scale-95"
          >
            📞 Llamar al 911
          </a>
        </div>

        {/* Contactos de emergencia en León */}
        <section className="mt-10">
          <h2 className="text-xl font-bold text-[#071726]">Números de emergencia en León, Gto.</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {EMERGENCY_CONTACTS.map((contact) => (
              <a
                key={contact.name}
                href={`tel:${contact.number.replace(/\s/g, "")}`}
                className={`flex items-center justify-between rounded-2xl px-5 py-4 transition hover:-translate-y-0.5 ${contact.color}`}
              >
                <div>
                  <p className={`text-sm ${contact.bold ? "font-bold text-lg" : "font-semibold"}`}>{contact.name}</p>
                  {!contact.bold && <p className="mt-0.5 text-xs text-rose-500">Toca para llamar</p>}
                </div>
                <span className={`font-bold ${contact.bold ? "text-3xl" : "text-lg"}`}>{contact.number}</span>
              </a>
            ))}
          </div>
        </section>

        {/* Señales de alarma */}
        <section className="mt-10 rounded-[2rem] border border-slate-200 bg-white p-7">
          <h2 className="text-xl font-bold text-[#071726]">Señales de alarma — ve a urgencias</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Si presentas alguno de estos síntomas, no esperes cita médica. Ve de inmediato a urgencias o llama al 911.
          </p>
          <ul className="mt-5 grid gap-2 sm:grid-cols-2">
            {RED_FLAGS.map((flag) => (
              <li key={flag} className="flex items-start gap-2.5 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                <span className="mt-0.5 h-2 w-2 flex-shrink-0 rounded-full bg-red-500" />
                {flag}
              </li>
            ))}
          </ul>
        </section>

        {/* Qué es VITAEON */}
        <section className="mt-10 rounded-[2rem] bg-[#071726] p-7 text-white">
          <h2 className="text-xl font-bold">¿Qué hace VITAEON?</h2>
          <p className="mt-3 text-sm leading-7 text-slate-300">
            VITAEON es una plataforma de orientación, búsqueda y agendamiento de citas con médicos especialistas privados en León, Guanajuato. Nuestro orientador inteligente puede ayudarte a identificar qué especialista necesitas, pero no sustituye la valoración presencial ni la atención de urgencias.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/" className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-[#071726] transition hover:bg-slate-100">
              Buscar médico especialista
            </Link>
            <Link href="/soporte" className="rounded-full border border-white/30 px-5 py-2.5 text-sm font-semibold text-white transition hover:border-white/60">
              Centro de ayuda
            </Link>
          </div>
        </section>

        <p className="mt-8 text-center text-xs leading-5 text-slate-400">
          VITAEON · Red médica privada en León, Guanajuato · No sustituye servicios de emergencia, ambulancia ni valoración inmediata.
        </p>
      </div>
    </main>
  );
}
