import {
  MarketplaceListingStatus,
  MarketplaceListingType,
  MarketplaceSubscriptionStatus,
  MedicalMedal,
  SubscriptionStatus
} from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { obsidianProfileSchema } from "@/lib/validation/schemas";

async function requireObsidianOwner() {
  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return { user: null, error: fail("FORBIDDEN", "Solo perfiles Obsidiana pueden acceder a este panel.", 403) };

  const doctor = await prisma.doctor.findUnique({
    where: { userId: user.id },
    select: { id: true, medal: true, subscriptionStatus: true }
  });

  const hasObsidianAccess =
    doctor?.medal === MedicalMedal.obsidiana && doctor.subscriptionStatus === SubscriptionStatus.ACTIVE;

  if (!hasObsidianAccess) {
    return {
      user: null,
      error: fail(
        "OBSIDIAN_SUBSCRIPTION_REQUIRED",
        "Este panel requiere una suscripción Obsidiana activa.",
        403
      )
    };
  }

  return { user, error: null };
}

function serializeListing(listing: {
  id: string;
  type: MarketplaceListingType;
  name: string;
  description: string;
  cityOrZone: string;
  priceRange: string | null;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
  status: MarketplaceListingStatus;
  subscriptionStatus: MarketplaceSubscriptionStatus;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: listing.id,
    serviceType: listing.type,
    businessName: listing.name,
    description: listing.description,
    cityOrZone: listing.cityOrZone,
    priceRange: listing.priceRange,
    contactName: listing.contactName,
    phone: listing.phone,
    email: listing.email,
    logoUrl: listing.imageUrl,
    isActive: listing.status === MarketplaceListingStatus.ACTIVE,
    status: listing.status,
    subscriptionStatus: listing.subscriptionStatus,
    createdAt: listing.createdAt.toISOString(),
    updatedAt: listing.updatedAt.toISOString()
  };
}

export async function GET() {
  const access = await requireObsidianOwner();
  if (!access.user) return access.error;

  const listing = await prisma.marketplaceListing.findUnique({
    where: { userId: access.user.id }
  });

  return ok(listing ? serializeListing(listing) : null);
}

export async function PUT(request: Request) {
  const limit = await rateLimitByIp("obsidiana:profile:update", { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas actualizaciones. Intenta de nuevo en un momento.", 429);

  const access = await requireObsidianOwner();
  if (!access.user) return access.error;

  const body = await request.json().catch(() => null);
  const parsed = obsidianProfileSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Revisa los datos del perfil Obsidiana.", 422, parsed.error.flatten());

  const status = parsed.data.isActive ? MarketplaceListingStatus.ACTIVE : MarketplaceListingStatus.INACTIVE;
  const listing = await prisma.marketplaceListing.upsert({
    where: { userId: access.user.id },
    create: {
      userId: access.user.id,
      type: MarketplaceListingType[parsed.data.serviceType],
      name: parsed.data.businessName,
      description: parsed.data.description,
      cityOrZone: parsed.data.cityOrZone,
      priceRange: parsed.data.priceRange,
      contactName: parsed.data.contactName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      imageUrl: parsed.data.logoUrl,
      status,
      subscriptionStatus: MarketplaceSubscriptionStatus.ACTIVE
    },
    update: {
      type: MarketplaceListingType[parsed.data.serviceType],
      name: parsed.data.businessName,
      description: parsed.data.description,
      cityOrZone: parsed.data.cityOrZone,
      priceRange: parsed.data.priceRange,
      contactName: parsed.data.contactName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      imageUrl: parsed.data.logoUrl,
      status,
      subscriptionStatus: MarketplaceSubscriptionStatus.ACTIVE
    }
  });

  await auditLog({
    actorUserId: access.user.id,
    action: "UPSERT_OBSIDIANA_PROFILE",
    entityType: "MarketplaceListing",
    entityId: listing.id,
    metadata: { type: parsed.data.serviceType, isActive: parsed.data.isActive }
  });

  return ok(serializeListing(listing));
}
