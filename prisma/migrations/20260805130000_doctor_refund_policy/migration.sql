-- Política de devoluciones declarada por el médico.
-- Migración aditiva: nuevo enum + dos columnas con valor por defecto.
-- CASE_BY_CASE replica el comportamiento actual (el médico revisa cada
-- solicitud), por lo que los perfiles existentes no cambian de conducta.
CREATE TYPE "RefundPolicy" AS ENUM ('ACCEPTS_REFUNDS', 'NO_REFUNDS', 'CASE_BY_CASE');

ALTER TABLE "Doctor"
    ADD COLUMN "refundPolicy" "RefundPolicy" NOT NULL DEFAULT 'CASE_BY_CASE',
    ADD COLUMN "refundPolicyNotes" TEXT;
