import { fail, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { z } from "zod";

const addSchema = z.object({
  hospitalId: z.string().min(1),
  notes: z.string().max(180).optional()
});

/* ── GET — lista de consultorios adicionales del médico ────── */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR")
    return fail("FORBIDDEN", "Solo médicos pueden ver sus consultorios.", 403);

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true }
  });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "Perfil médico no encontrado.", 409);

  try {
    const locations = await prisma.doctorLocation.findMany({
      where: { doctorId: doctor.id },
      include: { hospital: { select: { id: true, name: true, city: true } } },
      orderBy: { createdAt: "asc" }
    });
    return ok(locations);
  } catch {
    /* La tabla puede no existir aún si la migración está pendiente */
    return ok([]);
  }
}

/* ── POST — agregar consultorio adicional ─────────────────── */
export async function POST(request: Request) {
  const limit = await rateLimitByIp("doctor-locations:add", { limit: 20, windowMs: 60_000 });
  if (!limit.allowed)
    return fail("RATE_LIMITED", "Demasiadas solicitudes. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR")
    return fail("FORBIDDEN", "Solo médicos pueden gestionar consultorios.", 403);

  const body = await request.json().catch(() => null);
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Datos inválidos.", 422);

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true, hospitalId: true }
  });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "Perfil médico no encontrado.", 409);

  /* No puede duplicar el hospital principal */
  if (doctor.hospitalId === parsed.data.hospitalId)
    return fail("DUPLICATE_LOCATION", "Ese hospital ya es tu consultorio principal.", 409);

  const hospital = await prisma.hospital.findUnique({ where: { id: parsed.data.hospitalId } });
  if (!hospital) return fail("HOSPITAL_NOT_FOUND", "Hospital no encontrado.", 404);

  /* Límite de 5 consultorios adicionales */
  const count = await prisma.doctorLocation.count({ where: { doctorId: doctor.id } });
  if (count >= 5)
    return fail("LIMIT_REACHED", "Puedes tener hasta 5 consultorios adicionales.", 409);

  const location = await prisma.doctorLocation.create({
    data: {
      doctorId: doctor.id,
      hospitalId: parsed.data.hospitalId,
      notes: parsed.data.notes || null
    },
    include: { hospital: { select: { id: true, name: true, city: true } } }
  });

  return ok(location);
}

/* ── DELETE — eliminar consultorio adicional ──────────────── */
export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR")
    return fail("FORBIDDEN", "Solo médicos pueden gestionar consultorios.", 403);

  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get("id");
  if (!locationId) return fail("VALIDATION_ERROR", "ID de consultorio requerido.", 422);

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true }
  });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "Perfil médico no encontrado.", 409);

  const location = await prisma.doctorLocation.findFirst({
    where: { id: locationId, doctorId: doctor.id }
  });
  if (!location) return fail("NOT_FOUND", "Consultorio no encontrado.", 404);

  await prisma.doctorLocation.delete({ where: { id: locationId } });

  return ok({ deleted: true });
}
