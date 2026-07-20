import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

/* ── DELETE — revocar acceso al asistente ─── */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ assistantId: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return fail("FORBIDDEN", "Solo médicos pueden revocar asistentes.", 403);
  }

  const { assistantId } = await params;

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true }
  });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "Perfil médico no encontrado.", 409);

  // Verificar que el vínculo pertenece a este médico
  const link = await prisma.doctorAssistant.findFirst({
    where: { id: assistantId, doctorId: doctor.id },
    include: { user: { select: { id: true, email: true, name: true } } }
  });

  if (!link) return fail("NOT_FOUND", "Asistente no encontrado.", 404);

  // Eliminar el usuario asistente y el vínculo (cascade)
  await prisma.user.delete({ where: { id: link.userId } });

  await auditLog({
    actorUserId: user.id,
    action: "REVOKE_DOCTOR_ASSISTANT",
    entityType: "DoctorAssistant",
    entityId: assistantId,
    metadata: {
      assistantEmail: link.user.email,
      assistantName: link.user.name,
      doctorId: doctor.id
    }
  });

  return ok({ revoked: true });
}
