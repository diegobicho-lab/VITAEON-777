export type ClinicalResource = {
  id: string;
  name: string;
  category: string;
  description: string;
  url: string;
  external: true;
};

const rawClinicalResources = [
  {
    id: "vera-health",
    name: "Vera Health",
    category: "IA clínica / evidencia médica",
    description: "Motor externo de apoyo clínico basado en evidencia para profesionales de salud.",
    url: "https://www.verahealth.ai/home",
    external: true
  },
  {
    id: "pubmed",
    name: "PubMed",
    category: "Literatura biomédica",
    description: "Buscador de referencias biomédicas y artículos científicos.",
    url: "https://pubmed.ncbi.nlm.nih.gov/",
    external: true
  },
  {
    id: "pubmed-central",
    name: "PubMed Central",
    category: "Artículos de texto completo",
    description: "Archivo gratuito de literatura biomédica y ciencias de la vida.",
    url: "https://pmc.ncbi.nlm.nih.gov/",
    external: true
  },
  {
    id: "imss-gpc",
    name: "Guías de Práctica Clínica IMSS",
    category: "Guías clínicas México",
    description: "Acceso a guías clínicas mexicanas para apoyo profesional.",
    url: "https://www.imss.gob.mx/profesionales-salud/gpc",
    external: true
  }
] satisfies ClinicalResource[];

function validateClinicalResource(resource: ClinicalResource) {
  const parsedUrl = new URL(resource.url);
  if (parsedUrl.protocol !== "https:") {
    throw new Error(`Clinical resource URL must use HTTPS: ${resource.id}`);
  }
  if (!resource.external) {
    throw new Error(`Clinical resource must be marked external: ${resource.id}`);
  }
  return Object.freeze({ ...resource, url: parsedUrl.toString() });
}

export const clinicalResources = Object.freeze(rawClinicalResources.map(validateClinicalResource));
