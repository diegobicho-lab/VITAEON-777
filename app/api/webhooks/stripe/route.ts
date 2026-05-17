import { AppointmentStatus, MedicalMedal, PaymentStatus, SubscriptionStatus } from "@prisma/client";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { fail, ok } from "@/lib/api-response";
import { prisma } from "@/lib/db/prisma";
import { getStripe } from "@/lib/payments/stripe";
import { auditLog } from "@/lib/audit/audit";
import { emailShell, sendTransactionalEmail } from "@/lib/email/mailer";

export async function POST(request: Request) {
  const stripe = getStripe();
  const headerList = await headers();
  const signature = headerList.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !webhookSecret) return fail("WEBHOOK_NOT_CONFIGURED", "Webhook no configurado.", 500);

  const rawBody = await request.text();
  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch {
    return fail("INVALID_SIGNATURE", "Firma de webhook inválida.", 400);
  }

  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const paymentId = intent.metadata.paymentId;
    if (paymentId) {
      const status = event.type === "payment_intent.succeeded" ? PaymentStatus.PAID : PaymentStatus.FAILED;
      const payment = await prisma.payment.update({
        where: { id: paymentId },
        data: { status }
      });
      if (status === PaymentStatus.PAID) {
        await prisma.appointment.updateMany({
          where: {
            id: payment.appointmentId,
            status: { in: [AppointmentStatus.PENDING, AppointmentStatus.PENDING_DOCTOR_ACCEPTANCE] }
          },
          data: { status: AppointmentStatus.PENDING_DOCTOR_ACCEPTANCE }
        });
      }

      const appointment = await prisma.appointment.findUnique({
        where: { id: payment.appointmentId },
        include: {
          patient: { include: { user: true } },
          doctor: { include: { user: true, specialty: true } },
          availabilitySlot: true
        }
      });

      if (appointment) {
        const startsAt = new Intl.DateTimeFormat("es-MX", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: "America/Mexico_City"
        }).format(appointment.availabilitySlot.startsAt);
        await Promise.all([
          sendTransactionalEmail({
            to: appointment.patient.user.email,
            subject: status === PaymentStatus.PAID ? "Pago confirmado en VITAEON" : "No se pudo confirmar tu pago",
            text:
              status === PaymentStatus.PAID
                ? `Tu pago fue confirmado. Tu cita con ${appointment.doctor.fullName} queda pendiente de aceptación médica para ${startsAt}.`
                : `No pudimos confirmar el pago de tu cita con ${appointment.doctor.fullName}.`,
            html: emailShell(
              status === PaymentStatus.PAID ? "Pago confirmado" : "Pago no confirmado",
              status === PaymentStatus.PAID
                ? `<p>Tu pago fue confirmado. Tu cita con <strong>${appointment.doctor.fullName}</strong> queda pendiente de aceptación médica.</p><p><strong>Fecha:</strong> ${startsAt}</p>`
                : `<p>No pudimos confirmar el pago de tu cita con <strong>${appointment.doctor.fullName}</strong>.</p><p>Consulta tu panel para intentarlo de nuevo.</p>`
            )
          }),
          appointment.doctor.user?.email && status === PaymentStatus.PAID
            ? sendTransactionalEmail({
                to: appointment.doctor.user.email,
                subject: "Pago recibido para una cita VITAEON",
                text: `El pago de ${appointment.patient.user.name} fue confirmado para la cita del ${startsAt}.`,
                html: emailShell("Pago recibido", `<p>El pago de <strong>${appointment.patient.user.name}</strong> fue confirmado.</p><p><strong>Fecha:</strong> ${startsAt}</p>`)
              })
            : Promise.resolve({ sent: false, skipped: true })
        ]);
      }

      await auditLog({
        action: "STRIPE_WEBHOOK_PAYMENT_UPDATE",
        entityType: "Payment",
        entityId: payment.id,
        metadata: { status, stripeEvent: event.id }
      });
    }
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.kind === "doctor_subscription" && session.metadata.paymentId) {
      const isPaid = event.type === "checkout.session.completed" && session.payment_status === "paid";
      const plan = session.metadata.plan as keyof typeof MedicalMedal;
      const status = isPaid ? PaymentStatus.PAID : PaymentStatus.FAILED;
      const payment = await prisma.subscriptionPayment.update({
        where: { id: session.metadata.paymentId },
        data: {
          status,
          providerPaymentId: typeof session.payment_intent === "string" ? session.payment_intent : null
        }
      });

      const doctor = await prisma.doctor.findUnique({ where: { userId: payment.userId } });
      if (doctor) {
        await prisma.doctor.update({
          where: { id: doctor.id },
          data: {
            medal: isPaid ? MedicalMedal[plan] : doctor.medal,
            subscriptionStatus: isPaid ? SubscriptionStatus.ACTIVE : SubscriptionStatus.FAILED
          }
        });
      }

      await prisma.notification.create({
        data: {
          userId: payment.userId,
          type: isPaid ? "subscription_paid" : "subscription_failed",
          title: isPaid ? "Suscripción médica activa" : "Suscripción no completada",
          message: isPaid
            ? `Tu plan ${plan} quedó activo dentro de VITAEON.`
            : "No pudimos confirmar el pago de tu suscripción médica."
        }
      });

      const subscriptionUser = await prisma.user.findUnique({ where: { id: payment.userId }, select: { email: true } });
      if (subscriptionUser) {
        await sendTransactionalEmail({
          to: subscriptionUser.email,
          subject: isPaid ? "Suscripción médica activa en VITAEON" : "Suscripción médica no completada",
          text: isPaid ? `Tu plan ${plan} quedó activo en VITAEON.` : `No pudimos confirmar el pago de tu plan ${plan}.`,
          html: emailShell(
            isPaid ? "Suscripción activa" : "Suscripción no completada",
            isPaid
              ? `<p>Tu plan <strong>${plan}</strong> quedó activo en VITAEON.</p>`
              : `<p>No pudimos confirmar el pago de tu plan <strong>${plan}</strong>. Puedes intentarlo de nuevo desde tu panel médico.</p>`
          )
        });
      }

      await auditLog({
        action: "STRIPE_WEBHOOK_SUBSCRIPTION_UPDATE",
        entityType: "SubscriptionPayment",
        entityId: payment.id,
        metadata: { status, stripeEvent: event.id, plan }
      });
    }
  }

  return ok({ received: true });
}
