import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "STAFF")) {
    return fail("FORBIDDEN", "Solo administración o staff pueden ver pacientes.", 403);
  }

  const patients = await prisma.patient.findMany({
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          isActive: true,
          createdAt: true
        }
      },
      _count: {
        select: {
          appointments: true
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  await auditLog({
    actorUserId: user.id,
    action: "VIEW_PATIENTS",
    entityType: "Patient",
    metadata: { count: patients.length }
  });

  return ok(
    patients.map((patient) => ({
      id: patient.id,
      name: patient.user.name,
      email: patient.user.email,
      phone: patient.phone,
      isActive: patient.user.isActive,
      appointmentsCount: patient._count.appointments,
      createdAt: patient.createdAt
    }))
  );
}
