"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Users, CheckCircle2, XCircle, BarChart2 } from "lucide-react";
import { clientApi } from "@/services/client/api";

/* ── Types ─────────────────────────────────────────────────── */

type DayCount = { label: string; count: number };

type AnalyticsData = {
  revenueThisMonthCents: number;
  revenueLastMonthCents: number;
  total90: number;
  completed90: number;
  cancelled90: number;
  completionRate: number;
  byStatus: Record<string, number>;
  appointmentsByDay: DayCount[];
  topPatients: Array<{ name: string; count: number }>;
};

/* ── Helpers ────────────────────────────────────────────────── */

function money(cents: number) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(
    cents / 100
  );
}

function pct(value: number, total: number) {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
}

/* ── Bar chart (pure CSS) ───────────────────────────────────── */

function MiniBarChart({ data }: { data: DayCount[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="flex h-28 items-end gap-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-t-lg bg-[#1e9bd4]/70 transition-all"
            style={{ height: `${Math.max((d.count / max) * 100, 4)}%` }}
            title={`${d.count} citas`}
          />
          <span className="text-[10px] font-semibold text-slate-400">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ── Stat card ──────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "default"
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone?: "default" | "green" | "red";
}) {
  const iconBg =
    tone === "green" ? "bg-emerald-50 text-emerald-600" : tone === "red" ? "bg-red-50 text-red-500" : "bg-[#071726]/5 text-[#071726]";
  return (
    <div className="flex items-start gap-4 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>{icon}</div>
      <div>
        <p className="text-2xl font-bold text-[#071726]">{value}</p>
        <p className="mt-0.5 text-xs font-semibold text-slate-500">{label}</p>
        {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Main section ───────────────────────────────────────────── */

export function DoctorAnalyticsSection() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    clientApi<AnalyticsData>("/api/doctor/analytics")
      .then(setData)
      .catch(() => setError("No fue posible cargar las estadísticas."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="dashboard-card rounded-[1.75rem] border-silver/70 animate-pulse">
        <div className="h-6 w-48 rounded-full bg-slate-100" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-24 rounded-2xl bg-slate-100" />
          ))}
        </div>
      </section>
    );
  }

  if (error || !data) {
    return null; // silencioso si hay error, no rompe el dashboard
  }

  const revenueDiff = data.revenueThisMonthCents - data.revenueLastMonthCents;
  const revenueTrend = revenueDiff >= 0 ? "up" : "down";
  const revenuePct = data.revenueLastMonthCents > 0
    ? Math.abs(Math.round((revenueDiff / data.revenueLastMonthCents) * 100))
    : null;

  return (
    <section className="dashboard-card rounded-[1.75rem] border-silver/70">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-medical">Estadísticas</p>
          <h2 className="mt-2 text-2xl font-semibold text-deep">Rendimiento clínico</h2>
          <p className="mt-1 text-sm text-slate-500">Últimos 90 días · actualizado en tiempo real</p>
        </div>
        <BarChart2 className="h-8 w-8 shrink-0 text-slate-200" />
      </div>

      {/* Stat cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Ingresos este mes"
          value={money(data.revenueThisMonthCents)}
          sub={
            revenuePct !== null
              ? revenueTrend === "up"
                ? `+${revenuePct}% vs mes anterior`
                : `-${revenuePct}% vs mes anterior`
              : `Mes anterior: ${money(data.revenueLastMonthCents)}`
          }
          icon={revenueTrend === "up" ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          tone={revenueTrend === "up" ? "green" : "default"}
        />
        <StatCard
          label="Tasa de completadas"
          value={`${data.completionRate}%`}
          sub={`${data.completed90} de ${data.total90} citas (90 días)`}
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone={data.completionRate >= 80 ? "green" : data.completionRate >= 60 ? "default" : "red"}
        />
        <StatCard
          label="Canceladas (90 días)"
          value={String(data.cancelled90)}
          sub={`${pct(data.cancelled90, data.total90)}% del total`}
          icon={<XCircle className="h-5 w-5" />}
          tone={data.cancelled90 === 0 ? "green" : "default"}
        />
        <StatCard
          label="Total citas (90 días)"
          value={String(data.total90)}
          sub="Todas las citas registradas"
          icon={<Users className="h-5 w-5" />}
        />
      </div>

      {/* Charts row */}
      <div className="mt-6 grid gap-5 md:grid-cols-2">

        {/* Day-of-week bar chart */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
          <p className="mb-4 text-sm font-semibold text-[#071726]">Citas por día de la semana</p>
          <MiniBarChart data={data.appointmentsByDay} />
          <p className="mt-3 text-xs text-slate-400">Basado en los últimos 90 días</p>
        </div>

        {/* Top patients */}
        <div className="rounded-2xl border border-slate-100 bg-slate-50/60 p-5">
          <p className="mb-4 text-sm font-semibold text-[#071726]">Pacientes más frecuentes</p>
          {data.topPatients.length === 0 ? (
            <p className="text-sm text-slate-400">Sin datos suficientes aún.</p>
          ) : (
            <div className="space-y-2">
              {data.topPatients.map((p, i) => {
                const maxCount = data.topPatients[0]?.count ?? 1;
                const w = Math.max(Math.round((p.count / maxCount) * 100), 8);
                return (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-32 shrink-0 truncate text-sm font-medium text-[#071726]">{p.name}</div>
                    <div className="flex flex-1 items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-[#1e9bd4]"
                          style={{ width: `${w}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-right text-xs font-semibold text-slate-500">
                        {p.count} {p.count === 1 ? "cita" : "citas"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Insights accionables */}
      <div className="mt-6 rounded-2xl border border-slate-100 bg-gradient-to-br from-[#071726]/[0.03] to-white p-5">
        <p className="text-sm font-semibold text-[#071726]">💡 Insights para crecer</p>
        <ul className="mt-3 grid gap-2.5 text-sm text-slate-600 sm:grid-cols-2">
          {data.completionRate >= 90 ? (
            <li className="flex gap-2"><span className="shrink-0 text-emerald-500">🏆</span>Tu tasa de citas completadas es excelente. Comparte tu perfil para atraer más pacientes.</li>
          ) : data.completionRate >= 70 ? (
            <li className="flex gap-2"><span className="shrink-0 text-amber-500">📈</span>Puedes mejorar tu tasa de completadas confirmando citas rápidamente.</li>
          ) : (
            <li className="flex gap-2"><span className="shrink-0 text-red-400">⚠️</span>Tu tasa de completadas es baja. Verifica si hay cancelaciones frecuentes y contacta a tus pacientes.</li>
          )}
          {data.cancelled90 > 0 && (
            <li className="flex gap-2"><span className="shrink-0 text-slate-400">🔔</span>{data.cancelled90} {data.cancelled90 === 1 ? "cita cancelada" : "citas canceladas"} en 90 días. Los recordatorios automáticos reducen cancelaciones.</li>
          )}
          {data.revenueThisMonthCents === 0 && (
            <li className="flex gap-2"><span className="shrink-0 text-slate-400">💳</span>Activa los cobros en línea con Stripe para registrar ingresos automáticamente en tu panel.</li>
          )}
          <li className="flex gap-2"><span className="shrink-0 text-sky-500">👤</span>Los médicos con foto, bio y dirección completas reciben 4× más visitas en su perfil público.</li>
          {data.total90 > 0 && data.appointmentsByDay.some((d) => d.count === 0) && (
            <li className="flex gap-2"><span className="shrink-0 text-violet-400">📅</span>Algunos días de la semana no tienes citas. Considera publicar disponibilidad en esos días.</li>
          )}
        </ul>
      </div>

      {/* Status breakdown pills */}
      <div className="mt-5 flex flex-wrap gap-2">
        {Object.entries(data.byStatus)
          .sort((a, b) => b[1] - a[1])
          .map(([status, count]) => {
            const label: Record<string, string> = {
              COMPLETED: "Completadas",
              ACCEPTED: "Aceptadas",
              CONFIRMED: "Confirmadas",
              PENDING: "Pendientes",
              PENDING_DOCTOR_ACCEPTANCE: "Por aceptar",
              CANCELLED: "Canceladas",
              AUTO_CANCELLED: "Canceladas auto.",
              NO_SHOW: "No asistió",
              RESCHEDULE_REQUESTED: "Reagendamiento",
              RESCHEDULED: "Reagendadas",
              CANCELLATION_REQUESTED: "Cancel. solicitada",
              REFUND_PENDING: "Reembolso pend.",
              REFUNDED: "Reembolsadas"
            };
            const tone: Record<string, string> = {
              COMPLETED: "bg-emerald-50 text-emerald-700 border-emerald-200",
              ACCEPTED: "bg-sky-50 text-sky-700 border-sky-200",
              CANCELLED: "bg-red-50 text-red-600 border-red-200",
              AUTO_CANCELLED: "bg-red-50 text-red-600 border-red-200",
              NO_SHOW: "bg-orange-50 text-orange-600 border-orange-200"
            };
            return (
              <span
                key={status}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${tone[status] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}
              >
                {label[status] ?? status} · {count}
              </span>
            );
          })}
      </div>
    </section>
  );
}
