import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const specialtyNames = [
  "Medicina Interna",
  "Cardiología",
  "Neurología",
  "Dermatología",
  "Pediatría",
  "Ginecología",
  "Ortopedia",
  "Traumatología",
  "Oncología",
  "Endocrinología",
  "Gastroenterología",
  "Oftalmología",
  "Urología",
  "Neumología",
  "Psiquiatría",
  "Psicología",
  "Cirugía General",
  "Cirugía Plástica",
  "Medicina Estética",
  "Otorrinolaringología",
  "Reumatología",
  "Infectología",
  "Hematología",
  "Nefrología",
  "Medicina Familiar",
  "Medicina General",
  "Medicina del Deporte",
  "Nutrición",
  "Anestesiología",
  "Radiología",
  "Medicina de Rehabilitación",
  "Geriatría",
  "Angiología",
  "Alergología",
  "Coloproctología",
  "Odontología"
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
  for (const name of specialtyNames) {
    const specialty = await prisma.specialty.upsert({
      where: { name },
      update: {
        description: `Especialidad disponible para onboarding de médicos verificados en la beta privada.`
      },
      create: {
        name,
        description: `Especialidad disponible para onboarding de médicos verificados en la beta privada.`
      }
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
