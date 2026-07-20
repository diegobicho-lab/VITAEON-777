import { MedicalMedal } from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { availabilityRepeatRevertSchema, availabilitySlotSchema, availabilitySlotUpdateSchema } from "@/lib/validation/schemas";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para ver la agenda.", 401);

  let doctor = null;

  if (user.role === "DOCTOR") {
    doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
  } else if (user.role === "ASSISTANT") {
    // Asistente: cargar el médico vinculado
    const link = await prisma.doctorAssistant.findUnique({
      where: { userId: user.id },
      include: { doctor: true }
    });
    doctor = link?.doctor ?? null;
  } else {
    return fail("FORBIDDEN", "Solo médicos o asistentes pueden ver la agenda.", 403);
  }

  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);
  if (doctor.medal === MedicalMedal.obsidiana) return fail("OBSIDIAN_PROFILE_ONLY", "Obsidiana usa un panel comercial independiente.", 403);

  const slots = await prisma.availabilitySlot.findMany({
    where: { doctorId: doctor.id },
    include: { appointment: true },
    orderBy: { startsAt: "asc" }
  });

  return ok(slots);
}

export async function POST(request: Request) {
  const limit = await rateLimitByIp("availability:create", { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas publicaciones de disponibilidad. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo médicos pueden crear disponibilidad.", 403);

  const body = await request.json().catch(() => null);
  const parsed = availabilitySlotSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Disponibilidad inválida.", 422, parsed.error.flatten());

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);
  if (doctor.medal === MedicalMedal.obsidiana) return fail("OBSIDIAN_PROFILE_ONLY", "Obsidiana usa un panel comercial independiente.", 403);

  if (parsed.data.startsAt < new Date()) {
    return fail("PAST_SLOT", "No puedes publicar disponibilidad en una fecha pasada.", 422);
  }

  try {
    const slot = await prisma.availabilitySlot.create({
      data: {
        doctorId: doctor.id,
        startsAt: parsed.data.startsAt,
        endsAt: parsed.data.endsAt,
        isActive: true
      }
    });

    await auditLog({
      actorUserId: user.id,
      action: "CREATE_AVAILABILITY_SLOT",
      entityType: "AvailabilitySlot",
      entityId: slot.id,
      metadata: { startsAt: slot.startsAt.toISOString(), endsAt: slot.endsAt.toISOString() }
    });

    return ok(slot, { status: 201 });
  } catch {
    return fail("AVAILABILITY_CONFLICT", "Ya existe disponibilidad para ese horario.", 409);
  }
}

export async function PATCH(request: Request) {
  const limit = await rateLimitByIp("availability:update", { limit: 40, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas actualizaciones de disponibilidad. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo médicos pueden actualizar disponibilidad.", 403);

  const body = await request.json().catch(() => null);
  const parsed = availabilitySlotUpdateSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Actualización de disponibilidad inválida.", 422, parsed.error.flatten());

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);
  if (doctor.medal === MedicalMedal.obsidiana) return fail("OBSIDIAN_PROFILE_ONLY", "Obsidiana usa un panel comercial independiente.", 403);

  const existing = await prisma.availabilitySlot.findFirst({
    where: { id: parsed.data.slotId, doctorId: doctor.id },
    include: { appointment: true }
  });

  if (!existing) return fail("SLOT_NOT_FOUND", "No encontramos ese horario.", 404);
  if (existing.appointment && !parsed.data.isActive) {
    return fail("SLOT_HAS_APPOINTMENT", "No puedes ocultar un horario que ya tiene cita asignada.", 409);
  }

  const slot = await prisma.availabilitySlot.update({
    where: { id: existing.id },
    data: { isActive: parsed.data.isActive }
  });

  await auditLog({
    actorUserId: user.id,
    action: "UPDATE_AVAILABILITY_SLOT",
    entityType: "AvailabilitySlot",
    entityId: slot.id,
    metadata: { isActive: slot.isActive }
  });

  return ok(slot);
}

export async function DELETE(request: Request) {
  const limit = await rateLimitByIp("availability:delete", { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas actualizaciones de disponibilidad. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo médicos pueden eliminar disponibilidad.", 403);

  const body = await request.json().catch(() => null);
  const repeatRevert = availabilityRepeatRevertSchema.safeParse(body);

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);
  if (doctor.medal === MedicalMedal.obsidiana) return fail("OBSIDIAN_PROFILE_ONLY", "Obsidiana usa un panel comercial independiente.", 403);

  if (repeatRevert.success) {
    const result = await prisma.availabilitySlot.deleteMany({
      where: {
        doctorId: doctor.id,
        repeatBatchId: repeatRevert.data.repeatBatchId,
        generatedByMonthlyRepeat: true,
        appointment: null
      }
    });

    await auditLog({
      actorUserId: user.id,
      action: "REVERT_MONTHLY_REPEAT_AVAILABILITY",
      entityType: "AvailabilitySlot",
      metadata: { repeatBatchId: repeatRevert.data.repeatBatchId, deleted: result.count }
    });

    return ok({ deleted: result.count });
  }

  const parsed = availabilitySlotUpdateSchema.pick({ slotId: true }).safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Selecciona un horario válido.", 422, parsed.error.flatten());

  const existing = await prisma.availabilitySlot.findFirst({
    where: { id: parsed.data.slotId, doctorId: doctor.id },
    include: { appointment: true }
  });

  if (!existing) return fail("SLOT_NOT_FOUND", "No encontramos ese horario.", 404);
  if (existing.appointment) {
    return fail("SLOT_HAS_APPOINTMENT", "No puedes eliminar un horario que ya tiene cita asignada.", 409);
  }

  await prisma.availabilitySlot.delete({ where: { id: existing.id } });

  await auditLog({
    actorUserId: user.id,
    action: "DELETE_AVAILABILITY_SLOT",
    entityType: "AvailabilitySlot",
    entityId: existing.id,
    metadata: { startsAt: existing.startsAt.toISOString() }
  });

  return ok({ deleted: true });
}
