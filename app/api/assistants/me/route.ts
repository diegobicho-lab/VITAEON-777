import { fail, ok } from "@/lib/api-response";
import { resolveAssistantLink } from "@/lib/auth/assistant";
import { getCurrentUser } from "@/lib/auth/session";

/* ── GET — devuelve el médico vinculado al asistente actual ─── */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ASSISTANT") {
    return fail("FORBIDDEN", "Solo asistentes pueden acceder a este endpoint.", 403);
  }

  const link = await resolveAssistantLink(user.id);
  if (!link) {
    return fail("NOT_LINKED", "Este asistente no está vinculado a ningún médico.", 404);
  }

  return ok({
    assistantId: link.id,
    doctor: {
      id: link.doctor.id,
      fullName: link.doctor.fullName,
      specialty: link.doctor.specialty.name,
      hospital: link.doctor.hospital.name,
      medal: link.doctor.medal,
      consultationPriceCents: link.doctor.consultationPriceCents,
      consultationDurationMinutes: link.doctor.consultationDurationMinutes,
      imageUrl: link.doctor.imageUrl
    }
  });
}
