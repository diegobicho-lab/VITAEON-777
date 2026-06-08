import { MarketplaceListingStatus, MarketplaceListingType, MarketplaceSubscriptionStatus } from "@prisma/client";
import { ok } from "@/lib/api-response";
import { prisma } from "@/lib/db/prisma";

function mapRepresentative(item: {
  id: string;
  name: string;
  description: string;
  contactName: string | null;
  cityOrZone: string;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
  priceRange: string | null;
  createdAt: Date;
}) {
  return {
    id: item.id,
    lab: item.name,
    focus: item.description,
    representative: item.contactName ?? "Contacto profesional",
    zone: item.cityOrZone,
    phone: item.phone ?? "Contacto pendiente",
    email: item.email ?? "Correo pendiente",
    imageUrl: item.imageUrl,
    priceRange: item.priceRange,
    createdAt: item.createdAt.toISOString(),
    plan: "obsidiana"
  };
}

function mapCatering(item: {
  id: string;
  name: string;
  description: string;
  cityOrZone: string;
  phone: string | null;
  email: string | null;
  imageUrl: string | null;
  priceRange: string | null;
  createdAt: Date;
}) {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    cityOrZone: item.cityOrZone,
    phone: item.phone ?? "Contacto pendiente",
    email: item.email ?? "Correo pendiente",
    imageUrl: item.imageUrl,
    priceRange: item.priceRange,
    createdAt: item.createdAt.toISOString(),
    plan: "obsidiana"
  };
}

export async function GET() {
  const listings = await prisma.marketplaceListing.findMany({
    where: {
      status: MarketplaceListingStatus.ACTIVE,
      subscriptionStatus: MarketplaceSubscriptionStatus.ACTIVE
    },
    orderBy: [{ type: "asc" }, { createdAt: "desc" }]
  });

  return ok({
    representatives: listings
      .filter((item) => item.type === MarketplaceListingType.MEDICAL_REPRESENTATIVE)
      .map(mapRepresentative),
    catering: listings.filter((item) => item.type === MarketplaceListingType.CATERING).map(mapCatering)
  });
}
