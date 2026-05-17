import { fail, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/session";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return fail("UNAUTHENTICATED", "No hay sesión activa.", 401);
  return ok(user);
}
