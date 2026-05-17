import "server-only";

const DEFAULT_PROVIDER = "local-dev";
const DEFAULT_BUCKET = "vitaeon-verifications";

function getStorageProvider() {
  return process.env.STORAGE_PROVIDER || DEFAULT_PROVIDER;
}

function getStorageBucket() {
  return process.env.STORAGE_BUCKET || DEFAULT_BUCKET;
}

export function normalizePrivateDocumentRef(input: string) {
  const value = input.trim();
  if (!value) throw new Error("DOCUMENT_REFERENCE_REQUIRED");

  if (/^https?:\/\//i.test(value)) {
    throw new Error("PUBLIC_DOCUMENT_URL_NOT_ALLOWED");
  }

  if (value.startsWith("private://")) return value;

  const sanitized = value.replace(/^\/+/, "").replace(/\s+/g, "-");
  return `private://${getStorageProvider()}/${getStorageBucket()}/${sanitized}`;
}

export function normalizePrivateDocumentRefs(inputs: string[]) {
  return inputs.map(normalizePrivateDocumentRef);
}

export async function createPrivateDocumentReadToken(reference: string) {
  if (!reference.startsWith("private://")) throw new Error("INVALID_PRIVATE_DOCUMENT_REFERENCE");

  return {
    reference,
    expiresInSeconds: 300,
    readUrl: null,
    message:
      "Storage privado preparado. Conecta S3, Supabase Storage u otro proveedor para generar URLs firmadas temporales."
  };
}
