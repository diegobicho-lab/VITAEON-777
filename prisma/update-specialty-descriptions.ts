/**
 * Script de actualización de descripciones clínicas para especialidades.
 * Ejecutar una sola vez: npx ts-node --compiler-options '{"module":"commonjs"}' prisma/update-specialty-descriptions.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const descriptions: Record<string, string> = {
  "Alergología":              "Alergias, asma y enfermedades del sistema inmunológico. Diagnóstico de intolerancia y tratamiento desensibilizador.",
  "Anestesiología":           "Manejo del dolor y sedación segura en procedimientos quirúrgicos y diagnósticos.",
  "Angiología":               "Venas, arterias y sistema linfático. Várices, trombosis e insuficiencia vascular periférica.",
  "Cardiología":              "Corazón, presión arterial, arritmias y enfermedades del sistema circulatorio.",
  "Cirugía General":          "Procedimientos quirúrgicos del abdomen, vesícula, hernia y tejidos blandos.",
  "Cirugía Plástica":         "Reconstrucción, corrección estética y cirugías de mejora funcional o apariencia.",
  "Coloproctología":          "Colon, recto y ano. Hemorroides, fístulas, cáncer colorrectal y enfermedad inflamatoria intestinal.",
  "Dermatología":             "Piel, cabello y uñas. Acné, psoriasis, alergias cutáneas y dermatitis.",
  "Endocrinología":           "Diabetes, tiroides, metabolismo y trastornos hormonales.",
  "Gastroenterología":        "Estómago, intestino, hígado y páncreas. Colitis, reflujo y enfermedades digestivas.",
  "Geriatría":                "Salud integral del adulto mayor con enfoque en calidad de vida y autonomía funcional.",
  "Ginecología":              "Salud femenina, ciclo menstrual, embarazo y seguimiento reproductivo.",
  "Hematología":              "Sangre y médula ósea. Anemia, leucemia y trastornos de coagulación.",
  "Infectología":             "Infecciones bacterianas, virales y parasitarias. Tratamiento especializado de enfermedades infecciosas.",
  "Medicina de Rehabilitación": "Recuperación funcional tras lesiones, cirugías o enfermedades neurológicas.",
  "Medicina del Deporte":     "Lesiones deportivas, rendimiento atlético y rehabilitación de la actividad física.",
  "Medicina Estética":        "Tratamientos no quirúrgicos para rejuvenecimiento facial y mejora de la apariencia corporal.",
  "Medicina Familiar":        "Atención preventiva y continua para toda la familia en todas las etapas de vida.",
  "Medicina General":         "Primera consulta, orientación diagnóstica y atención de padecimientos frecuentes.",
  "Medicina Interna":         "Diagnóstico y tratamiento integral en adultos con enfermedades crónicas o complejas.",
  "Nefrología":               "Riñones y función renal. Insuficiencia renal crónica, hipertensión renal y diálisis.",
  "Neumología":               "Pulmones y vías respiratorias. Asma, EPOC, neumonía e infecciones respiratorias.",
  "Neurología":               "Cerebro, nervios y médula espinal. Migrañas, epilepsia y enfermedades neurodegenerativas.",
  "Nutrición":                "Alimentación terapéutica, control de peso y manejo nutricional de enfermedades crónicas.",
  "Odontología":              "Salud dental, encías y oclusión. Tratamientos preventivos, restauradores y estéticos.",
  "Oftalmología":             "Ojos y visión. Cataratas, glaucoma, retinopatía y corrección visual.",
  "Oncología":                "Diagnóstico y tratamiento del cáncer con enfoque integral y multidisciplinario.",
  "Ortopedia":                "Huesos, articulaciones y columna vertebral. Lesiones, fracturas y degeneración articular.",
  "Otorrinolaringología":     "Oído, nariz y garganta. Sinusitis, ronquidos, vértigo y pérdida auditiva.",
  "Pediatría":                "Salud y desarrollo de niños y adolescentes desde el nacimiento hasta los 18 años.",
  "Psicología":               "Bienestar emocional, terapia cognitivo-conductual y acompañamiento en procesos psicológicos.",
  "Psiquiatría":              "Salud mental, ansiedad, depresión y trastornos del estado de ánimo con tratamiento médico.",
  "Radiología":               "Diagnóstico por imagen: rayos X, ultrasonido, tomografía y resonancia magnética.",
  "Reumatología":             "Artritis, lupus y enfermedades autoinmunes que afectan articulaciones y tejidos conectivos.",
  "Traumatología":            "Lesiones musculoesqueléticas por accidentes, caídas o impacto físico.",
  "Urología":                 "Sistema urinario en hombres y mujeres. Próstata, vejiga, cálculos renales y función renal."
};

async function main() {
  console.log("Actualizando descripciones clínicas de especialidades...\n");
  let updated = 0;
  let skipped = 0;

  for (const [name, description] of Object.entries(descriptions)) {
    const result = await prisma.specialty.updateMany({
      where: { name },
      data: { description }
    });
    if (result.count > 0) {
      console.log(`✅ ${name}`);
      updated++;
    } else {
      console.log(`⚠️  ${name} — no encontrada en la BD (se omite)`);
      skipped++;
    }
  }

  console.log(`\n${updated} especialidades actualizadas, ${skipped} no encontradas.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
