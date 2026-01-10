export interface VitalRanges {
  hr: { min: number; max: number; label: string };
  bp_systolic: { min: number; max: number; label: string };
  bp_diastolic: { min: number; max: number; label: string };
  rr: { min: number; max: number; label: string };
  spo2: { min: number; max: number; label: string };
  temperature: { min: number; max: number; label: string };
  gcs: { value: number; label: string };
}

export type AgeGroup = "neonate" | "infant" | "toddler" | "preschool" | "school" | "adolescent" | "adult";

export function getAgeGroup(ageInYears: number): AgeGroup {
  if (ageInYears < 0.083) return "neonate";
  if (ageInYears < 1) return "infant";
  if (ageInYears < 3) return "toddler";
  if (ageInYears < 6) return "preschool";
  if (ageInYears < 12) return "school";
  if (ageInYears < 18) return "adolescent";
  return "adult";
}

export function getAgeGroupLabel(ageGroup: AgeGroup): string {
  const labels: Record<AgeGroup, string> = {
    neonate: "Neonate (0-1 month)",
    infant: "Infant (1-12 months)",
    toddler: "Toddler (1-3 years)",
    preschool: "Preschool (3-6 years)",
    school: "School Age (6-12 years)",
    adolescent: "Adolescent (12-18 years)",
    adult: "Adult (18+ years)",
  };
  return labels[ageGroup];
}

export function isPediatric(ageInYears: number): boolean {
  return ageInYears < 18;
}

export function getVitalRanges(ageInYears: number): VitalRanges {
  const ageGroup = getAgeGroup(ageInYears);

  const ranges: Record<AgeGroup, VitalRanges> = {
    neonate: {
      hr: { min: 120, max: 160, label: "120-160 bpm" },
      bp_systolic: { min: 60, max: 90, label: "60-90" },
      bp_diastolic: { min: 30, max: 60, label: "30-60" },
      rr: { min: 30, max: 60, label: "30-60 /min" },
      spo2: { min: 95, max: 100, label: "95-100%" },
      temperature: { min: 36.1, max: 37.2, label: "36.1-37.2°C" },
      gcs: { value: 15, label: "15/15" },
    },
    infant: {
      hr: { min: 100, max: 160, label: "100-160 bpm" },
      bp_systolic: { min: 70, max: 100, label: "70-100" },
      bp_diastolic: { min: 40, max: 65, label: "40-65" },
      rr: { min: 25, max: 40, label: "25-40 /min" },
      spo2: { min: 95, max: 100, label: "95-100%" },
      temperature: { min: 36.1, max: 37.2, label: "36.1-37.2°C" },
      gcs: { value: 15, label: "15/15" },
    },
    toddler: {
      hr: { min: 90, max: 150, label: "90-150 bpm" },
      bp_systolic: { min: 80, max: 110, label: "80-110" },
      bp_diastolic: { min: 50, max: 70, label: "50-70" },
      rr: { min: 20, max: 30, label: "20-30 /min" },
      spo2: { min: 95, max: 100, label: "95-100%" },
      temperature: { min: 36.1, max: 37.2, label: "36.1-37.2°C" },
      gcs: { value: 15, label: "15/15" },
    },
    preschool: {
      hr: { min: 80, max: 140, label: "80-140 bpm" },
      bp_systolic: { min: 85, max: 115, label: "85-115" },
      bp_diastolic: { min: 55, max: 75, label: "55-75" },
      rr: { min: 20, max: 25, label: "20-25 /min" },
      spo2: { min: 95, max: 100, label: "95-100%" },
      temperature: { min: 36.1, max: 37.2, label: "36.1-37.2°C" },
      gcs: { value: 15, label: "15/15" },
    },
    school: {
      hr: { min: 70, max: 120, label: "70-120 bpm" },
      bp_systolic: { min: 90, max: 120, label: "90-120" },
      bp_diastolic: { min: 60, max: 80, label: "60-80" },
      rr: { min: 15, max: 20, label: "15-20 /min" },
      spo2: { min: 95, max: 100, label: "95-100%" },
      temperature: { min: 36.1, max: 37.2, label: "36.1-37.2°C" },
      gcs: { value: 15, label: "15/15" },
    },
    adolescent: {
      hr: { min: 60, max: 100, label: "60-100 bpm" },
      bp_systolic: { min: 100, max: 130, label: "100-130" },
      bp_diastolic: { min: 65, max: 85, label: "65-85" },
      rr: { min: 12, max: 20, label: "12-20 /min" },
      spo2: { min: 95, max: 100, label: "95-100%" },
      temperature: { min: 36.1, max: 37.2, label: "36.1-37.2°C" },
      gcs: { value: 15, label: "15/15" },
    },
    adult: {
      hr: { min: 60, max: 100, label: "60-100 bpm" },
      bp_systolic: { min: 90, max: 120, label: "90-120" },
      bp_diastolic: { min: 60, max: 80, label: "60-80" },
      rr: { min: 12, max: 20, label: "12-20 /min" },
      spo2: { min: 95, max: 100, label: "95-100%" },
      temperature: { min: 36.1, max: 37.2, label: "36.1-37.2°C" },
      gcs: { value: 15, label: "15/15" },
    },
  };

  return ranges[ageGroup];
}

export function isVitalAbnormal(
  vital: "hr" | "bp_systolic" | "bp_diastolic" | "rr" | "spo2" | "temperature",
  value: number,
  ageInYears: number
): "low" | "high" | "normal" {
  const ranges = getVitalRanges(ageInYears);
  const range = ranges[vital];

  if (value < range.min) return "low";
  if (value > range.max) return "high";
  return "normal";
}

export function getMinSystolicBP(ageInYears: number): number {
  if (ageInYears < 1) return 70;
  if (ageInYears <= 10) return 70 + 2 * ageInYears;
  return 90;
}

export function getExpectedWeight(ageInYears: number): number {
  if (ageInYears < 1) {
    const ageInMonths = ageInYears * 12;
    if (ageInMonths <= 6) return (ageInMonths + 9) / 2;
    return (ageInMonths + 9) / 2;
  }
  if (ageInYears <= 5) return 2 * ageInYears + 8;
  if (ageInYears <= 14) return 3 * ageInYears;
  return 50;
}

export function formatBP(systolic: number, diastolic: number): string {
  return `${systolic}/${diastolic} mmHg`;
}
