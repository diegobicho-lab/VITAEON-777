import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { prescriptionTemplateSchema } from "@/lib/validation/schemas";

async function getAmatistaDoctor() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return { error: fail("FORBIDDEN", "Solo médicos pueden usar recetario.", 403) };

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id }, include: { specialty: true, hospital: true } });
  if (!doctor) return { error: fail("DOCTOR_PROFILE_REQUIRED", "Completa tu perfil médico antes de usar recetario.", 409) };
  // Obsidiana usa un panel comercial independiente; todos los demás planes tienen acceso.
  if (doctor.medal === "obsidiana") {
    return { error: fail("OBSIDIAN_PROFILE_ONLY", "Obsidiana usa un panel comercial independiente.", 403) };
  }

  return { user, doctor };
}

export async function GET() {
  const session = await getAmatistaDoctor();
  if (session.error) return session.error;

  const template = await prisma.prescriptionTemplate.findUnique({ where: { doctorId: session.doctor.id } });
  return ok({
    template,
    defaults: {
      doctorName: session.doctor.fullName,
      specialty: session.doctor.specialty.name,
      professionalLicense: session.doctor.professionalLicense ?? "",
      phone: session.doctor.professionalPhone ?? "",
      officeAddress: session.doctor.officeAddress ?? session.doctor.hospital.name
    }
  });
}

export async function POST(request: Request) {
  const limit = await rateLimitByIp("prescription-template:upsert", { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas actualizaciones. Intenta de nuevo en un momento.", 429);

  const session = await getAmatistaDoctor();
  if (session.error) return session.error;

  const body = await request.json().catch(() => null);
  const parsed = prescriptionTemplateSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Revisa los datos del recetario.", 422, parsed.error.flatten());

  const template = await prisma.prescriptionTemplate.upsert({
    where: { doctorId: session.doctor.id },
    update: parsed.data,
    create: { doctorId: session.doctor.id, ...parsed.data }
  });

  await auditLog({
    actorUserId: session.user.id,
    action: "PRESCRIPTION_TEMPLATE_UPSERT",
    entityType: "PrescriptionTemplate",
    entityId: template.id
  });

  return ok(template, { status: 201 });
}
