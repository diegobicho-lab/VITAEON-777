import "server-only";
import React from "react";
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

// ── Palette ──────────────────────────────────────────────────────────────────
const NAVY = "#071726";
const MEDICAL = "#1a80b8";
const GRAY = "#64748b";
const LIGHT_GRAY = "#f8fafc";
const BORDER = "#e2e8f0";
const AI_BG = "#f0f9ff";
const AI_BORDER = "#0ea5e9";

// ── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    color: NAVY,
    paddingTop: 44,
    paddingBottom: 52,
    paddingHorizontal: 48,
    lineHeight: 1.5
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingBottom: 14,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: BORDER
  },
  brandName: {
    fontSize: 17,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 3,
    color: NAVY
  },
  brandSub: {
    fontSize: 7,
    color: GRAY,
    marginTop: 3,
    letterSpacing: 0.4
  },
  headerRight: { alignItems: "flex-end" },
  headerRightTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "right"
  },
  headerRightSub: {
    fontSize: 7,
    color: GRAY,
    marginTop: 2,
    textAlign: "right"
  },

  // Meta grid (4 boxes)
  metaRow: {
    flexDirection: "row",
    marginBottom: 16
  },
  metaBox: {
    flex: 1,
    backgroundColor: LIGHT_GRAY,
    padding: 10,
    marginRight: 6,
    borderRadius: 4
  },
  metaBoxLast: { marginRight: 0 },
  metaLabel: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: GRAY,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4
  },
  metaValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: NAVY
  },
  metaSub: {
    fontSize: 7.5,
    color: GRAY,
    marginTop: 2
  },

  // AI summary box
  aiBox: {
    backgroundColor: AI_BG,
    padding: 14,
    marginBottom: 18,
    borderLeftWidth: 3,
    borderLeftColor: AI_BORDER,
    borderRadius: 4
  },
  aiLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: AI_BORDER,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 7
  },
  aiContent: {
    fontSize: 9,
    color: NAVY,
    lineHeight: 1.7
  },
  aiDisclaimer: {
    fontSize: 7,
    color: GRAY,
    marginTop: 8,
    fontStyle: "italic",
    lineHeight: 1.4
  },

  // Divider
  divider: {
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    marginBottom: 16
  },

  // NOM-004 sections
  section: { marginBottom: 12 },
  sectionLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: MEDICAL,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    paddingBottom: 3,
    marginBottom: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: MEDICAL
  },
  sectionContent: {
    fontSize: 9,
    color: NAVY,
    lineHeight: 1.6
  },
  sectionEmpty: {
    fontSize: 9,
    color: "#94a3b8",
    fontStyle: "italic"
  },

  // Signature
  signatureArea: {
    marginTop: 32,
    flexDirection: "row",
    justifyContent: "flex-end"
  },
  signatureBlock: { width: 210, alignItems: "center" },
  signatureLine: {
    borderTopWidth: 1,
    borderTopColor: NAVY,
    width: "100%",
    marginBottom: 7,
    paddingTop: 6
  },
  signatureName: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: NAVY,
    textAlign: "center"
  },
  signatureSub: {
    fontSize: 7.5,
    color: GRAY,
    textAlign: "center",
    marginTop: 2
  },

  // Footer (fixed)
  footer: {
    position: "absolute",
    bottom: 22,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 0.5,
    borderTopColor: BORDER,
    paddingTop: 7
  },
  footerText: { fontSize: 7, color: GRAY }
});

// ── Sub-components ───────────────────────────────────────────────────────────

function Section({ label, content }: { label: string; content?: string | null }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionLabel}>{label}</Text>
      {content?.trim() ? (
        <Text style={s.sectionContent}>{content.trim()}</Text>
      ) : (
        <Text style={s.sectionEmpty}>No registrado</Text>
      )}
    </View>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

export interface ClinicalHistoryPdfProps {
  patientName: string;
  consultationDate: string;
  doctorName: string;
  specialty: string;
  professionalLicense?: string | null;
  hospitalName: string;
  exportDate: string;
  aiSummary: string;
  fields: {
    identificationCard?: string | null;
    ethnicGroup?: string | null;
    consultationReason?: string | null;
    hereditaryFamilyHistory?: string | null;
    nonPathologicalHistory?: string | null;
    pathologicalHistory?: string | null;
    surgicalHistory?: string | null;
    fractureHistory?: string | null;
    gynecoObstetricHistory?: string | null;
    currentCondition?: string | null;
    systemsReview?: string | null;
    physicalExam?: string | null;
    labsAndImaging?: string | null;
    diagnosis?: string | null;
    treatment?: string | null;
    diagnosesOrClinicalProblems?: string | null;
    therapeuticIndication?: string | null;
    plan?: string | null;
    prognosis?: string | null;
    healthStatus?: string | null;
    additionalMedicalNotes?: string | null;
  };
}

// ── Document ─────────────────────────────────────────────────────────────────

export function ClinicalHistoryPdfDocument({
  patientName,
  consultationDate,
  doctorName,
  specialty,
  professionalLicense,
  hospitalName,
  exportDate,
  aiSummary,
  fields
}: ClinicalHistoryPdfProps) {
  return (
    <Document
      title={`Historia clínica — ${patientName}`}
      author={doctorName}
      subject="Historia clínica orientada — VITAEON"
      creator="VITAEON"
      producer="VITAEON · vitaeon.mx"
    >
      <Page size="A4" style={s.page}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <Text style={s.brandName}>VITAEON</Text>
            <Text style={s.brandSub}>Red médica privada · León, Guanajuato</Text>
          </View>
          <View style={s.headerRight}>
            <Text style={s.headerRightTitle}>Historia clínica orientada</Text>
            <Text style={s.headerRightSub}>NOM-004-SSA3-2012</Text>
            <Text style={s.headerRightSub}>Exportado: {exportDate}</Text>
          </View>
        </View>

        {/* ── Meta grid ── */}
        <View style={s.metaRow}>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Paciente</Text>
            <Text style={s.metaValue}>{patientName}</Text>
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Fecha de consulta</Text>
            <Text style={s.metaValue}>{consultationDate}</Text>
          </View>
          <View style={s.metaBox}>
            <Text style={s.metaLabel}>Médico</Text>
            <Text style={s.metaValue}>{doctorName}</Text>
            <Text style={s.metaSub}>{specialty}</Text>
            {professionalLicense ? (
              <Text style={s.metaSub}>Ced. Prof. {professionalLicense}</Text>
            ) : null}
          </View>
          <View style={[s.metaBox, s.metaBoxLast]}>
            <Text style={s.metaLabel}>Institución</Text>
            <Text style={s.metaValue}>{hospitalName}</Text>
          </View>
        </View>

        {/* ── AI summary ── */}
        <View style={s.aiBox}>
          <Text style={s.aiLabel}>Resumen de impresion clinica — Auxiliar IA (Amatista)</Text>
          <Text style={s.aiContent}>{aiSummary}</Text>
          <Text style={s.aiDisclaimer}>
            Resumen generado por inteligencia artificial con base en el contenido registrado.
            No sustituye el juicio clinico del medico ni constituye diagnostico oficial.
          </Text>
        </View>

        <View style={s.divider} />

        {/* ── NOM-004 sections ── */}
        <Section label="1. Ficha de identificacion" content={fields.identificationCard} />
        <Section label="2. Grupo etnico (cuando aplique)" content={fields.ethnicGroup} />
        <Section label="3. Motivo de consulta" content={fields.consultationReason} />
        <Section label="4. Antecedentes heredofamiliares" content={fields.hereditaryFamilyHistory} />
        <Section label="5. Antecedentes personales no patologicos" content={fields.nonPathologicalHistory} />
        <Section label="6. Antecedentes personales patologicos" content={fields.pathologicalHistory} />
        <Section label="7. Antecedentes quirurgicos" content={fields.surgicalHistory} />
        <Section label="8. Antecedentes de fracturas" content={fields.fractureHistory} />
        <Section label="9. Antecedentes ginecoosbtetricos (cuando aplique)" content={fields.gynecoObstetricHistory} />
        <Section label="10. Padecimiento actual" content={fields.currentCondition} />
        <Section label="11. Interrogatorio por aparatos y sistemas" content={fields.systemsReview} />
        <Section label="12. Exploracion fisica" content={fields.physicalExam} />
        <Section label="13. Resultados de laboratorio, gabinete y otros" content={fields.labsAndImaging} />
        <Section label="14. Diagnostico" content={fields.diagnosis} />
        <Section label="15. Diagnosticos o problemas clinicos" content={fields.diagnosesOrClinicalProblems} />
        <Section label="16. Tratamiento" content={fields.treatment} />
        <Section label="17. Indicacion terapeutica" content={fields.therapeuticIndication} />
        <Section label="18. Plan de seguimiento" content={fields.plan} />
        <Section label="19. Pronostico" content={fields.prognosis} />
        <Section label="20. Estado de salud" content={fields.healthStatus} />
        {fields.additionalMedicalNotes?.trim() ? (
          <Section label="Notas medicas adicionales" content={fields.additionalMedicalNotes} />
        ) : null}

        {/* ── Signature ── */}
        <View style={s.signatureArea}>
          <View style={s.signatureBlock}>
            <View style={s.signatureLine} />
            <Text style={s.signatureName}>{doctorName}</Text>
            {professionalLicense ? (
              <Text style={s.signatureSub}>Cedula Prof. {professionalLicense}</Text>
            ) : null}
            <Text style={s.signatureSub}>{specialty}</Text>
            <Text style={s.signatureSub}>{exportDate}</Text>
          </View>
        </View>

        {/* ── Footer (all pages) ── */}
        <View style={s.footer} fixed>
          <Text style={s.footerText}>VITAEON · vitaeon.mx · Historia clinica privada</Text>
          <Text
            style={s.footerText}
            render={({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) =>
              `Pagina ${pageNumber} de ${totalPages}`
            }
          />
        </View>

      </Page>
    </Document>
  );
}
