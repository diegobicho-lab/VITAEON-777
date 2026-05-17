export type MedicationSearchResult = {
  name: string;
  activeSubstance?: string;
  presentations: string[];
  indications: string;
  contraindications: string;
  warnings: string;
  referenceDose?: string;
  source: string;
  sourceUrl?: string;
};

export type MedicationSearchResponse = {
  status: "ready" | "integration_pending";
  disclaimer: string;
  results: MedicationSearchResult[];
};

const disclaimer =
  "La información mostrada es de referencia y no sustituye el criterio médico profesional. Verifique siempre fuentes oficiales, guías clínicas y ficha técnica del medicamento.";

export async function searchMedication(query: string): Promise<MedicationSearchResponse> {
  const apiKey = process.env.MEDICATION_API_KEY;
  const baseUrl = process.env.MEDICATION_API_URL;

  if (!apiKey || !baseUrl) {
    return {
      status: "integration_pending",
      disclaimer,
      results: [
        {
          name: query,
          presentations: [],
          indications: "Integración pendiente. Configure MEDICATION_API_URL y MEDICATION_API_KEY para consultar una fuente autorizada.",
          contraindications: "No disponible sin proveedor oficial configurado.",
          warnings: "No use esta respuesta como ficha técnica. Consulte fuente oficial, PLM con licencia, COFEPRIS o ficha autorizada.",
          source: "Integración pendiente"
        }
      ]
    };
  }

  const url = new URL(baseUrl);
  url.searchParams.set("q", query);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}` },
    cache: "no-store"
  });

  if (!response.ok) {
    return {
      status: "integration_pending",
      disclaimer,
      results: [
        {
          name: query,
          presentations: [],
          indications: "El proveedor externo no respondió correctamente.",
          contraindications: "No disponible.",
          warnings: "Verifique manualmente fuentes oficiales antes de indicar tratamiento.",
          source: "Proveedor externo no disponible"
        }
      ]
    };
  }

  const data = (await response.json()) as { results?: MedicationSearchResult[] };
  return {
    status: "ready",
    disclaimer,
    results: Array.isArray(data.results) ? data.results : []
  };
}
