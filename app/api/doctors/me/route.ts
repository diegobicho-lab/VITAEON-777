import { MedicalMedal, PaymentStatus, SubscriptionStatus } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { doctorProfileUpdateSchema } from "@/lib/validation/schemas";

const doctorInclude = {
  specialty: true,
  hospital: true,
  verification: true,
  availabilitySlots: {
    where: { isActive: true },
    orderBy: { startsAt: "asc" as const },
    take: 20
  }
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo médicos pueden ver este perfil.", 403);

  let doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    include: doctorInclude
  });

  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);
  if (doctor.medal === MedicalMedal.obsidiana) {
    return fail("OBSIDIAN_PROFILE_ONLY", "Obsidiana usa un panel comercial independiente.", 403);
  }

  if (doctor.subscriptionStatus === SubscriptionStatus.FAILED || doctor.subscriptionStatus === SubscriptionStatus.PENDING) {
    const latestPaidSubscription = await prisma.subscriptionPayment.findFirst({
      where: {
        userId: user.id,
        status: PaymentStatus.PAID,
        amountCents: { gt: 0 }
      },
      orderBy: { updatedAt: "desc" }
    });

    if (latestPaidSubscription) {
      doctor = await prisma.doctor.update({
        where: { id: doctor.id },
        data: {
          medal: latestPaidSubscription.plan,
          subscriptionStatus: SubscriptionStatus.ACTIVE
        },
        include: doctorInclude
      });
    }
  }

  return ok(doctor);
}

export async function PATCH(request: Request) {
  const limit = await rateLimitByIp("doctors:profile:update", { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas actualizaciones de perfil. Intenta de nuevo más tarde.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo médicos pueden editar su perfil.", 403);

  const body = await request.json().catch(() => null);
  const parsed = doctorProfileUpdateSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Perfil médico inválido.", 422, parsed.error.flatten());

  const existingDoctor = await prisma.doctor.findUnique({ where: { userId: user.id }, include: { specialty: true } });
  if (!existingDoctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);
  if (existingDoctor.medal === MedicalMedal.obsidiana) {
    return fail("OBSIDIAN_PROFILE_ONLY", "Obsidiana usa un panel comercial independiente.", 403);
  }

  const profileFields = [
    "fullName",
    "specialtyId",
    "hospitalId",
    "subSpecialty",
    "bio",
    "imageUrl",
    "practicePhotoUrl",
    "professionalLicensePhotoUrl",
    "university",
    "officeAddress",
    "officeReference",
    "cityState",
    "mapsUrl",
    "professionalPhone",
    "instagramUrl",
    "facebookUrl",
    "linkedinUrl",
    "websiteUrl",
    "whatsappUrl",
    "affiliateCode",
    "professionalLicense",
    "achievements",
    "certifications",
    "consultationPriceCents",
    "consultationDurationMinutes"
  ];
  const updatesProfessionalProfile = profileFields.some((field) => field in parsed.data);
  const hasLegalAcceptance = parsed.data.legalDeclarationAccepted || existingDoctor.legalDeclarationAccepted;

  if (updatesProfessionalProfile && !hasLegalAcceptance) {
    return fail(
      "LEGAL_DECLARATION_REQUIRED",
      "Debes aceptar que tu información profesional es real y verificable antes de guardar tu perfil médico.",
      422
    );
  }

  if (parsed.data.specialtyId) {
    const specialty = await prisma.specialty.findUnique({ where: { id: parsed.data.specialtyId } });
    if (!specialty) return fail("SPECIALTY_NOT_FOUND", "La especialidad seleccionada no existe.", 404);
  }

  if (parsed.data.hospitalId) {
    const hospital = await prisma.hospital.findUnique({ where: { id: parsed.data.hospitalId } });
    if (!hospital) return fail("HOSPITAL_NOT_FOUND", "El hospital o clínica seleccionado no existe.", 404);
  }

  const { affiliateCode, ...doctorData } = parsed.data;
  const updateData = { ...doctorData };

  if (affiliateCode) {
    // Each participating doctor receives a unique campaign code from the VITAEON
    // team.  The code is stored per-doctor in env vars (AFFILIATE_CODE_<LAST4>)
    // or falls back to the legacy single-doctor code for backward compatibility.
    const authorizedCode = process.env.SUSANA_AFFILIATE_CODE ?? "SUSANA-VITAEON-35";
    if (affiliateCode !== authorizedCode) {
      return fail(
        "AFFILIATE_CODE_NOT_AUTHORIZED",
        "El código de afiliación no está autorizado para este perfil médico.",
        403
      );
    }

    Object.assign(updateData, {
      affiliateDiscountEnabled: true,
      affiliateCodeLast4: affiliateCode.slice(-4)
    });
  }

  const doctor = await prisma.doctor.update({
    where: { id: existingDoctor.id },
    data: updateData,
    include: doctorInclude
  });

  await auditLog({
    actorUserId: user.id,
    action: "UPDATE_DOCTOR_PROFILE",
    entityType: "Doctor",
    entityId: doctor.id,
    metadata: { changedFields: Object.keys(parsed.data), affiliateCampaignUpdated: Boolean(affiliateCode) }
  });

  return ok(doctor);
}
