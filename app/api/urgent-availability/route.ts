import { ok, fail } from "@/lib/api-response";
import { prisma } from "@/lib/db/prisma";
import { publicDoctorWhere } from "@/lib/doctors/public-doctor-filter";
import { urgentAvailabilitySchema } from "@/lib/validation/schemas";

const medalPriority = { amatista: 3, diamante: 2, oro: 1 };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = urgentAvailabilitySchema.safeParse(Object.fromEntries(searchParams.entries()));
  if (!parsed.success) return fail("VALIDATION_ERROR", "Selecciona una especialidad para buscar urgencias.", 422, parsed.error.flatten());

  const doctors = await prisma.doctor.findMany({
    where: {
      ...publicDoctorWhere,
      specialtyId: parsed.data.specialtyId,
      availabilitySlots: {
        some: { isActive: true, startsAt: { gte: new Date() }, appointment: null }
      }
    },
    include: {
      specialty: true,
      hospital: true,
      availabilitySlots: {
        where: { isActive: true, startsAt: { gte: new Date() }, appointment: null },
        orderBy: { startsAt: "asc" },
        take: 6
      }
    }
  });

  const sorted = doctors.sort((a, b) => {
    const aFirst = a.availabilitySlots[0]?.startsAt.getTime() ?? Number.MAX_SAFE_INTEGER;
    const bFirst = b.availabilitySlots[0]?.startsAt.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (aFirst !== bFirst) return aFirst - bFirst;
    return medalPriority[b.medal] - medalPriority[a.medal];
  });

  return ok(
    sorted.map((doctor) => ({
      id: doctor.id,
      name: doctor.fullName,
      specialty: doctor.specialty.name,
      specialtyId: doctor.specialtyId,
      hospital: doctor.hospital.name,
      hospitalId: doctor.hospitalId,
      city: doctor.hospital.city,
      priceCents: doctor.consultationPriceCents,
      slug: doctor.slug,
      subSpecialty: doctor.subSpecialty,
      bio: doctor.bio,
      yearsExperience: doctor.yearsExperience,
      consultationDurationMinutes: doctor.consultationDurationMinutes,
      rating: doctor.rating,
      medal: doctor.medal,
      verificationStatus: doctor.verificationStatus,
      professionalLicense: doctor.professionalLicense,
      imageUrl: doctor.imageUrl,
      practicePhotoUrl: doctor.practicePhotoUrl,
      verifiedAt: doctor.verifiedAt,
      achievements: doctor.achievements,
      certifications: doctor.certifications,
      availability: doctor.availabilitySlots.map((slot) => ({
        id: slot.id,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt
      }))
    }))
  );
}
