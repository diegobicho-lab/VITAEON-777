import { describe, expect, it } from "vitest";
import { normalizePrivateDocumentRef } from "@/lib/storage/private-documents";

describe("storage privado de verificación médica", () => {
  it("convierte rutas internas a referencias privadas", () => {
    expect(normalizePrivateDocumentRef("doctors/doctor-id/cedula.pdf")).toContain("private://");
  });

  it("bloquea URLs públicas directas", () => {
    expect(() => normalizePrivateDocumentRef("https://example.com/cedula.pdf")).toThrow(
      "PUBLIC_DOCUMENT_URL_NOT_ALLOWED"
    );
  });
});
