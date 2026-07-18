import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const specialties: Array<{ name: string; description: string }> = [
  { name: "Alergología",              description: "Alergias, asma y enfermedades del sistema inmunológico. Diagnóstico de intolerancia y tratamiento desensibilizador." },
  { name: "Anestesiología",           description: "Manejo del dolor y sedación segura en procedimientos quirúrgicos y diagnósticos." },
  { name: "Angiología",               description: "Venas, arterias y sistema linfático. Várices, trombosis e insuficiencia vascular periférica." },
  { name: "Cardiología",              description: "Corazón, presión arterial, arritmias y enfermedades del sistema circulatorio." },
  { name: "Cirugía General",          description: "Procedimientos quirúrgicos del abdomen, vesícula, hernia y tejidos blandos." },
  { name: "Cirugía Plástica",         description: "Reconstrucción, corrección estética y cirugías de mejora funcional o apariencia." },
  { name: "Coloproctología",          description: "Colon, recto y ano. Hemorroides, fístulas, cáncer colorrectal y enfermedad inflamatoria intestinal." },
  { name: "Dermatología",             description: "Piel, cabello y uñas. Acné, psoriasis, alergias cutáneas y dermatitis." },
  { name: "Endocrinología",           description: "Diabetes, tiroides, metabolismo y trastornos hormonales." },
  { name: "Gastroenterología",        description: "Estómago, intestino, hígado y páncreas. Colitis, reflujo y enfermedades digestivas." },
  { name: "Geriatría",                description: "Salud integral del adulto mayor con enfoque en calidad de vida y autonomía funcional." },
  { name: "Ginecología",              description: "Salud femenina, ciclo menstrual, embarazo y seguimiento reproductivo." },
  { name: "Hematología",              description: "Sangre y médula ósea. Anemia, leucemia y trastornos de coagulación." },
  { name: "Infectología",             description: "Infecciones bacterianas, virales y parasitarias. Tratamiento especializado de enfermedades infecciosas." },
  { name: "Medicina de Rehabilitación", description: "Recuperación funcional tras lesiones, cirugías o enfermedades neurológicas." },
  { name: "Medicina del Deporte",     description: "Lesiones deportivas, rendimiento atlético y rehabilitación de la actividad física." },
  { name: "Medicina Estética",        description: "Tratamientos no quirúrgicos para rejuvenecimiento facial y mejora de la apariencia corporal." },
  { name: "Medicina Familiar",        description: "Atención preventiva y continua para toda la familia en todas las etapas de vida." },
  { name: "Medicina General",         description: "Primera consulta, orientación diagnóstica y atención de padecimientos frecuentes." },
  { name: "Medicina Interna",         description: "Diagnóstico y tratamiento integral en adultos con enfermedades crónicas o complejas." },
  { name: "Nefrología",               description: "Riñones y función renal. Insuficiencia renal crónica, hipertensión renal y diálisis." },
  { name: "Neumología",               description: "Pulmones y vías respiratorias. Asma, EPOC, neumonía e infecciones respiratorias." },
  { name: "Neurología",               description: "Cerebro, nervios y médula espinal. Migrañas, epilepsia y enfermedades neurodegenerativas." },
  { name: "Nutrición",                description: "Alimentación terapéutica, control de peso y manejo nutricional de enfermedades crónicas." },
  { name: "Odontología",              description: "Salud dental, encías y oclusión. Tratamientos preventivos, restauradores y estéticos." },
  { name: "Oftalmología",             description: "Ojos y visión. Cataratas, glaucoma, retinopatía y corrección visual." },
  { name: "Oncología",                description: "Diagnóstico y tratamiento del cáncer con enfoque integral y multidisciplinario." },
  { name: "Ortopedia",                description: "Huesos, articulaciones y columna vertebral. Lesiones, fracturas y degeneración articular." },
  { name: "Otorrinolaringología",     description: "Oído, nariz y garganta. Sinusitis, ronquidos, vértigo y pérdida auditiva." },
  { name: "Pediatría",                description: "Salud y desarrollo de niños y adolescentes desde el nacimiento hasta los 18 años." },
  { name: "Psicología",               description: "Bienestar emocional, terapia cognitivo-conductual y acompañamiento en procesos psicológicos." },
  { name: "Psiquiatría",              description: "Salud mental, ansiedad, depresión y trastornos del estado de ánimo con tratamiento médico." },
  { name: "Radiología",               description: "Diagnóstico por imagen: rayos X, ultrasonido, tomografía y resonancia magnética." },
  { name: "Reumatología",             description: "Artritis, lupus y enfermedades autoinmunes que afectan articulaciones y tejidos conectivos." },
  { name: "Traumatología",            description: "Lesiones musculoesqueléticas por accidentes, caídas o impacto físico." },
  { name: "Urología",                 description: "Sistema urinario en hombres y mujeres. Próstata, vejiga, cálculos renales y función renal." }
];

const leonHospitals = [
  "Hospital Ángeles León",
  "Hospital Aranda de la Parra",
  "Hospital Médica Campestre",
  "Hospital Christus Muguerza Altagracia",
  "Hospital MAC León",
  "Hospital Siena",
  "Clínica Médica San José",
  "Torre Médica Campestre",
  "Hospital General Regional de León"
];

const legacyDemoDoctorSlugs = [
  "dra-elena-vargas",
  "dra-susana-perez-guadarrama",
  "dr-diego-narvaez",
  "dra-sofia-almada",
  "dra-vitaeon-nutricion"
];

const legacyDemoEmails = [
  "elena.vargas@vitaeon.mx",
  "susana.perez@vitaeon.mx",
  "diego.narvaez@vitaeon.mx",
  "sofia.almada@vitaeon.mx",
  "vitaeon.nutricion@vitaeon.mx"
];

const legacyDemoHospitals = ["VITAEON Center", "Clínica Altum", "VITAEON Digital"];

async function main() {
  const adminEmail = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    throw new Error("SEED_ADMIN_EMAIL y SEED_ADMIN_PASSWORD son obligatorios para ejecutar el seed de beta.");
  }
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.doctor.deleteMany({ where: { slug: { in: legacyDemoDoctorSlugs } } });
  await prisma.user.deleteMany({ where: { email: { in: legacyDemoEmails } } });
  for (const name of legacyDemoHospitals) {
    await prisma.hospital.deleteMany({ where: { name, doctors: { none: {} } } });
  }

  const createdSpecialties = [];
  for (const { name, description } of specialties) {
    const specialty = await prisma.specialty.upsert({
      where: { name },
      update: { description },
      create: { name, description }
    });
    createdSpecialties.push(specialty);
  }

  const createdHospitals = [];
  for (const name of leonHospitals) {
    const hospital = await prisma.hospital.upsert({
      where: { name },
      update: { city: "León, Guanajuato" },
      create: { name, city: "León, Guanajuato" }
    });
    createdHospitals.push(hospital);
  }

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Administrador VITAEON",
      passwordHash,
      role: Role.ADMIN,
      isActive: true
    },
    create: {
      email: adminEmail,
      name: "Administrador VITAEON",
      passwordHash,
      role: Role.ADMIN
    }
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: admin.id,
      action: "SEED_BETA_CATALOG_READY",
      entityType: "System",
      metadata: {
        adminEmail,
        specialties: createdSpecialties.map((specialty) => specialty.name),
        hospitals: createdHospitals.map((hospital) => hospital.name),
        publicDemoProfiles: 0,
        publicDemoReviews: 0
      }
    }
  });

  console.log("VITAEON beta seed listo: admin, especialidades y hospitales reales de catálogo.");
  console.log(`Admin: ${adminEmail}`);
  console.log("No se crearon médicos, hospitales ni opiniones ficticias visibles.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
