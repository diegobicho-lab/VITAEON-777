"use client";

import { Loader2, Trash2, UserPlus } from "lucide-react";
import { useEffect, useState } from "react";
import { clientApi } from "@/services/client/api";

/* ── Tipos ──────────────────────────────────────────────────── */

type AssistantItem = {
  id: string;
  userId: string;
  doctorId: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
    createdAt: string;
  };
};

/* ── Componente ─────────────────────────────────────────────── */

export function DoctorAssistantsSection({
  plan,
  onMessage
}: {
  plan: string; // "oro" | "diamante" | "amatista" | "obsidiana"
  onMessage: (msg: string) => void;
}) {
  const [assistants, setAssistants] = useState<AssistantItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [sectionMessage, setSectionMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const isPlanAllowed = plan === "diamante" || plan === "amatista";

  async function load() {
    if (!isPlanAllowed) { setLoading(false); return; }
    setLoading(true);
    try {
      const data = await clientApi<AssistantItem[]>("/api/doctor/assistants");
      setAssistants(data);
    } catch {
      // silencioso: la lista se muestra vacía si hay error
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  function showMsg(text: string, ok: boolean) {
    setSectionMessage({ text, ok });
    setTimeout(() => setSectionMessage(null), 6000);
  }

  async function invite() {
    if (!name.trim() || !email.trim()) {
      showMsg("Completa el nombre y correo del asistente.", false);
      return;
    }
    setSaving(true);
    try {
      await clientApi("/api/doctor/assistants", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), email: email.trim().toLowerCase() })
      });
      setName("");
      setEmail("");
      showMsg("✓ Asistente invitado. Sus credenciales llegaron al correo proporcionado.", true);
      await load();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "No fue posible invitar al asistente.", false);
    } finally {
      setSaving(false);
    }
  }

  async function revoke(assistantId: string, assistantName: string) {
    if (!window.confirm(`¿Revocar el acceso de ${assistantName}? Esta acción eliminará su cuenta de VITAEON.`)) return;
    setRevoking(assistantId);
    try {
      await clientApi(`/api/doctor/assistants/${assistantId}`, { method: "DELETE" });
      showMsg("✓ Acceso revocado. La cuenta del asistente fue eliminada.", true);
      await load();
    } catch (err) {
      showMsg(err instanceof Error ? err.message : "No fue posible revocar el acceso.", false);
    } finally {
      setRevoking(null);
    }
  }

  function formatDate(value: string) {
    return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" }).format(new Date(value));
  }

  /* ── Plan insuficiente ── */
  if (!isPlanAllowed) {
    return (
      <section className="dashboard-card rounded-[1.75rem] border-silver/70">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Asistente de recepción</p>
            <h2 className="mt-2 text-2xl font-semibold text-deep">Gestión de asistentes</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Invita a tu secretaria o recepcionista como asistente en VITAEON. Tendrá acceso a un panel dedicado para ver la agenda y registrar citas de pacientes en tu nombre.
            </p>
          </div>
          <span className="inline-block rounded-full bg-amber-100 px-4 py-1.5 text-xs font-semibold text-amber-700">
            Disponible en Plan Diamante y Amatista
          </span>
        </div>
        <div className="mt-6 rounded-2xl border border-dashed border-silver/50 bg-slate-50/60 px-6 py-8 text-center">
          <UserPlus className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm text-slate-400">Actualiza tu plan para activar la función de asistente.</p>
        </div>
      </section>
    );
  }

  /* ── Plan correcto ── */
  return (
    <section className="dashboard-card rounded-[1.75rem] border-silver/70">
      {/* Mensaje de estado — aparece justo arriba del encabezado de esta sección */}
      {sectionMessage && (
        <div
          className={`mb-5 flex items-start gap-3 rounded-2xl px-5 py-3.5 text-sm font-medium ${
            sectionMessage.ok
              ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200"
              : "bg-red-50 text-red-700 ring-1 ring-red-200"
          }`}
        >
          <span>{sectionMessage.ok ? "✓" : "⚠"}</span>
          <span>{sectionMessage.text}</span>
        </div>
      )}
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Asistente de recepción</p>
        <h2 className="mt-2 text-2xl font-semibold text-deep">Gestión de asistentes</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Tu asistente accede a un panel dedicado para ver tu agenda y registrar citas de pacientes en tu nombre. Puedes tener un asistente activo a la vez.
        </p>
      </div>

      {/* Asistente actual */}
      <div className="mt-6">
        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin text-medical" />
            Cargando asistentes…
          </div>
        ) : assistants.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-silver/50 bg-slate-50/60 px-6 py-6 text-center">
            <UserPlus className="mx-auto h-7 w-7 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">Sin asistente asignado. Invita a tu secretaria o recepcionista.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {assistants.map((a) => (
              <div
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-silver/50 bg-slate-50/60 px-5 py-4"
              >
                <div>
                  <p className="font-semibold text-deep">{a.user.name}</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {a.user.email} · Desde {formatDate(a.createdAt)}
                  </p>
                </div>
                <button
                  onClick={() => revoke(a.id, a.user.name)}
                  disabled={revoking === a.id}
                  className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                >
                  {revoking === a.id
                    ? <Loader2 className="h-4 w-4 animate-spin" />
                    : <Trash2 className="h-4 w-4" />}
                  Revocar acceso
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Formulario de invitación (solo si no tiene ya un asistente) */}
      {!loading && assistants.length === 0 && (
        <div className="mt-6 rounded-2xl border border-silver/50 bg-white p-5">
          <p className="font-semibold text-deep">Invitar asistente</p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Se creará una cuenta de acceso restringido y se enviarán las credenciales al correo indicado.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre completo"
              className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-sm text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10"
            />
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Correo electrónico"
              type="email"
              className="rounded-2xl border border-silver/60 bg-slate-50/80 px-4 py-3 text-sm text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10"
            />
          </div>
          <button
            onClick={invite}
            disabled={saving || !name.trim() || !email.trim()}
            className="mt-4 flex items-center gap-2 rounded-full bg-[#071726] px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0d2638] disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Enviar invitación
          </button>
        </div>
      )}

      {/* Información de acceso */}
      <div className="mt-5 rounded-2xl bg-sky-50/60 px-5 py-4">
        <p className="text-sm leading-6 text-sky-800">
          <strong>Acceso del asistente:</strong> Tu asistente inicia sesión en VITAEON con su correo y contraseña temporal, y accede directamente a{" "}
          <span className="font-mono text-xs">/dashboard/assistant</span> — un panel simplificado sin acceso a tus datos clínicos, historial o cobros.
        </p>
      </div>
    </section>
  );
}
