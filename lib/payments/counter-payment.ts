/**
 * Cobro hecho en el consultorio.
 *
 * `PRODUCT.md` lo define así: el cobro en consultorio lo registra quien tenga el
 * contexto — la secretaria cuando hay recepción, el médico cuando atiende sin
 * ella. No es un rol fijo, así que el mismo predicado tiene que gobernar las dos
 * interfaces.
 *
 * Vivía duplicado dentro de `SecretaryPortal.tsx` y el panel del médico ni
 * siquiera exponía la acción, aunque el backend lleva días autorizándola. Dos
 * copias de una regla de dinero divergen en cuanto alguien toca una.
 */

/** Formas de pago que se liquidan en el mostrador, fuera de Stripe. */
const PROVEEDORES_EN_MOSTRADOR = ["CASH", "TRANSFER"] as const;

/**
 * ¿Este pago se puede marcar como cobrado desde la interfaz?
 *
 * Solo efectivo y transferencia. Los pagos de Stripe los confirma el webhook
 * contra el dinero real: marcarlos a mano dejaría a la plataforma afirmando un
 * cobro que Stripe no respalda.
 */
export function esCobrableEnMostrador(payment?: {
  provider: string;
  status: string;
} | null): boolean {
  if (!payment) return false;
  return (
    (PROVEEDORES_EN_MOSTRADOR as readonly string[]).includes(payment.provider) &&
    payment.status === "PENDING"
  );
}

/** Nombre del método de pago en el idioma del producto. */
export function nombreMetodoPago(provider: string): string {
  if (provider === "CASH") return "Efectivo";
  if (provider === "TRANSFER") return "Transferencia";
  return "En línea";
}
