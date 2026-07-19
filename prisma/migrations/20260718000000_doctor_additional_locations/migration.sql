-- AddTable: DoctorLocation — consultorios adicionales por médico
-- Un médico puede practicar en varios hospitales.
-- El hospital principal sigue en Doctor.hospitalId (sin cambios).

CREATE TABLE "DoctorLocation" (
    "id"         TEXT NOT NULL,
    "doctorId"   TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "notes"      TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DoctorLocation_pkey" PRIMARY KEY ("id")
);

-- Unique: un médico no puede tener el mismo hospital dos veces en la tabla
CREATE UNIQUE INDEX "DoctorLocation_doctorId_hospitalId_key"
    ON "DoctorLocation"("doctorId", "hospitalId");

-- Índices de búsqueda
CREATE INDEX "DoctorLocation_doctorId_idx"   ON "DoctorLocation"("doctorId");
CREATE INDEX "DoctorLocation_hospitalId_idx" ON "DoctorLocation"("hospitalId");

-- Foreign keys
ALTER TABLE "DoctorLocation"
    ADD CONSTRAINT "DoctorLocation_doctorId_fkey"
    FOREIGN KEY ("doctorId")
    REFERENCES "Doctor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DoctorLocation"
    ADD CONSTRAINT "DoctorLocation_hospitalId_fkey"
    FOREIGN KEY ("hospitalId")
    REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
