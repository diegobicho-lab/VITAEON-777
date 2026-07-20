import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export async function auditLog(input: {
  actorUserId?: string;
  action: string;
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata ?? {},
        ipAddress: input.ipAddress
      }
    });
  } catch (error) {
    // A failed audit insert must never crash a successful business operation.
    // Log to stderr so it surfaces in Vercel logs but does not propagate.
    console.error("[auditLog] Failed to write audit entry:", input.action, error);
  }
}
