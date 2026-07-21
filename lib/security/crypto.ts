import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error("ENCRYPTION_KEY is required for sensitive medical fields");

  const decoded = Buffer.from(key, "base64");
  if (decoded.length !== 32) throw new Error("ENCRYPTION_KEY must be a 32-byte base64 value");

  return decoded;
}

export function encryptSensitiveText(value: string) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decryptSensitiveText(payload: string) {
  const buffer = Buffer.from(payload, "base64");
  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function canEncryptSensitiveData() {
  try {
    getEncryptionKey();
    return true;
  } catch {
    return false;
  }
}

export function sealSensitiveText(value?: string | null) {
  if (!value) return null;

  if (canEncryptSensitiveData()) {
    return `enc:v1:${encryptSensitiveText(value)}`;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("ENCRYPTION_KEY is required in production for sensitive medical fields");
  }

  return `dev:v1:${Buffer.from(value, "utf8").toString("base64")}`;
}

export function openSensitiveText(value?: string | null) {
  if (!value) return null;

  if (value.startsWith("enc:v1:")) {
    try {
      return decryptSensitiveText(value.slice("enc:v1:".length));
    } catch {
      // Encrypted with a different key (e.g. dev seed data or rotated key).
      // Return null rather than crashing — callers treat null as "not provided".
      console.warn("[crypto] openSensitiveText: decryption failed (wrong key or corrupted data)");
      return null;
    }
  }

  if (value.startsWith("dev:v1:")) {
    return Buffer.from(value.slice("dev:v1:".length), "base64").toString("utf8");
  }

  return value;
}
