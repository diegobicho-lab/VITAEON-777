# AUDITORIA PRODUCCION VITAEON

## Pendientes Convertidos En Implementación

- UI legacy: `components/legacy/VitaeonExperience.jsx` ahora delega a la experiencia real conectada.
- Capa cliente: `services/client/api.ts` centraliza llamadas a API y `services/client/hooks.ts` deja hooks reutilizables para usuario, catálogos y doctores.
- Formularios reales: login, registro, logout, agendamiento, perfil médico y verificación médica usan endpoints reales.
- Registro médico: al crear cuenta como doctor se genera un perfil inicial editable y no verificado para completar onboarding.
- Citas: `GET/POST /api/appointments` y `PATCH /api/appointments/:id` validan sesión, rol, disponibilidad y evitan doble reserva con índice único.
- Pagos: `POST /api/payments` crea Payment Intent de Stripe desde backend o deja efectivo como pendiente.
- Pagos: `GET /api/payments` permite ver estados de pago por rol sin exponer tarjetas.
- Administración: `GET /api/patients` y `GET /api/admin/doctors` alimentan el panel administrativo.
- Dashboards: paciente, médico y administrador consumen datos reales y muestran estados de loading, error y vacío.
- Confianza visual: la home muestra cédula, médico verificado, disponibilidad real, cómo funciona y FAQ sin depender de perfiles médicos ficticios.
- Seguridad: se agregó rate limiting básico, headers de seguridad, roles por endpoint, auditoría y cifrado de motivo de consulta.
- Documentos médicos: se creó storage privado abstracto y se bloquean URLs públicas directas.
- Testing: se agregaron pruebas unitarias y e2e base para validaciones, storage, navegación y rutas protegidas.
- Render y estilos: Tailwind se carga desde `app/globals.css`, el layout principal lo importa de forma directa y el build enlaza la hoja CSS final de Next.
- Calendario médico: la agenda del doctor ahora tiene vista mensual, bloques por día, repetición semanal y citas dentro del día.
- Secretaria Amatista: el asistente opera como secretaria médica interna con próxima cita, resumen del día, pendientes, huecos y notificaciones.
- Suscripciones: Oro se activa gratis; Obsidiana/Diamante/Amatista abren Checkout Stripe y se confirman por webhook.
- Medicamentos: se agregó búsqueda exclusiva Amatista con integración externa configurable y fallback seguro.
- Notificaciones: se agregó sistema interno para médicos y pacientes.

## Archivos Modificados O Agregados

- `components/platform/VitaeonPlatform.tsx`
- `components/platform/DashboardClients.tsx`
- `components/legacy/VitaeonExperience.jsx`
- `app/globals.css`
- `app/layout.tsx`
- `services/client/api.ts`
- `services/client/hooks.ts`
- `lib/security/rate-limit.ts`
- `lib/security/crypto.ts`
- `lib/storage/private-documents.ts`
- `lib/validation/schemas.ts`
- `app/api/auth/login/route.ts`
- `app/api/auth/register/route.ts`
- `app/api/appointments/route.ts`
- `app/api/appointments/[id]/route.ts`
- `app/api/payments/route.ts`
- `app/api/patients/route.ts`
- `app/api/admin/doctors/route.ts`
- `app/api/availability/route.ts`
- `app/api/doctors/me/route.ts`
- `app/api/medical-verifications/route.ts`
- `app/api/availability/bulk/route.ts`
- `app/api/notifications/route.ts`
- `app/api/subscriptions/checkout/route.ts`
- `app/api/uploads/images/route.ts`
- `app/api/medications/search/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/api/specialties/route.ts`
- `app/api/hospitals/route.ts`
- `services/medications/medication-search.ts`
- `lib/notifications/notifications.ts`
- `next.config.mjs`
- `tailwind.config.ts`
- `package.json`
- `vitest.config.ts`
- `playwright.config.ts`
- `tests/unit/*`
- `tests/e2e/*`
- `.env.example`
- `README.md`

## Como Probar El Flujo Completo

1. Ejecuta `npm install`.
2. Copia `.env.example` a `.env`.
3. Configura PostgreSQL en `DATABASE_URL`.
4. Genera una llave `ENCRYPTION_KEY` base64 de 32 bytes.
5. Ejecuta `npm run db:migrate`.
6. Ejecuta `npm run db:seed`.
7. Ejecuta `npm run dev`.
8. Entra a `http://localhost:3000`.
9. Registra un paciente, busca un médico, selecciona disponibilidad y crea una cita.
10. Prueba efectivo pendiente o Stripe con llaves de test.
11. Entra al panel paciente para ver/cancelar citas.
12. Registra un médico real de beta para editar perfil, disponibilidad y verificación.
13. Entra como admin seed para aprobar/rechazar verificaciones y revisar auditoría.
14. En admin revisa médicos, pacientes, citas, pagos y logs.
15. Ejecuta `npm run typecheck`, `npm run lint`, `npm run build`, `npm run test:unit` y `npm run test:e2e`.

## Validación Ejecutada

- `npm run typecheck`: correcto.
- `npm run lint`: correcto sin errores.
- `npm run build`: correcto.
- `npm run test:unit`: correcto, 5 pruebas pasando.
- Verificación de build: `.next/server/app/index.html` incluye una hoja `/_next/static/css/*.css` y el CSS generado contiene Tailwind compilado.

## Configuración Externa Requerida

- PostgreSQL real.
- Stripe test/live keys y webhook secret.
- `APP_URL` y `NEXT_PUBLIC_APP_URL` para redirecciones de checkout.
- `MEDICATION_API_URL` y `MEDICATION_API_KEY` si se conecta una fuente autorizada de medicamentos.
- Storage privado real para documentos médicos: S3, Supabase Storage o equivalente.
- Proveedor SMTP para confirmaciones por correo.
- Redis o gateway para rate limiting en producción.
- Dominio HTTPS y revisión de headers en ambiente real.

## Riesgos Que Siguen Abiertos

- Cumplimiento legal médico y de datos sensibles debe revisarse con especialistas.
- MFA administrativo y médico aún está pendiente y debe tratarse como requisito crítico antes de lanzamiento público.
- Recuperación de contraseña ya está implementada con token seguro, expiración, auditoría y correo SMTP; falta validarla con proveedor SMTP real.
- Rate limiting actual es en memoria y no sirve para despliegues multi-instancia.
- Storage privado está abstraído, pero requiere proveedor real para generar URLs firmadas.
- Stripe necesita prueba con webhook real antes de producción.
- Las suscripciones están implementadas como Checkout de pago único; si se requiere cobro recurrente mensual, migrar a Stripe Billing Subscriptions.
- Email SMTP quedó implementado para eventos mínimos de beta; WhatsApp, SMS y push siguen pendientes hasta configurar proveedores reales.
- La búsqueda de medicamentos no inventa datos; requiere una fuente autorizada configurada para resultados reales.
- Faltan pruebas de penetración, monitoreo, alertas y backups auditados.

## Avance De Colaboración Médica

Pendientes cerrados en esta pasada:

- Se agregó agenda médica estructurada por día en `GET /api/doctor-agenda`.
- Se agregó asistente virtual básico para médicos en `POST /api/doctor-assistant`.
- Se agregó chat médico cifrado para derivaciones en `GET/POST /api/doctor-conversations`.
- Se agregó envío y lectura de mensajes en `GET/POST /api/doctor-conversations/:id/messages`.
- Se añadieron modelos `MedicalConversation` y `MedicalChatMessage` con migración Prisma.
- Se conectó el panel médico con agenda, asistente y conversaciones.

Archivos modificados:

- `prisma/schema.prisma`
- `prisma/migrations/20260507043000_medical_collaboration/migration.sql`
- `lib/validation/schemas.ts`
- `app/api/doctor-agenda/route.ts`
- `app/api/doctor-assistant/route.ts`
- `app/api/doctor-conversations/route.ts`
- `app/api/doctor-conversations/[id]/messages/route.ts`
- `components/platform/DashboardClients.tsx`
- `README.md`

Riesgos pendientes:

- El asistente médico actual es heurístico y no usa un modelo clínico real.
- Falta consentimiento explícito y políticas internas para compartir información entre médicos.
- Falta adjuntar documentos privados o referencia formal de paciente dentro del chat.
- Falta convertir el chat a tiempo real con WebSockets/SSE o polling controlado.
- Falta granularidad avanzada para permisos de derivación, cierre de conversación y trazabilidad por caso.

## Avance De Cierre Para Lanzamiento

Pendientes cerrados en esta pasada:

- Se agregó selección de plan médico en registro de doctor.
- Se conectó el plan activo del médico con `Doctor.medal`.
- Se ajustó el modelo médico para exigir declaración legal antes de publicar o guardar información profesional.
- Se implementó la restricción de perfil único por usuario médico: una especialidad, un hospital y un solo bloque de personalización.
- Se implementó prioridad explícita por plan en resultados: Amatista, Diamante y Oro; dentro del plan se ordena por disponibilidad, nombre y creación.
- Se ajustaron permisos por plan: Oro conserva perfil con títulos y visibilidad normal; Diamante sube prioridad; Amatista habilita prioridad máxima y asistente de IA.
- Se amplió el panel médico para editar nombre, especialidad, hospital/clínica, foto, biografía, cédula, precio, títulos, posgrados, subespecialidades y plan activo.
- Se agregó advertencia legal obligatoria y checkbox requerido dentro del panel médico.
- Se agregó gestión de horarios no disponibles mediante `PATCH /api/availability`.
- Se agregó manejo explícito de doble reserva con respuesta clara `SLOT_ALREADY_BOOKED`.
- Se priorizan médicos Amatista/Diamante/Obsidiana/Oro en `GET /api/doctors`.
- El ticket de cita ya muestra paciente, doctor, especialidad, hospital, fecha, pago e importe.
- Se agregaron páginas legales mínimas: aviso de privacidad, términos, consentimiento de datos y aviso de urgencias.

Archivos modificados o agregados:

- `components/platform/VitaeonPlatform.tsx`
- `components/platform/DashboardClients.tsx`
- `components/platform/LegalPage.tsx`
- `app/aviso-de-privacidad/page.tsx`
- `app/terminos/page.tsx`
- `app/consentimiento-datos/page.tsx`
- `app/urgencias/page.tsx`
- `app/api/auth/register/route.ts`
- `app/api/doctors/me/route.ts`
- `app/api/doctors/route.ts`
- `app/api/availability/route.ts`
- `app/api/appointments/route.ts`
- `app/api/doctor-assistant/route.ts`
- `lib/validation/schemas.ts`
- `prisma/schema.prisma`
- `prisma/seed.ts`
- `prisma/migrations/20260508010000_doctor_profile_legal_plan/migration.sql`
- `README.md`
- `docs/AUDITORIA_PRODUCCION_VITAEON.md`

Riesgos pendientes:

- Los planes todavía no cobran suscripción real; el distintivo queda preparado como estado operativo y requiere checkout/subscription real antes de producción comercial.
- Las páginas legales son base inicial y necesitan revisión jurídica.
- El asistente IA sigue siendo heurístico; para producción debe integrarse con proveedor clínicamente gobernado y límites de seguridad.
- Faltan MFA, recuperación de contraseña, proveedor de email y storage privado real conectado.
- En este entorno no se pudo aplicar `npx prisma migrate dev` porque PostgreSQL no responde en `localhost:5432`; la migración SQL quedó creada y el esquema fue validado con Prisma.

## Avance De Operación Médica Premium

Pendientes cerrados en esta pasada:

- Se agregó migración Prisma `20260508020000_doctor_calendar_notifications_subscriptions`.
- Se añadieron modelos `Notification`, `SubscriptionPayment` y `MedicationSearchLog`.
- Se amplió `Doctor` con `professionalLicensePhotoUrl`, `subscriptionStatus` y `verifiedAt`.
- Se creó calendario mensual en el panel médico con navegación de mes, selección de día, bloques horarios, repetición semanal y citas dentro del día.
- Se conectó disponibilidad masiva con validación de horarios y prevención de duplicados.
- Se creó sistema interno de notificaciones para eventos de citas, pagos, verificación y agenda.
- Se convirtió el asistente Amatista en secretaria médica virtual interna, sin fingir envíos externos.
- Se preparó la arquitectura de canales futuros: email, WhatsApp, SMS y push.
- Se agregó subida segura de imágenes para perfil, consultorio y cédula profesional visible.
- Se actualiza `verifiedAt` al aprobar o retirar verificación médica desde admin.
- Se implementó checkout de suscripción médica con Stripe para Obsidiana/Diamante/Amatista y activación gratuita de Oro.
- Se agregó manejo de `checkout.session.completed` y `checkout.session.expired` en webhook Stripe para actualizar plan y pago.
- Se agregó búsqueda de medicamentos exclusiva de Amatista con servicio externo configurable y fallback seguro.
- Se documentaron variables `APP_URL`, `MEDICATION_API_URL` y `MEDICATION_API_KEY`.

Archivos modificados o agregados:

- `prisma/schema.prisma`
- `prisma/migrations/20260508020000_doctor_calendar_notifications_subscriptions/migration.sql`
- `lib/validation/schemas.ts`
- `lib/notifications/notifications.ts`
- `services/client/api.ts`
- `services/medications/medication-search.ts`
- `app/api/availability/bulk/route.ts`
- `app/api/notifications/route.ts`
- `app/api/subscriptions/checkout/route.ts`
- `app/api/uploads/images/route.ts`
- `app/api/medications/search/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/api/appointments/route.ts`
- `app/api/doctor-agenda/route.ts`
- `app/api/doctor-assistant/route.ts`
- `app/api/doctors/route.ts`
- `app/api/medical-verifications/route.ts`
- `components/platform/DashboardClients.tsx`
- `.env.example`
- `README.md`
- `docs/AUDITORIA_PRODUCCION_VITAEON.md`

Cómo probar:

1. Configura PostgreSQL y ejecuta `npm run db:migrate && npm run db:seed`.
2. Entra como médico y revisa el calendario mensual en Panel Médico.
3. Crea bloques de disponibilidad por día y repetición semanal.
4. Entra como paciente, agenda en esos horarios y vuelve al panel médico para ver la cita dentro del calendario.
5. Cambia a plan Oro gratis o paga Obsidiana/Diamante/Amatista con Stripe test.
6. Configura webhook Stripe hacia `/api/webhooks/stripe` para activar planes pagados automáticamente.
7. Con plan Amatista, abre secretaria virtual y búsqueda de medicamentos.
8. Sube fotos de perfil, consultorio y cédula desde el formulario médico.
9. En admin, aprueba/rechaza verificación y revisa notificaciones/auditoría.

Riesgos abiertos:

- En producción, el cobro recurrente debe migrarse a Stripe Billing si los planes serán mensuales.
- Faltan proveedores reales para recordatorios externos.
- Faltan URLs firmadas privadas para ver documentos sensibles en panel admin.
- Falta integración real con fuente autorizada de medicamentos.
- Falta MFA, recuperación de contraseña, Redis para rate limiting y revisión legal final.

## Avance De Lanzamiento: Descuentos, Opiniones Y Urgencias

Pendientes cerrados en esta pasada:

- Se agregó migración Prisma `20260514090000_patient_discount_reviews_doctor_location`.
- Se amplió `Patient` con control de descuento de bienvenida de uso único.
- Se amplió `Appointment` con precio original, descuento aplicado y etiqueta visible en ticket/resumen.
- Se creó `DoctorReview` y `ReviewStatus` para opiniones, promedio de estrellas, moderación y respuesta médica.
- Se amplió `Doctor` con dirección de consultorio, referencia, ciudad/estado, mapa, teléfono profesional y redes sociales.
- Se creó `GET /api/discounts/welcome` para calcular el 35% de descuento del paciente nuevo con la Dra. Susana Pérez Guadarrama.
- Se conectó el descuento al flujo real de cita: se valida en backend, se muestra antes de pago y se marca como usado al crear la primera cita elegible.
- Se creó `GET /api/urgent-availability` para listar médicos por especialidad ordenados por horario más cercano.
- Se agregó botón rojo elegante “Buscar atención urgente” con modal responsable que no promete atención inmediata.
- Se creó `GET/POST/PATCH /api/reviews` para publicar, listar, responder y moderar opiniones.
- Se conectaron opiniones al perfil público del médico y al panel médico/admin.
- Se reforzó `POST /api/payments` para validar que la cita siga pagable y que el horario pertenezca a la cita antes de generar Stripe Payment Intent.
- Se actualizó el seed con la Dra. Susana Pérez Guadarrama como internista verificada y disponibilidad futura.
- Se agregaron campos de ubicación/redes al panel médico y su visualización pública en el perfil.
- Se mantuvo la estética actual de VITAEON: paleta, tipografía, cards, spacing y navegación premium.

Archivos modificados o agregados:

- `prisma/schema.prisma`
- `prisma/migrations/20260514090000_patient_discount_reviews_doctor_location/migration.sql`
- `prisma/seed.ts`
- `types/domain.ts`
- `lib/validation/schemas.ts`
- `lib/discounts/welcome-discount.ts`
- `app/api/auth/register/route.ts`
- `app/api/appointments/route.ts`
- `app/api/payments/route.ts`
- `app/api/doctors/route.ts`
- `app/api/doctors/me/route.ts`
- `app/api/discounts/welcome/route.ts`
- `app/api/urgent-availability/route.ts`
- `app/api/reviews/route.ts`
- `components/platform/VitaeonPlatform.tsx`
- `components/platform/DashboardClients.tsx`
- `README.md`
- `docs/AUDITORIA_PRODUCCION_VITAEON.md`

Cómo probar el descuento:

1. Ejecuta `npm run db:migrate && npm run db:seed`.
2. Registra un paciente nuevo.
3. Busca Medicina Interna y selecciona a la Dra. Susana Pérez Guadarrama.
4. Abre el flujo de cita y confirma que aparece el mensaje del 35% antes del pago.
5. Crea la cita y revisa que el ticket muestre precio regular, descuento y total.
6. Intenta crear otra cita con el mismo paciente: el descuento ya no debe volver a aparecer como aplicable.

Cómo probar opiniones:

1. Crea una cita confirmada o complétala desde panel médico/admin.
2. Entra como paciente y abre el perfil del médico.
3. Publica una opinión con estrellas.
4. Entra como médico para ver y responder la opinión.
5. Entra como admin para aprobar/rechazar opiniones desde el panel.

Cómo probar urgencias:

1. En home presiona “Buscar atención urgente”.
2. Selecciona una especialidad.
3. Verifica que el modal liste médicos por disponibilidad más próxima.
4. Selecciona un médico para continuar al flujo normal de reserva/pago.

Validaciones ejecutadas:

- `npx prisma format`: correcto.
- `npx prisma generate`: correcto.
- `npx prisma validate`: correcto.
- `npm run typecheck`: correcto.
- `npm run lint`: correcto.
- `npm run build`: correcto.

Limitación del entorno:

- `npx prisma migrate dev --name patient_discount_reviews_doctor_location` no pudo conectarse a PostgreSQL en `localhost:5432` y devolvió `Schema engine error`. La migración SQL ya existe y Prisma valida el schema; al levantar PostgreSQL local con `DATABASE_URL` correcto, ejecutar `npm run db:migrate`.

Riesgos abiertos:

- El descuento está controlado en backend para primer uso, pero en producción conviene agregar reportes administrativos específicos de campañas/promociones.
- La moderación de opiniones es básica por palabras bloqueadas; para producción conviene agregar flujo de revisión humana más robusto.
- Urgencias no sustituye atención inmediata real; el mensaje responsable ya está visible, pero las páginas legales deben reforzarlo.
- Stripe confirma pagos exitosos por webhook; se requiere configuración real de webhook en ambiente productivo.

## Avance Beta Privada / Piloto

Pendientes cerrados en esta pasada:

- Se agregó `Doctor.university` para reforzar confianza en perfiles médicos.
- Se creó migración `20260514193000_beta_trust_fields`.
- Se agregó edición de universidad en panel médico y visualización en perfil público.
- Se restringieron opiniones a pacientes con cita `COMPLETED`.
- Se reforzó el webhook de Stripe para confirmar únicamente citas pendientes y evitar reactivar citas canceladas.
- Se agregó activación/pausa administrativa de médicos desde `PATCH /api/admin/doctors`.
- Se agregaron páginas legales visibles: cancelaciones, reembolsos y soporte.
- Se agregaron páginas SEO indexables por especialidad y por médico.
- Se agregó `sitemap.xml` con fallback seguro si la base de datos no está disponible.

Archivos modificados o agregados:

- `prisma/schema.prisma`
- `prisma/migrations/20260514193000_beta_trust_fields/migration.sql`
- `prisma/seed.ts`
- `lib/validation/schemas.ts`
- `lib/seo/slug.ts`
- `types/domain.ts`
- `app/api/doctors/route.ts`
- `app/api/doctors/me/route.ts`
- `app/api/reviews/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/api/admin/doctors/route.ts`
- `app/especialidades/[slug]/page.tsx`
- `app/medicos/[slug]/page.tsx`
- `app/sitemap.ts`
- `app/politica-cancelaciones/page.tsx`
- `app/politica-reembolsos/page.tsx`
- `app/soporte/page.tsx`
- `components/platform/VitaeonPlatform.tsx`
- `components/platform/DashboardClients.tsx`
- `README.md`
- `docs/AUDITORIA_PRODUCCION_VITAEON.md`

Cómo probar esta fase:

1. Ejecutar `npm run db:migrate && npm run db:seed`.
2. Abrir `/especialidades/medicina-interna` para validar página indexable de especialidad.
3. Abrir `/medicos/dra-susana-perez-guadarrama` para validar perfil público con universidad, cédula, hospital y disponibilidad.
4. Entrar como médico y guardar universidad desde el panel médico.
5. Entrar como admin y pausar/activar un médico desde el panel.
6. Completar una cita y publicar opinión desde paciente; una cita solo confirmada debe ser rechazada.
7. Revisar `/politica-cancelaciones`, `/politica-reembolsos` y `/soporte`.

Riesgos abiertos para beta:

- Las páginas legales son funcionales, pero requieren revisión jurídica antes de operar con pacientes reales.
- La activación/pausa administrativa no reemplaza un workflow completo de sanciones o suspensión legal.
- El sitemap depende de `APP_URL` y de la base de datos para rutas dinámicas; si no hay DB devuelve rutas estáticas.
- Recuperación de contraseña quedó automatizada; falta validación con SMTP real del dominio VITAEON.

## Cierre Beta Privada 2026-05-15

Pendientes cerrados en esta pasada:

- Se agregó modelo `PasswordResetToken` con migración Prisma para recuperación segura de contraseña.
- Se crearon endpoints `POST /api/auth/password/request` y `POST /api/auth/password/reset`.
- Se agregaron pantallas `/recuperar-contrasena` y `/restablecer-contrasena` con estética VITAEON.
- Se implementó correo SMTP transaccional sin agregar dependencias externas nuevas.
- Se conectaron emails para registro, nueva cita, cancelación/completado, pagos Stripe, suscripciones y verificación médica.
- Se reorganizó el panel médico en secciones más limpias: Resumen, Agenda clínica, Disponibilidad, Perfil profesional, Suscripción, Opiniones y Notificaciones.
- Se agregó nota visible de revisión jurídica en las páginas legales.
- Se documentaron variables SMTP y `ADMIN_MFA_REQUIRED` en `.env.example`.

Archivos modificados o agregados:

- `prisma/schema.prisma`
- `prisma/migrations/20260515143000_password_reset_tokens/migration.sql`
- `lib/validation/schemas.ts`
- `lib/email/mailer.ts`
- `app/api/auth/password/request/route.ts`
- `app/api/auth/password/reset/route.ts`
- `app/api/auth/register/route.ts`
- `app/api/appointments/route.ts`
- `app/api/appointments/[id]/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/api/medical-verifications/route.ts`
- `components/platform/PasswordRecoveryClient.tsx`
- `components/platform/VitaeonPlatform.tsx`
- `components/platform/DashboardClients.tsx`
- `components/platform/LegalPage.tsx`
- `app/recuperar-contrasena/page.tsx`
- `app/restablecer-contrasena/page.tsx`
- `.env.example`
- `README.md`
- `docs/AUDITORIA_PRODUCCION_VITAEON.md`

Cómo probar recuperación de contraseña:

1. Configurar `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE` y `SMTP_STARTTLS`.
2. Abrir `/recuperar-contrasena`.
3. Enviar correo de un usuario existente.
4. Abrir el enlace recibido y crear nueva contraseña.
5. Confirmar que el token no puede reutilizarse.

Cómo probar emails:

1. Registrar paciente y médico.
2. Crear una cita como paciente.
3. Confirmar pago Stripe mediante webhook o dejar efectivo pendiente.
4. Cancelar/completar cita desde panel correspondiente.
5. Enviar verificación médica y aprobar/rechazar como admin.

Riesgos abiertos para pasar de beta a público:

- MFA administrativo sigue pendiente.
- Rate limiting sigue en memoria; mover a Redis/gateway antes de multi-instancia.
- Storage privado necesita proveedor real con URLs firmadas.
- SMTP debe validarse con dominio real, SPF/DKIM/DMARC.
- Stripe necesita prueba end-to-end con webhook público de test antes de aceptar pagos reales.
- Legal requiere revisión profesional antes de tratar pacientes reales fuera de beta privada.

## Flujo de Tickets y Aceptación Médica 2026-05-16

Pendientes cerrados en esta pasada:

- Se amplió `AppointmentStatus` con estados reales de operación clínica: `PENDING_DOCTOR_ACCEPTANCE`, `ACCEPTED`, `NO_SHOW`, `RESCHEDULE_REQUESTED`, `CANCELLATION_REQUESTED` y `REFUND_PENDING`.
- Se agregaron marcas de tiempo para aceptación, completado, no asistencia, solicitud de reagendamiento, solicitud de cancelación y reembolso pendiente.
- `POST /api/appointments` ahora crea el ticket como “pendiente de aceptación médica”.
- `PATCH /api/appointments/:id` ahora usa acciones explícitas:
  - `ACCEPT`
  - `COMPLETE`
  - `MARK_NO_SHOW`
  - `REQUEST_RESCHEDULE`
  - `REQUEST_CANCELLATION`
  - `MARK_REFUND_PENDING`
  - `CANCEL`
- Se reforzó validación por rol:
  - Solo el médico dueño o admin/staff puede aceptar, completar o marcar no asistencia.
  - Solo el paciente dueño o admin/staff puede solicitar reagendar o cancelar.
  - Solo admin/staff puede marcar reembolso pendiente manualmente.
- Si el paciente cancela una cita pagada en línea, la cita pasa a `REFUND_PENDING` y se notifica a administración; no se ejecuta devolución automática.
- Si la cita estaba en efectivo o pago pendiente, la cancelación no genera reembolso.
- El panel paciente muestra tickets con textos humanos y acciones posteriores a no asistencia.
- El panel médico muestra acciones clínicas: aceptar cita, completar cita, paciente no llegó y solicitar cancelación.
- El panel admin muestra una sección de seguimiento sensible para reembolsos pendientes, reagendamientos, cancelaciones y no asistencia.
- Se conectaron notificaciones internas y correos SMTP para creación de ticket, aceptación, completado, no asistencia, reagendamiento, cancelación y reembolso pendiente.

Archivos modificados o agregados:

- `prisma/schema.prisma`
- `prisma/migrations/20260516013000_appointment_lifecycle/migration.sql`
- `lib/validation/schemas.ts`
- `app/api/appointments/route.ts`
- `app/api/appointments/[id]/route.ts`
- `app/api/payments/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `app/api/doctor-assistant/route.ts`
- `components/platform/VitaeonPlatform.tsx`
- `components/platform/DashboardClients.tsx`
- `tests/unit/validation.test.ts`
- `README.md`
- `docs/AUDITORIA_PRODUCCION_VITAEON.md`

Cómo probar paciente:

1. Registrar o iniciar sesión como paciente.
2. Crear una cita desde el flujo médico.
3. Confirmar que aparece el ticket: médico, especialidad, hospital, fecha, estado de cita, estado de pago y total.
4. Entrar a `/dashboard/patient` y revisar “Mis citas”.
5. Si el médico marca “Paciente no llegó”, probar “Solicitar reagendar” y “Solicitar cancelar cita”.

Cómo probar médico:

1. Iniciar sesión como médico.
2. Abrir `/dashboard/doctor`.
3. En “Agenda clínica”, abrir una cita pendiente.
4. Usar “Aceptar cita”.
5. Después probar “Completar cita” y validar que el paciente pueda opinar.
6. En otra cita, probar “Paciente no llegó”.

Cómo probar admin:

1. Iniciar sesión como admin.
2. Abrir `/dashboard/admin`.
3. Revisar “Seguimiento clínico sensible”.
4. Confirmar que aparecen citas `NO_SHOW`, `RESCHEDULE_REQUESTED`, `CANCELLATION_REQUESTED` o `REFUND_PENDING`.

Riesgos pendientes:

- No hay devolución automática real en Stripe. Esto es intencional para beta: todo reembolso queda pendiente de revisión administrativa.
- Antes de activar devoluciones reales, se requiere flujo admin dedicado, permisos reforzados, conciliación con Stripe y webhook de `charge.refunded`/`refund.updated`.
- El proceso de reagendamiento guarda la solicitud y el horario solicitado si se envía; la experiencia visual para elegir un nuevo horario desde el ticket puede ampliarse después de validar beta.

## Limpieza de Datos Demo para Beta Privada 2026-05-16

Pendientes cerrados en esta pasada:

- `prisma/seed.ts` dejó de crear médicos, opiniones, hospitales y horarios ficticios visibles.
- Se eliminó el archivo duplicado `prisma/seed 2.ts`, que conservaba datos demo antiguos.
- El seed ahora crea únicamente:
  - un administrador principal configurable con `SEED_ADMIN_EMAIL` y `SEED_ADMIN_PASSWORD`;
  - especialidades médicas reales para catálogo;
  - hospitales reales de catálogo en León, Guanajuato, sin direcciones inventadas.
- El seed elimina identificadores legacy usados por datos demo anteriores: doctores visuales, correos demo y hospitales temporales como `VITAEON Center`, `Clínica Altum` y `VITAEON Digital`.
- `GET /api/doctors`, páginas SEO de médicos, páginas SEO por especialidad, sitemap y urgencias ahora usan un filtro público único.
- Un médico solo aparece públicamente si cumple todo:
  - usuario activo;
  - verificación `VERIFIED`;
  - `isVerified`;
  - declaración legal aceptada;
  - cédula profesional registrada;
  - nombre, biografía, subespecialidad, especialidad y hospital configurados.
- Los conteos de especialidades y hospitales ahora consideran solo médicos públicos completos, no perfiles incompletos o en onboarding.
- El registro médico ya no crea el hospital ficticio `VITAEON Digital`; usa catálogo real como punto inicial privado hasta que el médico configure su perfil.
- El sitemap evita perfiles incompletos, demo o no verificados.
- Los mensajes vacíos para especialidades sin médicos reales ahora comunican beta privada de forma profesional.
- Las validaciones de catálogo recortan espacios, limitan caracteres y evitan duplicados por nombre con comparación insensible a mayúsculas.

Archivos modificados o agregados:

- `prisma/seed.ts`
- `lib/doctors/public-doctor-filter.ts`
- `lib/validation/schemas.ts`
- `app/api/doctors/route.ts`
- `app/api/urgent-availability/route.ts`
- `app/api/specialties/route.ts`
- `app/api/hospitals/route.ts`
- `app/api/auth/register/route.ts`
- `app/especialidades/[slug]/page.tsx`
- `app/medicos/[slug]/page.tsx`
- `app/sitemap.ts`
- `components/platform/VitaeonPlatform.tsx`
- `tests/unit/validation.test.ts`
- `README.md`
- `docs/AUDITORIA_PRODUCCION_VITAEON.md`

Cómo probar:

1. Ejecutar `npm run db:seed`.
2. Confirmar que solo existe el admin inicial y catálogos reales.
3. Abrir una especialidad sin médicos y validar el mensaje de beta privada.
4. Registrar un médico real, completar perfil, aceptar declaración legal y enviar verificación.
5. Aprobarlo como admin y confirmar que aparece en resultados y sitemap solo después de estar completo y verificado.

Riesgos pendientes:

- El catálogo hospitalario incluye nombres sin direcciones para evitar datos inventados; cada médico debe agregar dirección específica de consultorio desde su panel.
- Si una base local ya tenía datos demo fuera de los identificadores legacy conocidos, se deben revisar manualmente desde admin antes de invitar médicos reales.
- Antes de operar públicamente, mantener `robots`/SEO revisado para no indexar perfiles en revisión.

## Cierre Operativo Beta Privada 2026-05-17

Pendientes cerrados en esta pasada:

- Se agregó sección interna “Modo Beta Privada” en el panel administrador sin cambiar la estética ni rehacer dashboards.
- El modo beta muestra médicos registrados, médicos verificados, médicos pausados, pacientes registrados, citas creadas, citas completadas, pagos pendientes, pagos confirmados, solicitudes de reagendamiento, cancelaciones, reembolsos pendientes, opiniones publicadas y eventos sensibles.
- Se agregó `app/robots.ts` para bloquear indexación por defecto durante beta privada mediante `BETA_ALLOW_INDEXING=false`.
- `sitemap.xml` ya no incluye especialidades sin médicos públicos completos.
- Las páginas de especialidad sin médicos tienen `robots: noindex`.
- `.env.example` quedó ordenado por secciones: App, Database, Auth, Encryption, Stripe, SMTP, Storage, Medication API, Campaigns, Rate limiting y Admin/MFA pendiente.
- Se creó `docs/beta` con documentación operativa de beta privada.

Archivos creados:

- `app/robots.ts`
- `docs/beta/BETA_ROADMAP.md`
- `docs/beta/QA_CHECKLIST.md`
- `docs/beta/DEPLOYMENT_GUIDE.md`
- `docs/beta/MEDICOS_PILOTO.md`
- `docs/beta/PACIENTES_PILOTO.md`
- `docs/beta/LAUNCH_BLOCKERS.md`
- `docs/beta/BETA_READY_CHECKLIST.md`

Archivos modificados:

- `.env.example`
- `README.md`
- `app/sitemap.ts`
- `app/especialidades/[slug]/page.tsx`
- `components/platform/DashboardClients.tsx`
- `docs/AUDITORIA_PRODUCCION_VITAEON.md`

Validación ejecutada:

- `npm run typecheck`: correcto.
- `npm run lint`: correcto.
- `npm run test:unit`: correcto, 8 pruebas pasando.
- `npm run build`: correcto.

Listo para beta:

- Seed limpio sin médicos ni opiniones ficticias visibles.
- Filtro público reforzado para perfiles médicos reales.
- Admin con modo beta privada para seguimiento operativo.
- SEO protegido para beta privada.
- Documentación de QA y deployment lista.

Pendiente antes de público:

- MFA administrativo.
- Redis/gateway para rate limiting multi-instancia.
- Stripe live y conciliación completa.
- Backups, monitoreo y alertas.
- Storage privado real con URLs firmadas.
- Revisión legal formal.
- Pruebas de penetración.

## Ajuste Cobros, Reagendado y Devoluciones 2026-05-20

Pendientes cerrados:

- El flujo “Cobros y cuenta bancaria” ahora captura errores reales de Stripe Connect en backend con logs controlados y devuelve mensajes claros al médico.
- El onboarding de Stripe Connect crea o reutiliza `stripeAccountId`, genera Account Link y no expone claves secretas al frontend.
- El estado de Stripe Connect ahora captura errores de Stripe y mantiene mensajes amables si la configuración falla.
- Los pagos de citas en línea mantienen separación de suscripciones: las citas usan PaymentIntent con destino al médico; las suscripciones se quedan en la cuenta principal de VITAEON.
- Las cancelaciones ahora priorizan reagendar antes de devolver dinero.
- Las solicitudes con pago en línea quedan como solicitud de devolución pendiente de decisión médica, sin mezclar ingresos de suscripción.
- Se agregó aprobación/rechazo de devolución por médico; si existe PaymentIntent pagado, se prepara reembolso sobre ese pago de cita.
- El reagendado aceptado por médico puede asignar automáticamente el horario disponible más cercano.
- El webhook de Stripe ahora contempla `charge.refunded` y actualiza pagos/citas reembolsadas.
- Se creó `docs/beta/STRIPE_SETUP_STATUS.md` con variables, webhook, separación de cobros y pendientes de configuración.

Archivos modificados:

- `app/api/appointments/[id]/route.ts`
- `app/api/payments/route.ts`
- `app/api/stripe/connect/onboarding/route.ts`
- `app/api/stripe/connect/status/route.ts`
- `app/api/subscriptions/checkout/route.ts`
- `app/api/webhooks/stripe/route.ts`
- `components/platform/DashboardClients.tsx`
- `lib/validation/schemas.ts`
- `prisma/schema.prisma`

Archivos creados:

- `lib/appointments/reschedule.ts`
- `prisma/migrations/20260520013000_refund_reschedule_controls/migration.sql`
- `docs/beta/STRIPE_SETUP_STATUS.md`

Validación ejecutada:

- `npx prisma generate`: correcto.
- `npm run typecheck`: correcto.
- `npm run lint`: correcto.
- `npm run build`: correcto.

Pendientes externos:

- Configurar `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`, `APP_URL` y `STRIPE_PLATFORM_FEE_PERCENTAGE` en Vercel.
- Registrar el webhook de Stripe con los eventos documentados.

## Directorio Representantes Médicos / Catering

Cambios aplicados:
- La sección pública de representantes médicos ahora opera como “Representantes Médicos / Catering”.
- Se agregó selector visual por tabs/pills para alternar entre representantes médicos y catering sin romper la estética premium actual.
- `GET /api/medical-representatives` ahora devuelve representantes y catering desde base de datos, filtrando únicamente registros `ACTIVE` con suscripción Obsidiana `ACTIVE`.
- Se agregaron modelos `MarketplaceListing` y `MarketplaceSubscriptionPayment` para representantes médicos, servicios de catering y pagos Obsidiana.
- Se agregó la suscripción `obsidiana` como plan médico y como plan comercial para representantes/catering, con precio de $250 MXN (`25000` centavos).
- `POST /api/marketplace-subscriptions/checkout` abre Checkout mensual en Stripe hacia la cuenta administradora de VITAEON; si falta `OBSIDIANA_PRICE_CENTS`, el backend usa `25000` como precio seguro por defecto.
- Se agregó base administrativa con `GET/POST/PATCH /api/admin/marketplace-listings` para crear, revisar, activar, pausar o rechazar representantes y catering.
- El webhook de Stripe reconoce `marketplace_obsidiana` para activar o fallar suscripciones Obsidiana sin mezclar pagos de citas ni suscripciones médicas.

Riesgos pendientes:
- Falta conectar una vista específica en el panel admin para gestionar representantes/catering desde interfaz, aunque la API segura ya quedó preparada.
- Debe mantenerse `OBSIDIANA_PRICE_CENTS=25000` en Vercel para documentar claramente el precio vigente y confirmar webhook Stripe con eventos de checkout/suscripción.
- No publicar representantes ni catering sin revisión administrativa y datos de contacto verificados.
- Completar onboarding Connect de cada médico antes de cobrar citas en línea.
- Pasar de pagos únicos de planes a Billing recurrente si se desea suscripción mensual automática.
