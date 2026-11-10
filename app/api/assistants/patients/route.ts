import { fail, ok } from "@/lib/api-response";
import { resolveAssistantLink } from "@/lib/auth/assistant";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

/* ── GET — buscar paciente por email o nombre ─── */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ASSISTANT") {
    return fail("FORBIDDEN", "Solo asistentes pueden buscar pacientes.", 403);
  }

  const link = await resolveAssistantLink(user.id);
  if (!link) return fail("NOT_LINKED", "Asistente no vinculado a ningún médico.", 404);

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < 3) {
    return fail("QUERY_TOO_SHORT", "Ingresa al menos 3 caracteres para buscar.", 422);
  }

  /**
   * Buscar por email exacto primero (más común en recepción), luego por nombre
   * parcial, SIEMPRE acotado a los pacientes del médico vinculado.
   *
   * El vínculo se resolvía arriba y solo se usaba como portero: cualquier
   * asistente autenticado podía buscar pacientes de cualquier otro consultorio
   * de la plataforma y recibir nombre, correo, teléfono y fecha de nacimiento.
   * El filtro por `doctorId` es lo que convierte ese portero en un límite real.
   */
  const users = await prisma.user.findMany({
    where: {
      role: "PATIENT",
      patient: {
        appointments: { some: { doctorId: link.doctorId } }
      },
      OR: [
        { email: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } }
      ]
    },
    select: {
      id: true,
      name: true,
      email: true,
      patient: { select: { id: true, phone: true, dateOfBirth: true } }
    },
    take: 8,
    orderBy: { name: "asc" }
  });

  return ok(
    users.map((u) => ({
      userId: u.id,
      patientId: u.patient?.id ?? null,
      name: u.name,
      email: u.email,
      phone: u.patient?.phone ?? null,
      dateOfBirth: u.patient?.dateOfBirth ?? null
    }))
  );
}
