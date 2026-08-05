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

  // http en claro nunca: los documentos de verificación llevan datos personales.
  if (/^http:\/\//i.test(value)) {
    throw new Error("INSECURE_DOCUMENT_URL_NOT_ALLOWED");
  }

  // Enlace https alojado por el propio médico (Drive, OneDrive, Dropbox…).
  // Se conserva tal cual: es un recurso externo, no un objeto de nuestro storage.
  // El control de acceso lo aplica el proveedor del médico; VITAEON solo guarda
  // la referencia y la muestra únicamente a administración.
  if (/^https:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      if (url.protocol !== "https:") throw new Error("INSECURE_DOCUMENT_URL_NOT_ALLOWED");
      return url.toString();
    } catch {
      throw new Error("INVALID_DOCUMENT_URL");
    }
  }

  if (value.startsWith("private://")) return value;

  const sanitized = value.replace(/^\/+/, "").replace(/\s+/g, "-");
  return `private://${getStorageProvider()}/${getStorageBucket()}/${sanitized}`;
}

export function normalizePrivateDocumentRefs(inputs: string[]) {
  return inputs.map(normalizePrivateDocumentRef);
}

/** True si la referencia es un enlace externo abrible por administración. */
export function isExternalDocumentLink(reference: string) {
  return /^https:\/\//i.test(reference);
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
