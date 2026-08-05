import { describe, expect, it } from "vitest";
import { extractWhatsappDigits, toCanonicalWhatsappUrl, whatsappContactSchema } from "@/lib/validation/schemas";

describe("contacto de WhatsApp", () => {
  it("acepta número con prefijo internacional", () => {
    expect(whatsappContactSchema.parse("+525512345678")).toBe("https://wa.me/525512345678");
  });

  it("acepta número sin el signo +", () => {
    expect(whatsappContactSchema.parse("525512345678")).toBe("https://wa.me/525512345678");
  });

  it("acepta enlace wa.me", () => {
    expect(whatsappContactSchema.parse("https://wa.me/525512345678")).toBe("https://wa.me/525512345678");
  });

  it("acepta enlace api.whatsapp.com con parámetro phone", () => {
    expect(whatsappContactSchema.parse("https://api.whatsapp.com/send?phone=525512345678")).toBe(
      "https://wa.me/525512345678"
    );
  });

  it("normaliza espacios, guiones y paréntesis a un formato canónico único", () => {
    const variants = ["+52 477 123 4567", "52-477-123-4567", "+52 (477) 123 4567"];
    for (const variant of variants) {
      expect(whatsappContactSchema.parse(variant)).toBe("https://wa.me/524771234567");
    }
  });

  it("antepone lada de México a números nacionales de 10 dígitos", () => {
    // Sin esto el enlace wa.me queda incompleto y no abre conversación.
    expect(whatsappContactSchema.parse("477 123 4567")).toBe("https://wa.me/524771234567");
  });

  it("rechaza texto con letras", () => {
    expect(whatsappContactSchema.safeParse("mi whatsapp").success).toBe(false);
  });

  it("rechaza números demasiado cortos", () => {
    expect(whatsappContactSchema.safeParse("12345").success).toBe(false);
  });

  it("rechaza enlaces que no son de WhatsApp", () => {
    expect(whatsappContactSchema.safeParse("https://evil.com/525512345678").success).toBe(false);
  });

  it("extractWhatsappDigits devuelve null para entradas inválidas", () => {
    expect(extractWhatsappDigits("abc")).toBeNull();
    expect(extractWhatsappDigits("")).toBeNull();
  });

  it("toCanonicalWhatsappUrl produce el formato esperado", () => {
    expect(toCanonicalWhatsappUrl("525512345678")).toBe("https://wa.me/525512345678");
  });
});
