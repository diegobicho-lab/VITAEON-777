import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { patientProfileUpdateSchema } from "@/lib/validation/schemas";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "PATIENT") return fail("FORBIDDEN", "Solo pacientes pueden ver su perfil.", 403);

  const patient = await prisma.patient.findUnique({
    where: { userId: user.id },
    include: { user: { select: { id: true, name: true, email: true, emailVerifiedAt: true } } }
  });

  if (!patient) return fail("PATIENT_PROFILE_REQUIRED", "El usuario no tiene perfil de paciente.", 409);

  return ok({
    id: patient.id,
    name: patient.user.name,
    email: patient.user.email,
    emailVerifiedAt: patient.user.emailVerifiedAt,
    phone: patient.phone,
    dateOfBirth: patient.dateOfBirth
  });
}

export async function PATCH(request: Request) {
  const limit = await rateLimitByIp("patients:profile:update", { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas actualizaciones de perfil. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "PATIENT") return fail("FORBIDDEN", "Solo pacientes pueden actualizar su perfil.", 403);

  const body = await request.json().catch(() => null);
  const parsed = patientProfileUpdateSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Datos de perfil inválidos.", 422, parsed.error.flatten());

  const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
  if (!patient) return fail("PATIENT_PROFILE_REQUIRED", "El usuario no tiene perfil de paciente.", 409);

  const updated = await prisma.$transaction(async (tx) => {
    if (parsed.data.name !== undefined) {
      await tx.user.update({
        where: { id: user.id },
        data: { name: parsed.data.name }
      });
    }

    return tx.patient.update({
      where: { id: patient.id },
      data: {
        phone: parsed.data.phone === undefined ? undefined : parsed.data.phone || null,
        dateOfBirth: parsed.data.dateOfBirth === undefined ? undefined : parsed.data.dateOfBirth
      },
      include: { user: { select: { id: true, name: true, email: true, emailVerifiedAt: true } } }
    });
  });

  await auditLog({
    actorUserId: user.id,
    action: "UPDATE_PATIENT_PROFILE",
    entityType: "Patient",
    entityId: patient.id
  });

  return ok({
    id: updated.id,
    name: updated.user.name,
    email: updated.user.email,
    emailVerifiedAt: updated.user.emailVerifiedAt,
    phone: updated.phone,
    dateOfBirth: updated.dateOfBirth
  });
}
