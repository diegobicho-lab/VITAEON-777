import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { MedicalMedal } from "@prisma/client";
import { NextResponse } from "next/server";
import { fail, ok } from "@/lib/api-response";
import { auditLog } from "@/lib/audit/audit";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";

const allowedTypes = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);

const allowedKinds = new Set(["profile", "office", "license", "commercial-logo", "prescription-header", "prescription-signature"]);
const maxBytes = 3 * 1024 * 1024;

function getStorageConfig() {
  return {
    supabaseUrl: process.env.SUPABASE_URL?.replace(/\/+$/, ""),
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    bucket: process.env.STORAGE_BUCKET || "vitaeon-verifications",
    basePath: (process.env.STORAGE_PRIVATE_BASE_PATH || "doctor-profile-assets").replace(/^\/+|\/+$/g, "")
  };
}

function getImageField(kind: string) {
  if (kind === "profile") return "imageUrl";
  if (kind === "office") return "practicePhotoUrl";
  if (kind === "license") return "professionalLicensePhotoUrl";
  return null;
}

async function uploadToSupabaseStorage(params: {
  bytes: Buffer;
  contentType: string;
  filename: string;
  userId: string;
}) {
  const { supabaseUrl, serviceRoleKey, bucket, basePath } = getStorageConfig();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_STORAGE_NOT_CONFIGURED");
  }

  const objectPath = `${basePath}/${params.userId}/${params.filename}`;
  const uploadUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${objectPath}`;
  const uploadBuffer = params.bytes.buffer.slice(
    params.bytes.byteOffset,
    params.bytes.byteOffset + params.bytes.byteLength
  ) as ArrayBuffer;
  const uploadBody = new Blob([uploadBuffer], { type: params.contentType });
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey,
      "Content-Type": params.contentType,
      "Cache-Control": "3600",
      "x-upsert": "true"
    },
    body: uploadBody
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[Supabase image upload error]", response.status, detail);
    throw new Error("SUPABASE_STORAGE_UPLOAD_FAILED");
  }

  return `/api/uploads/images?path=${encodeURIComponent(objectPath)}`;
}

async function uploadToLocalPublicFolder(params: {
  bytes: Buffer;
  filename: string;
  userId: string;
}) {
  const relativeDir = `/uploads/doctors/${params.userId}`;
  const publicDir = path.join(process.cwd(), "public", relativeDir);
  await mkdir(publicDir, { recursive: true });
  await writeFile(path.join(publicDir, params.filename), params.bytes);
  return `${relativeDir}/${params.filename}`;
}

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

  const doctor = await prisma.doctor.findUnique({ where: { userId: user.id }, select: { id: true, medal: true } });
  if (doctor?.medal === MedicalMedal.obsidiana && kind !== "commercial-logo") {
    return fail("OBSIDIAN_LOGO_ONLY", "Obsidiana solo puede subir imagen o logo comercial.", 403);
  }

  const extension = allowedTypes.get(file.type);
  const filename = `${kind}-${randomUUID()}.${extension}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const storageProvider = process.env.STORAGE_PROVIDER || "local-dev";

  let url: string;
  try {
    if (storageProvider === "supabase") {
      url = await uploadToSupabaseStorage({
        bytes,
        contentType: file.type,
        filename,
        userId: user.id
      });
    } else if (process.env.VERCEL === "1" || process.env.NODE_ENV === "production") {
      return fail(
        "STORAGE_NOT_CONFIGURED",
        "El almacenamiento de imágenes no está configurado. Configura Supabase Storage antes de subir fotografías en producción.",
        503
      );
    } else {
      url = await uploadToLocalPublicFolder({ bytes, filename, userId: user.id });
    }
  } catch (error) {
    console.error("[Doctor image upload error]", error);
    return fail(
      "IMAGE_UPLOAD_FAILED",
      "No fue posible subir la imagen. Revisa la configuración de almacenamiento e intenta de nuevo.",
      500
    );
  }

  const imageField = getImageField(kind);
  if (imageField) {
    if (doctor) {
      await prisma.doctor.update({
        where: { id: doctor.id },
        data: { [imageField]: url }
      });
      await auditLog({
        actorUserId: user.id,
        action: "UPLOAD_DOCTOR_IMAGE",
        entityType: "Doctor",
        entityId: doctor.id,
        metadata: { kind, imageField }
      });
    }
  }

  return ok({ url }, { status: 201 });
}

export async function GET(request: Request) {
  const { supabaseUrl, serviceRoleKey, bucket, basePath } = getStorageConfig();
  if (!supabaseUrl || !serviceRoleKey) return fail("STORAGE_NOT_CONFIGURED", "Storage no configurado.", 503);

  const url = new URL(request.url);
  const objectPath = url.searchParams.get("path") ?? "";
  const normalizedPath = objectPath.replace(/\\/g, "/").replace(/^\/+/, "");
  const pathSegments = normalizedPath.split("/");
  const safePath = path.posix.normalize(normalizedPath);

  if (
    !normalizedPath ||
    normalizedPath.includes("\0") ||
    pathSegments.some((segment) => segment === "..") ||
    safePath === "." ||
    safePath.startsWith("../")
  ) {
    return fail("INVALID_IMAGE_PATH", "Ruta de imagen inválida.", 422);
  }

  // Profile photos are public (visible on the specialist listing to all visitors).
  // Medical verifications and license photos are private — require authentication.
  const publicPrefixes = ["doctor-profile-assets/"];
  const privatePrefixes = [`${basePath}/`, "medical-verifications/"];
  const isPublic = publicPrefixes.some((prefix) => safePath.startsWith(prefix));
  const isAllowed = isPublic || privatePrefixes.some((prefix) => safePath.startsWith(prefix));

  if (!isAllowed) return fail("INVALID_IMAGE_PATH", "Ruta de imagen inválida.", 422);

  if (!isPublic) {
    // Private assets — require an authenticated session.
    const user = await getCurrentUser();
    if (!user) return fail("UNAUTHENTICATED", "Inicia sesión para acceder a imágenes.", 401);
  }

  const storageUrl = `${supabaseUrl}/storage/v1/object/${bucket}/${safePath}`;
  const response = await fetch(storageUrl, {
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      apikey: serviceRoleKey
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("[Supabase image read error]", response.status, detail);
    return fail("IMAGE_NOT_FOUND", "No fue posible cargar la imagen.", response.status === 404 ? 404 : 502);
  }

  const contentType = response.headers.get("content-type") || "application/octet-stream";
  const body = await response.arrayBuffer();
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300"
    }
  });
}
