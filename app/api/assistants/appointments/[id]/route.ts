import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { resolveAssistantLink } from "@/lib/auth/assistant";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

const patchSchema = z.object({
  assistantNotes: z.string().max(2000).optional().default("")
});

/**
 * PATCH /api/assistants/appointments/:id
 *
 * Allows an ASSISTANT to save internal notes on an appointment.
 * Notes are only visible to the doctor's team — never shown to the patient.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ASSISTANT") {
    return fail("FORBIDDEN", "Solo asistentes pueden editar notas internas.", 403);
  }

  const link = await resolveAssistantLink(user.id);
  if (!link) return fail("NOT_LINKED", "Asistente no vinculado a ningún médico.", 404);

  const { id: appointmentId } = await params;

  // Verify the appointment belongs to the linked doctor
  const appointment = await prisma.appointment.findFirst({
    where: { id: appointmentId, doctorId: link.doctorId }
  });
  if (!appointment) return fail("NOT_FOUND", "Cita no encontrada.", 404);

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Nota inválida.", 422, parsed.error.flatten());

  const updated = await prisma.appointment.update({
    where: { id: appointmentId },
    data: { assistantNotes: parsed.data.assistantNotes || null },
    select: { id: true, assistantNotes: true }
  });

  return ok(updated);
}
