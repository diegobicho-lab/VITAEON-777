import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import {
  AppointmentStatus,
  PaymentProvider,
  PaymentStatus,
  Prisma
} from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getSecretarySession } from "@/lib/auth/secretary";
import { prisma } from "@/lib/db/prisma";
import { emailButton, emailShell, sendTransactionalEmail } from "@/lib/email/mailer";
import { createNotification } from "@/lib/notifications/notifications";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { sealSensitiveText } from "@/lib/security/crypto";

const appointmentSchema = z.discriminatedUnion("patientType", [
  // Paciente que ya tiene cuenta VITAEON
  z.object({
    patientType: z.literal("vitaeon"),
    patientId: z.string().min(1), // Patient.id
    availabilitySlotId: z.string().min(1),
    paymentMethod: z.enum(["CASH", "TRANSFER"]).default("CASH"),
    reason: z.string().max(600).optional()
  }),
  // Paciente presencial sin cuenta VITAEON
  z.object({
    patientType: z.literal("guest"),
    guestName: z.string().min(2).max(120),
    guestPhone: z.string().min(7).max(30).optional(),
    availabilitySlotId: z.string().min(1),
    paymentMethod: z.enum(["CASH", "TRANSFER"]).default("CASH"),
    reason: z.string().max(600).optional()
  })
]);

/* ── GET — listar citas del día del médico (para que la secretaria vea la agenda) ─── */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const session = await getSecretarySession(token);
  if (!session) return fail("UNAUTHORIZED", "Sesión de secretaría no válida.", 401);

  const link = await prisma.doctorSecretaryLink.findUnique({
    where: { token },
    select: { isActive: true, doctorId: true }
  });
  if (!link?.isActive) return fail("LINK_INACTIVE", "El enlace fue desactivado por el médico.", 403);

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const appointments = await prisma.appointment.findMany({
    where: {
      doctorId: session.doctorId,
      availabilitySlot: { startsAt: { gte: todayStart, lte: todayEnd } },
      status: {
        notIn: ["CANCELLED", "AUTO_CANCELLED", "REFUNDED"]
      }
    },
    orderBy: { availabilitySlot: { startsAt: "asc" } },
    select: {
      id: true,
      status: true,
      secretaryCreated: true,
      guestPatientName: true,
      guestPatientPhone: true,
      availabilitySlot: { select: { startsAt: true, endsAt: true } },
      patient: {
        select: {
          user: { select: { name: true, email: true } }
        }
      },
      payments: { select: { provider: true, status: true } }
    }
  });

  return ok(appointments);
}

/* ── POST — crear cita desde el panel de secretaría ─── */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const limit = await rateLimitByIp("secretaria:appointments:create", { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas solicitudes. Intenta en un momento.", 429);

  const session = await getSecretarySession(token);
  if (!session) return fail("UNAUTHORIZED", "Sesión de secretaría no válida. Ingresa el PIN.", 401);

  const link = await prisma.doctorSecretaryLink.findUnique({
    where: { token },
    select: { isActive: true, doctorId: true }
  });
  if (!link?.isActive) return fail("LINK_INACTIVE", "El enlace fue desactivado por el médico.", 403);

  const body = await request.json().catch(() => null);
  const parsed = appointmentSchema.safeParse(body);
  if (!parsed.success) {
    return fail("VALIDATION_ERROR", "Datos de cita inválidos.", 422, parsed.error.flatten());
  }

  const doctorId = session.doctorId;

  try {
    const appointment = await prisma.$transaction(async (tx) => {
      // Verificar slot disponible
      const slot = await tx.availabilitySlot.findFirst({
        where: {
          id: parsed.data.availabilitySlotId,
          doctorId,
          isActive: true,
          appointment: null,
          startsAt: { gte: new Date() }
        },
        include: {
          doctor: {
            select: {
              consultationPriceCents: true,
              fullName: true,
              userId: true,
              specialty: { select: { name: true } }
            }
          }
        }
      });
      if (!slot) throw new Error("SLOT_UNAVAILABLE");

      let patientId: string;
      let patientName: string;
      let patientEmail: string | null = null;
      let guestPatientName: string | null = null;
      let guestPatientPhone: string | null = null;

      if (parsed.data.patientType === "vitaeon") {
        // Paciente VITAEON registrado
        const patient = await tx.patient.findUnique({
          where: { id: parsed.data.patientId },
          select: { id: true, user: { select: { name: true, email: true } } }
        });
        if (!patient) throw new Error("PATIENT_NOT_FOUND");
        patientId = patient.id;
        patientName = patient.user.name;
        patientEmail = patient.user.email;
      } else {
        // Paciente presencial — crear registro fantasma (sin contraseña real, sin email real)
        const ghostEmail = `vitaeon-guest-${randomBytes(8).toString("hex")}@vitaeon.internal`;
        const ghostPasswordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 10);

        const ghostUser = await tx.user.create({
          data: {
            email: ghostEmail,
            name: parsed.data.guestName,
            passwordHash: ghostPasswordHash,
            role: "PATIENT",
            isActive: false // cuenta inactiva — nunca puede iniciar sesión
          }
        });
        const ghostPatient = await tx.patient.create({
          data: {
            userId: ghostUser.id,
            phone: parsed.data.guestPhone ?? null,
            welcomeDiscountAvailable: false
          }
        });

        patientId = ghostPatient.id;
        patientName = parsed.data.guestName;
        guestPatientName = parsed.data.guestName;
        guestPatientPhone = parsed.data.guestPhone ?? null;
      }

      const provider =
        parsed.data.paymentMethod === "TRANSFER" ? PaymentProvider.TRANSFER : PaymentProvider.CASH;

      const created = await tx.appointment.create({
        data: {
          patientId,
          doctorId,
          availabilitySlotId: slot.id,
          status: AppointmentStatus.ACCEPTED,
          reason: parsed.data.reason ? sealSensitiveText(parsed.data.reason) : null,
          originalAmountCents: slot.doctor.consultationPriceCents,
          discountCents: 0,
          secretaryCreated: true,
          guestPatientName,
          guestPatientPhone,
          payments: {
            create: {
              provider,
              amountCents: slot.doctor.consultationPriceCents,
              status: PaymentStatus.PENDING
            }
          }
        },
        include: {
          availabilitySlot: true,
          doctor: {
            select: {
              fullName: true,
              userId: true,
              specialty: { select: { name: true } }
            }
          }
        }
      });

      return { created, patientName, patientEmail, slotDoctorFullName: slot.doctor.fullName };
    });

    const startsAt = new Intl.DateTimeFormat("es-MX", {
      dateStyle: "full",
      timeStyle: "short",
      timeZone: "America/Mexico_City"
    }).format(new Date(appointment.created.availabilitySlot.startsAt));

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "https://vitaeon.mx").replace(/\/$/, "");

    // Notificación al médico
    if (appointment.created.doctor.userId) {
      await createNotification({
        userId: appointment.created.doctor.userId,
        type: "new_appointment_secretary",
        title: "Cita registrada por secretaría",
        message: `La secretaría agendó una cita con ${appointment.patientName} para el ${startsAt}.`
      });
    }

    // Email al paciente VITAEON (no a los guests que no tienen email real)
    if (appointment.patientEmail && !appointment.patientEmail.endsWith("@vitaeon.internal")) {
      void sendTransactionalEmail({
        to: appointment.patientEmail,
        subject: `Tu cita con ${appointment.slotDoctorFullName} fue agendada`,
        text: `La recepción agendó tu cita con ${appointment.slotDoctorFullName} para el ${startsAt}. El pago se realiza en consultorio.`,
        html: emailShell(
          `Cita con ${appointment.slotDoctorFullName}`,
          `<p>Hola <strong>${appointment.patientName}</strong>,</p>
          <p>La recepción agendó tu cita en <strong>VITAEON</strong>.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;width:100%;">
            <tr><td style="padding:8px 0;border-bottom:1px solid #e5edf2;font-size:13px;color:#7f9aaa;width:130px;">Médico</td><td style="padding:8px 0;border-bottom:1px solid #e5edf2;font-size:14px;font-weight:600;color:#071726;">${appointment.slotDoctorFullName}</td></tr>
            <tr><td style="padding:8px 0;border-bottom:1px solid #e5edf2;font-size:13px;color:#7f9aaa;">Especialidad</td><td style="padding:8px 0;border-bottom:1px solid #e5edf2;font-size:14px;color:#374151;">${appointment.created.doctor.specialty.name}</td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#7f9aaa;">Fecha y hora</td><td style="padding:8px 0;font-size:14px;font-weight:600;color:#071726;">${startsAt}</td></tr>
          </table>
          <p style="margin-top:16px;font-size:14px;color:#374151;">El pago se realiza directamente en el consultorio.</p>
          ${emailButton("Ver mis citas", `${appUrl}/dashboard/patient`)}`
        )
      }).catch((err) => console.error("[secretaria] email fallido:", err));
    }

    await auditLog({
      action: "SECRETARY_CREATE_APPOINTMENT",
      entityType: "Appointment",
      entityId: appointment.created.id,
      metadata: {
        doctorId,
        patientType: parsed.data.patientType,
        slotId: appointment.created.availabilitySlotId
      }
    });

    return ok({ appointmentId: appointment.created.id, patientName: appointment.patientName }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "SLOT_UNAVAILABLE") {
      return fail("SLOT_UNAVAILABLE", "El horario ya no está disponible. Selecciona otro.", 409);
    }
    if (error instanceof Error && error.message === "PATIENT_NOT_FOUND") {
      return fail("PATIENT_NOT_FOUND", "Paciente no encontrado en VITAEON.", 404);
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return fail("SLOT_ALREADY_BOOKED", "Ese horario acaba de ser reservado. Selecciona otro.", 409);
    }
    console.error("[secretaria/appointments POST]", error);
    return fail("APPOINTMENT_CREATE_FAILED", "No fue posible crear la cita.", 500);
  }
}
