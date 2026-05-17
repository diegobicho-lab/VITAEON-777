import type { Metadata } from "next";
import { LegalPage } from "@/components/platform/LegalPage";

export const metadata: Metadata = {
  title: "Política de reembolsos"
};

export default function RefundPolicyPage() {
  return (
    <LegalPage eyebrow="Pagos" title="Política de reembolsos">
      <p>
        Los pagos en línea se procesan mediante proveedores seguros configurados por VITAEON. La plataforma no almacena datos bancarios ni números de tarjeta.
      </p>
      <p>
        Si un pago falla, la cita no debe quedar confirmada. Si un pago se confirma correctamente, el comprobante y estado de pago quedan visibles en el panel correspondiente.
      </p>
      <p>
        Los reembolsos requieren validación administrativa y dependen de la política específica del médico, el horario reservado y el proveedor de pago. En beta privada, cada caso debe revisarse por soporte antes de ejecutar un reembolso.
      </p>
    </LegalPage>
  );
}
