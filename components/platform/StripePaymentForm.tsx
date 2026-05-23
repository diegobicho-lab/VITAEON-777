"use client";

import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useState } from "react";

export function StripePaymentForm({ onPaid }: { onPaid: (paymentIntentId?: string) => Promise<void> | void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [status, setStatus] = useState<"idle" | "loading" | "error" | "success">("idle");
  const [message, setMessage] = useState("");

  async function submitPayment() {
    if (!stripe || !elements) return;
    setStatus("loading");
    setMessage("");

    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required"
    });

    if (result.error) {
      setStatus("error");
      setMessage(result.error.message ?? "No pudimos confirmar el pago todavía. Intenta actualizar en unos segundos.");
      return;
    }

    setMessage("Pago recibido. Estamos actualizando tu cita como pagada y aceptada automáticamente.");
    try {
      await onPaid(result.paymentIntent?.id);
      setStatus("success");
      setMessage("Pago confirmado. Tu cita quedó pagada y aceptada automáticamente.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Tu pago fue recibido, pero no pudimos actualizar tu cita todavía. Intenta actualizar en unos segundos.");
    }
  }

  return (
    <div className="mt-5 rounded-[2rem] border border-silver bg-white p-5 shadow-sm">
      <PaymentElement />
      <button
        type="button"
        onClick={submitPayment}
        disabled={!stripe || status === "loading"}
        className="mt-5 w-full rounded-full bg-black px-6 py-4 font-semibold text-white transition hover:bg-deep disabled:cursor-not-allowed disabled:opacity-60"
      >
        {status === "loading" ? "Procesando pago..." : "Continuar con pago seguro"}
      </button>
      {message && (
        <p className={`mt-3 text-sm ${status === "error" ? "text-red-600" : "text-medical"}`}>{message}</p>
      )}
    </div>
  );
}
