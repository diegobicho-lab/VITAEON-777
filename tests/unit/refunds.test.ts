import { describe, expect, it, vi, beforeEach } from "vitest";
import { PaymentProvider, PaymentStatus } from "@prisma/client";

const refundsCreate = vi.fn();
vi.mock("@/lib/payments/stripe", () => ({
  getStripe: () => ({ refunds: { create: refundsCreate } })
}));

const { findRefundablePayment, refundAppointmentPayment, refundOutcomeMessage } = await import(
  "@/lib/payments/refunds"
);

type Tx = { payment: { update: ReturnType<typeof vi.fn> } };

function makeTx(): Tx {
  return { payment: { update: vi.fn().mockResolvedValue({}) } };
}

const paidPayment = {
  id: "pay_1",
  provider: PaymentProvider.STRIPE,
  status: PaymentStatus.PAID,
  providerPaymentIntentId: "pi_123",
  amountCents: 150000,
  refundId: null as string | null
};

beforeEach(() => {
  refundsCreate.mockReset();
});

describe("devolución de citas", () => {
  it("identifica el pago en línea reembolsable", () => {
    expect(findRefundablePayment([paidPayment])?.id).toBe("pay_1");
    expect(findRefundablePayment([{ ...paidPayment, status: PaymentStatus.PENDING }])).toBeUndefined();
    expect(findRefundablePayment([{ ...paidPayment, provider: PaymentProvider.CASH }])).toBeUndefined();
  });

  it("no hace nada cuando no hubo pago en línea", async () => {
    const tx = makeTx();
    const outcome = await refundAppointmentPayment(tx as never, {
      payment: undefined,
      appointmentId: "apt_1",
      doctorId: "doc_1",
      reason: "test"
    });
    expect(outcome.kind).toBe("NOT_APPLICABLE");
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  it("es idempotente: no vuelve a devolver un pago ya reembolsado", async () => {
    const tx = makeTx();
    const outcome = await refundAppointmentPayment(tx as never, {
      payment: { ...paidPayment, refundId: "re_existente" },
      appointmentId: "apt_1",
      doctorId: "doc_1",
      reason: "test"
    });
    expect(outcome).toEqual({ kind: "ALREADY_REFUNDED", refundId: "re_existente" });
    // Lo importante: nunca se llama a Stripe una segunda vez.
    expect(refundsCreate).not.toHaveBeenCalled();
  });

  it("envía una clave de idempotencia a Stripe", async () => {
    refundsCreate.mockResolvedValue({ id: "re_1", status: "succeeded", amount: 150000 });
    const tx = makeTx();
    await refundAppointmentPayment(tx as never, {
      payment: paidPayment,
      appointmentId: "apt_1",
      doctorId: "doc_1",
      reason: "test"
    });
    expect(refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_123", amount: 150000 }),
      expect.objectContaining({ idempotencyKey: "refund_appointment_apt_1_pay_1" })
    );
  });

  // El dinero de la consulta llegó a la cuenta conectada del médico
  // (destination charge). Sin revertir la transferencia, la devolución saldría
  // del saldo de VITAEON y el médico se quedaría con el importe íntegro.
  it("revierte la transferencia al médico para no cobrar la devolución a la plataforma", async () => {
    refundsCreate.mockResolvedValue({ id: "re_1", status: "succeeded", amount: 150000 });
    const tx = makeTx();
    await refundAppointmentPayment(tx as never, {
      payment: paidPayment,
      appointmentId: "apt_1",
      doctorId: "doc_1",
      reason: "test"
    });
    expect(refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ reverse_transfer: true, refund_application_fee: true }),
      expect.anything()
    );
  });

  it("marca REFUNDED solo cuando Stripe confirma", async () => {
    refundsCreate.mockResolvedValue({ id: "re_ok", status: "succeeded", amount: 150000 });
    const tx = makeTx();
    const outcome = await refundAppointmentPayment(tx as never, {
      payment: paidPayment,
      appointmentId: "apt_1",
      doctorId: "doc_1",
      reason: "test"
    });
    expect(outcome.kind).toBe("REFUNDED");
    expect(tx.payment.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: PaymentStatus.REFUNDED }) })
    );
  });

  it("no da por devuelto el dinero cuando Stripe deja el refund pendiente", async () => {
    refundsCreate.mockResolvedValue({ id: "re_pend", status: "pending", amount: 150000 });
    const tx = makeTx();
    const outcome = await refundAppointmentPayment(tx as never, {
      payment: paidPayment,
      appointmentId: "apt_1",
      doctorId: "doc_1",
      reason: "test"
    });
    expect(outcome.kind).toBe("PENDING");
    const data = tx.payment.update.mock.calls[0][0].data;
    expect(data.status).toBeUndefined(); // sigue PAID hasta que Stripe confirme
    expect(data.transferStatus).toBe("refund_pending");
  });

  it("informa fallo sin lanzar cuando Stripe rechaza", async () => {
    refundsCreate.mockRejectedValue(new Error("card_error"));
    const tx = makeTx();
    const outcome = await refundAppointmentPayment(tx as never, {
      payment: paidPayment,
      appointmentId: "apt_1",
      doctorId: "doc_1",
      reason: "test"
    });
    expect(outcome).toEqual({ kind: "FAILED", message: "STRIPE_REFUND_FAILED" });
  });

  it("falla claramente si falta el PaymentIntent", async () => {
    const tx = makeTx();
    const outcome = await refundAppointmentPayment(tx as never, {
      payment: { ...paidPayment, providerPaymentIntentId: null },
      appointmentId: "apt_1",
      doctorId: "doc_1",
      reason: "test"
    });
    expect(outcome).toEqual({ kind: "FAILED", message: "MISSING_PAYMENT_INTENT" });
  });

  it("nunca expone detalle técnico en el mensaje al usuario", () => {
    const message = refundOutcomeMessage({ kind: "FAILED", message: "STRIPE_REFUND_FAILED" });
    expect(message).not.toContain("STRIPE");
    expect(message).toContain("equipo administrativo");
  });
});
