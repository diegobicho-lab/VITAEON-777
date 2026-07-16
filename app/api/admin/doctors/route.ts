import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { adminDoctorStatusSchema } from "@/lib/validation/schemas";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "STAFF")) {
    return fail("FORBIDDEN", "Solo administración o staff pueden ver médicos.", 403);
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = 100;

  const [doctors, total] = await Promise.all([
    prisma.doctor.findMany({
      include: {
        user: { select: { email: true, name: true, isActive: true } },
        specialty: true,
        hospital: true,
        _count: { select: { appointments: true, availabilitySlots: true } }
      },
      orderBy: [{ verificationStatus: "asc" }, { fullName: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize
    }),
    prisma.doctor.count()
  ]);

  await auditLog({
    actorUserId: user.id,
    action: "VIEW_ADMIN_DOCTORS",
    entityType: "Doctor",
    metadata: { count: doctors.length }
  });

  return ok({
    doctors: doctors.map((doctor) => ({
      id: doctor.id,
      fullName: doctor.fullName,
      email: doctor.user?.email ?? null,
      isActive: doctor.user?.isActive ?? true,
      specialty: doctor.specialty.name,
      hospital: doctor.hospital.name,
      verificationStatus: doctor.verificationStatus,
      professionalLicense: doctor.professionalLicense,
      appointmentsCount: doctor._count.appointments,
      availabilityCount: doctor._count.availabilitySlots
    })),
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      hasNextPage: page * pageSize < total
    }
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return fail("FORBIDDEN", "Solo administración puede activar o desactivar médicos.", 403);
  }

  const body = await request.json().catch(() => null);
  const parsed = adminDoctorStatusSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Datos de médico inválidos.", 422, parsed.error.flatten());

  const doctor = await prisma.doctor.findUnique({
    where: { id: parsed.data.doctorId },
    include: { user: true }
  });
  if (!doctor || !doctor.userId) return fail("DOCTOR_NOT_FOUND", "No encontramos el médico solicitado.", 404);

  const updatedUser = await prisma.user.update({
    where: { id: doctor.userId },
    data: { isActive: parsed.data.isActive },
    select: { id: true, isActive: true }
  });

  await prisma.notification.create({
    data: {
      userId: doctor.userId,
      type: parsed.data.isActive ? "doctor_profile_enabled" : "doctor_profile_disabled",
      title: parsed.data.isActive ? "Perfil médico activado" : "Perfil médico pausado",
      message: parsed.data.isActive
        ? "Tu perfil médico volvió a estar activo dentro de VITAEON."
        : "Tu perfil médico fue pausado por administración. Contacta a soporte para más información."
    }
  });

  await auditLog({
    actorUserId: user.id,
    action: parsed.data.isActive ? "ENABLE_DOCTOR_PROFILE" : "DISABLE_DOCTOR_PROFILE",
    entityType: "Doctor",
    entityId: doctor.id,
    metadata: { userId: updatedUser.id, isActive: updatedUser.isActive }
  });

  return ok({ id: doctor.id, isActive: updatedUser.isActive });
}
