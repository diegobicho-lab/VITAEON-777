import { getCurrentUser } from "@/lib/auth/session";
import { fail, ok } from "@/lib/api-response";

function mask(value: string | undefined): string {
  if (!value) return "❌ NO CONFIGURADO";
  if (value.length <= 8) return "✅ SET";
  return `✅ ${value.slice(0, 4)}${"*".repeat(value.length - 6)}${value.slice(-2)}`;
}

export async function GET() {
  // Requiere sesión de administrador — nunca exponer config a usuarios anónimos
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return fail("FORBIDDEN", "Solo administradores pueden ver el estado del sistema.", 403);
  }

  const encryptionKeySet = Boolean(process.env.ENCRYPTION_KEY);
  const supabaseConfigured = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
  const storageProvider = process.env.STORAGE_PROVIDER || "local-dev";

  const platformFeeRaw = process.env.STRIPE_PLATFORM_FEE_PERCENTAGE;
  const platformFee = Number(platformFeeRaw ?? "0");
  const feeOk = Number.isFinite(platformFee) && platformFee > 0;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisOk = Boolean(redisUrl && redisToken);

  const cronSecret = process.env.CRON_SECRET;

  const checks = {
    email: {
      RESEND_API_KEY: mask(process.env.RESEND_API_KEY),
      EMAIL_FROM: process.env.EMAIL_FROM ? `✅ ${process.env.EMAIL_FROM}` : "❌ NO CONFIGURADO",
      SMTP_fallback: process.env.SMTP_HOST ? `✅ ${process.env.SMTP_HOST}` : "— no configurado (OK si usas Resend)"
    },
    payments: {
      STRIPE_SECRET_KEY: mask(process.env.STRIPE_SECRET_KEY),
      STRIPE_PLATFORM_FEE_PERCENTAGE: feeOk
        ? `✅ ${platformFeeRaw}% configurado — plataforma cobra comisión`
        : "❌ NO CONFIGURADO o cero — pagos en línea bloqueados en producción",
      STRIPE_WEBHOOK_SECRET: mask(process.env.STRIPE_WEBHOOK_SECRET),
      webhookIdempotency: redisOk
        ? "✅ Redis activo — eventos Stripe son idempotentes"
        : "❌ Redis no configurado — riesgo de duplicados en webhooks"
    },
    security: {
      ENCRYPTION_KEY: encryptionKeySet
        ? "✅ configurado (campos médicos cifrados)"
        : "❌ NO CONFIGURADO — historiales médicos sin cifrar en la DB",
      AUTH_SECRET: process.env.AUTH_SECRET ? "✅ configurado" : "❌ NO CONFIGURADO"
    },
    storage: {
      STORAGE_PROVIDER:
        storageProvider === "supabase"
          ? "✅ supabase"
          : `⚠️ ${storageProvider} — médicos no pueden subir fotos en producción`,
      SUPABASE_URL: process.env.SUPABASE_URL
        ? `✅ ${process.env.SUPABASE_URL.slice(0, 30)}...`
        : "❌ NO CONFIGURADO",
      SUPABASE_SERVICE_ROLE_KEY: mask(process.env.SUPABASE_SERVICE_ROLE_KEY),
      STORAGE_BUCKET: process.env.STORAGE_BUCKET
        ? `✅ ${process.env.STORAGE_BUCKET}`
        : "⚠️ usando bucket por defecto: vitaeon-verifications",
      imageUploadsReady:
        supabaseConfigured && storageProvider === "supabase"
          ? "✅ imágenes de médicos funcionando"
          : "❌ médicos NO pueden subir fotos — configura SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY + STORAGE_PROVIDER=supabase"
    },
    infrastructure: {
      redis: redisOk
        ? "✅ Upstash Redis configurado (rate-limiting + idempotencia)"
        : "❌ UPSTASH_REDIS_REST_URL / TOKEN no configurados — rate-limiting y dedup de webhooks inactivos",
      cron: cronSecret
        ? "✅ CRON_SECRET configurado — cron de auto-cancelación protegido"
        : "❌ CRON_SECRET no configurado — endpoint /api/cron/auto-cancel sin autenticación"
    },
    subscriptions: {
      amatistaGate:
        "✅ gate verifica medal === 'amatista' AND subscriptionStatus === 'ACTIVE' (fuga de ingresos corregida)"
    },
    app: {
      NEXT_PUBLIC_APP_URL:
        process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "⚠️ usando vitaeon.mx por defecto",
      NODE_ENV: process.env.NODE_ENV
    },
    database: {
      DATABASE_URL: process.env.DATABASE_URL ? "✅ configurado" : "❌ NO CONFIGURADO"
    }
  };

  return ok(checks);
}
