import type { Metadata } from "next";
import { PasswordResetClient } from "@/components/platform/PasswordRecoveryClient";

export const metadata: Metadata = {
  title: "Restablecer contraseña",
  description: "Crea una nueva contraseña para tu cuenta VITAEON."
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return <PasswordResetClient token={params.token ?? ""} />;
}
