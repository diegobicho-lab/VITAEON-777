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
https://vitaeon.mx/api/webhooks/stripe
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
- Si el médico no tiene cuenta lista, VITAEON bloquea el pago en línea para evitar que dinero de citas quede en la cuenta de plataforma. El paciente puede elegir pago en efectivo o intentar más tarde.
- Los reembolsos de citas se procesan sobre el `payment_intent` de la cita, no sobre pagos de suscripción.

## Suscripciones médicas

Los planes médicos usan Stripe Checkout/Billing en la cuenta principal de VITAEON. No usan destination charges hacia médicos.

Estado actual:

- Oro: gratis, activación interna.
- Diamante: suscripción quincenal a plataforma.
- Amatista: suscripción quincenal a plataforma.
- Obsidiana: suscripción mensual comercial a plataforma; redirige al panel comercial y no da acceso al panel médico.

Nota: Obsidiana también puede administrarse desde el marketplace para representantes médicos/catering con el mismo precio base definido por `OBSIDIANA_PRICE_CENTS`.

## Qué revisar si aparece un error

1. Que `STRIPE_SECRET_KEY` exista en Vercel.
2. Que `APP_URL` apunte a la URL pública correcta.
3. Que el webhook esté registrado en Stripe con el endpoint canónico de `vitaeon.mx`.
4. Que `STRIPE_WEBHOOK_SECRET` sea el secreto del endpoint de webhook, no una API key.
5. Que el médico haya completado Stripe Connect antes de intentar recibir pagos de citas.
