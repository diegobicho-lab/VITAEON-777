"use client";

import { AlertTriangle, Loader2, MailWarning, ShieldCheck, Undo2 } from "lucide-react";
import { useState } from "react";
import { clientApi } from "@/services/client/api";
import type { RefundPolicy } from "@/types/domain";

/**
 * Avisos que el paciente debe ver ANTES de comprometerse con un pago.
 *
 * Se centralizan aquí para que el panel del paciente y el flujo de reserva
 * muestren exactamente el mismo texto y la misma lógica: si cambia una regla,
 * cambia en un solo sitio.
 */

export const REFUND_POLICY_COPY: Record<RefundPolicy, { label: string; description: string; tone: "ok" | "warn" | "info" }> = {
  ACCEPTS_REFUNDS: {
    label: "Este médico acepta devoluciones",
    description: "La devolución se procesa conforme a sus políticas de cancelación y al método de pago utilizado.",
    tone: "ok"
  },
  NO_REFUNDS: {
    label: "Este médico no ofrece devoluciones",
    description: "Si cancelas después de pagar, el importe no será reembolsado.",
    tone: "warn"
  },
  CASE_BY_CASE: {
    label: "Las devoluciones se revisan caso por caso",
    description: "Si necesitas cancelar, el médico o su equipo revisará tu solicitud y se pondrá en contacto contigo.",
    tone: "info"
  }
};

/** Política de cancelación y devolución del médico, visible antes de pagar. */
export function RefundPolicyNotice({
  policy,
  notes,
  compact = false
}: {
  policy?: RefundPolicy | null;
  notes?: string | null;
  compact?: boolean;
}) {
  const copy = REFUND_POLICY_COPY[policy ?? "CASE_BY_CASE"];
  const tone =
    copy.tone === "ok"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : copy.tone === "warn"
        ? "border-amber-200 bg-amber-50 text-amber-900"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-2xl border px-4 py-3 ${tone} ${compact ? "text-xs leading-5" : "text-sm leading-6"}`}>
      <p className="flex items-start gap-2 font-semibold">
        {copy.tone === "warn" ? (
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        ) : (
          <Undo2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        )}
        {copy.label}
      </p>
      <p className="mt-1 pl-6">{copy.description}</p>
      {notes && <p className="mt-1 pl-6 italic opacity-90">{notes}</p>}
    </div>
  );
}

/**
 * Aviso de correo sin verificar con acción de reenvío incorporada.
 *
 * Se muestra en el paso de selección de método de pago para que el paciente no
 * llegue a pulsar "pagar" creyendo que puede completar la reserva.
 */
export function EmailVerificationNotice({ onVerified }: { onVerified?: () => void }) {
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");

  async function resend() {
    if (sending) return;
    setSending(true);
    setMessage("");
    try {
      const result = await clientApi<{ sent?: boolean; alreadyVerified?: boolean; message: string }>(
        "/api/auth/verify-email/resend",
        { method: "POST", body: "{}" }
      );
      setMessage(result.message);
      if (result.alreadyVerified) onVerified?.();
    } catch (caught) {
      setMessage(
        caught instanceof Error ? caught.message : "No pudimos reenviar el correo. Intenta de nuevo en unos minutos."
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3.5">
      <p className="flex items-start gap-2 text-sm font-semibold leading-6 text-amber-900">
        <MailWarning className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Verifica tu correo para completar la reserva
      </p>
      <p className="mt-1 pl-6 text-sm leading-6 text-amber-800">
        Por seguridad de tu expediente, necesitamos confirmar tu correo antes de registrar la cita y procesar el pago.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3 pl-6">
        <button
          type="button"
          onClick={resend}
          disabled={sending}
          aria-busy={sending}
          className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {sending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          {sending ? "Enviando…" : "Reenviar enlace de verificación"}
        </button>
        {message && (
          <p role="status" aria-live="polite" className="text-sm font-semibold text-amber-900">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

/** Confirmación explícita antes de cancelar cuando no hay derecho a devolución. */
export function NoRefundConfirmation({ doctorName }: { doctorName: string }) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-900">
      <p className="flex items-start gap-2 font-semibold">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        Esta cancelación no tiene devolución
      </p>
      <p className="mt-1 pl-6">
        {doctorName} no acepta devoluciones para esta cita. Si continúas, la cita será cancelada y el pago no será
        reembolsado.
      </p>
    </div>
  );
}
