import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { publicDoctorWhere } from "@/lib/doctors/public-doctor-filter";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { specialtyCreateSchema } from "@/lib/validation/schemas";

export async function GET() {
  const specialties = await prisma.specialty.findMany({
    include: {
      doctors: {
        where: publicDoctorWhere,
        select: { id: true }
      }
    },
    orderBy: { name: "asc" }
  });

  return ok(
    specialties.map((specialty) => ({
      id: specialty.id,
      name: specialty.name,
      description: specialty.description,
      doctorsCount: specialty.doctors.length
    }))
  );
}

export async function POST(request: Request) {
  const limit = await rateLimitByIp("catalog:specialties:create", { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas solicitudes de catálogo. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return fail("FORBIDDEN", "Solo administración puede crear especialidades.", 403);

  const body = await request.json().catch(() => null);
  const parsed = specialtyCreateSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Especialidad inválida.", 422, parsed.error.flatten());

  const existing = await prisma.specialty.findFirst({
    where: { name: { equals: parsed.data.name, mode: "insensitive" } }
  });
  if (existing) return fail("SPECIALTY_EXISTS", "La especialidad ya existe en el catálogo.", 409);

  const specialty = await prisma.specialty
    .create({
      data: {
        name: parsed.data.name,
        description: parsed.data.description
      }
    })
    .catch(() => null);

  if (!specialty) return fail("SPECIALTY_EXISTS", "La especialidad ya existe o no pudo crearse.", 409);

  await auditLog({
    actorUserId: user.id,
    action: "CREATE_SPECIALTY",
    entityType: "Specialty",
    entityId: specialty.id
  });

  return ok(specialty, { status: 201 });
}
