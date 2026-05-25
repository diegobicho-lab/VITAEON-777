import { z } from "zod";

export const emailSchema = z.string().email().max(254);

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(8).max(128)
});

export const passwordRecoveryRequestSchema = z.object({
  email: emailSchema
});

export const passwordRecoveryResetSchema = z.object({
  token: z.string().min(32).max(240),
  password: z.string().min(10).max(128)
});

export const registerSchema = z.object({
  email: emailSchema,
  password: z.string().min(10).max(128),
  name: z.string().min(3).max(120),
  role: z.enum(["PATIENT", "DOCTOR"]).default("PATIENT"),
  phone: z.string().min(8).max(30).optional(),
  medal: z.enum(["oro", "diamante", "amatista"]).optional()
});

export const appointmentCreateSchema = z.object({
  doctorId: z.string().min(1),
  availabilitySlotId: z.string().min(1),
  paymentMethod: z.enum(["ONLINE", "TRANSFER", "CASH"]),
  reason: z.string().max(1200).optional()
});

export const appointmentUpdateSchema = z
  .object({
    action: z
      .enum([
        "ACCEPT",
        "COMPLETE",
        "MARK_NO_SHOW",
        "REQUEST_RESCHEDULE",
        "REQUEST_CANCELLATION",
        "MARK_REFUND_PENDING",
        "APPROVE_REFUND",
        "REJECT_REFUND",
        "CANCEL"
      ])
      .optional(),
    status: z
      .enum([
        "CANCELLED",
        "COMPLETED",
        "CONFIRMED",
        "ACCEPTED",
        "PENDING_DOCTOR_ACCEPTANCE",
        "NO_SHOW",
        "RESCHEDULE_REQUESTED",
        "RESCHEDULED",
        "CANCELLATION_REQUESTED",
        "REFUND_PENDING"
      ])
      .optional(),
    cancellationReason: z.string().min(3).max(600).optional(),
    refundReason: z.string().min(3).max(600).optional(),
    availabilitySlotId: z.string().min(1).optional()
  })
  .refine((value) => Boolean(value.action || value.status || value.availabilitySlotId), {
    message: "Debes enviar una acción, un nuevo estado o un nuevo horario.",
    path: ["action"]
  });

export const doctorSearchSchema = z.object({
  specialtyId: z.string().optional(),
  city: z.string().optional(),
  hospitalId: z.string().optional(),
  query: z.string().max(160).optional()
});

const catalogNameSchema = z
  .string()
  .trim()
  .min(3)
  .max(160)
  .regex(/^[\p{L}\p{M}0-9 .,'()/-]+$/u, "Usa un nombre profesional sin caracteres especiales innecesarios.");

export const specialtyCreateSchema = z.object({
  name: catalogNameSchema.max(120),
  description: z.string().trim().max(600).optional()
});

export const hospitalCreateSchema = z.object({
  name: catalogNameSchema,
  city: z.string().trim().min(3).max(120),
  address: z.string().trim().max(240).optional()
});

export const paymentIntentSchema = z.object({
  appointmentId: z.string().min(1),
  provider: z.enum(["STRIPE", "MERCADO_PAGO", "CASH"])
});

export const doctorVerificationSchema = z.object({
  doctorId: z.string().min(1),
  professionalLicense: z.string().min(4).max(80),
  specialtyBoard: z.string().max(160).optional(),
  documents: z.array(z.string().min(3).max(240)).max(8).default([])
});

export const verificationReviewSchema = z.object({
  verificationId: z.string().min(1),
  status: z.enum(["VERIFIED", "REJECTED", "IN_REVIEW"]),
  notes: z.string().max(1000).optional()
});

export const availabilitySlotSchema = z
  .object({
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date()
  })
  .refine((value) => value.endsAt > value.startsAt, {
    message: "La hora final debe ser posterior a la hora inicial.",
    path: ["endsAt"]
  });

export const availabilitySlotUpdateSchema = z.object({
  slotId: z.string().min(1),
  isActive: z.boolean()
});

export const availabilityBulkSchema = z
  .object({
    date: z.coerce.date().optional(),
    dates: z.array(z.coerce.date()).max(31).optional(),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    durationMinutes: z.union([z.literal(45), z.literal(60)]).default(45),
    repeatWeekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
    repeatUntil: z.coerce.date().optional()
  })
  .refine((value) => value.endTime > value.startTime, {
    message: "La hora final debe ser posterior a la hora inicial.",
    path: ["endTime"]
  })
  .refine((value) => Boolean(value.date || value.dates?.length || value.repeatWeekdays?.length), {
    message: "Selecciona al menos un día para publicar disponibilidad.",
    path: ["date"]
  });

export const doctorProfileUpdateSchema = z.object({
  fullName: z.string().min(3).max(120).optional(),
  specialtyId: z.string().min(1).optional(),
  subSpecialty: z.string().min(3).max(120).optional(),
  bio: z.string().min(20).max(1800).optional(),
  imageUrl: z.string().min(1).max(500).optional(),
  practicePhotoUrl: z.string().min(1).max(500).optional(),
  professionalLicensePhotoUrl: z.string().min(1).max(500).optional(),
  university: z.string().max(180).optional(),
  officeAddress: z.string().max(240).optional(),
  officeReference: z.string().max(180).optional(),
  cityState: z.string().max(140).optional(),
  mapsUrl: z.string().max(500).optional(),
  professionalPhone: z.string().max(40).optional(),
  instagramUrl: z.string().max(500).optional(),
  facebookUrl: z.string().max(500).optional(),
  linkedinUrl: z.string().max(500).optional(),
  websiteUrl: z.string().max(500).optional(),
  whatsappUrl: z.string().max(500).optional(),
  affiliateCode: z.string().trim().min(4).max(80).optional(),
  hospitalId: z.string().min(1).optional(),
  consultationPriceCents: z.number().int().min(0).max(2500000).optional(),
  consultationDurationMinutes: z.number().int().min(15).max(180).optional(),
  professionalLicense: z.string().min(4).max(80).optional(),
  medal: z.enum(["oro", "diamante", "amatista"]).optional(),
  achievements: z.array(z.string().min(3).max(160)).max(8).optional(),
  certifications: z.array(z.string().min(3).max(160)).max(12).optional(),
  legalDeclarationAccepted: z.boolean().optional()
});

export const medicalConversationCreateSchema = z.object({
  recipientDoctorId: z.string().min(1).optional(),
  title: z.string().min(3).max(160),
  patientAlias: z.string().min(2).max(120).optional(),
  clinicalSummary: z.string().min(3).max(1800).optional(),
  initialMessage: z.string().min(1).max(1800).optional()
});

export const medicalChatMessageSchema = z.object({
  body: z.string().min(1).max(1800)
});

export const doctorAssistantSchema = z.object({
  prompt: z.string().min(3).max(1800),
  context: z.string().max(1800).optional()
});

export const subscriptionCheckoutSchema = z.object({
  plan: z.enum(["oro", "diamante", "amatista"])
});

export const cancellationRequestSchema = z.object({
  appointmentId: z.string().min(1),
  reason: z.string().trim().min(6).max(600)
});

export const medicationSearchSchema = z.object({
  query: z.string().min(2).max(120)
});

const medicalNoteField = z.string().max(12000).optional().default("");

export const clinicalHistoryUpsertSchema = z.object({
  patientId: z.string().min(1),
  appointmentId: z.string().min(1),
  nonPathologicalHistory: medicalNoteField,
  pathologicalHistory: medicalNoteField,
  surgicalHistory: medicalNoteField,
  fractureHistory: medicalNoteField,
  gynecoObstetricHistory: medicalNoteField,
  currentCondition: medicalNoteField,
  physicalExam: medicalNoteField,
  labsAndImaging: medicalNoteField,
  plan: medicalNoteField,
  prognosis: medicalNoteField,
  healthStatus: medicalNoteField
});

export const prescriptionTemplateSchema = z.object({
  doctorName: z.string().trim().min(3).max(160),
  specialty: z.string().trim().min(2).max(160),
  professionalLicense: z.string().trim().max(80).optional().default(""),
  phone: z.string().trim().max(40).optional().default(""),
  officeAddress: z.string().trim().max(240).optional().default(""),
  headerImageUrl: z.string().trim().max(500).optional().default(""),
  signatureImageUrl: z.string().trim().max(500).optional().default("")
});

export const prescriptionUpsertSchema = z.object({
  id: z.string().min(1).optional(),
  patientId: z.string().min(1),
  appointmentId: z.string().min(1),
  templateId: z.string().min(1).optional(),
  patientAge: z.string().trim().max(40).optional().default(""),
  diagnosis: medicalNoteField,
  medicationInstructions: medicalNoteField,
  dosage: medicalNoteField,
  frequency: medicalNoteField,
  duration: medicalNoteField,
  generalRecommendations: medicalNoteField,
  additionalNotes: medicalNoteField
});

export const reviewCreateSchema = z.object({
  doctorId: z.string().min(1),
  appointmentId: z.string().min(1).optional(),
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .min(8, "La opinión debe tener al menos 8 caracteres.")
    .max(900)
});

export const reviewModerationSchema = z.object({
  reviewId: z.string().min(1),
  status: z.enum(["PUBLISHED", "PENDING_REVIEW", "REJECTED"]).optional(),
  doctorReply: z.string().trim().min(2).max(500).optional()
});

export const adminDoctorStatusSchema = z.object({
  doctorId: z.string().min(1),
  isActive: z.boolean()
});

export const urgentAvailabilitySchema = z.object({
  specialtyId: z.string().min(1)
});
