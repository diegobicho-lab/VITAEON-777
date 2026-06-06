export type Role = "PATIENT" | "DOCTOR" | "ADMIN" | "STAFF";

export type AppointmentStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "COMPLETED" | "REFUNDED";

export type PaymentStatus = "PENDING" | "PAID" | "FAILED" | "REFUNDED";

export type VerificationStatus = "UNVERIFIED" | "IN_REVIEW" | "VERIFIED" | "REJECTED";

export type MedicalMedal = "oro" | "diamante" | "amatista";

export interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export interface DoctorListItem {
  id: string;
  name: string;
  slug: string;
  specialty: string;
  specialtyId: string;
  subSpecialty: string;
  bio: string;
  yearsExperience: number;
  city: string;
  hospital: string;
  hospitalId: string;
  priceCents: number;
  consultationDurationMinutes: number;
  rating: number;
  medal: MedicalMedal;
  planPriorityLabel?: string;
  verificationStatus: VerificationStatus;
  professionalLicense?: string | null;
  imageUrl?: string | null;
  practicePhotoUrl?: string | null;
  university?: string | null;
  verifiedAt?: string | null;
  reviewAverage?: number;
  reviewCount?: number;
  officeAddress?: string | null;
  officeReference?: string | null;
  cityState?: string | null;
  mapsUrl?: string | null;
  professionalPhone?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  linkedinUrl?: string | null;
  websiteUrl?: string | null;
  whatsappUrl?: string | null;
  achievements: string[];
  certifications: string[];
  availability: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
  }>;
}
