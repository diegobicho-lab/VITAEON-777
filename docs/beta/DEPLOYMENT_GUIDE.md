# Deployment Guide VITAEON Beta

## Vercel

1. Conectar repositorio.
2. Configurar build command: `npm run build`.
3. Configurar install command: `npm install`.
4. Configurar framework: Next.js.
5. Agregar variables de entorno de producción beta.

## PostgreSQL

Usar Supabase, Railway, Neon o proveedor PostgreSQL equivalente.

Variables:

- `DATABASE_URL`

Comandos:

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

## Stripe Test

Variables:

- `STRIPE_SECRET_KEY`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `APP_URL`

Webhook recomendado:

```text
POST https://tu-dominio.com/api/webhooks/stripe
```

Eventos mínimos:

- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `checkout.session.completed`
- `checkout.session.expired`

## SMTP

Variables:

- `EMAIL_FROM`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASSWORD`
- `SMTP_SECURE`
- `SMTP_STARTTLS`

Configurar SPF, DKIM y DMARC antes de usar correos con pacientes reales.

## Storage

Para documentos médicos usar proveedor privado con URLs firmadas.

Variables:

- `STORAGE_PROVIDER`
- `STORAGE_BUCKET`
- `STORAGE_REGION`
- `STORAGE_ACCESS_KEY_ID`
- `STORAGE_SECRET_ACCESS_KEY`
- `STORAGE_PRIVATE_BASE_PATH`

## SEO Beta

Por defecto `BETA_ALLOW_INDEXING=false` bloquea indexación en robots. Activar solo cuando existan perfiles reales aprobados y revisión legal.

## Checklist Deployment

- PostgreSQL responde.
- Migraciones aplicadas.
- Seed limpio ejecutado.
- Stripe test configurado.
- Webhook Stripe activo.
- SMTP probado.
- `AUTH_SECRET` fuerte.
- `ENCRYPTION_KEY` base64 de 32 bytes.
- HTTPS activo.
- `npm run build` correcto.
