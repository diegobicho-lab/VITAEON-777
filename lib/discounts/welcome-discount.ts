import type { Prisma } from "@prisma/client";

export const WELCOME_DISCOUNT_RATE = 0.35;
export const WELCOME_DISCOUNT_DOCTOR_NAME = "Dra. Susana Pérez Guadarrama";

export function isWelcomeDiscountDoctor(doctor: { fullName: string; specialty?: { name: string } | null }) {
  return (
    doctor.fullName.trim().toLowerCase() === WELCOME_DISCOUNT_DOCTOR_NAME.toLowerCase() &&
    doctor.specialty?.name === "Medicina Interna"
  );
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
      select: { fullName: true, affiliateDiscountEnabled: true, specialty: { select: { name: true } } }
    }),
    tx.appointment.count({ where: { patientId: input.patientId } })
  ]);

  const eligible =
    Boolean(patient?.welcomeDiscountAvailable) &&
    !patient?.welcomeDiscountUsedAt &&
    priorAppointments === 0 &&
    Boolean(doctor?.affiliateDiscountEnabled && isWelcomeDiscountDoctor(doctor));

  const discountCents = eligible ? Math.round(input.amountCents * WELCOME_DISCOUNT_RATE) : 0;

  return {
    eligible,
    discountCents,
    finalAmountCents: Math.max(input.amountCents - discountCents, 0),
    label: eligible ? "Beneficio exclusivo: 35% de descuento en tu primera consulta con la Dra. Susana Pérez Guadarrama" : null
  };
}
