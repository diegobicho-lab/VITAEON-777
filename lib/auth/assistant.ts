import "server-only";
import { prisma } from "@/lib/db/prisma";
import type { CurrentUser } from "@/types/domain";

/**
 * Devuelve el Doctor asociado al usuario, ya sea porque el usuario ES médico
 * (Doctor.userId = user.id) o porque es su ASISTENTE (DoctorAssistant.userId = user.id).
 * Devuelve null si el usuario no tiene médico vinculado.
 */
export async function resolveDoctor(user: CurrentUser) {
  if (user.role === "DOCTOR") {
    return prisma.doctor.findUnique({ where: { userId: user.id } });
  }
  if (user.role === "ASSISTANT") {
    const link = await prisma.doctorAssistant.findUnique({
      where: { userId: user.id },
      include: { doctor: true }
    });
    return link?.doctor ?? null;
  }
  return null;
}

/**
 * Devuelve el vínculo DoctorAssistant completo (con doctor incluido) para el userId dado.
 * Útil para validar que el asistente existe y obtener el doctorId en una sola query.
 */
export async function resolveAssistantLink(userId: string) {
  return prisma.doctorAssistant.findUnique({
    where: { userId },
    include: {
      doctor: {
        include: { specialty: true, hospital: true }
      }
    }
  });
}
