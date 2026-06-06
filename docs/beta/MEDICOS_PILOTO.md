# Médicos Piloto

## Requisitos De Onboarding

- Nombre completo.
- Especialidad única.
- Hospital o clínica real.
- Dirección de consultorio.
- Universidad.
- Cédula profesional.
- Biografía profesional.
- Foto profesional.
- Declaración legal aceptada.
- Disponibilidad mensual configurada.
- Verificación aprobada por admin.
- Cuenta de cobro Stripe Connect configurada para pagos de citas.
- Plan médico activo.

## Flujo Recomendado Para El Primer Médico Real

1. El médico crea o inicia sesión con rol médico.
2. Entra al Panel Médico.
3. Revisa la tarjeta "Onboarding beta privada".
4. Completa Perfil profesional.
5. Acepta la declaración profesional obligatoria.
6. Sube foto profesional, foto de consultorio e imagen de cédula.
7. Configura disponibilidad mensual real.
8. Configura "Cobros y cuenta bancaria" con Stripe Connect.
9. Selecciona o confirma su plan médico.
10. Envía verificación.
11. El administrador revisa documentos y aprueba o rechaza.
12. Una vez aprobado, se prueba una cita real con pago en línea de prueba.

## Checklist De Validación Antes De Enviar Pacientes

- El panel médico muestra todos los pasos de onboarding completados.
- El perfil aparece como verificado.
- El médico tiene al menos un horario disponible futuro.
- El pago de cita genera transferencia hacia la cuenta conectada del médico.
- El pago de suscripción aparece como ingreso de plataforma.
- El paciente recibe ticket visible.
- El médico ve la cita en Agenda clínica.
- El webhook de Stripe responde HTTP 200.
- No hay perfiles demo públicos visibles.

## Criterios Para Publicar Perfil

Un médico no debe aparecer públicamente si:

- No está verificado.
- No completó perfil.
- No aceptó declaración legal.
- No tiene cédula.
- No tiene especialidad válida.
- No tiene hospital/consultorio válido.
- Está pausado por administración.

## Guion De Prueba Con Médico

1. Crear cuenta médica.
2. Completar perfil.
3. Configurar disponibilidad.
4. Enviar verificación.
5. Admin aprueba.
6. Paciente reserva.
7. Médico acepta.
8. Médico completa o marca no asistencia.

## Mensaje Sugerido Para Invitar Al Médico Piloto

Hola, doctor(a). Estamos iniciando la beta privada de VITAEON en León, Guanajuato.

El primer paso es completar su perfil médico, configurar disponibilidad real y conectar su cuenta de cobro para que las citas pagadas en línea lleguen correctamente a su cuenta mediante Stripe.

La plataforma mostrará una guía interna llamada "Onboarding beta privada" dentro del Panel Médico. Esa guía indica qué falta antes de publicar su perfil para pacientes reales.
