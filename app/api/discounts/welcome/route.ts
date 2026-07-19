import { ok, fail } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getWelcomeDiscountQuote, WELCOME_DISCOUNT_RATE } from "@/lib/discounts/welcome-discount";

export async function GET(request: Request) {
  const user = await getCurrentUser();

  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId");
  if (!doctorId) return fail("VALIDATION_ERROR", "Selecciona un médico para calcular el descuento.", 422);

  // Load the doctor to be able to show real name in messages.
  const doctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    select: {
      id: true,
      fullName: true,
      consultationPriceCents: true,
      affiliateDiscountEnabled: true
    }
  });
  if (!doctor) return fail("NOT_FOUND", "Médico no encontrado.", 404);

  if (!user || user.role !== "PATIENT") {
    return ok({
      eligible: false,
      message: doctor.affiliateDiscountEnabled
        ? `Crea una cuenta de paciente en VITAEON para activar el ${Math.round(WELCOME_DISCOUNT_RATE * 100)}% de descuento en tu primera consulta con ${doctor.fullName}.`
        : "Crea una cuenta de paciente en VITAEON para ver si hay beneficios disponibles."
    });
  }

  const patient = await prisma.patient.findUnique({ where: { userId: user.id } });
  if (!patient) return fail("NOT_FOUND", "No se encontró el perfil de paciente.", 404);

  const quote = await prisma.$transaction((tx) =>
    getWelcomeDiscountQuote(tx, {
      patientId: patient.id,
      doctorId: doctor.id,
      amountCents: doctor.consultationPriceCents
    })
  );

  return ok({
    ...quote,
    doctorName: doctor.fullName,
    headline: quote.eligible
      ? `Beneficio exclusivo: ${Math.round(WELCOME_DISCOUNT_RATE * 100)}% de descuento en tu primera consulta con ${doctor.fullName}.`
      : null,
    explanation: quote.eligible
      ? "Este beneficio es parte de una campaña de afiliación autorizada por el médico para pacientes nuevos en VITAEON."
      : null
  });
}
