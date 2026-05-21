# Estado de Stripe para VITAEON Beta

Este documento separa los cobros de citas, las suscripciones médicas y los puntos que deben configurarse antes de operar pagos reales.

## Variables requeridas

- `STRIPE_SECRET_KEY`: clave secreta de Stripe en modo test o live.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: clave pública para el frontend.
- `STRIPE_WEBHOOK_SECRET`: secreto del webhook configurado en Stripe.
- `STRIPE_PLATFORM_FEE_PERCENTAGE`: comisión de plataforma para citas. Actualmente debe iniciar en `0`.
- `APP_URL` o `NEXT_PUBLIC_APP_URL`: URL pública de VITAEON para retornos de Stripe Connect y Checkout.

## Webhook

Endpoint esperado:

```txt
https://vitaeon-777.vercel.app/api/webhooks/stripe
```

Eventos cubiertos por backend:

- `checkout.session.completed`
- `checkout.session.expired`
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `charge.refunded`
- `account.updated`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

## Citas en línea

Los pagos de citas usan `PaymentIntent` con Stripe Connect mediante `transfer_data.destination`.

Requisitos:

- El médico debe completar onboarding de Stripe Connect.
- El médico debe tener `chargesEnabled=true` y `payoutsEnabled=true`.
- Si el médico no tiene cuenta lista, el paciente verá: “Para recibir pagos en línea primero configura tu cuenta de cobro.”
- Los reembolsos de citas se procesan sobre el `payment_intent` de la cita, no sobre pagos de suscripción.

## Suscripciones médicas

Los planes Diamante y Amatista usan Stripe Checkout en la cuenta principal de VITAEON. No usan destination charges hacia médicos.

Estado actual:

- Oro: gratis, activación interna.
- Diamante: Checkout de pago único a plataforma.
- Amatista: Checkout de pago único a plataforma.

Pendiente para una etapa posterior:

- Convertir Diamante y Amatista a Billing recurrente con `priceId` oficiales si se desea cobro mensual automático.

## Qué revisar si aparece un error

1. Que `STRIPE_SECRET_KEY` exista en Vercel.
2. Que `APP_URL` apunte a la URL pública correcta.
3. Que el webhook esté registrado en Stripe con el endpoint anterior.
4. Que `STRIPE_WEBHOOK_SECRET` sea el secreto del endpoint de webhook, no una API key.
5. Que el médico haya completado Stripe Connect antes de intentar recibir pagos de citas.
