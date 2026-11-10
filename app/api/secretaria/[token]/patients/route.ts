import { fail, ok } from "@/lib/api-response";
import { getSecretarySession } from "@/lib/auth/secretary";
import { prisma } from "@/lib/db/prisma";
import { rateLimitByIp } from "@/lib/security/rate-limit";

/** Mínimo de caracteres antes de buscar, para no enumerar el padrón de pacientes. */
const MIN_QUERY_LENGTH = 3;

/** Resultados devueltos como máximo. */
const MAX_RESULTS = 8;

/**
 * GET — buscar pacientes del médico para que la secretaría agende por teléfono.
 *
 * La secretaría entra por enlace + PIN y NO tiene cuenta VITAEON, así que nunca
 * pasa por `getCurrentUser()`. El panel usaba `/api/assistants/patients`, que
 * exige `role === "ASSISTANT"`: devolvía 403 siempre y el cliente lo traducía a
 * "No se encontró ningún paciente", culpando al paciente de un fallo de
 * autenticación. El resultado era que la secretaria daba de alta como invitado a
 * alguien ya registrado y partía su expediente en dos.
 *
 * La búsqueda se acota a pacientes con historial con ESE médico: la secretaría
 * de un consultorio no puede enumerar pacientes de otro.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  /**
   * La rama de correo exacto responde si una dirección tiene cuenta en VITAEON.
   * Para atender una llamada eso es verificar a quien ya te está dictando su
   * correo; a ritmo de script es construir un padrón de quién busca atención
   * médica privada, que bajo LFPDPPP es dato sensible. El límite es lo que
   * separa una cosa de la otra: una recepción real no consulta 30 veces por
   * minuto.
   */
  const limit = await rateLimitByIp("secretaria:patients:search", { limit: 30, windowMs: 60_000 });
  if (!limit.allowed) {
    return fail("RATE_LIMITED", "Demasiadas búsquedas seguidas. Espera un momento.", 429);
  }

  const session = await getSecretarySession(token);
  if (!session) return fail("UNAUTHORIZED", "Sesión de secretaría no válida.", 401);

  const link = await prisma.doctorSecretaryLink.findUnique({
    where: { token },
    select: { isActive: true, doctorId: true }
  });
  if (!link?.isActive) return fail("LINK_INACTIVE", "El enlace fue desactivado por el médico.", 403);

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();
  if (q.length < MIN_QUERY_LENGTH) {
    return fail("QUERY_TOO_SHORT", `Escribe al menos ${MIN_QUERY_LENGTH} caracteres para buscar.`, 422);
  }

  /**
   * Dos caminos, con alcances distintos a propósito:
   *
   * - Por nombre o correo parcial: SOLO pacientes con historial con este médico.
   *   Buscar por fragmentos es descubrir, y descubrir pacientes de otros
   *   consultorios es la fuga que este endpoint existe para cerrar.
   *
   * - Por correo exacto: cualquier paciente registrado, haya venido o no. El
   *   paciente está dictando su correo por teléfono; esto es verificar que la
   *   cuenta existe, no explorar el padrón. Sin el correo completo no se llega
   *   a nadie, así que no habilita enumeración.
   *
   * Sin la segunda rama, un paciente que se registró y nunca ha venido con este
   * médico sería invisible y la secretaria lo duplicaría como invitado.
   */
  const pareceCorreoCompleto = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(q);

  const alcance = pareceCorreoCompleto
    ? { email: { equals: q, mode: "insensitive" as const } }
    : {
        patient: {
          appointments: { some: { doctorId: link.doctorId } }
        },
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } }
        ]
      };

  const users = await prisma.user.findMany({
    where: {
      role: "PATIENT",
      ...alcance
    },
    select: {
      id: true,
      name: true,
      email: true,
      patient: { select: { id: true, phone: true, dateOfBirth: true } }
    },
    take: MAX_RESULTS,
    orderBy: { name: "asc" }
  });

  return ok(
    users.map((u) => ({
      userId: u.id,
      patientId: u.patient?.id ?? null,
      name: u.name,
      email: u.email,
      phone: u.patient?.phone ?? null,
      dateOfBirth: u.patient?.dateOfBirth ?? null
    }))
  );
}
