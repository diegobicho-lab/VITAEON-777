import { MedicalMedal, Prisma, VerificationStatus } from "@prisma/client";

export const publicDoctorWhere = {
  medal: { not: MedicalMedal.obsidiana },
  verificationStatus: VerificationStatus.VERIFIED,
  isVerified: true,
  legalDeclarationAccepted: true,
  user: { isActive: true },
  fullName: { not: "" },
  subSpecialty: { not: "" },
  bio: { not: "" },
  specialtyId: { not: "" },
  hospitalId: { not: "" },
  AND: [{ professionalLicense: { not: null } }, { professionalLicense: { not: "" } }]
} satisfies Prisma.DoctorWhereInput;
