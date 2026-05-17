import type { Metadata } from "next";
import { LegalPage } from "@/components/platform/LegalPage";

export const metadata: Metadata = {
  title: "Aviso de privacidad"
};

export default function PrivacyNoticePage() {
  return (
    <LegalPage eyebrow="Privacidad" title="Aviso de privacidad">
      <p>
        VITAEON trata datos personales de pacientes, médicos y usuarios con fines de identificación, registro, gestión de citas, pagos, comunicación operativa y verificación médica.
      </p>
      <p>
        Los datos clínicos o sensibles se limitan a lo necesario para operar la plataforma y deben consultarse únicamente por usuarios autorizados según su rol. La plataforma no vende datos médicos ni expone documentos privados de verificación.
      </p>
      <p>
        El usuario puede solicitar acceso, rectificación, cancelación u oposición de sus datos mediante los canales administrativos de VITAEON. Para producción real se requiere revisión legal local antes del lanzamiento público.
      </p>
    </LegalPage>
  );
}
