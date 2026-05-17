import type { Metadata } from "next";
import { LegalPage } from "@/components/platform/LegalPage";

export const metadata: Metadata = {
  title: "Política de cancelaciones"
};

export default function CancellationPolicyPage() {
  return (
    <LegalPage eyebrow="Citas" title="Política de cancelaciones">
      <p>
        Las citas en VITAEON pueden cancelarse desde el panel del paciente conforme a las reglas visibles al momento de reservar. Para la beta privada, recomendamos solicitar cambios con al menos 24 horas de anticipación.
      </p>
      <p>
        Cuando una cita se cancela, el horario deja de aparecer como confirmado y queda registrado en auditoría para proteger la trazabilidad entre paciente, médico y administración.
      </p>
      <p>
        La plataforma no garantiza atención inmediata. Si existe una urgencia médica real, el paciente debe acudir a servicios de emergencia o llamar a los números locales correspondientes.
      </p>
    </LegalPage>
  );
}
