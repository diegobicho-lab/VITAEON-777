import { fail, ok } from "@/lib/api-response";
import { getSecretarySession } from "@/lib/auth/secretary";
import { prisma } from "@/lib/db/prisma";

/* ── GET — obtener horarios disponibles del médico ─── */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const session = await getSecretarySession(token);
  if (!session) return fail("UNAUTHORIZED", "Sesión de secretaría no válida. Ingresa el PIN.", 401);

  // Verificar que el link sigue activo
  const link = await prisma.doctorSecretaryLink.findUnique({
    where: { token },
    select: { isActive: true, doctorId: true }
  });
  if (!link?.isActive) return fail("LINK_INACTIVE", "El enlace fue desactivado por el médico.", 403);

  const now = new Date();

  const [doctor, slots] = await Promise.all([
    prisma.doctor.findUnique({
      where: { id: session.doctorId },
      select: {
        fullName: true,
        consultationPriceCents: true,
        consultationDurationMinutes: true,
        specialty: { select: { name: true } },
        hospital: { select: { name: true } }
      }
    }),
    prisma.availabilitySlot.findMany({
      where: {
        doctorId: session.doctorId,
        isActive: true,
        startsAt: { gte: now },
        appointment: null
      },
      orderBy: { startsAt: "asc" },
      take: 60, // máx 60 slots futuros
      select: { id: true, startsAt: true, endsAt: true }
    })
  ]);

  if (!doctor) return fail("DOCTOR_NOT_FOUND", "Médico no encontrado.", 404);

  return ok({ doctor, slots });
}
