import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { publicDoctorWhere } from "@/lib/doctors/public-doctor-filter";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function getDoctor(slug: string) {
  return prisma.doctor.findFirst({
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
      }
    }
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const doctor = await getDoctor(slug).catch(() => null);
  if (!doctor) return { title: "Perfil médico" };
  return {
    title: `${doctor.fullName} | ${doctor.specialty.name} en León | VITAEON`,
    description: `${doctor.fullName}, ${doctor.specialty.name}, ${doctor.hospital.name}. Perfil verificado en VITAEON.`
  };
}

export default async function DoctorSeoPage({ params }: PageProps) {
  const { slug } = await params;
  const doctor = await getDoctor(slug);
  if (!doctor) notFound();

  const average = doctor.reviews.length
    ? doctor.reviews.reduce((sum, review) => sum + review.rating, 0) / doctor.reviews.length
    : doctor.rating;

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
    ...(doctor.reviews.length > 0 && {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": average.toFixed(1),
        "reviewCount": String(doctor.reviews.length),
        "bestRating": "5",
        "worstRating": "1"
      }
    })
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    <main className="min-h-screen bg-[linear-gradient(180deg,#f8fbfd_0%,#ffffff_52%,#eef5f8_100%)] px-5 pb-24 pt-8 text-ink">
      <nav className="glass mx-auto flex max-w-7xl items-center justify-between rounded-full px-7 py-4 shadow-glass">
        <Link href="/" className="font-semibold tracking-[0.45em] text-deep">VITAEON</Link>
        <Link href="/#busqueda" className="rounded-full bg-black px-5 py-3 text-sm font-semibold text-white">Agendar cita</Link>
      </nav>
      <section className="mx-auto mt-16 grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="rounded-[2rem] border border-silver bg-white p-5 shadow-premium">
          <Image src={doctor.imageUrl ?? "/doctor-diagnosis.jpg"} alt={doctor.fullName} width={900} height={900} unoptimized className="h-[32rem] w-full rounded-[1.5rem] object-cover" />
          <div className="mt-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">Médico verificado</span>
            <span className="rounded-full bg-slate-50 px-4 py-2 text-sm font-semibold text-deep">★ {average.toFixed(1)} · {doctor.reviews.length} opiniones</span>
          </div>
          {doctor.practicePhotoUrl && (
            <div className="mt-5 rounded-[1.75rem] border border-silver bg-[linear-gradient(180deg,#f8fbfd_0%,#ffffff_100%)] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-medical">Consultorio</p>
              <Image
                src={doctor.practicePhotoUrl}
                alt={`Consultorio de ${doctor.fullName}`}
                width={900}
                height={520}
                unoptimized
                className="mt-3 h-56 w-full rounded-[1.35rem] object-cover"
              />
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Espacio de atención mostrado por el médico para orientar tu visita.
              </p>
            </div>
          )}
        </div>
        <div className="rounded-[2rem] border border-silver bg-white p-8 shadow-premium">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-medical">Perfil médico público</p>
          <h1 className="mt-4 text-5xl font-semibold leading-tight text-deep">{doctor.fullName}</h1>
          <p className="mt-3 text-xl font-semibold text-medical">{doctor.specialty.name}</p>
          <p className="mt-6 text-lg leading-8 text-slate-600">{doctor.bio}</p>
          <div className="mt-8 grid gap-3 text-slate-600">
            <p><strong className="text-deep">Hospital:</strong> {doctor.hospital.name}</p>
            <p><strong className="text-deep">Cédula:</strong> {doctor.professionalLicense ?? "En verificación"}</p>
            <p className="text-sm leading-6 text-slate-500">
              La cédula se muestra como dato profesional. La imagen documental completa queda reservada para revisión interna de VITAEON.
            </p>
            {doctor.university && <p><strong className="text-deep">Universidad:</strong> {doctor.university}</p>}
            <p><strong className="text-deep">Experiencia:</strong> {doctor.yearsExperience} años</p>
            {doctor.officeAddress && <p><strong className="text-deep">Consultorio:</strong> {doctor.officeAddress}</p>}
            {doctor.officeReference && <p><strong className="text-deep">Referencia:</strong> {doctor.officeReference}</p>}
            {doctor.cityState && <p><strong className="text-deep">Ciudad:</strong> {doctor.cityState}</p>}
          </div>
          <div className="mt-8 rounded-[1.5rem] bg-slate-50 p-5">
            <p className="font-semibold text-deep">Próxima disponibilidad</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {doctor.availabilitySlots.map((slot) => (
                <span key={slot.id} className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-deep">
                  {new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short" }).format(slot.startsAt)}
                </span>
              ))}
              {doctor.availabilitySlots.length === 0 && <span className="text-sm text-slate-600">Sin horarios publicados por ahora.</span>}
            </div>
          </div>
          <Link href="/#busqueda" className="mt-8 inline-flex rounded-full bg-black px-6 py-4 font-semibold text-white">
            Ver disponibilidad y agendar
          </Link>
        </div>
      </section>
    </main>
    </>
  );
}
