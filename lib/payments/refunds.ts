import "server-only";
import { PaymentProvider, PaymentStatus, type Prisma } from "@prisma/client";
import { getStripe } from "@/lib/payments/stripe";

type RefundablePayment = {
  id: string;
  provider: PaymentProvider;
  status: PaymentStatus;
  providerPaymentIntentId: string | null;
  amountCents: number;
  refundId: string | null;
};

export type RefundOutcome =
  | { kind: "NOT_APPLICABLE"; reason: "no_online_payment" }
  | { kind: "ALREADY_REFUNDED"; refundId: string }
  | { kind: "REFUNDED"; refundId: string; amountCents: number }
  | { kind: "PENDING"; refundId: string }
  | { kind: "FAILED"; message: string };

/** Pago en línea efectivamente cobrado y por tanto reembolsable. */
export function findRefundablePayment(payments: RefundablePayment[]) {
  return payments.find(
    (payment) => payment.provider === PaymentProvider.STRIPE && payment.status === PaymentStatus.PAID
  );
}

/**
 * Procesa la devolución de una cita de forma idempotente.
 *
 * Reglas:
 * - Si ya existe `refundId`, no se vuelve a cobrar a Stripe: se informa y punto.
 *   Sin esta guarda, dos clics o un webhook repetido generaban doble devolución.
 * - Nunca se marca REFUNDED si Stripe no confirmó. Un refund puede quedar en
 *   `pending`; en ese caso el pago queda con `transferStatus = "refund_pending"`
 *   y el importe NO se da por devuelto.
 * - El error de Stripe se propaga como resultado tipado, no como excepción con
 *   detalle técnico: quien llama decide el mensaje que ve el usuario.
 *
 * `stripeRefunds` se inyecta solo en pruebas; en producción usa el cliente real.
 */
export async function refundAppointmentPayment(
  tx: Prisma.TransactionClient,
  input: {
    payment: RefundablePayment | undefined;
    appointmentId: string;
    doctorId: string;
    reason: string;
  }
): Promise<RefundOutcome> {
  const { payment, appointmentId, doctorId } = input;

  if (!payment) return { kind: "NOT_APPLICABLE", reason: "no_online_payment" };

  // Idempotencia: ya devuelto previamente.
  if (payment.refundId) return { kind: "ALREADY_REFUNDED", refundId: payment.refundId };

  if (!payment.providerPaymentIntentId) {
    return { kind: "FAILED", message: "MISSING_PAYMENT_INTENT" };
  }

  let refund;
  try {
    refund = await getStripe().refunds.create(
      {
        payment_intent: payment.providerPaymentIntentId,
        amount: payment.amountCents,
        // Las citas se cobran con destination charges: el dinero se transfiere
        // automáticamente a la cuenta conectada del médico.
        //
        // Sin `reverse_transfer`, Stripe devuelve al paciente desde el saldo de
        // la PLATAFORMA y el médico conserva su transferencia íntegra: VITAEON
        // pagaría de su bolsillo cada devolución de una consulta que nunca
        // cobró. Con la reversión, el importe se recupera de la cuenta del
        // médico, que es quien recibió el dinero de la consulta.
        reverse_transfer: true,
        // Si en el futuro se activa STRIPE_PLATFORM_FEE_PERCENTAGE, la comisión
        // también se devuelve: no se cobra comisión por una consulta anulada.
        refund_application_fee: true,
        metadata: {
          kind: "appointment_refund",
          appointmentId,
          paymentId: payment.id,
          doctorId
        }
      },
      // Clave de idempotencia de Stripe: un reintento por timeout de red no
      // genera una segunda devolución del mismo pago.
      { idempotencyKey: `refund_appointment_${appointmentId}_${payment.id}` }
    );
  } catch (error) {
    console.error("[refundAppointmentPayment] Stripe refund failed", {
      appointmentId,
      paymentId: payment.id,
      error
    });
    return { kind: "FAILED", message: "STRIPE_REFUND_FAILED" };
  }

  // Stripe puede responder succeeded | pending | failed | canceled.
  if (refund.status === "failed" || refund.status === "canceled") {
    await tx.payment.update({
      where: { id: payment.id },
      data: { refundId: refund.id, transferStatus: `refund_${refund.status}` }
    });
    return { kind: "FAILED", message: "STRIPE_REFUND_REJECTED" };
  }

  if (refund.status === "pending") {
    await tx.payment.update({
      where: { id: payment.id },
      data: { refundId: refund.id, transferStatus: "refund_pending" }
    });
    return { kind: "PENDING", refundId: refund.id };
  }

  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.REFUNDED,
      refundId: refund.id,
      refundedAt: new Date(),
      refundedAmountCents: refund.amount,
      transferStatus: "refunded"
    }
  });

  return { kind: "REFUNDED", refundId: refund.id, amountCents: refund.amount };
}

/** Mensaje para el usuario según el resultado. Nunca expone detalle técnico. */
export function refundOutcomeMessage(outcome: RefundOutcome): string {
  switch (outcome.kind) {
    case "REFUNDED":
      return "La devolución fue procesada correctamente.";
    case "ALREADY_REFUNDED":
      return "Esta cita ya tenía una devolución registrada.";
    case "PENDING":
      return "La devolución está en proceso. Puede tardar unos días en reflejarse.";
    case "NOT_APPLICABLE":
      return "La cita no tenía pago en línea, así que no hay importe que devolver.";
    case "FAILED":
      return "No fue posible procesar la devolución. El equipo administrativo revisará el caso.";
  }
}
