import { describe, expect, it, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const deleteMany = vi.fn();
const auditLogSpy = vi.fn();

vi.mock("@/lib/db/prisma", () => ({
  prisma: { auditLog: { findMany: (...a: unknown[]) => findMany(...a), deleteMany: (...a: unknown[]) => deleteMany(...a) } }
}));
vi.mock("@/lib/audit/audit", () => ({ auditLog: (...a: unknown[]) => auditLogSpy(...a) }));
vi.mock("@/lib/appointments/auto-cancel", () => ({ autoCancelExpiredAppointments: vi.fn() }));
vi.mock("@/lib/email/mailer", () => ({
  sendTransactionalEmail: vi.fn(),
  emailShell: vi.fn(),
  emailButton: vi.fn()
}));

const { purgeExpiredAuditLogs } = await import("@/lib/cron/jobs");

const NOW = new Date("2026-08-05T12:00:00.000Z");

beforeEach(() => {
  findMany.mockReset();
  deleteMany.mockReset();
  auditLogSpy.mockReset();
});

describe("purga de registros de auditoría", () => {
  it("aplica 24 meses a las acciones sensibles y 3 a las de solo lectura", async () => {
    findMany.mockResolvedValue([]);
    await purgeExpiredAuditLogs(NOW);

    const where = findMany.mock.calls[0][0].where;
    const [completo, soloLectura] = where.OR;

    // Periodo completo: 24 meses atrás => agosto 2024
    expect(completo.createdAt.lt.toISOString().slice(0, 7)).toBe("2024-08");
    // Solo lectura: 3 meses atrás => mayo 2026
    expect(soloLectura.createdAt.lt.toISOString().slice(0, 7)).toBe("2026-05");
    expect(soloLectura.action.in).toContain("LOGIN_SUCCESS");
    expect(soloLectura.action.in).toContain("VIEW_ADMIN_DOCTORS");
  });

  // Las acciones que tocan un expediente deben sobrevivir el periodo completo:
  // son las que importan para trazabilidad clínica.
  it("no incluye acciones clínicas en la purga corta", async () => {
    findMany.mockResolvedValue([]);
    await purgeExpiredAuditLogs(NOW);

    const accionesCortas = findMany.mock.calls[0][0].where.OR[1].action.in;
    for (const sensible of [
      "CREATE_APPOINTMENT",
      "VIEW_APPOINTMENT",
      "REVIEW_MEDICAL_VERIFICATION",
      "APPROVE_REFUND",
      "UPDATE_DOCTOR_PROFILE"
    ]) {
      expect(accionesCortas).not.toContain(sensible);
    }
  });

  it("borra por lotes y respeta el tope", async () => {
    findMany.mockResolvedValue([{ id: "a" }, { id: "b" }]);
    deleteMany.mockResolvedValue({ count: 2 });

    const r = await purgeExpiredAuditLogs(NOW);

    expect(findMany.mock.calls[0][0].take).toBe(5000);
    expect(deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["a", "b"] } } });
    expect(r.deleted).toBe(2);
    expect(r.reachedBatchLimit).toBe(false);
  });

  it("avisa cuando quedan filas para el día siguiente", async () => {
    findMany.mockResolvedValue(Array.from({ length: 5000 }, (_, i) => ({ id: String(i) })));
    deleteMany.mockResolvedValue({ count: 5000 });

    const r = await purgeExpiredAuditLogs(NOW);
    expect(r.reachedBatchLimit).toBe(true);
  });

  it("no toca la base cuando no hay nada vencido", async () => {
    findMany.mockResolvedValue([]);
    const r = await purgeExpiredAuditLogs(NOW);

    expect(deleteMany).not.toHaveBeenCalled();
    expect(r.deleted).toBe(0);
  });

  // Registrar "borré 0 filas" cada día haría crecer justo la tabla que
  // intentamos contener.
  it("solo se audita a sí misma cuando borró algo", async () => {
    findMany.mockResolvedValue([]);
    await purgeExpiredAuditLogs(NOW);
    expect(auditLogSpy).not.toHaveBeenCalled();

    findMany.mockResolvedValue([{ id: "a" }]);
    deleteMany.mockResolvedValue({ count: 1 });
    await purgeExpiredAuditLogs(NOW);
    expect(auditLogSpy).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CRON_PURGE_AUDIT_LOGS" })
    );
  });

  it("borra primero lo más antiguo", async () => {
    findMany.mockResolvedValue([]);
    await purgeExpiredAuditLogs(NOW);
    expect(findMany.mock.calls[0][0].orderBy).toEqual({ createdAt: "asc" });
  });
});
