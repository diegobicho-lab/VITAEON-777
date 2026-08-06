import { prisma } from "@/lib/db/prisma";
import { stripBlockedDateSlots } from "@/lib/availability/availability";
import { publicDoctorWhere } from "@/lib/doctors/public-doctor-filter";
import { ok, fail } from "@/lib/api-response";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { doctorSearchSchema } from "@/lib/validation/schemas";

const medalPriority = {
  amatista: 4,
  diamante: 3,
  obsidiana: 0,
  oro: 1
};

const patientLanguageMap: Array<{ keys: string[]; terms: string[] }> = [
  { keys: ["dieta", "bajar de peso", "peso", "obesidad", "nutricion", "nutrición", "alimentacion", "alimentación", "plan alimenticio"], terms: ["Nutrición", "Endocrinología", "Medicina Interna", "metabolismo"] },
  { keys: ["cadera", "rodilla", "hombro", "tobillo", "fractura", "esguince", "trauma", "ortopedia", "lesion", "lesión"], terms: ["Traumatología", "Ortopedia", "Medicina de Rehabilitación"] },
  { keys: ["espalda", "columna", "ciatica", "ciática", "lumbalgia", "cuello"], terms: ["Traumatología", "Ortopedia", "Medicina de Rehabilitación", "Neurología", "columna"] },
  { keys: ["diabetes", "glucosa", "azucar", "azúcar", "tiroides", "hormonal", "metabolismo"], terms: ["Endocrinología", "Medicina Interna"] },
  { keys: ["presion", "presión", "hipertension", "hipertensión", "presión alta"], terms: ["Medicina Interna", "Cardiología"] },
  { keys: ["pecho", "dolor de pecho", "palpitaciones", "falta de aire", "corazon", "corazón"], terms: ["Cardiología", "Medicina Interna", "Neumología"] },
  { keys: ["embarazo", "control prenatal", "menstruacion", "menstruación", "ovario"], terms: ["Ginecología", "Obstetricia"] },
  { keys: ["ansiedad", "depresion", "depresión", "estres", "estrés", "panico", "pánico", "insomnio"], terms: ["Psicología", "Psiquiatría"] },
  { keys: ["acne", "acné", "piel", "manchas", "lunar", "cabello", "comezon", "comezón"], terms: ["Dermatología"] },
  { keys: ["estomago", "estómago", "gastritis", "reflujo", "abdomen", "colon", "diarrea", "estreñimiento"], terms: ["Gastroenterología", "Medicina Interna"] },
  { keys: ["tos", "asma", "bronquitis", "neumonia", "neumonía", "respirar"], terms: ["Neumología", "Medicina Interna"] },
  { keys: ["orina", "urinaria", "prostata", "próstata", "riñon", "riñón"], terms: ["Urología", "Nefrología"] },
  { keys: ["ojo", "ojos", "vista", "vision", "visión"], terms: ["Oftalmología"] },
  { keys: ["oido", "oído", "garganta", "nariz", "sinusitis"], terms: ["Otorrinolaringología"] },
  { keys: ["niño", "niña", "bebe", "bebé", "vacunas", "pediatria", "pediatría"], terms: ["Pediatría"] },
  { keys: ["articulaciones", "artritis", "reuma", "dolor articular"], terms: ["Reumatología", "Medicina Interna"] }
];

function expandSearchTerms(query?: string) {
  if (!query?.trim()) return [];
  const clean = query.trim().toLowerCase();
  const terms = new Set([query.trim()]);
  for (const entry of patientLanguageMap) {
    if (entry.keys.some((key) => clean.includes(key))) {
      entry.terms.forEach((term) => terms.add(term));
    }
  }
  return Array.from(terms).slice(0, 8);
}

/** Hard cap on the number of doctors returned per search request.
 *  Keeps memory usage and response times predictable while the number of
 *  verified doctors is small.  Replace with full cursor pagination once the
 *  platform reaches ~500 doctors.
 */
const DOCTOR_SEARCH_LIMIT = 120;

export async function GET(request: Request) {
  const limit = await rateLimitByIp("doctors:search", { limit: 60, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas búsquedas. Intenta de nuevo en un momento.", 429);

  const { searchParams } = new URL(request.url);
  const parsed = doctorSearchSchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return fail("VALIDATION_ERROR", "Filtros inválidos.", 422, parsed.error.flatten());

  const { specialtyId, hospitalId, city, query } = parsed.data;
  const searchTerms = expandSearchTerms(query);
  const doctors = await prisma.doctor.findMany({
    where: {
      ...publicDoctorWhere,
      ...(specialtyId ? { specialtyId } : {}),
      ...(hospitalId ? { hospitalId } : {}),
      ...(city ? { hospital: { city } } : {}),
      ...(searchTerms.length
        ? {
            OR: [
              ...searchTerms.flatMap((term) => [
                { fullName: { contains: term, mode: "insensitive" as const } },
                { subSpecialty: { contains: term, mode: "insensitive" as const } },
                { bio: { contains: term, mode: "insensitive" as const } },
                { specialty: { name: { contains: term, mode: "insensitive" as const } } },
                { hospital: { name: { contains: term, mode: "insensitive" as const } } },
                { hospital: { city: { contains: term, mode: "insensitive" as const } } }
              ])
            ]
          }
        : {})
    },
    include: {
      specialty: true,
      hospital: true,
      availabilitySlots: {
        where: {
          isActive: true,
          startsAt: { gte: new Date() },
          appointment: null
        },
        orderBy: { startsAt: "asc" },
        take: 12
      },
      reviews: {
        where: { status: "PUBLISHED" },
        select: { rating: true }
      }
    },
    // Pre-sort by medal ASC — PostgreSQL sorts enums alphabetically, so
    // "amatista" (a) < "diamante" (d) < "obsidiana" (o) < "oro" (o).
    // ASC puts amatista first, diamante second — the two premium tiers always
    // survive the DOCTOR_SEARCH_LIMIT cap.  The in-process sort below refines
    // secondary criteria (slots, reviews, alphabetical).
    orderBy: [
      { medal: "asc" },
      { fullName: "asc" }
    ],
    take: DOCTOR_SEARCH_LIMIT
  });

  // Los días que el médico marcó como no disponibles se descartan ANTES de
  // ordenar, para que la disponibilidad que ve el paciente y el criterio de
  // ranking usen exactamente el mismo conjunto de horarios.
  const doctorsWithOpenDays = await stripBlockedDateSlots(prisma, doctors);

  // Weighted review score: average × log₂(count + 1)
  // A doctor with 5★ × 1 review scores lower than one with 4.8★ × 20 reviews.
  function reviewScore(reviews: Array<{ rating: number }>) {
    if (reviews.length === 0) return 0;
    const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
    return avg * Math.log2(reviews.length + 1);
  }

  const sortedDoctors = doctorsWithOpenDays.sort((a, b) => {
    // 1. Plan tier (amatista > diamante > oro > obsidiana)
    const planDifference = medalPriority[b.medal] - medalPriority[a.medal];
    if (planDifference !== 0) return planDifference;

    // 2. Has at least one future slot (binary: yes beats no)
    const aHasSlots = a.availabilitySlots.length > 0 ? 1 : 0;
    const bHasSlots = b.availabilitySlots.length > 0 ? 1 : 0;
    if (bHasSlots !== aHasSlots) return bHasSlots - aHasSlots;

    // 3. Weighted review score (higher is better)
    const scoreDiff = reviewScore(b.reviews) - reviewScore(a.reviews);
    if (Math.abs(scoreDiff) > 0.001) return scoreDiff;

    // 4. More available slots
    const slotDiff = b.availabilitySlots.length - a.availabilitySlots.length;
    if (slotDiff !== 0) return slotDiff;

    // 5. Alphabetical as final tiebreaker
    return a.fullName.localeCompare(b.fullName, "es");
  });

  return ok(
    sortedDoctors.map((doctor) => {
      // Do not fall back to doctor.rating (default 4.9) — return null when
      // there are no published reviews so the UI can show an empty state instead
      // of misleading social proof.
      const reviewAverage = doctor.reviews.length
        ? doctor.reviews.reduce((sum, review) => sum + review.rating, 0) / doctor.reviews.length
        : null;

      return {
        id: doctor.id,
        name: doctor.fullName,
        slug: doctor.slug,
        specialty: doctor.specialty.name,
        specialtyId: doctor.specialtyId,
        subSpecialty: doctor.subSpecialty,
        bio: doctor.bio,
        yearsExperience: doctor.yearsExperience,
        city: doctor.hospital.city,
        hospital: doctor.hospital.name,
        hospitalId: doctor.hospitalId,
        priceCents: doctor.consultationPriceCents,
        consultationDurationMinutes: doctor.consultationDurationMinutes,
        rating: reviewAverage,
        reviewAverage,
        reviewCount: doctor.reviews.length,
        medal: doctor.medal,
        planPriorityLabel:
          doctor.medal === "amatista"
            ? "Perfil destacado"
            : doctor.medal === "diamante"
              ? "Mayor visibilidad por plan"
              : "Visibilidad normal",
        verificationStatus: doctor.verificationStatus,
        professionalLicense: doctor.professionalLicense,
        university: doctor.university,
        imageUrl: doctor.imageUrl,
        practicePhotoUrl: doctor.practicePhotoUrl,
        verifiedAt: doctor.verifiedAt,
        officeAddress: doctor.officeAddress,
        officeReference: doctor.officeReference,
        cityState: doctor.cityState,
        mapsUrl: doctor.mapsUrl,
        professionalPhone: doctor.professionalPhone,
        instagramUrl: doctor.instagramUrl,
        facebookUrl: doctor.facebookUrl,
        linkedinUrl: doctor.linkedinUrl,
        websiteUrl: doctor.websiteUrl,
        whatsappUrl: doctor.whatsappUrl,
        achievements: doctor.achievements,
        certifications: doctor.certifications,
        // El paciente debe conocer la política de devoluciones ANTES de pagar,
        // no enterrada en términos y condiciones.
        refundPolicy: doctor.refundPolicy,
        refundPolicyNotes: doctor.refundPolicyNotes,
        availability: doctor.availabilitySlots.map((slot) => ({
          id: slot.id,
          startsAt: slot.startsAt,
          endsAt: slot.endsAt
        }))
      };
    })
  );
}
