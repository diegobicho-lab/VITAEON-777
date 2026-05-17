import { MedicalMedal, Role, VerificationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { emailShell, sendTransactionalEmail } from "@/lib/email/mailer";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { registerSchema } from "@/lib/validation/schemas";
import type { CurrentUser } from "@/types/domain";

export async function POST(request: Request) {
  const limit = await rateLimitByIp("auth:register", { limit: 4, windowMs: 10 * 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados registros desde esta conexión. Intenta más tarde.", 429);

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Datos de registro inválidos.", 422, parsed.error.flatten());

  const email = parsed.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return fail("EMAIL_ALREADY_REGISTERED", "Este correo ya está registrado.", 409);

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        email,
        name: parsed.data.name,
        passwordHash,
        role: parsed.data.role === "DOCTOR" ? Role.DOCTOR : Role.PATIENT
      }
    });

    if (parsed.data.role === "PATIENT") {
      await tx.patient.create({
        data: {
          userId: created.id,
          phone: parsed.data.phone,
          welcomeDiscountAvailable: true
        }
      });
      await tx.notification.create({
        data: {
          userId: created.id,
          type: "welcome_discount",
          title: "35% de descuento en tu primera valoración",
          message:
            "Beneficio exclusivo: si agendas tu primera consulta con la Dra. Susana Pérez Guadarrama y la campaña está activa, obtienes 35% de descuento."
        }
      });
    }

    if (parsed.data.role === "DOCTOR") {
      const specialty = await tx.specialty.upsert({
        where: { name: "Medicina General" },
        create: {
          name: "Medicina General",
          description: "Perfil inicial para médicos en proceso de configuración."
        },
        update: {}
      });
      const hospital = await tx.hospital.upsert({
        where: { name: "Hospital Ángeles León" },
        create: {
          name: "Hospital Ángeles León",
          city: "León, Guanajuato"
        },
        update: {}
      });

      await tx.doctor.create({
        data: {
          userId: created.id,
          slug: `doctor-${created.id}`,
          specialtyId: specialty.id,
          hospitalId: hospital.id,
          fullName: parsed.data.name,
          subSpecialty: "Perfil médico en configuración",
          bio: "Médico en proceso de completar su perfil profesional y verificación documental.",
          yearsExperience: 0,
          consultationPriceCents: 0,
          consultationDurationMinutes: 45,
          verificationStatus: VerificationStatus.UNVERIFIED,
          medal: parsed.data.medal ? MedicalMedal[parsed.data.medal] : MedicalMedal.oro
        }
      });
    }

    return created;
  });

  const currentUser: CurrentUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as CurrentUser["role"]
  };
  const token = await createSessionToken(currentUser);
  await setSessionCookie(token);

  await auditLog({
    actorUserId: user.id,
    action: "REGISTER_USER",
    entityType: "User",
    entityId: user.id,
    metadata: { role: user.role }
  });

  await sendTransactionalEmail({
    to: user.email,
    subject: "Bienvenido a VITAEON",
    text:
      user.role === Role.DOCTOR
        ? "Tu cuenta médica fue creada. Completa tu perfil profesional, disponibilidad y verificación desde tu panel."
        : "Tu cuenta de paciente fue creada. Ya puedes buscar especialistas, reservar citas y consultar tus tickets.",
    html: emailShell(
      "Bienvenido a VITAEON",
      user.role === Role.DOCTOR
        ? "<p>Tu cuenta médica fue creada correctamente.</p><p>Completa tu perfil profesional, disponibilidad y verificación desde tu panel médico.</p>"
        : "<p>Tu cuenta de paciente fue creada correctamente.</p><p>Ya puedes buscar especialistas, reservar citas y consultar tus tickets desde tu panel.</p>"
    )
  });

  if (user.role === Role.DOCTOR) {
    const admins = await prisma.user.findMany({ where: { role: Role.ADMIN, isActive: true }, select: { email: true } });
    await Promise.all(
      admins.map((admin) =>
        sendTransactionalEmail({
          to: admin.email,
          subject: "Nuevo médico registrado en VITAEON",
          text: `${user.name} creó una cuenta médica y debe completar verificación.`,
          html: emailShell("Nuevo médico registrado", `<p>${user.name} creó una cuenta médica en VITAEON.</p><p>Revisa su perfil y verificación cuando sea enviada.</p>`)
        })
      )
    );
  }

  return ok(currentUser, { status: 201 });
}
