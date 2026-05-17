import { ok, fail } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { getWelcomeDiscountQuote, WELCOME_DISCOUNT_DOCTOR_NAME } from "@/lib/discounts/welcome-discount";

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "PATIENT") {
    return ok({
      eligible: false,
      message:
        "Crea una cuenta de paciente en VITAEON para activar el 35% de descuento en tu primera consulta con la Dra. Susana Pérez Guadarrama."
    });
  }

  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId");
  if (!doctorId) return fail("VALIDATION_ERROR", "Selecciona un médico para calcular el descuento.", 422);

  const [patient, doctor] = await Promise.all([
    prisma.patient.findUnique({ where: { userId: user.id } }),
    prisma.doctor.findUnique({ where: { id: doctorId }, include: { specialty: true } })
  ]);
  if (!patient || !doctor) return fail("NOT_FOUND", "No se encontró el paciente o médico.", 404);

  const quote = await prisma.$transaction((tx) =>
    getWelcomeDiscountQuote(tx, {
      patientId: patient.id,
      doctorId: doctor.id,
      amountCents: doctor.consultationPriceCents
    })
  );

  return ok({
    ...quote,
    doctorName: WELCOME_DISCOUNT_DOCTOR_NAME,
    headline:
      "Beneficio exclusivo: 35% de descuento en tu primera consulta con la Dra. Susana Pérez Guadarrama.",
    explanation:
      "Este beneficio forma parte de una campaña de afiliación autorizada por la médico. La medicina interna es ideal para una primera valoración integral: síntomas generales, enfermedades crónicas, estudios de laboratorio, presión arterial, glucosa, problemas digestivos, respiratorios y metabólicos."
  });
}
