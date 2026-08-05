import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { stripBlockedDateSlots } from "@/lib/availability/availability";
import { prisma } from "@/lib/db/prisma";
import { publicDoctorWhere } from "@/lib/doctors/public-doctor-filter";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function getDoctor(slug: string) {
  const doctor = await prisma.doctor.findFirst({
    where: {
      slug,
      ...publicDoctorWhere
    },
    include: {
      specialty: true,
      hospital: true,
      reviews: {
        where: { status: "PUBLISHED" },
        include: { patient: { include: { user: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
        take: 6
      },
      availabilitySlots: {
        where: { isActive: true, startsAt: { gte: new Date() }, appointment: null },
        orderBy: { startsAt: "asc" },
        take: 8
      },
      additionalLocations: {
        include: { hospital: { select: { id: true, name: true, city: true } } },
        orderBy: { createdAt: "asc" }
      }
    }
  });

  if (!doctor) return null;

  // Mismo criterio que el listado público y la reserva: los días bloqueados
  // por el médico no se ofrecen al paciente.
  const [withOpenDays] = await stripBlockedDateSlots(prisma, [doctor]);
  return withOpenDays;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doctor = await getDoctor(slug).catch(() => null);
  if (!doctor) return { title: "Perfil médico" };
  return {
    title: `${doctor.fullName} | ${doctor.specialty.name} en León | VITAEON`,
    description: `${doctor.fullName}, ${doctor.specialty.name} en ${doctor.hospital.name}. ${doctor.bio?.slice(0, 120) ?? "Perfil verificado en VITAEON."}`,
    openGraph: {
      title: `${doctor.fullName} · ${doctor.specialty.name}`,
      description: doctor.bio?.slice(0, 160) ?? "Perfil médico verificado en VITAEON León.",
      images: doctor.imageUrl ? [{ url: doctor.imageUrl }] : []
    }
  };
}

export default async function DoctorSeoPage({ params }: PageProps) {
  const { slug } = await params;
  const doctor = await getDoctor(slug);
  if (!doctor) notFound();

  // Only show a real aggregate rating computed from verified published reviews.
  // The `doctor.rating` field defaults to 4.9 in the schema, which is misleading
  // for new doctors with zero reviews — we show nothing instead.
  const average = doctor.reviews.length
    ? doctor.reviews.reduce((sum, review) => sum + review.rating, 0) / doctor.reviews.length
    : null;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://vitaeon.mx";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Physician",
    "name": doctor.fullName,
    "description": doctor.bio,
    "medicalSpecialty": doctor.specialty.name,
    "url": `${appUrl}/medicos/${doctor.slug}`,
    "image": doctor.imageUrl ?? undefined,
    "worksFor": {
      "@type": "MedicalOrganization",
      "name": doctor.hospital.name,
      "address": {
        "@type": "PostalAddress",
        "addressLocality": doctor.cityState ?? "León",
        "addressRegion": "Guanajuato",
        "addressCountry": "MX"
      }
    },
    ...(doctor.officeAddress && {
      "address": {
        "@type": "PostalAddress",
        "streetAddress": doctor.officeAddress,
        "addressLocality": doctor.cityState ?? "León",
        "addressRegion": "Guanajuato",
        "addressCountry": "MX"
      }
    }),
    ...(doctor.professionalPhone && { "telephone": doctor.professionalPhone }),
    ...(doctor.reviews.length > 0 && average !== null && {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": average.toFixed(1),
        "reviewCount": String(doctor.reviews.length),
        "bestRating": "5",
        "worstRating": "1"
      }
    })
  };

  /* ── Helpers ── */
  const price = doctor.consultationPriceCents
    ? new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(doctor.consultationPriceCents / 100)
    : null;

  const socialLinks = [
    { label: "WhatsApp", url: doctor.whatsappUrl, icon: "💬", cta: true },
    { label: "Instagram", url: doctor.instagramUrl, icon: "📸", cta: false },
    { label: "LinkedIn", url: doctor.linkedinUrl, icon: "💼", cta: false },
    { label: "Sitio web", url: doctor.websiteUrl, icon: "🌐", cta: false }
  ].filter((s): s is typeof s & { url: string } => Boolean(s.url));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbfd_0%,#ffffff_52%,#eef5f8_100%)] px-5 pb-24 pt-8 text-[#071726]">
        <nav className="glass mx-auto flex max-w-7xl items-center justify-between rounded-full px-7 py-4 shadow-glass">
          <Link href="/" className="font-semibold tracking-[0.45em] text-[#071726]">VITAEON</Link>
          <Link href={`/?doctor=${doctor.id}`} className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">
            Agendar cita
          </Link>
        </nav>

        <section className="mx-auto mt-16 grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          {/* Columna izquierda — foto y galería */}
          <div className="space-y-5">
            <div className="rounded-[2rem] border border-silver bg-white p-5 shadow-premium">
              <Image
                src={doctor.imageUrl ?? "/doctor-diagnosis.jpg"}
                alt={doctor.fullName}
                width={900}
                height={900}
                // Skip Next.js optimization only for images NOT hosted on Supabase
                // (e.g. local /public files in dev). Supabase URLs are covered by
                // remotePatterns in next.config.mjs and can be served as AVIF/WebP.
                unoptimized={!doctor.imageUrl?.includes("supabase.co")}
                className="h-[32rem] w-full rounded-[1.5rem] object-cover"
                priority
              />
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
                  ✓ Médico verificado
                </span>
                {doctor.reviews.length > 0 && average !== null && (
                  <span className="rounded-full bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
                    ★ {average.toFixed(1)} · {doctor.reviews.length} opinión{doctor.reviews.length !== 1 ? "es" : ""}
                  </span>
                )}
                {price && (
                  <span className="rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                    {price} / consulta
                  </span>
                )}
              </div>

              {/* Redes sociales y contacto */}
              {socialLinks.length > 0 && (
                <div className="mt-5 flex flex-wrap gap-2">
                  {socialLinks.map((s) => (
                    <a
                      key={s.label}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5 ${
                        s.cta
                          ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                          : "border border-silver bg-white text-deep hover:border-slate-300"
                      }`}
                    >
                      <span>{s.icon}</span> {s.label}
                    </a>
                  ))}
                </div>
              )}
            </div>

            {/* Foto del consultorio */}
            {doctor.practicePhotoUrl && (
              <div className="rounded-[1.75rem] border border-silver bg-white p-5 shadow-premium">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-medical">Consultorio</p>
                <Image
                  src={doctor.practicePhotoUrl}
                  alt={`Consultorio de ${doctor.fullName}`}
                  width={900}
                  height={520}
                  unoptimized={!doctor.practicePhotoUrl.includes("supabase.co")}
                  className="mt-3 h-56 w-full rounded-[1.35rem] object-cover"
                />
                <p className="mt-3 text-sm leading-6 text-slate-500">
                  Espacio de atención mostrado por el médico para orientar tu visita.
                </p>
              </div>
            )}
          </div>

          {/* Columna derecha — info y disponibilidad */}
          <div className="space-y-5">
            <div className="rounded-[2rem] border border-silver bg-white p-8 shadow-premium">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-medical">Perfil médico público</p>
              <h1 className="mt-4 text-4xl font-semibold leading-tight text-[#071726] sm:text-5xl">
                {doctor.fullName}
              </h1>
              <p className="mt-3 text-xl font-semibold text-medical">{doctor.specialty.name}</p>
              {doctor.subSpecialty && (
                <p className="mt-1 text-sm font-semibold text-slate-500">{doctor.subSpecialty}</p>
              )}
              <p className="mt-6 text-base leading-8 text-slate-600">{doctor.bio}</p>

              <dl className="mt-8 grid gap-3 text-slate-600">
                <div>
                  <dt className="font-semibold text-[#071726]">Hospital principal</dt>
                  <dd className="mt-0.5 text-sm">{doctor.hospital.name}</dd>
                </div>
                {doctor.additionalLocations.length > 0 && (
                  <div>
                    <dt className="font-semibold text-[#071726]">También atiende en</dt>
                    <dd className="mt-1 flex flex-wrap gap-2">
                      {doctor.additionalLocations.map((loc) => (
                        <span key={loc.id} className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                          {loc.hospital.name}{loc.notes ? ` · ${loc.notes}` : ""}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
                <div>
                  <dt className="font-semibold text-[#071726]">Cédula profesional</dt>
                  <dd className="mt-0.5 text-sm">{doctor.professionalLicense ?? "En verificación"}</dd>
                </div>
                {doctor.university && (
                  <div>
                    <dt className="font-semibold text-[#071726]">Universidad</dt>
                    <dd className="mt-0.5 text-sm">{doctor.university}</dd>
                  </div>
                )}
                {doctor.yearsExperience > 0 && (
                  <div>
                    <dt className="font-semibold text-[#071726]">Experiencia</dt>
                    <dd className="mt-0.5 text-sm">{doctor.yearsExperience} años</dd>
                  </div>
                )}
                {doctor.officeAddress && (
                  <div>
                    <dt className="font-semibold text-[#071726]">Consultorio</dt>
                    <dd className="mt-0.5 text-sm">
                      {doctor.officeAddress}
                      {doctor.officeReference && ` — ${doctor.officeReference}`}
                    </dd>
                  </div>
                )}
                {doctor.mapsUrl && (
                  <div>
                    <a
                      href={doctor.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-medical hover:underline"
                    >
                      📍 Ver en Google Maps
                    </a>
                  </div>
                )}
              </dl>
            </div>

            {/* Disponibilidad */}
            <div className="rounded-[2rem] border border-silver bg-white p-6 shadow-premium">
              <p className="font-semibold text-[#071726]">Próxima disponibilidad</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {doctor.availabilitySlots.map((slot) => (
                  <span key={slot.id} className="rounded-full bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-800">
                    {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(slot.startsAt)}
                  </span>
                ))}
                {doctor.availabilitySlots.length === 0 && (
                  <span className="text-sm text-slate-500">Sin horarios publicados por ahora.</span>
                )}
              </div>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/?doctor=${doctor.id}`}
                  className="inline-flex items-center gap-2 rounded-full bg-[#071726] px-6 py-3.5 font-semibold text-white transition hover:-translate-y-0.5"
                >
                  Ver disponibilidad y agendar cita →
                </Link>
                {doctor.whatsappUrl && (
                  <a
                    href={doctor.whatsappUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-5 py-3.5 font-semibold text-emerald-700 transition hover:-translate-y-0.5"
                  >
                    💬 WhatsApp directo
                  </a>
                )}
              </div>
            </div>

            {/* Opiniones */}
            {doctor.reviews.length > 0 && (
              <div className="rounded-[2rem] border border-silver bg-white p-6 shadow-premium">
                <p className="font-semibold text-[#071726]">
                  Opiniones de pacientes{average !== null ? ` · ★ ${average.toFixed(1)} de 5` : ""}
                </p>
                <div className="mt-4 grid gap-3">
                  {doctor.reviews.map((review) => (
                    <article key={review.id} className="rounded-2xl bg-slate-50 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-[#071726]">
                          {review.patient.user.name.split(" ")[0]}.
                        </p>
                        <span className="text-sm text-amber-500">{"★".repeat(review.rating)}</span>
                      </div>
                      {review.comment && (
                        <p className="mt-2 text-sm leading-6 text-slate-600">{review.comment}</p>
                      )}
                      {review.doctorReply && (
                        <div className="mt-3 rounded-xl border-l-2 border-medical/30 bg-white pl-3 py-2">
                          <p className="text-xs font-semibold text-medical">Respuesta del médico</p>
                          <p className="mt-1 text-sm leading-5 text-slate-600">{review.doctorReply}</p>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </>
  );
}
