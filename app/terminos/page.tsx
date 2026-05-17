import type { Metadata } from "next";
import { LegalPage } from "@/components/platform/LegalPage";

export const metadata: Metadata = {
  title: "Términos y condiciones"
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="Condiciones de uso" title="Términos y condiciones">
      <p>
        VITAEON facilita búsqueda de especialistas, gestión de disponibilidad, agendamiento de citas, pagos y comunicación operativa entre usuarios autorizados.
      </p>
      <p>
        Los médicos son responsables de mantener actualizados su perfil, cédula, disponibilidad, precios y datos profesionales. Los pacientes son responsables de proporcionar información veraz y presentarse conforme a las políticas de cancelación aplicables.
      </p>
      <p>
        Los pagos en efectivo quedan marcados como pendientes hasta su liquidación en consulta. Los pagos en línea deben validarse desde backend y proveedor de pago configurado.
      </p>
    </LegalPage>
  );
}
