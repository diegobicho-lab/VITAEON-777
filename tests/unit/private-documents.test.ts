import { describe, expect, it } from "vitest";
import { isExternalDocumentLink, normalizePrivateDocumentRef } from "@/lib/storage/private-documents";

describe("storage privado de verificación médica", () => {
  it("convierte rutas internas a referencias privadas", () => {
    expect(normalizePrivateDocumentRef("doctors/doctor-id/cedula.pdf")).toContain("private://");
  });

  it("conserva referencias privadas ya normalizadas", () => {
    const reference = "private://local-dev/vitaeon-verifications/cedula.pdf";
    expect(normalizePrivateDocumentRef(reference)).toBe(reference);
  });

  // Cambio deliberado de comportamiento: antes se rechazaba TODA URL http(s), lo
  // que hacía imposible enviar la verificación porque el propio formulario pide
  // un enlace de Drive. Ahora se aceptan enlaces https (recurso externo del
  // médico, visible solo para administración) y se sigue bloqueando http.
  it("acepta enlaces https compartidos por el médico", () => {
    expect(normalizePrivateDocumentRef("https://drive.google.com/file/d/abc/view")).toBe(
      "https://drive.google.com/file/d/abc/view"
    );
  });

  it("bloquea http en claro para no exponer documentos sensibles", () => {
    expect(() => normalizePrivateDocumentRef("http://example.com/cedula.pdf")).toThrow(
      "INSECURE_DOCUMENT_URL_NOT_ALLOWED"
    );
  });

  it("rechaza referencias vacías", () => {
    expect(() => normalizePrivateDocumentRef("   ")).toThrow("DOCUMENT_REFERENCE_REQUIRED");
  });

  it("distingue enlaces externos de referencias privadas", () => {
    expect(isExternalDocumentLink("https://drive.google.com/x")).toBe(true);
    expect(isExternalDocumentLink("private://local-dev/bucket/x.pdf")).toBe(false);
  });
});
