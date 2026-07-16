import { ok } from "@/lib/api-response";

function mask(value: string | undefined): string {
  if (!value) return "❌ NO CONFIGURADO";
  if (value.length <= 8) return "✅ SET";
  return `✅ ${value.slice(0, 4)}${"*".repeat(value.length - 6)}${value.slice(-2)}`;
}

export async function GET() {
  const checks = {
    email: {
      RESEND_API_KEY: mask(process.env.RESEND_API_KEY),
      EMAIL_FROM: process.env.EMAIL_FROM ? `✅ ${process.env.EMAIL_FROM}` : "❌ NO CONFIGURADO",
      SMTP_fallback: process.env.SMTP_HOST ? `✅ ${process.env.SMTP_HOST}` : "— no configurado (OK si usas Resend)"
    },
    payments: {
      STRIPE_SECRET_KEY: mask(process.env.STRIPE_SECRET_KEY),
      STRIPE_PLATFORM_FEE_PERCENTAGE: process.env.STRIPE_PLATFORM_FEE_PERCENTAGE
        ? `✅ ${process.env.STRIPE_PLATFORM_FEE_PERCENTAGE}%`
        : "❌ NO CONFIGURADO (comisión en 0%)",
      STRIPE_WEBHOOK_SECRET: mask(process.env.STRIPE_WEBHOOK_SECRET)
    },
    app: {
      NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "— usando vitaeon.mx por defecto",
      NODE_ENV: process.env.NODE_ENV
    },
    database: {
      DATABASE_URL: process.env.DATABASE_URL ? "✅ configurado" : "❌ NO CONFIGURADO"
    }
  };

  return ok(checks);
}
