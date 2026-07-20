import { fail } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { generateClinicalSummary } from "@/lib/ai/clinical-summary";
import { renderClinicalHistoryPdf } from "@/lib/pdf/render-clinical-pdf";
import { openSensitiveText } from "@/lib/security/crypto";
import { rateLimitByIp } from "@/lib/security/rate-limit";

function formatDate(date: Date | string) {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(new Date(date));
}

/**
 * GET /api/clinical-histories/[id]/export
 *
 * Generates a PDF of the clinical history with an AI-generated clinical
 * impression summary (Claude Haiku). Exclusive to Amatista plan.
 *
 * Returns: application/pdf — attachment download.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const limit = await rateLimitByIp("clinical-histories:export", { limit: 10, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas exportaciones. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") {
    return fail("FORBIDDEN", "Solo médicos pueden exportar historias clínicas.", 403);
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    include: { specialty: true, hospital: true }
  });
  if (!doctor) return fail("DOCTOR_PROFILE_REQUIRED", "Perfil médico no encontrado.", 409);

  // Exportación PDF con IA: exclusiva para Amatista activo.
  if (doctor.medal !== "amatista" || doctor.subscriptionStatus !== "ACTIVE") {
    return fail(
      "AMATISTA_PLAN_REQUIRED",
      "La exportación PDF con IA está disponible exclusivamente para médicos con plan Amatista activo.",
      403
    );
  }

  const { id } = await params;
  const history = await prisma.clinicalHistory.findFirst({
    where: { id, doctorId: doctor.id },
    include: {
      patient: { include: { user: { select: { name: true } } } },
      appointment: { include: { availabilitySlot: true } }
    }
  });
  if (!history) return fail("HISTORY_NOT_FOUND", "Historia clínica no encontrada.", 404);

  // Decrypt all PHI fields.
  const d = (v: string | null | undefined) => openSensitiveText(v ?? null);
  const fields = {
    identificationCard:        d(history.identificationCard),
    ethnicGroup:               d(history.ethnicGroup),
    consultationReason:        d(history.consultationReason),
    hereditaryFamilyHistory:   d(history.hereditaryFamilyHistory),
    nonPathologicalHistory:    d(history.nonPathologicalHistory),
    pathologicalHistory:       d(history.pathologicalHistory),
    surgicalHistory:           d(history.surgicalHistory),
    fractureHistory:           d(history.fractureHistory),
    gynecoObstetricHistory:    d(history.gynecoObstetricHistory),
    currentCondition:          d(history.currentCondition),
    systemsReview:             d(history.systemsReview),
    physicalExam:              d(history.physicalExam),
    labsAndImaging:            d(history.labsAndImaging),
    diagnosis:                 d(history.diagnosis),
    treatment:                 d(history.treatment),
    diagnosesOrClinicalProblems: d(history.diagnosesOrClinicalProblems),
    therapeuticIndication:     d(history.therapeuticIndication),
    plan:                      d(history.plan),
    prognosis:                 d(history.prognosis),
    healthStatus:              d(history.healthStatus),
    additionalMedicalNotes:    d(history.additionalMedicalNotes)
  };

  const patientName = history.patient.user.name;
  const consultationDate = formatDate(history.appointment.availabilitySlot.startsAt);
  const exportDate = formatDate(new Date());

  // Generate AI clinical summary (non-blocking failure — PDF is always returned).
  const aiSummary = await generateClinicalSummary({
    patientName,
    consultationDate,
    doctorName: doctor.fullName,
    specialty: doctor.specialty.name,
    consultationReason:          fields.consultationReason,
    currentCondition:            fields.currentCondition,
    pathologicalHistory:         fields.pathologicalHistory,
    hereditaryFamilyHistory:     fields.hereditaryFamilyHistory,
    physicalExam:                fields.physicalExam,
    labsAndImaging:              fields.labsAndImaging,
    diagnosis:                   fields.diagnosis,
    diagnosesOrClinicalProblems: fields.diagnosesOrClinicalProblems,
    treatment:                   fields.treatment,
    plan:                        fields.plan,
    prognosis:                   fields.prognosis
  });

  // Render PDF (via .tsx helper — JSX avoids react-pdf type incompatibility).
  const pdfBuffer = await renderClinicalHistoryPdf({
    patientName,
    consultationDate,
    doctorName:          doctor.fullName,
    specialty:           doctor.specialty.name,
    professionalLicense: doctor.professionalLicense,
    hospitalName:        doctor.hospital.name,
    exportDate,
    aiSummary,
    fields
  });

  await auditLog({
    actorUserId: user.id,
    action: "EXPORT_CLINICAL_HISTORY_PDF",
    entityType: "ClinicalHistory",
    entityId: history.id,
    metadata: { patientId: history.patientId, aiSummaryGenerated: true }
  });

  // Safe filename: letters, numbers, hyphens only.
  const safeName = patientName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .toLowerCase();
  const date = new Date().toISOString().slice(0, 10);
  const filename = `historial-${safeName}-${date}.pdf`;

  return new Response(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store, no-cache"
    }
  });
}
