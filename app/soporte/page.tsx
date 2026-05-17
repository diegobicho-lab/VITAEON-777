import type { Metadata } from "next";
import { LegalPage } from "@/components/platform/LegalPage";

export const metadata: Metadata = {
  title: "Soporte VITAEON"
};

export default function SupportPage() {
  return (
    <LegalPage eyebrow="Ayuda" title="Soporte para beta privada">
      <p>
        Para soporte de pacientes, médicos o administración, escribe a soporte@vitaeon.mx con tu nombre, correo registrado y una descripción clara de la situación.
      </p>
      <p>
        Si necesitas recuperar acceso a tu cuenta durante la beta privada, solicita ayuda desde el mismo correo registrado. El equipo de VITAEON verificará identidad antes de cualquier cambio sensible.
      </p>
      <p>
        Para incidencias de pago, incluye número de cita, médico, fecha, hora y método de pago. No envíes datos de tarjeta por correo o mensajería.
      </p>
    </LegalPage>
  );
}
