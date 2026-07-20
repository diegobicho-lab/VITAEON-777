import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { emailButton, emailShell, sendTransactionalEmail } from "@/lib/email/mailer";
import { rateLimitByIp } from "@/lib/security/rate-limit";

const assistantInviteSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().min(2).max(120)
});

/* ── GET — listar asistentes del médico ─── */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return fail("FORBIDDEN", "Solo médicos pueden gestionar sus asistentes.", 403);
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true }
  });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "Perfil médico no encontrado.", 409);

  const assistants = await prisma.doctorAssistant.findMany({
    where: { doctorId: doctor.id },
    include: {
      user: { select: { id: true, name: true, email: true, createdAt: true } }
    },
    orderBy: { createdAt: "desc" }
  });

  return ok(assistants);
}

/* ── POST — invitar asistente (crea cuenta y envía credenciales por email) ─── */
export async function POST(request: Request) {
  const limit = await rateLimitByIp("doctor:assistants:invite", { limit: 5, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiados intentos. Espera un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return fail("FORBIDDEN", "Solo médicos pueden invitar asistentes.", 403);
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true, fullName: true, medal: true }
  });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "Perfil médico no encontrado.", 409);

  // Plan mínimo: Diamante o Amatista
  if (doctor.medal === "oro" || doctor.medal === "obsidiana") {
    return fail(
      "PLAN_REQUIRED",
      "La función de asistente está disponible en los planes Diamante y Amatista.",
      403
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = assistantInviteSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Datos de invitación inválidos.", 422, parsed.error.flatten());
  }

  // Verificar que el email no exista ya en el sistema
  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: { id: true }
  });
  if (existing) {
    return fail(
      "EMAIL_ALREADY_EXISTS",
      "Este correo ya tiene una cuenta en VITAEON. Usa otro correo para el asistente.",
      409
    );
  }

  // Verificar que el doctor no tenga ya un asistente activo
  const existingAssistant = await prisma.doctorAssistant.findFirst({
    where: { doctorId: doctor.id }
  });
  if (existingAssistant) {
    return fail(
      "ASSISTANT_ALREADY_EXISTS",
      "Ya tienes un asistente activo. Revoca el acceso actual antes de invitar a otro.",
      409
    );
  }

  // Generar contraseña temporal segura — 16 bytes = 128 bits de entropía.
  const tempPassword = `Vit-${randomBytes(16).toString("hex")}`;
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://vitaeon.mx").replace(/\/$/, "");

  const result = await prisma.$transaction(async (tx) => {
    const newUser = await tx.user.create({
      data: {
        email: parsed.data.email.toLowerCase(),
        name: parsed.data.name,
        passwordHash,
        role: "ASSISTANT"
      }
    });

    const link = await tx.doctorAssistant.create({
      data: { userId: newUser.id, doctorId: doctor.id }
    });

    return { newUser, link };
  });

  // Enviar credenciales por email
  await sendTransactionalEmail({
    to: parsed.data.email,
    subject: `${doctor.fullName} te invitó como asistente en VITAEON`,
    html: emailShell(
      "Acceso como asistente médico",
      `<p>Hola <strong>${parsed.data.name}</strong>,</p>
      <p><strong>${doctor.fullName}</strong> te ha dado acceso como asistente en VITAEON para gestionar su agenda de citas.</p>
      <table style="border-radius:8px;background:#f8fafc;padding:16px 20px;margin:16px 0;width:100%;">
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Correo</td><td style="padding:6px 0 6px 16px;font-weight:600;">${parsed.data.email}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:13px;">Contraseña temporal</td><td style="padding:6px 0 6px 16px;font-weight:600;letter-spacing:0.05em;">${tempPassword}</td></tr>
      </table>
      ${emailButton("Iniciar sesión en VITAEON", `${appUrl}/`)}
      <p style="margin-top:20px;font-size:13px;color:#94a3b8;">Para tu seguridad, cambia tu contraseña desde la opción de recuperación después de iniciar sesión.</p>`
    ),
    text: `Hola ${parsed.data.name}, ${doctor.fullName} te invitó como asistente en VITAEON.\nCorreo: ${parsed.data.email}\nContraseña temporal: ${tempPassword}\nAccede en: ${appUrl}`
  });

  await auditLog({
    actorUserId: user.id,
    action: "INVITE_DOCTOR_ASSISTANT",
    entityType: "DoctorAssistant",
    entityId: result.link.id,
    metadata: {
      assistantEmail: parsed.data.email,
      assistantName: parsed.data.name,
      doctorId: doctor.id
    }
  });

  return ok({ assistantId: result.link.id, email: parsed.data.email }, { status: 201 });
}
