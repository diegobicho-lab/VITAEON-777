import "server-only";
import React from "react";
import { renderToBuffer } from "@react-pdf/renderer";
import { ClinicalHistoryPdfDocument, type ClinicalHistoryPdfProps } from "./clinical-history-pdf";

/**
 * Renders the clinical history PDF document to a Buffer.
 * Kept in a .tsx file so JSX can be used directly — avoids type-cast friction
 * when calling renderToBuffer from a .ts API route.
 */
export async function renderClinicalHistoryPdf(props: ClinicalHistoryPdfProps): Promise<Buffer> {
  return renderToBuffer(<ClinicalHistoryPdfDocument {...props} />);
}
