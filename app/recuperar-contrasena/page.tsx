import type { Metadata } from "next";
import { PasswordRequestClient } from "@/components/platform/PasswordRecoveryClient";

export const metadata: Metadata = {
  title: "Recuperar contraseña",
  description: "Recupera tu acceso seguro a VITAEON."
};

export default function RecoverPasswordPage() {
  return <PasswordRequestClient />;
}
