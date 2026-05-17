import type { Metadata } from "next";
import { LegalPage } from "@/components/platform/LegalPage";

export const metadata: Metadata = {
  title: "Consentimiento de datos"
};

export default function DataConsentPage() {
  return (
    <LegalPage eyebrow="Consentimiento informado" title="Uso de datos en VITAEON">
      <p>
        Al crear una cuenta o agendar una cita, el usuario autoriza el tratamiento de datos necesarios para operar el flujo médico digital: identidad, contacto, cita, médico seleccionado, hospital, horario, pago y motivo general de consulta cuando sea proporcionado.
      </p>
      <p>
        El motivo de consulta debe usarse únicamente para preparar la atención y no reemplaza historia clínica completa, diagnóstico profesional ni consentimiento clínico específico del médico o institución.
      </p>
      <p>
        Los documentos de verificación médica pertenecen al proceso administrativo de VITAEON y no deben publicarse de forma abierta.
      </p>
    </LegalPage>
  );
}
