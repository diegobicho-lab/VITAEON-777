# VITAEON

Plataforma médica premium para conectar pacientes con especialistas verificados, hospitales privados, citas, pagos y paneles profesionales.

## Estado actual

El proyecto fue migrado de un prototipo SPA servido por CDN a una arquitectura Next.js preparada para producción y con flujo funcional conectado a API:

- Next.js App Router.
- TypeScript.
- Tailwind CSS compilado.
- Prisma ORM con PostgreSQL.
- API Routes para doctores, disponibilidad médica, verificación médica, citas, pagos, login, representantes médicos y auditoría.
- Sesiones HTTP-only con JWT firmado.
- Roles: paciente, doctor, administrador y staff.
- Stripe preparado para Payment Intents y webhooks.
- Auditoría de acciones sensibles.
- Seed limpio para beta privada: admin principal, especialidades reales y hospitales reales de catálogo en León, sin médicos ni opiniones ficticias visibles.
- Home funcional conectada a `/api/specialties`, `/api/hospitals`, `/api/doctors`, `/api/auth/*`, `/api/appointments` y `/api/payments`.
- Dashboards funcionales para paciente, médico y administrador.
- Registro médico con perfil inicial editable y verificación pendiente.
- Calendario mensual médico con disponibilidad, bloqueos, repetición semanal y citas dentro de cada día.
- Secretaria médica virtual para plan Amatista con agenda del día, próxima cita, huecos disponibles y notificaciones internas.
- Notificaciones internas para pacientes y médicos.
- Fotos de perfil, consultorio y cédula profesional visible para perfil médico.
- Checkout de suscripción médica preparado con Stripe para Diamante y Amatista; Oro se activa sin cobro.
- Búsqueda de medicamentos preparada para fuente autorizada externa, con fallback seguro si no existe API configurada.
- Home enriquecida con indicadores de confianza, cómo funciona y FAQ sin depender de perfiles médicos ficticios.
- Descuento de bienvenida del 35% para pacientes nuevos en su primera consulta con la Dra. Susana Pérez Guadarrama, Medicina Interna.
- Opiniones de pacientes con estrellas, moderación básica y respuesta del médico.
- Botón de atención urgente que ordena disponibilidad por horarios más cercanos dentro de la especialidad seleccionada.
- Perfil médico público ampliado con dirección, referencia, mapa, teléfono profesional y redes sociales.
- Panel admin ampliado con médicos registrados, citas recientes, pagos, pacientes y auditoría.
- Modo Beta Privada dentro del panel admin con métricas operativas para piloto controlado.
- Capa cliente reutilizable en `services/client`.
- Rate limiting básico en login, registro, citas, pagos, disponibilidad, catálogos y verificación médica.
- Cifrado AES-256-GCM aplicado a campos clínicos sensibles del flujo de citas cuando `ENCRYPTION_KEY` está configurado.
- Storage privado abstraído para documentos médicos, sin aceptar URLs públicas directas.
- Pruebas unitarias y e2e base declaradas.

> Validación local: se ejecutaron correctamente `npx prisma validate`, `npx prisma generate`, `npm run typecheck`, `npm run lint` y `npm run build`. La migración requiere PostgreSQL activo en `DATABASE_URL`.

## Instalación

```bash
npm install
cp .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Abre `http://localhost:3000`.

## Comandos

```bash
npm run dev        # Desarrollo Next.js
npm run build      # Build de producción
npm run start      # Servir build
npm run lint       # Revisión ESLint
npm run typecheck  # Revisión TypeScript
npm run format     # Prettier
npm run db:migrate # Migraciones Prisma
npm run db:seed    # Catálogo beta limpio y admin inicial
npm run test:unit   # Pruebas unitarias
npm run test:e2e    # Pruebas e2e Playwright
```

## Variables de entorno

Ver `.env.example`.

- `DATABASE_URL`: conexión PostgreSQL.
- `AUTH_SECRET`: secreto fuerte para firmar sesión.
- `ENCRYPTION_KEY`: llave base64 de 32 bytes para cifrar campos médicos sensibles.
- `STRIPE_SECRET_KEY`: clave privada Stripe.
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`: clave pública Stripe.
- `STRIPE_WEBHOOK_SECRET`: firma de webhook.
- `APP_URL` y `NEXT_PUBLIC_APP_URL`: URL base para redirecciones de checkout y enlaces internos.
- `MEDICATION_API_URL`, `MEDICATION_API_KEY`: fuente autorizada futura para búsqueda de medicamentos.
- `EMAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_SECURE`, `SMTP_STARTTLS`: correos de cuenta, citas, pagos, verificación y recuperación de contraseña.
- `STORAGE_*`: documentos de verificación médica.
- `STORAGE_PROVIDER`: `local-dev`, `s3`, `supabase` u otro proveedor futuro.
- `RATE_LIMIT_DRIVER`: por ahora `memory`; en producción debe migrarse a Redis/gateway.
- `BETA_ALLOW_INDEXING`: mantener `false` durante beta privada para bloquear indexación general en `robots.txt`.
- `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`: credenciales iniciales de seed; cambiar contraseña después del primer acceso.

## Estructura

```text
app/                 Rutas Next.js, dashboards y API routes
components/platform/ Experiencia visual conectada a API real
lib/                 Auth, DB, seguridad, validaciones, pagos y auditoría
services/            Servicios de negocio del servidor
types/               Tipos compartidos
prisma/              Schema y seed
app/globals.css      Estilo visual premium, Tailwind y estilos globales
docs/                Auditoría y notas de producción
docs/beta/           Roadmap, QA, deployment y bloqueadores de beta
```

## Seguridad

La arquitectura evita contraseñas en texto plano, usa cookies HTTP-only, separa permisos por rol y registra acciones relevantes en `AuditLog`. Para producción médica real todavía se debe completar revisión legal, cifrado de campos sensibles, almacenamiento privado de documentos, backups, monitoreo y pruebas de penetración.

## Beta Privada

La carpeta `docs/beta` contiene los documentos operativos para ejecutar un piloto serio:

- `BETA_ROADMAP.md`
- `QA_CHECKLIST.md`
- `DEPLOYMENT_GUIDE.md`
- `MEDICOS_PILOTO.md`
- `PACIENTES_PILOTO.md`
- `LAUNCH_BLOCKERS.md`
- `BETA_READY_CHECKLIST.md`

Durante beta privada, `BETA_ALLOW_INDEXING=false` evita indexación accidental. Solo perfiles médicos completos, activos, verificados, con cédula y declaración legal aceptada aparecen públicamente.

## API inicial

- `GET /api/auth/me`: usuario autenticado.
- `GET /api/doctors`: médicos verificados con filtros.
- `GET /api/admin/doctors`: listado administrativo de médicos.
- `GET/PATCH /api/doctors/me`: perfil editable del médico autenticado.
- `GET/POST/PATCH /api/availability`: disponibilidad gestionada por médicos, incluyendo horarios disponibles y no disponibles.
- `GET/POST /api/appointments`: citas con bloqueo de horario.
- `GET/PATCH /api/appointments/:id`: detalle y ciclo de vida de cita por acciones: `ACCEPT`, `COMPLETE`, `MARK_NO_SHOW`, `REQUEST_RESCHEDULE`, `REQUEST_CANCELLATION`, `MARK_REFUND_PENDING` y `CANCEL`.
- `POST /api/auth/register`: registro de paciente o solicitud inicial de cuenta médica.
- `POST /api/auth/login`: sesión segura por cookie HTTP-only.
- `POST /api/auth/logout`: cierre de sesión y auditoría.
- `POST /api/auth/password/request`: recuperación de contraseña sin revelar si el correo existe.
- `POST /api/auth/password/reset`: cambio de contraseña con token seguro, expiración e invalidación.
- `GET /api/payments`: pagos visibles según rol.
- `POST /api/payments`: preparación de pago Stripe o efectivo pendiente.
- `GET /api/patients`: pacientes para administración o staff.
- `POST /api/webhooks/stripe`: confirmación backend de pagos.
- `GET/POST/PATCH /api/medical-verifications`: envío y revisión administrativa de verificación médica.
- `GET/POST /api/specialties`: catálogo público y alta administrativa.
- `GET/POST /api/hospitals`: catálogo público y alta administrativa.
- `GET /api/audit-logs`: auditoría para administración.
- `GET /api/medical-representatives`: directorio público de representantes médicos y catering con Obsidiana activa.
- `GET/POST/PATCH /api/admin/marketplace-listings`: administración de representantes médicos, catering y estado de Obsidiana.
- `POST /api/marketplace-subscriptions/checkout`: activación o checkout mensual Obsidiana para representantes/catering; los pagos entran a la cuenta VITAEON.
- `GET /api/doctor-agenda`: agenda médica ordenada por días y horarios publicados.
- `GET /api/doctor-agenda?month=YYYY-MM`: calendario médico mensual con disponibilidad y citas.
- `GET/POST /api/doctor-assistant`: secretaria médica virtual para plan Amatista.
- `GET/PATCH /api/notifications`: notificaciones internas.
- `POST /api/availability/bulk`: bloques de disponibilidad por día o repetición semanal.
- `POST /api/subscriptions/checkout`: checkout Stripe para planes médicos y activación de Oro.
- `POST /api/uploads/images`: subida segura de imágenes médicas del doctor.
- `POST /api/medications/search`: búsqueda de medicamentos para plan Amatista con integración externa configurable.
- `GET/POST /api/doctor-conversations`: conversaciones médicas cifradas para derivaciones.
- `GET/POST /api/doctor-conversations/:id/messages`: mensajes de chat médico protegidos por rol.
- `GET /api/discounts/welcome`: calcula descuento de bienvenida por médico y paciente autenticado.
- `GET/POST/PATCH /api/reviews`: opiniones de pacientes, respuesta médica y moderación administrativa.
- `GET /api/urgent-availability`: médicos con disponibilidad futura más cercana por especialidad.

## Flujo de prueba

1. Instala dependencias, configura `.env`, levanta PostgreSQL y ejecuta migraciones/seed.
2. Entra a la home y filtra médicos por especialidad u hospital.
3. Registra un paciente desde el modal de autenticación.
4. Selecciona un médico verificado, elige disponibilidad real y crea una cita.
5. Si un médico real autorizado activa la campaña de la Dra. Susana Pérez Guadarrama y el paciente es elegible, revisa el descuento de bienvenida antes del pago.
6. Elige efectivo para dejar pago pendiente o Stripe para generar Payment Intent.
7. Usa el botón “Buscar atención urgente” para listar horarios cercanos por especialidad sin prometer atención inmediata.
8. Entra al panel de paciente para ver ticket, pago, descuento aplicado y estado “Pendiente de aceptación médica”.
9. Entra como médico, acepta la cita, complétala o marca “Paciente no llegó” cuando aplique.
10. Si el médico marca no asistencia, el paciente puede solicitar reagendamiento o cancelación desde “Mis citas”.
11. Después de una cita completada, publica una opinión con estrellas.
10. Registra un médico real desde la UI o créalo desde admin/onboarding privado; no hay médico demo público en el seed.
11. El médico completa perfil, hospital/consultorio, universidad, cédula, redes, disponibilidad y verificación.
12. El admin aprueba la verificación médica para que el perfil pueda aparecer públicamente.
13. En el panel médico revisa opiniones recibidas y responde cuando corresponda.
14. En el panel médico elige plan: Oro se activa gratis; Diamante y Amatista abren checkout Stripe en modo test si las llaves están configuradas.
15. Usa el calendario mensual para crear bloques por día o repetir disponibilidad semanal.
16. Si el médico está en Amatista, revisa la secretaria médica virtual y la búsqueda de medicamentos.
17. Inicia sesión como admin con `SEED_ADMIN_EMAIL` o `admin@vitaeon.mx`; la contraseña inicial es `SEED_ADMIN_PASSWORD` o `VitaeonBeta2026!`.
18. Aprueba/rechaza verificaciones, crea especialidades/hospitales, modera opiniones y revisa auditoría.
19. Revisa desde admin los médicos registrados, pacientes, pagos, citas recientes, reagendamientos y reembolsos pendientes.
20. Ejecuta `npm run test:unit` para validar esquemas críticos.
21. Ejecuta `npm run test:e2e` con el servidor disponible para revisar navegación, auth y paneles protegidos.
22. Prueba recuperación de contraseña desde `/recuperar-contrasena`; con SMTP configurado recibirás un enlace a `/restablecer-contrasena`.

## Ciclo de vida de citas y tickets

Las citas nuevas se crean como ticket visible para el paciente y quedan en estado `PENDING_DOCTOR_ACCEPTANCE` hasta que el médico las acepte.

Estados operativos:

- `PENDING_DOCTOR_ACCEPTANCE`: ticket creado, pendiente de aceptación médica.
- `ACCEPTED`: cita aceptada por el médico.
- `COMPLETED`: atención completada; habilita opinión verificada.
- `NO_SHOW`: el médico marcó que el paciente no asistió.
- `RESCHEDULE_REQUESTED`: el paciente solicitó reagendamiento; conserva el pago original si ya estaba pagado.
- `CANCELLATION_REQUESTED`: cancelación solicitada.
- `REFUND_PENDING`: posible devolución pendiente de revisión administrativa.
- `CANCELLED`: cita cancelada.
- `REFUNDED`: cita reembolsada si administración lo procesa manualmente.

Los reembolsos reales no se ejecutan automáticamente. VITAEON solo marca `REFUND_PENDING`, notifica al administrador y conserva trazabilidad para revisión manual. Cualquier devolución Stripe debe hacerse desde un flujo administrativo seguro, con webhook y conciliación activados.

## Colaboración Médica

El panel médico incluye una primera versión funcional de:

- Agenda clínica mensual con horarios libres, bloqueos, pacientes agendados, estado de cita y pago.
- Secretaria médica virtual Amatista con próxima cita, resumen del día, pendientes de confirmación, huecos disponibles y canales externos preparados.
- Chat médico para coordinación y derivación de pacientes entre especialistas.
- Notificaciones internas para eventos críticos de agenda.

Los alias de pacientes, resumen clínico y mensajes se guardan cifrados con AES-256-GCM mediante `ENCRYPTION_KEY`. Esta función no reemplaza expediente clínico formal ni consentimiento institucional; es una base segura para colaboración médica controlada.

## Planes Médicos

El plan activo del médico se guarda en `Doctor.medal` como distintivo operativo:

- `oro`: perfil básico, una especialidad, un hospital, fotografía, títulos médicos y visibilidad normal.
- `diamante`: todo lo anterior con prioridad sobre perfiles Oro dentro de la especialidad.
- `amatista`: prioridad superior a Diamante/Oro, agenda médica personalizada y asistente de IA para calendario.

El backend publica solo perfiles verificados con declaración legal aceptada. Cada médico tiene un único `Doctor` por `userId`, con una sola especialidad y un solo hospital. El backend bloquea el asistente para médicos que no tengan plan Amatista.

Los pagos de suscripción se registran en `SubscriptionPayment`. Stripe confirma Diamante/Amatista vía `checkout.session.completed` en el webhook; Oro se marca como plan gratuito sin tarjeta.

Antes de guardar datos profesionales, el médico debe aceptar esta declaración dentro del panel:

> Declaro bajo protesta de decir verdad que la información profesional, títulos, posgrados, subespecialidades, certificaciones y datos médicos proporcionados son reales, comprobables y me pertenecen.

## Páginas Legales

Se incluyen páginas mínimas coherentes con la marca:

- `/aviso-de-privacidad`
- `/terminos`
- `/consentimiento-datos`
- `/urgencias`

Antes de uso real con pacientes, estas páginas deben ser revisadas por asesoría legal y cumplimiento médico local.

## Pagos

Stripe está preparado desde backend para citas y suscripciones médicas. VITAEON no almacena tarjetas. El pago en efectivo se marca como pendiente. Mercado Pago queda reservado por variables y arquitectura.

Para probar suscripciones en modo test:

1. Configura `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` y `APP_URL`.
2. Entra como médico y elige Diamante o Amatista.
3. Completa Checkout con tarjeta de prueba de Stripe.
4. Ejecuta o expón el webhook local para que `/api/webhooks/stripe` active el plan automáticamente.

## Documentos médicos privados

Las verificaciones médicas guardan referencias tipo `private://provider/bucket/path`, no URLs públicas. En desarrollo puedes enviar una ruta privada como `doctors/doctor-id/cedula.pdf` y el backend la normaliza. En producción conecta S3, Supabase Storage o un proveedor equivalente y genera URLs firmadas temporales únicamente desde backend.

## Próximos pasos

1. Instalar dependencias en un entorno con `npm`.
2. Levantar PostgreSQL.
3. Ejecutar migraciones y seed.
4. Completar pruebas Stripe de citas y suscripciones con tarjetas de test y webhook local.
5. Sustituir rate limiting en memoria por Redis o gateway administrado.
6. Agregar MFA administrativo y médico; `ADMIN_MFA_REQUIRED` queda documentado como pendiente crítico de beta.
7. Conectar proveedor real para documentos médicos y medicamentos autorizados.
8. Ejecutar QA: accesibilidad, responsive, seguridad, rendimiento y e2e.
9. Revisar cumplimiento legal antes de pacientes reales.

## Beta privada / piloto

La plataforma quedó reforzada para operar una beta privada inicial en León, Guanajuato con pocos médicos reales y pacientes reales:

- Los perfiles públicos pueden mostrar universidad, cédula, hospital, ubicación, experiencia, foto profesional, redes y estado de verificación.
- Las opiniones ahora se aceptan únicamente cuando el paciente tiene una cita completada con ese médico.
- Administración puede activar o pausar perfiles médicos sin eliminarlos.
- El webhook de Stripe solo confirma citas que siguen en estado pendiente, evitando reactivar citas canceladas por confirmaciones tardías.
- Se agregaron páginas legales visibles: `/politica-cancelaciones`, `/politica-reembolsos` y `/soporte`.
- Se agregaron páginas indexables: `/especialidades/[slug]` y `/medicos/[slug]`, además de `sitemap.xml`.

Para probar el flujo beta:

1. Ejecuta `npm install`.
2. Configura `.env` con `DATABASE_URL`, `AUTH_SECRET`, `ENCRYPTION_KEY`, `APP_URL`, SMTP y llaves Stripe test.
3. Ejecuta `npm run db:migrate && npm run db:seed`.
4. Inicia con `npm run dev`.
5. Registra un paciente, busca Medicina Interna, agenda una cita y revisa ticket/pago.
6. Registra un médico real de beta, publica horarios y completa universidad, cédula, ubicación y redes.
7. Marca una cita como completada y prueba una opinión verificada.
8. Entra como admin, aprueba/rechaza verificaciones y activa/pausa médicos.

## Beta privada 2026-05-15

Se reforzó la operación mínima para piloto privado:

- Recuperación de contraseña con token seguro, expiración de 30 minutos, auditoría e invalidación después de uso.
- Correos SMTP transaccionales para registro, citas, pago Stripe, suscripciones, verificación médica y recuperación de contraseña.
- Panel médico simplificado en secciones: Resumen, Agenda clínica, Disponibilidad, Perfil profesional, Suscripción, Opiniones y Notificaciones.
- Páginas legales muestran nota de beta: requieren revisión jurídica antes de operación pública.
- Storage privado sigue abstraído; para producción conectar S3/Supabase Storage y generar URLs firmadas desde backend.
- Stripe sigue en modo preparado/test; VITAEON no almacena tarjetas y el webhook confirma citas solo si siguen pendientes.

Comandos recomendados para validar:

```bash
npm install
npm run db:migrate
npm run db:seed
npx prisma generate
npm run typecheck
npm run lint
npm run test:unit
npm run build
npm run dev
```
