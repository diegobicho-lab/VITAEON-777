import { MedicalMedal, Role, VerificationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { createSessionToken, setSessionCookie } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { emailButton, emailShell, sendTransactionalEmail } from "@/lib/email/mailer";
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
          title: "Descuento de bienvenida en tu primera consulta",
          message:
            "Como nuevo paciente puedes tener un descuento exclusivo en tu primera consulta. El beneficio se aplica automáticamente al reservar si la campaña está activa para el médico seleccionado."
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
          medal: MedicalMedal.oro // plan is assigned by Stripe webhook after payment, not at registration
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

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://vitaeon.mx").replace(/\/$/, "");
  await sendTransactionalEmail({
    to: user.email,
    subject: `Bienvenido a VITAEON, ${user.name.split(" ")[0]}`,
    text:
      user.role === Role.DOCTOR
        ? "Tu cuenta médica fue creada. Completa tu perfil profesional, disponibilidad y verificación desde tu panel para aparecer en el directorio."
        : "Tu cuenta de paciente fue creada. Ya puedes buscar especialistas verificados, reservar citas y pagar en línea.",
    html: emailShell(
      user.role === Role.DOCTOR ? `Bienvenido, ${user.name.split(" ")[0]}` : `Bienvenido a VITAEON, ${user.name.split(" ")[0]}`,
      user.role === Role.DOCTOR
        ? [
            `<p>Tu cuenta médica fue creada correctamente en <strong>VITAEON</strong>.</p>`,
            `<p>Para aparecer en el directorio de pacientes necesitas:</p>`,
            `<ul style="margin:12px 0;padding-left:20px;color:#374151;">`,
            `<li style="margin-bottom:6px;">Completar tu perfil profesional y subir foto</li>`,
            `<li style="margin-bottom:6px;">Registrar tu cédula profesional</li>`,
            `<li style="margin-bottom:6px;">Configurar tu disponibilidad mensual</li>`,
            `<li style="margin-bottom:6px;">Conectar tu cuenta de cobro con Stripe</li>`,
            `<li style="margin-bottom:6px;">Enviar documentos para verificación</li>`,
            `</ul>`,
            emailButton("Ir a mi panel médico", `${appUrl}/dashboard/doctor`)
          ].join("")
        : [
            `<p>Tu cuenta de paciente fue creada correctamente en <strong>VITAEON</strong>.</p>`,
            `<p>Ahora puedes buscar especialistas médicos verificados en León, Guanajuato, reservar citas y pagar en línea de forma segura.</p>`,
            emailButton("Buscar especialistas", appUrl)
          ].join("")
    )
  });

  if (user.role === Role.DOCTOR) {
    const admins = await prisma.user.findMany({ where: { role: Role.ADMIN, isActive: true }, select: { email: true } });
    const adminAppUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://vitaeon.mx").replace(/\/$/, "");
    await Promise.all(
      admins.map((admin) =>
        sendTransactionalEmail({
          to: admin.email,
          subject: `Nuevo médico registrado: ${user.name}`,
          text: `${user.name} (${user.email}) creó una cuenta médica en VITAEON y debe completar verificación.`,
          html: emailShell(
            "Nuevo médico registrado",
            [
              `<p><strong>${user.name}</strong> (<a href="mailto:${user.email}" style="color:#1a80b8;">${user.email}</a>) creó una cuenta médica en VITAEON.</p>`,
              `<p>Cuando el médico envíe sus documentos de verificación recibirás otra notificación para aprobar o rechazar su perfil.</p>`,
              emailButton("Ver panel de administración", `${adminAppUrl}/dashboard/admin`)
            ].join("")
          )
        })
      )
    );
  }

  return ok(currentUser, { status: 201 });
}
