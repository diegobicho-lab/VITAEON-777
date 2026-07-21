import {
  AppointmentStatus,
  MarketplaceListingStatus,
  MarketplaceSubscriptionStatus,
  MedicalMedal,
  PaymentStatus,
  SubscriptionStatus
} from "@prisma/client";
import { headers } from "next/headers";
import type Stripe from "stripe";
import { fail, ok } from "@/lib/api-response";
import { redis } from "@/lib/db/redis";
import { prisma } from "@/lib/db/prisma";
import { getStripe } from "@/lib/payments/stripe";
import { auditLog } from "@/lib/audit/audit";
import { emailShell, sendTransactionalEmail } from "@/lib/email/mailer";

/** TTL in seconds for idempotency keys (7 days — Stripe retries for up to 3 days). */
const STRIPE_EVENT_IDEMPOTENCY_TTL = 604_800;

function stripeObjectId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value && typeof (value as { id?: unknown }).id === "string") {
    return (value as { id: string }).id;
  }
  return null;
}

function stripeSubscriptionPeriodEnd(subscription: Stripe.Subscription) {
  const periodEnd = (subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end;
  return typeof periodEnd === "number" ? new Date(periodEnd * 1000) : undefined;
}

function invoiceSubscriptionId(invoice: Stripe.Invoice) {
  const direct = stripeObjectId((invoice as Stripe.Invoice & { subscription?: unknown }).subscription);
  const parent = (invoice as Stripe.Invoice & { parent?: { subscription_details?: { subscription?: unknown } } }).parent?.subscription_details?.subscription;
  return direct ?? stripeObjectId(parent);
}

function invoicePaymentIntentId(invoice: Stripe.Invoice) {
  return stripeObjectId((invoice as Stripe.Invoice & { payment_intent?: unknown }).payment_intent);
}

function invoiceCustomerId(invoice: Stripe.Invoice) {
  return stripeObjectId((invoice as Stripe.Invoice & { customer?: unknown }).customer);
}

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

  // ── Idempotency guard ─────────────────────────────────────────────────────
  // Stripe retries failed webhooks for up to 72 h with the same event.id.
  // We use Redis as a distributed lock so duplicate deliveries are no-ops.
  const idempotencyKey = `vitaeon:stripe:event:${event.id}`;
  try {
    // SET NX returns "OK" only when the key didn't exist before — meaning this
    // is the first time we see this event.  EX sets the TTL automatically.
    const isNew = await redis.set(idempotencyKey, "1", { nx: true, ex: STRIPE_EVENT_IDEMPOTENCY_TTL });
    if (!isNew) {
      // Already processed — return 200 to stop Stripe from retrying.
      return ok({ received: true, duplicate: true });
    }
  } catch (redisError) {
    // If Redis is unavailable, log and continue processing rather than
    // blocking payments.  A duplicate event is safer than a stuck payment.
    console.error("[Stripe webhook] Redis idempotency check failed — processing anyway:", redisError);
  }

  // ── Event dispatch ───────────────────────────────────────────────────────────
  // Each block is wrapped in try-catch so a single P2025 or DB timeout does not
  // cause a 500 → Stripe retry storm. The idempotency key is already set, so if
  // we return ok() after a caught error we at least stop the 72-h retry cycle
  // and log the failure for investigation.
  try {

  if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.payment_failed") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const paymentId = intent.metadata.paymentId;
    const appointmentId = intent.metadata.appointmentId;
    if (paymentId || appointmentId) {
      const status = event.type === "payment_intent.succeeded" ? PaymentStatus.PAID : PaymentStatus.FAILED;
      const payoutMode = intent.metadata.payoutMode;
      const existingPayment = await prisma.payment.findFirst({
        where: {
          OR: [
            ...(paymentId ? [{ id: paymentId }] : []),
            { providerPaymentIntentId: intent.id },
            ...(appointmentId ? [{ appointmentId }] : [])
          ]
        },
        select: { id: true, status: true, appointmentId: true }
      });
      if (!existingPayment) return ok({ received: true });
      const shouldNotify = existingPayment.status !== status;
      const payment = await prisma.payment.update({
        where: { id: existingPayment.id },
        data: {
          status,
          providerPaymentIntentId: intent.id,
          providerChargeId: typeof intent.latest_charge === "string" ? intent.latest_charge : null,
          transferStatus:
            status === PaymentStatus.PAID
              ? payoutMode === "platform_pending_doctor_connect"
                ? "paid_platform_pending_manual_payout"
                : "paid_destination_charge"
              : "failed"
        }
      });
      if (status === PaymentStatus.PAID) {
        await prisma.appointment.updateMany({
          where: {
            id: payment.appointmentId,
            status: { in: [AppointmentStatus.PENDING, AppointmentStatus.PENDING_DOCTOR_ACCEPTANCE, AppointmentStatus.CONFIRMED] }
          },
          data: {
            status: AppointmentStatus.ACCEPTED,
            acceptedAt: new Date(),
            acceptedByDoctor: true,
            acceptedAutomatically: true,
            acceptedReason: "Pago en línea confirmado"
          }
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

      if (appointment && shouldNotify) {
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
                ? `Tu pago fue confirmado. Tu cita con ${appointment.doctor.fullName} quedó aceptada automáticamente para ${startsAt}.`
                : `No pudimos confirmar el pago de tu cita con ${appointment.doctor.fullName}.`,
            html: emailShell(
              status === PaymentStatus.PAID ? "Pago confirmado" : "Pago no confirmado",
              status === PaymentStatus.PAID
                ? `<p>Tu pago fue confirmado. Tu cita con <strong>${appointment.doctor.fullName}</strong> quedó aceptada automáticamente.</p><p><strong>Fecha:</strong> ${startsAt}</p>`
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

  if (event.type === "charge.refunded") {
    const charge = event.data.object as Stripe.Charge;
    const paymentIntentId = typeof charge.payment_intent === "string" ? charge.payment_intent : null;
    const refund = charge.refunds?.data[0];
    const payment = await prisma.payment.findFirst({
      where: {
        OR: [
          { providerChargeId: charge.id },
          ...(paymentIntentId ? [{ providerPaymentIntentId: paymentIntentId }] : [])
        ]
      }
    });

    if (payment) {
      const fullyRefunded = charge.amount_refunded >= payment.amountCents;
      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: fullyRefunded ? PaymentStatus.REFUNDED : payment.status,
          providerChargeId: charge.id,
          refundId: refund?.id ?? payment.refundId,
          refundedAt: refund ? new Date(refund.created * 1000) : new Date(),
          refundedAmountCents: charge.amount_refunded,
          transferStatus: fullyRefunded ? "refunded" : "partially_refunded"
        }
      });

      if (fullyRefunded) {
        await prisma.appointment.update({
          where: { id: updated.appointmentId },
          data: {
            status: AppointmentStatus.REFUNDED,
            refundRequested: true,
            doctorRefundDecision: "approved"
          }
        });
      }

      await auditLog({
        action: "STRIPE_WEBHOOK_CHARGE_REFUNDED",
        entityType: "Payment",
        entityId: payment.id,
        metadata: { stripeEvent: event.id, chargeId: charge.id, amountRefunded: charge.amount_refunded }
      });
    }
  }

  if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
    const invoice = event.data.object as Stripe.Invoice;
    const subscriptionId = invoiceSubscriptionId(invoice);
    if (subscriptionId) {
      const payment = await prisma.subscriptionPayment.findFirst({
        where: { providerSubscriptionId: subscriptionId },
        orderBy: { createdAt: "desc" }
      });

      if (payment) {
        const paid = event.type === "invoice.paid";
        let currentPeriodEnd = payment.currentPeriodEnd;
        try {
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          currentPeriodEnd = stripeSubscriptionPeriodEnd(subscription) ?? currentPeriodEnd;
        } catch (error) {
          console.error("[Stripe subscription period lookup error]", error);
        }

        await prisma.subscriptionPayment.update({
          where: { id: payment.id },
          data: {
            status: paid ? PaymentStatus.PAID : PaymentStatus.FAILED,
            providerPaymentId: invoicePaymentIntentId(invoice) ?? payment.providerPaymentId,
            providerCustomerId: invoiceCustomerId(invoice) ?? payment.providerCustomerId,
            currentPeriodEnd
          }
        });

        await prisma.doctor.updateMany({
          where: { userId: payment.userId },
          data: { subscriptionStatus: paid ? SubscriptionStatus.ACTIVE : SubscriptionStatus.FAILED }
        });

        await auditLog({
          action: paid ? "STRIPE_WEBHOOK_SUBSCRIPTION_RENEWED" : "STRIPE_WEBHOOK_SUBSCRIPTION_RENEWAL_FAILED",
          entityType: "SubscriptionPayment",
          entityId: payment.id,
          metadata: { stripeEvent: event.id, subscriptionId }
        });
      } else {
        const marketplacePayment = await prisma.marketplaceSubscriptionPayment.findFirst({
          where: { providerSubscriptionId: subscriptionId },
          orderBy: { createdAt: "desc" }
        });

        if (marketplacePayment) {
          const paid = event.type === "invoice.paid";
          let currentPeriodEnd = marketplacePayment.currentPeriodEnd;
          try {
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            currentPeriodEnd = stripeSubscriptionPeriodEnd(subscription) ?? currentPeriodEnd;
          } catch (error) {
            console.error("[Stripe Obsidiana period lookup error]", error);
          }

          const updatedPayment = await prisma.marketplaceSubscriptionPayment.update({
            where: { id: marketplacePayment.id },
            data: {
              status: paid ? PaymentStatus.PAID : PaymentStatus.FAILED,
              providerPaymentId: invoicePaymentIntentId(invoice) ?? marketplacePayment.providerPaymentId,
              providerCustomerId: invoiceCustomerId(invoice) ?? marketplacePayment.providerCustomerId,
              currentPeriodEnd
            }
          });

          await prisma.marketplaceListing.update({
            where: { id: updatedPayment.listingId },
            data: {
              subscriptionStatus: paid ? MarketplaceSubscriptionStatus.ACTIVE : MarketplaceSubscriptionStatus.FAILED,
              activeUntil: currentPeriodEnd
            }
          });

          await auditLog({
            action: paid ? "STRIPE_WEBHOOK_OBSIDIANA_RENEWED" : "STRIPE_WEBHOOK_OBSIDIANA_RENEWAL_FAILED",
            entityType: "MarketplaceSubscriptionPayment",
            entityId: updatedPayment.id,
            metadata: { stripeEvent: event.id, subscriptionId }
          });
        }
      }
    }
  }

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.expired") {
    const session = event.data.object as Stripe.Checkout.Session;
    if (session.metadata?.kind === "marketplace_obsidiana" && session.metadata.paymentId && session.metadata.listingId) {
      const isPaid = event.type === "checkout.session.completed" && session.payment_status === "paid";
      const payment = await prisma.marketplaceSubscriptionPayment.update({
        where: { id: session.metadata.paymentId },
        data: {
          status: isPaid ? PaymentStatus.PAID : PaymentStatus.FAILED,
          providerPaymentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
          providerCustomerId: typeof session.customer === "string" ? session.customer : null,
          providerSubscriptionId: typeof session.subscription === "string" ? session.subscription : null
        }
      });

      await prisma.marketplaceListing.update({
        where: { id: session.metadata.listingId },
        data: {
          status: isPaid ? MarketplaceListingStatus.ACTIVE : MarketplaceListingStatus.PENDING,
          subscriptionStatus: isPaid ? MarketplaceSubscriptionStatus.ACTIVE : MarketplaceSubscriptionStatus.FAILED,
          providerCustomerId: payment.providerCustomerId,
          providerSubscriptionId: payment.providerSubscriptionId,
          providerSessionId: session.id
        }
      });

      await auditLog({
        action: isPaid ? "STRIPE_WEBHOOK_OBSIDIANA_ACTIVE" : "STRIPE_WEBHOOK_OBSIDIANA_FAILED",
        entityType: "MarketplaceListing",
        entityId: session.metadata.listingId,
        metadata: { stripeEvent: event.id, paymentId: payment.id }
      });
    }

    if (session.metadata?.kind === "doctor_subscription" && session.metadata.paymentId) {
      const isPaid = event.type === "checkout.session.completed" && session.payment_status === "paid";
      const plan = session.metadata.plan as keyof typeof MedicalMedal;
      const status = isPaid ? PaymentStatus.PAID : PaymentStatus.FAILED;
      const payment = await prisma.subscriptionPayment.update({
        where: { id: session.metadata.paymentId },
        data: {
          status,
          providerPaymentId: typeof session.payment_intent === "string" ? session.payment_intent : null,
          providerCustomerId: typeof session.customer === "string" ? session.customer : null,
          providerSubscriptionId: typeof session.subscription === "string" ? session.subscription : null
        }
      });

      const doctor = await prisma.doctor.findUnique({ where: { userId: payment.userId } });
      if (doctor) {
        if (isPaid) {
          await prisma.doctor.update({
            where: { id: doctor.id },
            data: {
              medal: MedicalMedal[plan],
              subscriptionStatus: SubscriptionStatus.ACTIVE
            }
          });
        } else {
          const latestPaidSubscription = await prisma.subscriptionPayment.findFirst({
            where: {
              userId: payment.userId,
              status: PaymentStatus.PAID,
              amountCents: { gt: 0 }
            },
            orderBy: { updatedAt: "desc" }
          });

          if (!latestPaidSubscription && doctor.subscriptionStatus === SubscriptionStatus.PENDING) {
            await prisma.doctor.update({
              where: { id: doctor.id },
              data: { subscriptionStatus: SubscriptionStatus.FAILED }
            });
          }
        }
      }

      const shouldNotifySubscriptionFailure =
        !isPaid &&
        !(await prisma.subscriptionPayment.findFirst({
          where: {
            userId: payment.userId,
            status: PaymentStatus.PAID,
            amountCents: { gt: 0 }
          }
        }));

      if (isPaid || shouldNotifySubscriptionFailure) {
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
      } else {
        await auditLog({
          action: "STRIPE_WEBHOOK_IGNORED_STALE_SUBSCRIPTION_FAILURE",
          entityType: "SubscriptionPayment",
          entityId: payment.id,
          metadata: { stripeEvent: event.id, plan }
        });
      }

      const subscriptionUser = await prisma.user.findUnique({ where: { id: payment.userId }, select: { email: true } });
      if (subscriptionUser && (isPaid || shouldNotifySubscriptionFailure)) {
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

  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account;
    const externalAccounts = account.external_accounts as Stripe.ApiList<Stripe.ExternalAccount> | undefined;
    const bank = externalAccounts?.data.find((item): item is Stripe.BankAccount => item.object === "bank_account");
    const doctor = await prisma.doctor.findFirst({ where: { stripeAccountId: account.id } });

    if (doctor) {
      await prisma.doctor.update({
        where: { id: doctor.id },
        data: {
          stripeOnboardingCompleted: Boolean(account.details_submitted && account.charges_enabled && account.payouts_enabled),
          payoutsEnabled: Boolean(account.payouts_enabled),
          chargesEnabled: Boolean(account.charges_enabled),
          bankAccountLast4: bank?.last4 ?? doctor.bankAccountLast4
        }
      });

      await auditLog({
        action: "STRIPE_CONNECT_ACCOUNT_UPDATED",
        entityType: "Doctor",
        entityId: doctor.id,
        metadata: {
          stripeEvent: event.id,
          chargesEnabled: Boolean(account.charges_enabled),
          payoutsEnabled: Boolean(account.payouts_enabled)
        }
      });
    }
  }

  if (
    event.type === "customer.subscription.created" ||
    event.type === "customer.subscription.updated" ||
    event.type === "customer.subscription.deleted"
  ) {
    const subscription = event.data.object as Stripe.Subscription;
    const status =
      event.type === "customer.subscription.deleted"
        ? SubscriptionStatus.CANCELLED
        : subscription.status === "active"
          ? SubscriptionStatus.ACTIVE
          : subscription.status === "past_due" || subscription.status === "unpaid"
            ? SubscriptionStatus.FAILED
            : SubscriptionStatus.PENDING;

    const subscriptionLookup = [
      { providerSubscriptionId: subscription.id },
      ...(typeof subscription.customer === "string" ? [{ providerCustomerId: subscription.customer }] : [])
    ];

    const payment = await prisma.subscriptionPayment.findFirst({
      where: {
        OR: subscriptionLookup
      },
      orderBy: { createdAt: "desc" }
    });

    if (payment) {
      const plan = subscription.metadata?.plan as keyof typeof MedicalMedal | undefined;
      const planMedal = plan && MedicalMedal[plan] ? MedicalMedal[plan] : null;
      await prisma.subscriptionPayment.update({
        where: { id: payment.id },
        data: {
          providerSubscriptionId: subscription.id,
          providerCustomerId: typeof subscription.customer === "string" ? subscription.customer : payment.providerCustomerId,
          status: status === SubscriptionStatus.ACTIVE ? PaymentStatus.PAID : payment.status,
          currentPeriodEnd: stripeSubscriptionPeriodEnd(subscription) ?? payment.currentPeriodEnd
        }
      });
      await prisma.doctor.updateMany({
        where: { userId: payment.userId },
        data: planMedal && status === SubscriptionStatus.ACTIVE ? { subscriptionStatus: status, medal: planMedal } : { subscriptionStatus: status }
      });
    } else {
      const marketplacePayment = await prisma.marketplaceSubscriptionPayment.findFirst({
        where: {
          OR: subscriptionLookup
        },
        orderBy: { createdAt: "desc" }
      });

      if (marketplacePayment) {
        await prisma.marketplaceSubscriptionPayment.update({
          where: { id: marketplacePayment.id },
          data: {
            providerSubscriptionId: subscription.id,
            providerCustomerId: typeof subscription.customer === "string" ? subscription.customer : marketplacePayment.providerCustomerId,
            status: status === SubscriptionStatus.ACTIVE ? PaymentStatus.PAID : marketplacePayment.status,
            currentPeriodEnd: stripeSubscriptionPeriodEnd(subscription) ?? marketplacePayment.currentPeriodEnd
          }
        });

        await prisma.marketplaceListing.update({
          where: { id: marketplacePayment.listingId },
          data: {
            subscriptionStatus:
              status === SubscriptionStatus.ACTIVE
                ? MarketplaceSubscriptionStatus.ACTIVE
                : status === SubscriptionStatus.CANCELLED
                  ? MarketplaceSubscriptionStatus.CANCELLED
                  : status === SubscriptionStatus.FAILED
                    ? MarketplaceSubscriptionStatus.FAILED
                    : MarketplaceSubscriptionStatus.PENDING,
            providerSubscriptionId: subscription.id,
            providerCustomerId: typeof subscription.customer === "string" ? subscription.customer : undefined
          }
        });
      }
    }
  }

  } catch (dispatchError) {
    // Log the error but still return 200 to prevent Stripe from retrying an
    // event that was already marked as processed in the idempotency store.
    console.error(`[Stripe webhook] Unhandled error processing event ${event.id} (${event.type}):`, dispatchError);
  }

  return ok({ received: true });
}
