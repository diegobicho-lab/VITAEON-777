import {
  MarketplaceListingStatus,
  MarketplaceListingType,
  MarketplaceSubscriptionStatus
} from "@prisma/client";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { marketplaceListingSchema, marketplaceStatusSchema } from "@/lib/validation/schemas";

async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return null;
  return user;
}

export async function GET() {
  const user = await requireAdmin();
  if (!user) return fail("FORBIDDEN", "Solo administración puede revisar representantes y catering.", 403);

  const listings = await prisma.marketplaceListing.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      payments: {
        orderBy: { createdAt: "desc" },
        take: 5
      }
    }
  });

  return ok(listings);
}

export async function POST(request: Request) {
  const user = await requireAdmin();
  if (!user) return fail("FORBIDDEN", "Solo administración puede crear representantes y catering.", 403);

  const body = await request.json().catch(() => null);
  const parsed = marketplaceListingSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Datos inválidos para el directorio.", 422, parsed.error.flatten());

  const listing = await prisma.marketplaceListing.upsert({
    where: {
      type_name_cityOrZone: {
        type: MarketplaceListingType[parsed.data.type],
        name: parsed.data.name,
        cityOrZone: parsed.data.cityOrZone
      }
    },
    create: {
      type: MarketplaceListingType[parsed.data.type],
      name: parsed.data.name,
      description: parsed.data.description,
      cityOrZone: parsed.data.cityOrZone,
      contactName: parsed.data.contactName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      imageUrl: parsed.data.imageUrl,
      priceRange: parsed.data.priceRange,
      status: parsed.data.status ? MarketplaceListingStatus[parsed.data.status] : MarketplaceListingStatus.PENDING
    },
    update: {
      description: parsed.data.description,
      contactName: parsed.data.contactName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      imageUrl: parsed.data.imageUrl,
      priceRange: parsed.data.priceRange,
      status: parsed.data.status ? MarketplaceListingStatus[parsed.data.status] : undefined
    }
  });

  await auditLog({
    actorUserId: user.id,
    action: "UPSERT_MARKETPLACE_LISTING",
    entityType: "MarketplaceListing",
    entityId: listing.id,
    metadata: { type: parsed.data.type, name: parsed.data.name }
  });

  return ok(listing);
}

export async function PATCH(request: Request) {
  const user = await requireAdmin();
  if (!user) return fail("FORBIDDEN", "Solo administración puede activar o pausar el directorio.", 403);

  const body = await request.json().catch(() => null);
  const parsed = marketplaceStatusSchema.safeParse(body);
  if (!parsed.success) return fail("VALIDATION_ERROR", "Estado inválido para el directorio.", 422, parsed.error.flatten());

  const listing = await prisma.marketplaceListing.update({
    where: { id: parsed.data.listingId },
    data: {
      status: MarketplaceListingStatus[parsed.data.status],
      subscriptionStatus: parsed.data.subscriptionStatus
        ? MarketplaceSubscriptionStatus[parsed.data.subscriptionStatus]
        : undefined
    }
  });

  await auditLog({
    actorUserId: user.id,
    action: "UPDATE_MARKETPLACE_LISTING_STATUS",
    entityType: "MarketplaceListing",
    entityId: listing.id,
    metadata: { status: parsed.data.status, subscriptionStatus: parsed.data.subscriptionStatus }
  });

  return ok(listing);
}

export async function DELETE(request: Request) {
  const user = await requireAdmin();
  if (!user) return fail("FORBIDDEN", "Solo administración puede eliminar entradas del directorio.", 403);

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return fail("VALIDATION_ERROR", "Se requiere el id del registro a eliminar.", 422);

  const existing = await prisma.marketplaceListing.findUnique({ where: { id } });
  if (!existing) return fail("NOT_FOUND", "Registro no encontrado.", 404);

  await prisma.marketplaceListing.delete({ where: { id } });

  await auditLog({
    actorUserId: user.id,
    action: "DELETE_MARKETPLACE_LISTING",
    entityType: "MarketplaceListing",
    entityId: id,
    metadata: { name: existing.name, type: existing.type }
  });

  return ok({ deleted: true });
}
