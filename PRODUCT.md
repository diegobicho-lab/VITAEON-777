# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Mercado de dos lados genuino: ninguno de los dos es secundario y el diseño debe
servirlos con el mismo peso.

- **Pacientes** en León, Guanajuato, que buscan un especialista privado de
  confianza. Llegan sin cuenta previa, comparan médicos, agendan y pagan la
  consulta en línea antes de asistir.
- **Médicos especialistas** que operan consulta privada. Pagan una suscripción
  por plan (`oro`, `obsidiana`, `diamante`, `amatista`) y usan la plataforma
  como su consultorio: agenda, cobros, expediente y pacientes.
- **Secretarias** de esos médicos, con acceso por enlace y PIN, sin cuenta
  propia. Trabajan desde el panel para informar al médico de sus próximas citas
  y agendar por teléfono.
- **Administración de VITAEON**, que verifica a cada médico antes de publicarlo
  y supervisa pagos, auditoría y contenido.

## Product Purpose

Conectar pacientes con especialistas privados verificados de León y, al mismo
tiempo, darle al médico la operación completa de su consulta. El éxito es doble:
el paciente llega a una consulta real con un médico que existe y está
acreditado, y el médico llena su agenda sin montar su propia infraestructura.

## Positioning

El diferenciador es el **consultorio completo para el médico**: agenda,
secretaría virtual, expediente clínico y asistente con IA en un solo lugar, no
solo captación de pacientes. Un directorio médico puede listar al mismo
especialista, pero no puede decir con verdad que opera su consulta.

Esto se sostiene además sobre una red **curada y local**: catálogo real de
especialidades y hospitales privados de León, con verificación de cédula
profesional y credenciales revisada por administración antes de que un médico
aparezca. No es alta libre.

## Operating Context

- El paciente descubre por especialidad o por médico, revisa el perfil, elige un
  horario disponible y paga antes de la consulta.
- El médico publica disponibilidad en un calendario mensual, con repetición
  semanal, bloqueo de días y horarios día por día; acepta, reagenda o cancela
  citas.
- La cancelación puede originarse del paciente o del médico y dispara una
  devolución sujeta a la política de reembolso de cada médico.
- La secretaria entra por enlace con PIN, ve las próximas citas del médico y
  puede agendar pacientes que llaman por teléfono.
- **El cobro en consultorio lo registra quien tenga el contexto:** la secretaria
  cuando hay recepción, el médico cuando atiende sin ella. No es rol fijo. Las
  citas agendadas por teléfono nacen con el pago pendiente y se liquidan en
  efectivo o transferencia al llegar, fuera de Stripe.
- Todo ocurre en horario del consultorio: **America/Mexico_City**. Las fechas
  civiles y los instantes son cosas distintas en este producto y confundirlas ha
  causado errores reales en producción.

## Capabilities and Constraints

**Confirmado en el producto**

- Registro y verificación de médicos con cédula profesional, foto de consultorio
  y documentos privados.
- Disponibilidad médica con bloqueos, repetición semanal y reactivación de días.
- Citas con estados de aceptación, reagenda, cancelación y devolución.
- Pagos con Stripe mediante cargos con destino a la cuenta del médico; las
  devoluciones revierten la transferencia al médico, no las absorbe la
  plataforma.
- Expediente e historia clínica, recursos clínicos y notificaciones internas.
- Secretaría virtual y asistente de agenda con IA para el plan Amatista.
- Auditoría de acciones sensibles con purga por antigüedad.

**Restricciones técnicas**

- Serverless sobre Vercel con Prisma y PostgreSQL en Supabase a través de
  pgBouncer en modo transacción; el límite de conexiones es una restricción real
  de capacidad, no un detalle de configuración.
- La zona horaria del consultorio es fuente de verdad compartida entre servidor
  y cliente.

**Abierto / no decidido**

- Stripe sigue en modo de prueba. El cambio a cobros reales está pausado de forma
  deliberada y tiene un procedimiento propio pendiente de ejecutar.
- No se ha ejecutado nunca una devolución completa de punta a punta en modo de
  prueba.

## Brand Commitments

- Nombre: **VITAEON**. Dominios `vitaeon.mx` y `vitaeon.com.mx`.
- Se describe como plataforma médica **premium** y como red privada, no como
  directorio abierto.
- Los planes médicos se nombran con piedras: `oro`, `obsidiana`, `diamante`,
  `amatista`. Amatista es el nivel superior y sus funciones deben sentirse
  acordes a ese precio.
- Idioma del producto: español de México.

## Evidence on Hand

- Catálogo **real** de especialidades y hospitales privados de León en el seed.
- Páginas legales publicadas: aviso de privacidad, consentimiento de datos,
  términos, política de cancelaciones, política de reembolsos, soporte y
  urgencias.
- Perfiles médicos con foto de consultorio y cédula profesional visible.

**Lo que no existe y no debe inventarse:** no hay médicos ficticios, opiniones,
testimonios, casos de éxito, cifras de pacientes atendidos, métricas de
resultados ni prensa. El seed se limpió a propósito para la beta privada. Si una
superficie futura necesita prueba social, hay que pedirla, no fabricarla.

## Product Principles

1. **La acreditación es el producto.** Si un médico aparece, es porque alguien
   revisó su cédula. Nada en el diseño debe diluir esa diferencia frente a un
   directorio de alta libre.
2. **El dinero del paciente no es de la plataforma.** Cobros y devoluciones se
   presentan con claridad sobre quién paga qué y cuándo regresa.
3. **Servir a los dos lados sin sacrificar ninguno.** Una mejora para el médico
   que degrada la experiencia del paciente no es una mejora.
4. **La hora que ve el usuario es la del consultorio.** Nunca la del servidor ni
   la del dispositivo.
5. **No fabricar evidencia.** Sin pacientes reales todavía, cualquier cifra,
   testimonio o reseña inventada es una mentira con bata.

## Accessibility & Inclusion

Pacientes de todas las edades, incluidos adultos mayores que agendan desde el
teléfono y usuarios que llegan por llamada telefónica atendida por la
secretaria. No se ha establecido un estándar formal de accesibilidad (WCAG u
otro) como requisito del producto; queda abierto.

**Punto abierto en cumplimiento normativo:** la NOM-004 del expediente clínico,
la LFPDPPP y las políticas publicadas de cancelación y reembolso se tratan como
compromisos vigentes que el trabajo futuro debe respetar. No hay constancia de
una revisión formal de cumplimiento, y el usuario señaló ambas cosas a la vez.
Confirmar antes de asumir que el producto está certificado en cualquiera de las
tres.
