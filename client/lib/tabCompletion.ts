import type { DraftCase } from "@/lib/draftManager";

export interface TabCompletionMap {
  patient: number;
  history: number;
  primary: number;
  exam: number;
  treatment: number;
  notes: number;
  disposition: number;
}

export const TAB_LABELS = ["patient", "history", "primary", "exam", "treatment", "notes", "disposition"] as const;
export type TabKey = typeof TAB_LABELS[number];

export const TAB_DISPLAY: Record<TabKey, string> = {
  patient: "Patient",
  history: "History",
  primary: "Primary",
  exam: "Exam",
  treatment: "Treatment",
  notes: "Notes",
  disposition: "Disposition",
};

function hasValue(v: any): boolean {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (typeof v === "number") return !isNaN(v) && v !== 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return !!v;
}

function pct(filled: number, total: number) {
  if (total === 0) return 0;
  return Math.round((filled / total) * 100);
}

export function calcTabCompletion(caseSheetData: any): TabCompletionMap {
  if (!caseSheetData) {
    return { patient: 0, history: 0, primary: 0, exam: 0, treatment: 0, notes: 0, disposition: 0 };
  }

  const vitals = caseSheetData.vitals_at_arrival || {};
  const patientFilled = ["hr", "bp_systolic", "rr", "spo2", "temperature"].filter(k => hasValue(vitals[k])).length;

  const sample = caseSheetData.sample || {};
  const historyFilled = ["signsSymptoms", "allergies", "medications", "pastMedicalHistory", "lastMeal", "eventsHopi"]
    .filter(k => hasValue(sample[k])).length;

  const abcde = caseSheetData.abcde || {};
  const primaryFilled = ["airway", "breathing", "circulation", "disability", "exposure"].filter(section => {
    const s = abcde[section];
    return s && Object.values(s).some(v => hasValue(v));
  }).length;

  const exam = caseSheetData.examination || {};
  const examFilled = Math.min(
    Object.keys(exam).filter(k => (k.includes("status") || k.includes("notes")) && hasValue(exam[k])).length,
    8,
  );

  const treatment = caseSheetData.treatment || {};
  const meds = treatment.medications || [];
  const treatmentFilled = (meds.length > 0 ? 1 : 0) + (hasValue(treatment.fluids) ? 1 : 0) + (hasValue(treatment.primary_diagnosis) ? 1 : 0);

  const erObs = caseSheetData.er_observation || {};
  const notesFilled = (hasValue(erObs.notes) || hasValue(erObs.duration)) ? 1 : 0;

  const disposition = caseSheetData.disposition || {};
  const dispositionFilled = hasValue(disposition.type) ? 1 : 0;

  return {
    patient: pct(patientFilled, 5),
    history: pct(historyFilled, 6),
    primary: pct(primaryFilled, 5),
    exam: pct(examFilled, 8),
    treatment: pct(treatmentFilled, 3),
    notes: pct(notesFilled, 1),
    disposition: pct(dispositionFilled, 1),
  };
}

export function overallCompletion(tabs: TabCompletionMap): number {
  const vals = Object.values(tabs);
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

export function draftOverallCompletion(draft: DraftCase): number {
  if (!draft.caseSheetData) return 0;
  return overallCompletion(calcTabCompletion(draft.caseSheetData));
}
