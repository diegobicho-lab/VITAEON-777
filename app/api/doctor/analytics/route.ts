import { fail, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

/**
 * GET /api/doctor/analytics
 *
 * Returns aggregated stats for the authenticated doctor:
 * - Revenue this month and last month (CASH + TRANSFER + STRIPE paid payments)
 * - Appointment counts by status (last 90 days)
 * - Completion rate (last 90 days)
 * - Appointment distribution by day of week (last 90 days)
 * - Top 5 most frequent patients (last 90 days)
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return fail("FORBIDDEN", "Solo médicos pueden acceder a sus estadísticas.", 403);
  }

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id } });
  if (!doctor) return fail("DOCTOR_NOT_FOUND", "Perfil médico no encontrado.", 404);

  const now = new Date();

  // ── Date windows ────────────────────────────────────────────────────────────
  const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const startOf90Days = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  // ── Revenue this month ───────────────────────────────────────────────────────
  const paymentsThisMonth = await prisma.payment.findMany({
    where: {
      appointment: { doctorId: doctor.id },
      status: "PAID",
      createdAt: { gte: startOfThisMonth }
    },
    select: { amountCents: true }
  });
  const revenueThisMonthCents = paymentsThisMonth.reduce((sum, p) => sum + p.amountCents, 0);

  // ── Revenue last month ───────────────────────────────────────────────────────
  const paymentsLastMonth = await prisma.payment.findMany({
    where: {
      appointment: { doctorId: doctor.id },
      status: "PAID",
      createdAt: { gte: startOfLastMonth, lt: startOfThisMonth }
    },
    select: { amountCents: true }
  });
  const revenueLastMonthCents = paymentsLastMonth.reduce((sum, p) => sum + p.amountCents, 0);

  // ── Appointments last 90 days (with slot time for day-of-week) ───────────────
  const appointments90 = await prisma.appointment.findMany({
    where: {
      doctorId: doctor.id,
      createdAt: { gte: startOf90Days }
    },
    select: {
      id: true,
      status: true,
      patientId: true,
      availabilitySlot: { select: { startsAt: true } }
    }
  });

  // Status breakdown
  const byStatus: Record<string, number> = {};
  for (const a of appointments90) {
    byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
  }

  const total90 = appointments90.length;
  const completed90 = byStatus["COMPLETED"] ?? 0;
  const cancelled90 = (byStatus["CANCELLED"] ?? 0) + (byStatus["AUTO_CANCELLED"] ?? 0);
  const completionRate = total90 > 0 ? Math.round((completed90 / total90) * 100) : 0;

  // Day of week distribution (0=Sun … 6=Sat)
  const dayLabels = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const byDow = [0, 0, 0, 0, 0, 0, 0];
  for (const a of appointments90) {
    if (a.availabilitySlot?.startsAt) {
      const dow = new Date(a.availabilitySlot.startsAt).getDay();
      byDow[dow]++;
    }
  }
  const appointmentsByDay = dayLabels.map((label, i) => ({ label, count: byDow[i] }));

  // ── Top 5 patients (by appointment count, last 90 days) ─────────────────────
  const patientCounts: Record<string, number> = {};
  for (const a of appointments90) {
    patientCounts[a.patientId] = (patientCounts[a.patientId] ?? 0) + 1;
  }
  const topPatientIds = Object.entries(patientCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([id]) => id);

  const topPatients = topPatientIds.length > 0
    ? await prisma.patient.findMany({
        where: { id: { in: topPatientIds } },
        select: {
          id: true,
          user: { select: { name: true } }
        }
      })
    : [];

  const topPatientsWithCount = topPatients
    .map((p) => ({ name: p.user?.name ?? "Paciente", count: patientCounts[p.id] ?? 0 }))
    .sort((a, b) => b.count - a.count);

  return ok({
    revenueThisMonthCents,
    revenueLastMonthCents,
    total90,
    completed90,
    cancelled90,
    completionRate,
    byStatus,
    appointmentsByDay,
    topPatients: topPatientsWithCount
  });
}
