import { fail, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para ver notificaciones.", 401);

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 50
  });

  return ok(notifications);
}

export async function PATCH(request: Request) {
  const limit = await rateLimitByIp("notifications:update", { limit: 60, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas actualizaciones de notificaciones.", 429);

  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para actualizar notificaciones.", 401);

  const body = await request.json().catch(() => null);
  const notificationId = typeof body?.notificationId === "string" ? body.notificationId : null;

  if (notificationId) {
    const updated = await prisma.notification.updateMany({
      where: { id: notificationId, userId: user.id },
      data: { isRead: true }
    });
    return ok({ updated: updated.count });
  }

  const updated = await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true }
  });
  return ok({ updated: updated.count });
}
