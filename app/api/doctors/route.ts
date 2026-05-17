import { prisma } from "@/lib/db/prisma";
import { publicDoctorWhere } from "@/lib/doctors/public-doctor-filter";
import { ok, fail } from "@/lib/api-response";
import { doctorSearchSchema } from "@/lib/validation/schemas";

const medalPriority = {
  amatista: 3,
  diamante: 2,
  oro: 1
};

const patientLanguageMap: Array<{ keys: string[]; terms: string[] }> = [
  { keys: ["dieta", "bajar de peso", "peso", "nutricion", "nutrición"], terms: ["Nutrición", "Endocrinología", "Medicina Interna", "metabolismo"] },
  { keys: ["cadera", "rodilla", "fractura", "trauma", "ortopedia"], terms: ["Traumatología", "Ortopedia", "Medicina de Rehabilitación"] },
  { keys: ["espalda", "columna", "ciatica", "ciática"], terms: ["Traumatología", "Ortopedia", "Medicina de Rehabilitación", "Neurología", "columna"] },
  { keys: ["diabetes", "glucosa", "azucar", "azúcar"], terms: ["Endocrinología", "Medicina Interna", "metabolismo"] },
  { keys: ["presion", "presión", "hipertension", "hipertensión"], terms: ["Medicina Interna", "Cardiología"] },
  { keys: ["pecho", "dolor de pecho", "palpitaciones"], terms: ["Cardiología", "Medicina Interna"] },
  { keys: ["embarazo", "control prenatal"], terms: ["Ginecología", "Obstetricia"] },
  { keys: ["ansiedad", "depresion", "depresión", "estres", "estrés"], terms: ["Psicología", "Psiquiatría"] },
  { keys: ["acne", "acné", "piel", "manchas"], terms: ["Dermatología"] },
  { keys: ["estomago", "estómago", "gastritis", "reflujo", "abdomen"], terms: ["Gastroenterología", "Medicina Interna"] }
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

export async function GET(request: Request) {
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
    orderBy: [{ fullName: "asc" }, { createdAt: "asc" }]
  });

  const sortedDoctors = doctors.sort((a, b) => {
    const planDifference = medalPriority[b.medal] - medalPriority[a.medal];
    if (planDifference !== 0) return planDifference;
    const availabilityDifference = b.availabilitySlots.length - a.availabilitySlots.length;
    if (availabilityDifference !== 0) return availabilityDifference;
    const nameDifference = a.fullName.localeCompare(b.fullName, "es");
    if (nameDifference !== 0) return nameDifference;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });

  return ok(
    sortedDoctors.map((doctor) => {
      const reviewAverage = doctor.reviews.length
        ? doctor.reviews.reduce((sum, review) => sum + review.rating, 0) / doctor.reviews.length
        : doctor.rating;

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
      planPriorityLabel: doctor.medal === "amatista" ? "Perfil destacado" : doctor.medal === "diamante" ? "Mayor visibilidad por plan" : "Visibilidad normal",
      verificationStatus: doctor.verificationStatus,
      professionalLicense: doctor.professionalLicense,
      university: doctor.university,
      imageUrl: doctor.imageUrl,
      practicePhotoUrl: doctor.practicePhotoUrl,
      professionalLicensePhotoUrl: doctor.professionalLicensePhotoUrl,
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
      availability: doctor.availabilitySlots.map((slot) => ({
        id: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt
      }))
      };
    })
  );
}
