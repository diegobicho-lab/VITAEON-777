import type { Metadata } from "next";
import { LegalPage } from "@/components/platform/LegalPage";

export const metadata: Metadata = {
  title: "Aviso de urgencias"
};

export default function EmergencyNoticePage() {
  return (
    <LegalPage eyebrow="Aviso médico" title="VITAEON no sustituye atención de urgencia">
      <p>
        VITAEON es una plataforma de orientación, búsqueda y agendamiento. No sustituye servicios de emergencia, urgencias hospitalarias, ambulancia ni valoración inmediata ante signos de alarma.
      </p>
      <p>
        Si existe dolor intenso de pecho, dificultad para respirar, pérdida de conciencia, sangrado importante, síntomas neurológicos súbitos, riesgo de autolesión o cualquier situación grave, acude de inmediato a urgencias o llama a los servicios de emergencia locales.
      </p>
      <p>
        Las recomendaciones inteligentes dentro de VITAEON son orientación general y no reemplazan el criterio clínico de un profesional de salud.
      </p>
    </LegalPage>
  );
}
