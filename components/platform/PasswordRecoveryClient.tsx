"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { HeartPulse, Loader2, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { clientApi } from "@/services/client/api";

export function PasswordRequestClient() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setMessage("");
    try {
      const response = await clientApi<{ message: string }>("/api/auth/password/request", {
        method: "POST",
        body: JSON.stringify({ email })
      });
      setMessage(response.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible solicitar recuperación.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PasswordCard title="Recuperar contraseña" message={message} icon={<ShieldCheck className="h-7 w-7 text-medical" />}>
      <input
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        placeholder="Correo electrónico"
        type="email"
        className="w-full rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-3.5 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10"
      />
      <button
        disabled={loading}
        onClick={submit}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#071726] px-6 py-4 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0d2638] disabled:opacity-50"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : "Enviar instrucciones"}
      </button>
    </PasswordCard>
  );
}

export function PasswordResetClient({ token }: { token: string }) {
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    setMessage("");
    try {
      const response = await clientApi<{ message: string }>("/api/auth/password/reset", {
        method: "POST",
        body: JSON.stringify({ token, password })
      });
      setMessage(response.message);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No fue posible cambiar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <PasswordCard title="Nueva contraseña" message={message} icon={<ShieldCheck className="h-7 w-7 text-medical" />}>
      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="Nueva contraseña segura"
        className="w-full rounded-2xl border border-silver/60 bg-slate-50/80 px-5 py-3.5 text-deep outline-none transition focus:border-medical/40 focus:bg-white focus:ring-2 focus:ring-medical/10"
      />
      <button
        disabled={loading || !token}
        onClick={submit}
        className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#071726] px-6 py-4 font-semibold text-white transition hover:-translate-y-0.5 hover:bg-[#0d2638] disabled:opacity-50"
      >
        {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> Actualizando...</> : "Cambiar contraseña"}
      </button>
    </PasswordCard>
  );
}

function PasswordCard({ title, message, icon, children }: { title: string; message: string; icon: ReactNode; children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#faf9f7_0%,#ffffff_50%,#eef5f8_100%)] px-4 py-16 text-ink">
      <section className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#071726]">
            <HeartPulse className="h-7 w-7 text-white" />
          </div>
          <p className="text-sm font-bold tracking-[0.42em] text-deep">VITAEON</p>
        </div>
        <div className="rounded-[2rem] border border-silver/70 bg-white px-8 py-10 shadow-soft">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.32em] text-medical">Cuenta segura</p>
              <h1 className="mt-2 text-3xl font-bold text-deep">{title}</h1>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-medical/10">
              {icon}
            </div>
          </div>
          <div className="mt-8 grid gap-4">{children}</div>
          {message && (
            <p className="mt-5 rounded-2xl border border-medical/20 bg-medical/5 px-5 py-4 text-sm font-semibold text-medical">
              {message}
            </p>
          )}
          <Link href="/" className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-deep">
            ← Volver al inicio
          </Link>
        </div>
      </section>
    </main>
  );
}
