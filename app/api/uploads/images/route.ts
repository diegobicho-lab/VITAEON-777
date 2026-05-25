import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fail, ok } from "@/lib/api-response";
import { getCurrentUser } from "@/lib/auth/session";
import { rateLimitByIp } from "@/lib/security/rate-limit";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

const allowedKinds = new Set(["profile", "office", "license", "prescription-header", "prescription-signature"]);
const maxBytes = 3 * 1024 * 1024;

export async function POST(request: Request) {
  const limit = await rateLimitByIp("uploads:images", { limit: 20, windowMs: 60_000 });
  if (!limit.allowed) return fail("RATE_LIMITED", "Demasiadas subidas de imagen. Intenta en un momento.", 429);

  const user = await getCurrentUser();
  if (!user || user.role !== "DOCTOR") return fail("FORBIDDEN", "Solo médicos pueden subir imágenes de perfil.", 403);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const kind = String(form?.get("kind") ?? "");

  if (!allowedKinds.has(kind)) return fail("INVALID_IMAGE_KIND", "Tipo de imagen inválido.", 422);
  if (!(file instanceof File)) return fail("FILE_REQUIRED", "Selecciona una imagen.", 422);
  if (!allowedTypes.has(file.type)) return fail("INVALID_FILE_TYPE", "Solo se aceptan imágenes JPG, PNG o WebP.", 422);
  if (file.size > maxBytes) return fail("FILE_TOO_LARGE", "La imagen debe pesar máximo 3 MB.", 422);

  const extension = allowedTypes.get(file.type);
  const relativeDir = `/uploads/doctors/${user.id}`;
  const filename = `${kind}-${randomUUID()}.${extension}`;
  const publicDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(publicDir, { recursive: true });
  await writeFile(path.join(publicDir, filename), Buffer.from(await file.arrayBuffer()));

  return ok({ url: `${relativeDir}/${filename}` }, { status: 201 });
}
