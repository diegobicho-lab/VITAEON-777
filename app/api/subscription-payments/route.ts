import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para ver ingresos de suscripciones.", 401);
  if (user.role !== "ADMIN" && user.role !== "STAFF") {
    return fail("FORBIDDEN", "Solo administración puede ver ingresos de suscripciones.", 403);
  }

  const payments = await prisma.subscriptionPayment.findMany({
    include: {
      user: {
        select: {
          email: true,
          doctor: {
            select: {
              id: true,
              fullName: true,
              subscriptionStatus: true
            }
          }
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  await auditLog({
    actorUserId: user.id,
    action: "VIEW_SUBSCRIPTION_PAYMENTS",
    entityType: "SubscriptionPayment",
    metadata: { count: payments.length }
  });

  return ok(
    payments.map((payment) => ({
      id: payment.id,
      plan: payment.plan,
      status: payment.status,
      provider: payment.provider,
      amountCents: payment.amountCents,
      currency: payment.currency,
      createdAt: payment.createdAt,
      doctor: {
        id: payment.user.doctor?.id ?? "",
        fullName: payment.user.doctor?.fullName ?? "Médico sin perfil",
        email: payment.user.email,
        subscriptionStatus: payment.user.doctor?.subscriptionStatus ?? "PENDING"
      }
    }))
  );
}
