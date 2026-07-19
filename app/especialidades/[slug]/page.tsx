import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { publicDoctorWhere } from "@/lib/doctors/public-doctor-filter";
import { slugify } from "@/lib/seo/slug";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

async function getSpecialty(slug: string) {
  const specialties = await prisma.specialty.findMany({
    include: {
      doctors: {
        where: {
          ...publicDoctorWhere
        },
        include: {
          hospital: true,
          reviews: { where: { status: "PUBLISHED" }, select: { rating: true } },
          availabilitySlots: {
            where: { isActive: true, startsAt: { gte: new Date() }, appointment: null },
            orderBy: { startsAt: "asc" },
            take: 3
          }
        }
      }
    }
  });
  return specialties.find((specialty) => slugify(specialty.name) === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const specialty = await getSpecialty(slug).catch(() => null);
  if (!specialty) return { title: "Especialidad médica" };
  return {
    title: `${specialty.name} en León, Guanajuato | VITAEON`,
    description: `Especialistas verificados en ${specialty.name} dentro de la red médica privada VITAEON en León, Guanajuato.`,
    robots: specialty.doctors.length > 0 ? { index: true, follow: true } : { index: false, follow: true }
  };
}

export default async function SpecialtyPage({ params }: PageProps) {
  const { slug } = await params;
  const specialty = await getSpecialty(slug);
  if (!specialty) notFound();

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://vitaeon.mx";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalWebPage",
    "name": `${specialty.name} en León, Guanajuato`,
    "description": specialty.description ?? `Especialistas verificados en ${specialty.name} dentro de la red médica VITAEON en León, Guanajuato.`,
    "url": `${appUrl}/especialidades/${slug}`,
    "about": {
      "@type": "MedicalSpecialty",
      "name": specialty.name,
      "relevantSpecialty": specialty.name
    },
    "audience": {
      "@type": "Patient",
      "audienceType": "Paciente",
      "geographicArea": {
        "@type": "AdministrativeArea",
        "name": "León, Guanajuato, México"
      }
    }
  };

  const medalPriority = { amatista: 4, diamante: 3, obsidiana: 2, oro: 1 };
  const doctors = specialty.doctors.sort((a, b) => {
    const plan = medalPriority[b.medal] - medalPriority[a.medal];
    if (plan !== 0) return plan;
    const availability = b.availabilitySlots.length - a.availabilitySlots.length;
    if (availability !== 0) return availability;
    return a.fullName.localeCompare(b.fullName, "es");
  });

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
      <section className="mx-auto mt-16 max-w-7xl">
        <p className="text-sm font-semibold uppercase tracking-[0.28em] text-medical">Especialidad verificada</p>
        <h1 className="mt-4 max-w-5xl text-5xl font-semibold leading-tight text-deep md:text-7xl">
          {specialty.name} en León, Guanajuato.
        </h1>
        <p className="mt-6 max-w-3xl text-xl leading-8 text-slate-600">
          Explora médicos verificados, disponibilidad real y perfiles profesionales dentro de la red VITAEON.
        </p>
        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {doctors.map((doctor) => {
            const average = doctor.reviews.length
              ? doctor.reviews.reduce((sum, review) => sum + review.rating, 0) / doctor.reviews.length
              : doctor.rating;
            return (
              <Link key={doctor.id} href={`/medicos/${doctor.slug}`} className="rounded-[2rem] border border-silver bg-white p-5 shadow-premium transition hover:-translate-y-1">
                <Image src={doctor.imageUrl ?? "/doctor-diagnosis.jpg"} alt={doctor.fullName} width={640} height={360} unoptimized className="h-56 w-full rounded-[1.5rem] object-cover" />
                <div className="mt-5 flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-semibold text-deep">{doctor.fullName}</h2>
                    <p className="mt-1 text-sm font-semibold text-medical">{doctor.subSpecialty}</p>
                  </div>
                  <span className="rounded-full bg-slate-50 px-3 py-2 text-sm font-semibold text-deep">★ {average.toFixed(1)}</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-slate-600">{doctor.hospital.name} · {doctor.yearsExperience} años · {doctor.availabilitySlots.length} horarios próximos</p>
              </Link>
            );
          })}
          {doctors.length === 0 && (
            <div className="rounded-[2rem] border border-silver bg-white p-8 shadow-premium">
              <p className="font-semibold text-deep">Aún no hay especialistas disponibles</p>
              <p className="mt-3 text-slate-600">Aún no hay especialistas disponibles en esta categoría. Estamos incorporando médicos verificados para la beta privada de VITAEON.</p>
            </div>
          )}
        </div>
      </section>
    </main>
    </>
  );
}
