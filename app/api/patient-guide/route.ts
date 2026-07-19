import Anthropic from "@anthropic-ai/sdk";
import { fail, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { z } from "zod";

/* ── Anthropic client (lazy) ─────────────────────────────────── */
function getAnthropic() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY no configurado.");
  return new Anthropic({ apiKey });
}

/* ── Fallback keywords si no hay API key ─────────────────────── */
function fallbackGuide(symptom: string) {
  const s = symptom.toLowerCase();
  let specialty = "Medicina Interna";
  let reason = "Medicina Interna puede orientarte hacia el especialista adecuado según tus síntomas.";
  const alternatives: string[] = [];

  if (/coraz|pecho|presion|presión|palpit/.test(s)) { specialty = "Cardiología"; reason = "Los síntomas relacionados con el corazón o la presión arterial los atiende Cardiología."; alternatives.push("Medicina Interna"); }
  else if (/cabez|migraña|migrana|mareo|convuls|nervio|temblor/.test(s)) { specialty = "Neurología"; reason = "Los síntomas neurológicos como migraña, mareos o temblores son área de Neurología."; alternatives.push("Medicina Interna"); }
  else if (/rodill|cadera|espalda|hueso|fractur|columna|articulac/.test(s)) { specialty = "Traumatología y Ortopedia"; reason = "Los dolores musculoesqueléticos, fracturas y lesiones articulares los atiende Traumatología."; alternatives.push("Medicina del Deporte"); }
  else if (/piel|acne|acné|mancha|dermat/.test(s)) { specialty = "Dermatología"; reason = "Los problemas de piel, manchas y afecciones cutáneas son área de Dermatología."; }
  else if (/estomag|vomit|nausea|náusea|diarrea|reflujo|gastrit/.test(s)) { specialty = "Gastroenterología"; reason = "Los problemas digestivos como reflujo, náuseas o gastritis los atiende Gastroenterología."; alternatives.push("Medicina Interna"); }
  else if (/ansied|depres|tristeza|pánico|panico|mental|estrés|estres/.test(s)) { specialty = "Psiquiatría"; reason = "Los síntomas emocionales y de salud mental los atiende Psiquiatría."; alternatives.push("Psicología"); }
  else if (/ojo|vision|visión|vista/.test(s)) { specialty = "Oftalmología"; reason = "Los problemas de visión y salud ocular los atiende Oftalmología."; }
  else if (/oido|oído|oreja|garganta|sinusit|nariz/.test(s)) { specialty = "Otorrinolaringología"; reason = "Los síntomas de oído, nariz y garganta los atiende Otorrinolaringología."; }
  else if (/niño|niña|bebé|bebe|pediatr|infant/.test(s)) { specialty = "Pediatría"; reason = "La salud infantil la atiende Pediatría."; }
  else if (/embaraz|ginecol|menstruac|ovario|útero|utero/.test(s)) { specialty = "Ginecología y Obstetricia"; reason = "La salud femenina, embarazo y ciclo menstrual los atiende Ginecología."; }
  else if (/riñon|riñón|vejiga|orina|prostat/.test(s)) { specialty = "Urología"; reason = "Los síntomas urinarios y de próstata los atiende Urología."; alternatives.push("Nefrología"); }

  return { specialty, reason, alternatives, redFlag: null, aiGenerated: false };
}

const schema = z.object({
  symptom: z.string().min(3).max(400)
});

/* ── POST ─────────────────────────────────────────────────────── */
export async function POST(request: Request) {
  /* 1. Solo usuarios autenticados */
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHORIZED", "Inicia sesión para usar el orientador con IA.", 401);

  /* 2. Rate limit: 10 consultas por hora por IP */
  const limit = await rateLimitByIp("patient-guide", { limit: 10, windowMs: 60 * 60_000 });
  if (!limit.allowed)
    return fail("RATE_LIMITED", "Has alcanzado el límite de 10 consultas por hora. Intenta más tarde.", 429);

  /* 3. Validar body */
  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Síntoma inválido.", 422);

  const { symptom } = parsed.data;

  /* 4. Llamar a Claude Haiku */
  try {
    const anthropic = getAnthropic();

    const systemPrompt = `Eres el orientador médico de VITAEON, una plataforma de salud privada en León, Guanajuato, México.
Tu tarea es ayudar a pacientes a identificar qué especialidad médica necesitan según sus síntomas.
Responde SIEMPRE en español, de forma empática, clara y sin alarmismo innecesario.
Responde SOLO con un JSON válido con esta estructura exacta, sin texto adicional:
{
  "specialty": "Nombre de la especialidad médica principal (1 especialidad)",
  "reason": "Explicación breve y empática de por qué esa especialidad (2-3 oraciones máx)",
  "alternatives": ["Especialidad alternativa 1", "Especialidad alternativa 2"],
  "redFlag": "Solo si hay síntomas de urgencia real — texto breve de advertencia, o null si no aplica"
}
IMPORTANTE: No hagas diagnósticos. Solo orienta hacia la especialidad correcta.
Las especialidades disponibles en VITAEON León incluyen: Cardiología, Neurología, Pediatría, Dermatología, Traumatología y Ortopedia, Gastroenterología, Ginecología y Obstetricia, Psiquiatría, Oftalmología, Otorrinolaringología, Urología, Nefrología, Neumología, Endocrinología, Medicina Interna, Medicina del Deporte, Reumatología, Cirugía General.`;

    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      system: systemPrompt,
      messages: [{ role: "user", content: `El paciente describe: "${symptom}"` }]
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    const jsonStart = rawText.indexOf("{");
    const jsonEnd = rawText.lastIndexOf("}");
    const jsonText = jsonStart >= 0 && jsonEnd > jsonStart ? rawText.slice(jsonStart, jsonEnd + 1) : rawText;
    const result = JSON.parse(jsonText);

    if (!result.specialty || !result.reason) throw new Error("Estructura incompleta");

    return ok({ ...result, aiGenerated: true });
  } catch (error) {
    console.error("[Patient guide AI error]", error);
    /* Fallback a keywords si falla la IA */
    return ok(fallbackGuide(symptom));
  }
}
