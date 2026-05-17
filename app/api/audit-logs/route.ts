import { fail, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "STAFF")) {
    return fail("FORBIDDEN", "Solo administración o staff pueden consultar auditoría.", 403);
  }

  const logs = await prisma.auditLog.findMany({
    include: {
      actor: {
        select: { email: true, name: true }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100
  });

  return ok(logs);
}
