import { ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { clearSessionCookie, getCurrentUser } from "@/lib/auth/session";

export async function POST() {
  const user = await getCurrentUser();
  await clearSessionCookie();

  if (user) {
    await auditLog({
      actorUserId: user.id,
      action: "LOGOUT",
      entityType: "User",
      entityId: user.id
    });
  }

  return ok({ signedOut: true });
}
