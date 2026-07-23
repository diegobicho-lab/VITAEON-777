import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export type MedicationSearchResult = {
  name: string;
  activeSubstance?: string;
  presentations: string[];
  indications: string;
  contraindications: string;
  warnings: string;
  referenceDose?: string;
  interactions?: string;
  source: string;
  sourceUrl?: string;
};

export type MedicationSearchResponse = {
  status: "ready" | "integration_pending";
  disclaimer: string;
  results: MedicationSearchResult[];
};

const disclaimer =
  "La información mostrada es de referencia auxiliar y no sustituye el criterio médico profesional, la ficha técnica oficial ni las guías clínicas. Siempre verifique con fuentes autorizadas (COFEPRIS, PLM, IMSS-GPC) antes de indicar o ajustar tratamientos.";

const SYSTEM_PROMPT = `Eres un asistente de referencia farmacológica para médicos en México.
Tienes un conocimiento profundo de los medicamentos disponibles en el mercado mexicano, incluyendo marcas comerciales, presentaciones, dosis de referencia, mecanismos de acción, indicaciones, contraindicaciones, interacciones importantes y advertencias de seguridad conforme a los estándares mexicanos (COFEPRIS, PLM México, NOM-SSA).

Cuando el médico consulte un medicamento o principio activo, responde SIEMPRE con un JSON válido con esta estructura exacta:
{
  "results": [
    {
      "name": "Nombre comercial principal o DCI si no hay marca dominante",
      "activeSubstance": "Principio activo (DCI)",
      "presentations": ["Presentación 1", "Presentación 2"],
      "indications": "Indicaciones clínicas principales en México",
      "contraindications": "Contraindicaciones absolutas y relativas más relevantes",
      "warnings": "Advertencias de seguridad importantes (embarazo, lactancia, insuficiencia renal/hepática, etc.)",
      "referenceDose": "Dosis de referencia habitual en adultos (indicar si varía por indicación)",
      "interactions": "Interacciones clínicamente relevantes más importantes",
      "source": "Referencia farmacológica mexicana (PLM/COFEPRIS/NOM-SSA)"
    }
  ]
}

Si el medicamento tiene múltiples formulaciones importantes (ej. liberación inmediata vs. extendida) o el query menciona una indicación específica, puedes incluir hasta 2-3 resultados en el array.

Si el término buscado no corresponde a un medicamento real o es ambiguo, incluye un resultado con un mensaje claro en "indications" explicando la ambigüedad.

Responde ÚNICAMENTE con el JSON, sin texto adicional antes o después.`;

export async function searchMedication(query: string): Promise<MedicationSearchResponse> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      status: "integration_pending",
      disclaimer,
      results: [
        {
          name: query,
          presentations: [],
          indications: "IA farmacológica no disponible: configura ANTHROPIC_API_KEY en Vercel.",
          contraindications: "No disponible.",
          warnings: "Consulta siempre fuentes oficiales como COFEPRIS, PLM o fichas técnicas autorizadas.",
          source: "Configuración pendiente"
        }
      ]
    };
  }

  try {
    const client = new Anthropic();

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1200,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Buscar referencia farmacológica: ${query}`
        }
      ]
    });

    const block = message.content[0];
    if (block.type !== "text" || !block.text.trim()) {
      throw new Error("Respuesta vacía del modelo.");
    }

    // Extraer JSON limpio (el modelo puede envolver en ```json ... ```)
    let raw = block.text.trim();
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
    if (jsonMatch?.[1]) raw = jsonMatch[1].trim();

    const parsed = JSON.parse(raw) as { results?: MedicationSearchResult[] };

    const results = Array.isArray(parsed.results) ? parsed.results : [];
    if (results.length === 0) throw new Error("Sin resultados en respuesta IA.");

    // Garantizar que todos los campos requeridos existan
    const clean = results.map((r) => ({
      name: r.name ?? query,
      activeSubstance: r.activeSubstance,
      presentations: Array.isArray(r.presentations) ? r.presentations : [],
      indications: r.indications ?? "No disponible.",
      contraindications: r.contraindications ?? "Consulta ficha técnica oficial.",
      warnings: r.warnings ?? "Consulta ficha técnica oficial.",
      referenceDose: r.referenceDose,
      interactions: r.interactions,
      source: r.source ?? "Referencia IA · VITAEON"
    }));

    return {
      status: "ready",
      disclaimer,
      results: clean
    };
  } catch (error) {
    console.error("[medication-search:ai]", error);
    return {
      status: "integration_pending",
      disclaimer,
      results: [
        {
          name: query,
          presentations: [],
          indications: "No fue posible consultar la referencia farmacológica en este momento. Intenta de nuevo.",
          contraindications: "No disponible.",
          warnings: "Consulta siempre fuentes oficiales: COFEPRIS, PLM México o fichas técnicas autorizadas.",
          source: "Referencia IA temporalmente no disponible"
        }
      ]
    };
  }
}
