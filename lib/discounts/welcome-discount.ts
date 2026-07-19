import type { Prisma } from "@prisma/client";

/** Percentage applied to the first appointment for eligible patients. */
export const WELCOME_DISCOUNT_RATE = 0.35;

/**
 * Returns true when a doctor is configured to offer the welcome discount.
 *
 * The gate is the `affiliateDiscountEnabled` flag on the Doctor record —
 * an admin sets it per-doctor from the backoffice.  There is no hardcoded
 * name check; any doctor with the flag enabled participates in the campaign.
 */
export function isWelcomeDiscountDoctor(doctor: { affiliateDiscountEnabled: boolean }) {
  return Boolean(doctor.affiliateDiscountEnabled);
}

export async function getWelcomeDiscountQuote(
  tx: Prisma.TransactionClient,
  input: { patientId: string; doctorId: string; amountCents: number }
) {
  const [patient, doctor, priorAppointments] = await Promise.all([
    tx.patient.findUnique({
      where: { id: input.patientId },
      select: { welcomeDiscountAvailable: true, welcomeDiscountUsedAt: true }
    }),
    tx.doctor.findUnique({
      where: { id: input.doctorId },
      select: { fullName: true, affiliateDiscountEnabled: true }
    }),
    tx.appointment.count({ where: { patientId: input.patientId } })
  ]);

  const eligible =
    Boolean(patient?.welcomeDiscountAvailable) &&
    !patient?.welcomeDiscountUsedAt &&
    priorAppointments === 0 &&
    Boolean(doctor && isWelcomeDiscountDoctor(doctor));

  const discountCents = eligible ? Math.round(input.amountCents * WELCOME_DISCOUNT_RATE) : 0;

  return {
    eligible,
    discountCents,
    finalAmountCents: Math.max(input.amountCents - discountCents, 0),
    label: eligible
      ? `Beneficio exclusivo: ${Math.round(WELCOME_DISCOUNT_RATE * 100)}% de descuento en tu primera consulta con ${doctor?.fullName ?? "este médico"}`
      : null
  };
}
