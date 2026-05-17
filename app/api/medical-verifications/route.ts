import { Role, VerificationStatus } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { emailShell, sendTransactionalEmail } from "@/lib/email/mailer";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { normalizePrivateDocumentRefs } from "@/lib/storage/private-documents";
import { doctorVerificationSchema, verificationReviewSchema } from "@/lib/validation/schemas";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para ver verificaciones.", 401);

  if (user.role === "ADMIN") {
    const verifications = await prisma.medicalVerification.findMany({
      include: { doctor: { include: { user: true, specialty: true, hospital: true } } },
      orderBy: { createdAt: "desc" }
    });
    return ok(verifications);
  }

  if (user.role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
    if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);
    const verification = await prisma.medicalVerification.findUnique({ where: { doctorId: doctor.id } });
    return ok(verification);
  }

  return fail("FORBIDDEN", "No tienes permiso para ver verificaciones médicas.", 403);
}

export async function POST(request: Request) {
  const limit = await rateLimitByIp("medical-verifications:submit", { limit: 12, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas solicitudes de verificación. Intenta de nuevo más tarde.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo médicos pueden enviar verificación.", 403);

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);

  const body = await request.json().catch(() => null);
  const parsed = doctorVerificationSchema.safeParse({ ...body, doctorId: doctor.id });
  if (!parsed.success) return fail("VALIDATION_ERROR", "Datos de verificación inválidos.", 422, parsed.error.flatten());

  let documentRefs: string[];
  try {
    documentRefs = normalizePrivateDocumentRefs(parsed.data.documents);
  } catch (error) {
    const code = error instanceof Error ? error.message : "INVALID_DOCUMENT_REFERENCE";
    return fail(code, "Los documentos médicos deben guardarse como referencias privadas, no como URLs públicas.", 422);
  }

  const verification = await prisma.medicalVerification.upsert({
    where: { doctorId: doctor.id },
    create: {
      doctorId: doctor.id,
      professionalLicense: parsed.data.professionalLicense,
      specialtyBoard: parsed.data.specialtyBoard,
      documentUrls: documentRefs,
      status: VerificationStatus.IN_REVIEW
    },
    update: {
      professionalLicense: parsed.data.professionalLicense,
      specialtyBoard: parsed.data.specialtyBoard,
      documentUrls: documentRefs,
      status: VerificationStatus.IN_REVIEW,
      reviewedAt: null,
      reviewedByUserId: null,
      rejectionReason: null
    }
  });

  await auditLog({
    actorUserId: user.id,
    action: "SUBMIT_MEDICAL_VERIFICATION",
    entityType: "MedicalVerification",
    entityId: verification.id
  });

  const admins = await prisma.user.findMany({ where: { role: Role.ADMIN, isActive: true }, select: { email: true } });
  await Promise.all(
    admins.map((admin) =>
      sendTransactionalEmail({
        to: admin.email,
        subject: "Verificación médica pendiente en VITAEON",
        text: `${doctor.fullName} envió documentación de verificación médica.`,
        html: emailShell("Verificación pendiente", `<p><strong>${doctor.fullName}</strong> envió documentación para revisión médica.</p>`)
      })
    )
  );

  return ok(verification, { status: 201 });
}

export async function PATCH(request: Request) {
  const limit = await rateLimitByIp("medical-verifications:review", { limit: 60, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas revisiones en poco tiempo.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return fail("FORBIDDEN", "Solo administración puede revisar médicos.", 403);

  const body = await request.json().catch(() => null);
  const parsed = verificationReviewSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Revisión inválida.", 422, parsed.error.flatten());

  const verification = await prisma.medicalVerification.update({
    where: { id: parsed.data.verificationId },
    data: {
      status: parsed.data.status as VerificationStatus,
      rejectionReason: parsed.data.status === VerificationStatus.REJECTED ? parsed.data.notes : null,
      reviewedByUserId: user.id,
      reviewedAt: new Date()
    }
  });

  await prisma.doctor.update({
    where: { id: verification.doctorId },
    data: {
      verificationStatus: parsed.data.status as VerificationStatus,
      isVerified: parsed.data.status === VerificationStatus.VERIFIED,
      verifiedAt: parsed.data.status === VerificationStatus.VERIFIED ? new Date() : null,
      professionalLicense:
        parsed.data.status === VerificationStatus.VERIFIED ? verification.professionalLicense : undefined
    }
  });

  if (verification.doctorId) {
    const reviewedDoctor = await prisma.doctor.findUnique({ where: { id: verification.doctorId } });
    if (reviewedDoctor?.userId) {
      await prisma.notification.create({
        data: {
          userId: reviewedDoctor.userId,
          type: parsed.data.status === VerificationStatus.VERIFIED ? "verification_approved" : "verification_reviewed",
          title: parsed.data.status === VerificationStatus.VERIFIED ? "Médico verificado" : "Verificación revisada",
          message:
            parsed.data.status === VerificationStatus.VERIFIED
              ? "Tu perfil fue aprobado y ahora puede mostrarse con insignia de Médico verificado."
              : parsed.data.notes ?? "Tu verificación fue revisada por administración."
        }
      });

      const reviewedDoctorUser = await prisma.user.findUnique({ where: { id: reviewedDoctor.userId }, select: { email: true } });
      if (reviewedDoctorUser) {
        await sendTransactionalEmail({
          to: reviewedDoctorUser.email,
          subject: parsed.data.status === VerificationStatus.VERIFIED ? "Tu verificación médica fue aprobada" : "Tu verificación médica fue revisada",
          text:
            parsed.data.status === VerificationStatus.VERIFIED
              ? "Tu perfil fue aprobado y ahora puede mostrarse con insignia de Médico verificado."
              : parsed.data.notes ?? "Tu verificación fue revisada por administración.",
          html: emailShell(
            parsed.data.status === VerificationStatus.VERIFIED ? "Médico verificado" : "Verificación revisada",
            parsed.data.status === VerificationStatus.VERIFIED
              ? "<p>Tu perfil fue aprobado y ahora puede mostrarse con insignia de <strong>Médico verificado</strong>.</p>"
              : `<p>${parsed.data.notes ?? "Tu verificación fue revisada por administración."}</p>`
          )
        });
      }
    }
  }

  await auditLog({
    actorUserId: user.id,
    action: "REVIEW_MEDICAL_VERIFICATION",
    entityType: "MedicalVerification",
    entityId: verification.id,
    metadata: { status: parsed.data.status }
  });

  return ok(verification);
}
