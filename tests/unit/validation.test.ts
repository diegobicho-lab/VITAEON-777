import { describe, expect, it } from "vitest";
import {
  appointmentCreateSchema,
  appointmentUpdateSchema,
  doctorVerificationSchema,
  hospitalCreateSchema,
  loginSchema,
  specialtyCreateSchema
} from "@/lib/validation/schemas";

describe("validaciones clínicas VITAEON", () => {
  it("rechaza accesos con contraseña demasiado corta", () => {
    expect(loginSchema.safeParse({ email: "paciente@vitaeon.mx", password: "123" }).success).toBe(false);
  });

  it("acepta una cita con horario real y pago en efectivo", () => {
    const result = appointmentCreateSchema.safeParse({
      doctorId: "doctor_1",
      availabilitySlotId: "slot_1",
      paymentMethod: "CASH",
      reason: "Dolor de cabeza recurrente"
    });

    expect(result.success).toBe(true);
  });

  it("acepta acciones seguras del ciclo de vida de citas", () => {
    expect(appointmentUpdateSchema.safeParse({ action: "ACCEPT" }).success).toBe(true);
    expect(appointmentUpdateSchema.safeParse({ action: "COMPLETE" }).success).toBe(true);
    expect(appointmentUpdateSchema.safeParse({ action: "MARK_NO_SHOW" }).success).toBe(true);
    expect(appointmentUpdateSchema.safeParse({ action: "REQUEST_RESCHEDULE", availabilitySlotId: "slot_2" }).success).toBe(true);
    expect(appointmentUpdateSchema.safeParse({ action: "REQUEST_CANCELLATION", cancellationReason: "Necesito cancelar la cita." }).success).toBe(true);
    expect(appointmentUpdateSchema.safeParse({ action: "MARK_REFUND_PENDING" }).success).toBe(true);
  });

  it("rechaza actualizaciones de cita sin acción o estado", () => {
    expect(appointmentUpdateSchema.safeParse({ cancellationReason: "Sin acción" }).success).toBe(false);
  });

  it("permite referencias privadas de documentos y rechaza cargas excesivas", () => {
    expect(
      doctorVerificationSchema.safeParse({
        doctorId: "doctor_1",
        professionalLicense: "ABC12345",
        documents: ["private://s3/vitaeon/doctor-id/cedula.pdf"]
      }).success
    ).toBe(true);

    expect(
      doctorVerificationSchema.safeParse({
        doctorId: "doctor_1",
        professionalLicense: "ABC12345",
        documents: Array.from({ length: 9 }, (_, index) => `doc-${index}.pdf`)
      }).success
    ).toBe(false);
  });

  it("normaliza catálogos médicos y rechaza nombres no profesionales", () => {
    const specialty = specialtyCreateSchema.safeParse({ name: "  Medicina Interna  " });
    const hospital = hospitalCreateSchema.safeParse({ name: " Hospital Ángeles León ", city: " León, Guanajuato " });

    expect(specialty.success && specialty.data.name).toBe("Medicina Interna");
    expect(hospital.success && hospital.data.name).toBe("Hospital Ángeles León");
    expect(specialtyCreateSchema.safeParse({ name: "<script>alert(1)</script>" }).success).toBe(false);
  });
});
