import { MedicalMedal } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import {
  clinicDateOnly,
  combineClinicDateAndTime,
  addMinutes,
  previewBlockDate
} from "@/lib/availability/availability";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import {
  blockedDateCreateSchema,
  blockedDateDeleteSchema,
  blockedDatePreviewQuerySchema
} from "@/lib/validation/schemas";

/** Resuelve el médico del usuario actual (médico titular o asistente vinculado). */
async function resolveDoctor(userId: string, role: string, allowAssistant: boolean) {
  if (role === "DOCTOR") return prisma.doctor.findUnique({ where: { userId } });
  if (allowAssistant && role === "ASSISTANT") {
    const link = await prisma.doctorAssistant.findUnique({ where: { userId }, include: { doctor: true } });
    return link?.doctor ?? null;
  }
  return null;
}

/** GET → lista de días bloqueados, o vista previa del impacto con ?date=YYYY-MM-DD */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para ver tu agenda.", 401);

  const doctor = await resolveDoctor(user.id, user.role, true);
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);
  if (doctor.medal === MedicalMedal.obsidiana) {
    return fail("OBSIDIAN_PROFILE_ONLY", "Obsidiana usa un panel comercial independiente.", 403);
  }

  const dateParam = new URL(request.url).searchParams.get("date");
  if (dateParam) {
    const parsed = blockedDatePreviewQuerySchema.safeParse({ date: dateParam });
    if (!parsed.success) return fail("VALIDATION_ERROR", "Fecha inválida.", 422, parsed.error.flatten());
    const preview = await previewBlockDate(prisma, doctor.id, parsed.data.date);
    return ok(preview);
  }

  const blockedDates = await prisma.doctorBlockedDate.findMany({
    where: { doctorId: doctor.id },
    orderBy: { date: "asc" },
    select: { id: true, date: true, reason: true }
  });

  return ok(blockedDates.map((entry) => ({ ...entry, date: entry.date.toISOString().slice(0, 10) })));
}

/**
 * POST → marca un día como no disponible.
 *
 * Desactiva los slots libres de esa fecha (no los borra, para poder revertir) y
 * NUNCA toca las citas ya reservadas: si existen, se informa al médico y se le
 * pide gestionarlas antes. Cancelar citas en silencio dejaría al paciente sin
 * aviso y con un cobro sin resolver.
 */
export async function POST(request: Request) {
  const limit = await rateLimitByIp("availability:block-date", { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados cambios de calendario. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para modificar tu agenda.", 401);
  if (user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo el médico titular puede bloquear días.", 403);

  const doctor = await resolveDoctor(user.id, user.role, false);
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);
  if (doctor.medal === MedicalMedal.obsidiana) {
    return fail("OBSIDIAN_PROFILE_ONLY", "Obsidiana usa un panel comercial independiente.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = blockedDateCreateSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Fecha inválida.", 422, parsed.error.flatten());

  const preview = await previewBlockDate(prisma, doctor.id, parsed.data.date);
  if (preview.activeAppointments.length > 0) {
    return fail(
      "DATE_HAS_APPOINTMENTS",
      "Esta fecha tiene citas programadas. Cancélalas o reagéndalas antes de bloquear el día.",
      409,
      { activeAppointments: preview.activeAppointments }
    );
  }

  const dayStart = combineClinicDateAndTime(parsed.data.date, "00:00");
  const dayEnd = addMinutes(dayStart, 24 * 60);

  const result = await prisma.$transaction(async (tx) => {
    const blocked = await tx.doctorBlockedDate.upsert({
      where: { doctorId_date: { doctorId: doctor.id, date: clinicDateOnly(parsed.data.date) } },
      create: { doctorId: doctor.id, date: clinicDateOnly(parsed.data.date), reason: parsed.data.reason },
      update: { reason: parsed.data.reason }
    });

    // Solo se desactivan slots sin cita: los reservados quedan intactos.
    const deactivated = await tx.availabilitySlot.updateMany({
      where: { doctorId: doctor.id, startsAt: { gte: dayStart, lt: dayEnd }, appointment: { is: null } },
      data: { isActive: false }
    });

    return { blocked, deactivated: deactivated.count };
  });

  await auditLog({
    actorUserId: user.id,
    action: "BLOCK_AVAILABILITY_DATE",
    entityType: "DoctorBlockedDate",
    entityId: result.blocked.id,
    metadata: { date: result.blocked.date.toISOString().slice(0, 10), deactivatedSlots: result.deactivated }
  });

  return ok({
    date: result.blocked.date.toISOString().slice(0, 10),
    reason: result.blocked.reason,
    deactivatedSlots: result.deactivated
  });
}

/** DELETE → vuelve a habilitar el día y reactiva los slots libres desactivados. */
export async function DELETE(request: Request) {
  const limit = await rateLimitByIp("availability:unblock-date", { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados cambios de calendario. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para modificar tu agenda.", 401);
  if (user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo el médico titular puede habilitar días.", 403);

  const doctor = await resolveDoctor(user.id, user.role, false);
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);

  const body = await request.json().catch(() => null);
  const parsed = blockedDateDeleteSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Fecha inválida.", 422, parsed.error.flatten());

  const dateOnly = clinicDateOnly(parsed.data.date);
  const existing = await prisma.doctorBlockedDate.findUnique({
    where: { doctorId_date: { doctorId: doctor.id, date: dateOnly } }
  });
  if (!existing) return fail("BLOCKED_DATE_NOT_FOUND", "Ese día no está bloqueado.", 404);

  const dayStart = combineClinicDateAndTime(parsed.data.date, "00:00");
  const dayEnd = addMinutes(dayStart, 24 * 60);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    await tx.doctorBlockedDate.delete({ where: { id: existing.id } });

    // Solo se reactivan horarios futuros: reactivar pasados no aporta nada.
    const reactivated = await tx.availabilitySlot.updateMany({
      where: {
        doctorId: doctor.id,
        startsAt: { gte: dayStart > now ? dayStart : now, lt: dayEnd },
        appointment: { is: null },
        isActive: false
      },
      data: { isActive: true }
    });

    return { reactivated: reactivated.count };
  });

  await auditLog({
    actorUserId: user.id,
    action: "UNBLOCK_AVAILABILITY_DATE",
    entityType: "DoctorBlockedDate",
    entityId: existing.id,
    metadata: { date: dateOnly.toISOString().slice(0, 10), reactivatedSlots: result.reactivated }
  });

  return ok({ date: dateOnly.toISOString().slice(0, 10), reactivatedSlots: result.reactivated });
}
