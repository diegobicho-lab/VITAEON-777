import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export interface ClinicalSummaryInput {
  patientName: string;
  consultationDate: string;
  doctorName: string;
  specialty: string;
  consultationReason?: string | null;
  currentCondition?: string | null;
  pathologicalHistory?: string | null;
  hereditaryFamilyHistory?: string | null;
  physicalExam?: string | null;
  labsAndImaging?: string | null;
  diagnosis?: string | null;
  diagnosesOrClinicalProblems?: string | null;
  treatment?: string | null;
  plan?: string | null;
  prognosis?: string | null;
}

/**
 * Generates a clinical impression summary in formal Mexican medical Spanish
 * using Claude Haiku. Returns a fallback string if AI is unavailable.
 *
 * Called exclusively from the Amatista PDF export endpoint.
 * The summary is labeled as AI-generated auxiliary content in the PDF —
 * it does NOT replace the physician's clinical judgment.
 */
export async function generateClinicalSummary(input: ClinicalSummaryInput): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return "Resumen IA no disponible: ANTHROPIC_API_KEY no configurado en este entorno.";
  }

  // Build the data section from non-empty fields only.
  const lines = [
    input.consultationReason && `Motivo de consulta: ${input.consultationReason}`,
    input.currentCondition && `Padecimiento actual: ${input.currentCondition}`,
    input.pathologicalHistory && `Antecedentes patológicos: ${input.pathologicalHistory}`,
    input.hereditaryFamilyHistory && `Antecedentes heredofamiliares: ${input.hereditaryFamilyHistory}`,
    input.physicalExam && `Exploración física: ${input.physicalExam}`,
    input.labsAndImaging && `Laboratorio / gabinete: ${input.labsAndImaging}`,
    input.diagnosis && `Diagnóstico: ${input.diagnosis}`,
    input.diagnosesOrClinicalProblems && `Problemas clínicos: ${input.diagnosesOrClinicalProblems}`,
    input.treatment && `Tratamiento: ${input.treatment}`,
    input.plan && `Plan de seguimiento: ${input.plan}`,
    input.prognosis && `Pronóstico: ${input.prognosis}`,
  ].filter(Boolean);

  if (lines.length === 0) {
    return "Sin datos clínicos suficientes para generar el resumen de impresión.";
  }

  const prompt = `Eres un asistente de documentación médica de referencia. Con base en los datos del expediente clínico del paciente ${input.patientName} (consulta del ${input.consultationDate} con ${input.doctorName}, ${input.specialty}), redacta un resumen de impresión clínica en español médico formal.

Datos del expediente:
${lines.join("\n")}

Instrucciones:
- Redacta en prosa continua, sin numeración ni viñetas.
- Máximo 250 palabras.
- Incluye: presentación clínica, hallazgos relevantes, impresión diagnóstica, plan terapéutico y pronóstico.
- Usa terminología médica formal del estándar mexicano (NOM-004-SSA3-2012).
- No inventes datos que no estén en el expediente.
- No incluyas el encabezado "Resumen" ni ninguna etiqueta introductoria.`;

  try {
    const client = new Anthropic();
    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      messages: [{ role: "user", content: prompt }]
    });

    const block = message.content[0];
    if (block.type === "text" && block.text.trim()) {
      return block.text.trim();
    }
    return "No fue posible obtener respuesta del modelo de IA.";
  } catch (error) {
    console.error("[clinical-summary:ai]", error);
    return "Resumen IA no disponible en este momento. El expediente completo está disponible en las secciones siguientes.";
  }
}
