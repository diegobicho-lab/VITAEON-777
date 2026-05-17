"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
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

  return <PasswordCard title="Recuperar contraseña" message={message} icon={<ShieldCheck className="h-8 w-8 text-medical" />}>
    <input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Correo electrónico" className="w-full rounded-3xl bg-slate-50 px-5 py-4 outline-none" />
    <button disabled={loading} onClick={submit} className="mt-4 rounded-full bg-black px-6 py-3 font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50">
      {loading ? "Enviando..." : "Enviar instrucciones"}
    </button>
  </PasswordCard>;
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

  return <PasswordCard title="Nueva contraseña" message={message} icon={<ShieldCheck className="h-8 w-8 text-medical" />}>
    <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Nueva contraseña segura" className="w-full rounded-3xl bg-slate-50 px-5 py-4 outline-none" />
    <button disabled={loading || !token} onClick={submit} className="mt-4 rounded-full bg-black px-6 py-3 font-semibold text-white transition hover:-translate-y-0.5 disabled:opacity-50">
      {loading ? "Actualizando..." : "Cambiar contraseña"}
    </button>
  </PasswordCard>;
}

function PasswordCard({ title, message, icon, children }: { title: string; message: string; icon: ReactNode; children: ReactNode }) {
  return (
    <main className="min-h-screen bg-soft px-5 py-10 text-ink">
      <section className="mx-auto max-w-2xl rounded-[2rem] border border-silver bg-white p-8 shadow-premium">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-medical">VITAEON</p>
            <h1 className="mt-3 text-4xl font-semibold text-deep">{title}</h1>
          </div>
          {icon}
        </div>
        <div className="mt-8">{children}</div>
        {message && <p className="mt-5 rounded-3xl bg-slate-50 p-4 text-sm font-semibold text-medical">{message}</p>}
        <Link href="/" className="mt-6 inline-flex text-sm font-semibold text-deep">Volver al inicio</Link>
      </section>
    </main>
  );
}
