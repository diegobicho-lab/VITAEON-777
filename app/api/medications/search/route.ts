import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { medicationSearchSchema } from "@/lib/validation/schemas";
import { searchMedication } from "@/services/medications/medication-search";

export async function POST(request: Request) {
  const limit = await rateLimitByIp("medications:search", { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas búsquedas de medicamentos. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo médicos pueden usar esta herramienta.", 403);

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "El usuario no tiene perfil médico.", 409);
  const hasAccess =
    (doctor.medal === "amatista" || doctor.medal === "diamante") &&
    doctor.subscriptionStatus === "ACTIVE";
  if (!hasAccess) {
    return fail(
      "PLAN_UPGRADE_REQUIRED",
      "La referencia farmacológica IA está disponible en los planes Diamante y Amatista activos.",
      402
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = medicationSearchSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Búsqueda inválida.", 422, parsed.error.flatten());

  const result = await searchMedication(parsed.data.query);
  await prisma.medicationSearchLog.create({
    data: {
      doctorId: doctor.id,
      query: parsed.data.query,
      source: result.status
    }
  });
  await auditLog({
    actorUserId: user.id,
    action: "SEARCH_MEDICATION_REFERENCE",
    entityType: "MedicationSearchLog",
    metadata: { query: parsed.data.query, source: result.status }
  });

  return ok(result);
}
