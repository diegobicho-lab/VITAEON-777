import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { publicDoctorWhere } from "@/lib/doctors/public-doctor-filter";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { hospitalCreateSchema } from "@/lib/validation/schemas";

export async function GET() {
  try {
    const hospitals = await prisma.hospital.findMany({
      select: {
        id: true,
        name: true,
        city: true,
        address: true,
        doctors: {
          where: publicDoctorWhere,
          select: { id: true }
        }
      },
      orderBy: [{ city: "asc" }, { name: "asc" }]
    });

    return ok(
      hospitals.map((hospital) => ({
        id: hospital.id,
        name: hospital.name,
        city: hospital.city,
        address: hospital.address,
        doctorsCount: hospital.doctors.length
      }))
    );
  } catch (error) {
    console.error("VITAEON_HOSPITALS_QUERY_ERROR", error);
    return fail(
      "HOSPITALS_QUERY_FAILED",
      "No fue posible cargar hospitales. Verifica que la base de datos tenga las migraciones Prisma aplicadas y que el cliente Prisma esté generado.",
      500
    );
  }
}

export async function POST(request: Request) {
  const limit = await rateLimitByIp("catalog:hospitals:create", { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas solicitudes de catálogo. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return fail("FORBIDDEN", "Solo administración puede crear hospitales.", 403);

  const body = await request.json().catch(() => null);
  const parsed = hospitalCreateSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Hospital inválido.", 422, parsed.error.flatten());

  const existing = await prisma.hospital.findFirst({
    where: { name: { equals: parsed.data.name, mode: "insensitive" } }
  });
  if (existing) return fail("HOSPITAL_EXISTS", "El hospital o clínica ya existe en el catálogo.", 409);

  const hospital = await prisma.hospital
    .create({
      data: {
        name: parsed.data.name,
        city: parsed.data.city,
        address: parsed.data.address
      }
    })
    .catch(() => null);

  if (!hospital) return fail("HOSPITAL_EXISTS", "El hospital ya existe o no pudo crearse.", 409);

  await auditLog({
    actorUserId: user.id,
    action: "CREATE_HOSPITAL",
    entityType: "Hospital",
    entityId: hospital.id
  });

  return ok(hospital, { status: 201 });
}
