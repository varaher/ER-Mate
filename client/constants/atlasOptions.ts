export const AIRWAY_STATUS_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "Patent", value: "patent" },
  { label: "Partially obstructed", value: "partially_obstructed" },
  { label: "Completely obstructed", value: "completely_obstructed" },
];

export const AIRWAY_MAINTENANCE_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "Self-maintained", value: "self_maintained" },
  { label: "Recovery position", value: "recovery_position" },
  { label: "Head tilt/Chin lift", value: "head_tilt_chin_lift" },
  { label: "Jaw thrust", value: "jaw_thrust" },
];

export const AIRWAY_OBSTRUCTION_CAUSE_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "None", value: "none" },
  { label: "Tongue fall", value: "tongue_fall" },
  { label: "Secretions", value: "secretions" },
  { label: "Blood/Vomitus", value: "blood_vomitus" },
  { label: "Foreign body", value: "foreign_body" },
  { label: "Edema", value: "edema" },
  { label: "Trauma", value: "trauma" },
];

export const AIRWAY_SPEECH_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "Clear", value: "clear" },
  { label: "Hoarse", value: "hoarse" },
  { label: "Stridor", value: "stridor" },
  { label: "Gurgling", value: "gurgling" },
  { label: "Unable to speak", value: "unable_to_speak" },
];

export const AIRWAY_COMPROMISE_SIGNS_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "None", value: "none" },
  { label: "Accessory muscle use", value: "accessory_muscle_use" },
  { label: "Tracheal tug", value: "tracheal_tug" },
  { label: "Intercostal recession", value: "intercostal_recession" },
  { label: "Cyanosis", value: "cyanosis" },
];

export const AIRWAY_INTERVENTIONS = [
  { label: "Suction", value: "suction" },
  { label: "OPA", value: "opa" },
  { label: "NPA", value: "npa" },
  { label: "LMA", value: "lma" },
  { label: "ETT", value: "ett" },
  { label: "Cricothyrotomy", value: "cricothyrotomy" },
];

export const O2_DEVICE_OPTIONS = [
  { label: "Room air", value: "room_air" },
  { label: "Nasal prongs", value: "nasal_prongs" },
  { label: "Simple face mask", value: "simple_face_mask" },
  { label: "Venturi mask", value: "venturi_mask" },
  { label: "NRM (Non-rebreather)", value: "nrm" },
  { label: "HFNC", value: "hfnc" },
  { label: "NIV/BiPAP", value: "niv_bipap" },
  { label: "Mechanical ventilation", value: "mechanical_ventilation" },
];

export const BREATHING_PATTERN_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "Regular", value: "regular" },
  { label: "Tachypneic", value: "tachypneic" },
  { label: "Bradypneic", value: "bradypneic" },
  { label: "Kussmaul", value: "kussmaul" },
  { label: "Cheyne-Stokes", value: "cheyne_stokes" },
  { label: "Ataxic", value: "ataxic" },
  { label: "Apneic spells", value: "apneic_spells" },
];

export const CHEST_EXPANSION_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "Equal bilateral", value: "equal_bilateral" },
  { label: "Reduced left", value: "reduced_left" },
  { label: "Reduced right", value: "reduced_right" },
  { label: "Reduced bilateral", value: "reduced_bilateral" },
  { label: "Paradoxical", value: "paradoxical" },
];

export const AIR_ENTRY_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "Equal bilateral", value: "equal_bilateral" },
  { label: "Reduced left", value: "reduced_left" },
  { label: "Reduced right", value: "reduced_right" },
  { label: "Reduced bilateral", value: "reduced_bilateral" },
  { label: "Absent left", value: "absent_left" },
  { label: "Absent right", value: "absent_right" },
];

export const BREATHING_EFFORT_OPTIONS = [
  { label: "Normal", value: "normal" },
  { label: "Mild increase", value: "mild" },
  { label: "Moderate increase", value: "moderate" },
  { label: "Severe increase", value: "severe" },
  { label: "Exhaustion", value: "exhaustion" },
];

export const ADDED_BREATH_SOUNDS_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "None", value: "none" },
  { label: "Wheeze", value: "wheeze" },
  { label: "Rhonchi", value: "rhonchi" },
  { label: "Crackles/Crepitations", value: "crackles" },
  { label: "Pleural rub", value: "pleural_rub" },
  { label: "Stridor", value: "stridor" },
  { label: "Diminished", value: "diminished" },
];

export const BREATHING_INTERVENTIONS = [
  { label: "Nebulization", value: "nebulization" },
  { label: "ICD insertion", value: "icd_insertion" },
  { label: "Needle decompression", value: "needle_decompression" },
  { label: "Bag-mask ventilation", value: "bag_mask_ventilation" },
  { label: "Intubation", value: "intubation" },
];

export const PULSE_QUALITY_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "Strong and regular", value: "strong_regular" },
  { label: "Weak", value: "weak" },
  { label: "Thready", value: "thready" },
  { label: "Bounding", value: "bounding" },
  { label: "Irregular", value: "irregular" },
  { label: "Absent peripherally", value: "absent_peripherally" },
];

export const CAPILLARY_REFILL_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "< 2 seconds", value: "normal" },
  { label: "2-3 seconds", value: "delayed_mild" },
  { label: "3-5 seconds", value: "delayed_moderate" },
  { label: "> 5 seconds", value: "delayed_severe" },
];

export const SKIN_COLOR_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "Pink/Normal", value: "normal" },
  { label: "Pale", value: "pale" },
  { label: "Mottled", value: "mottled" },
  { label: "Cyanotic", value: "cyanotic" },
  { label: "Flushed", value: "flushed" },
  { label: "Jaundiced", value: "jaundiced" },
];

export const SKIN_TEMPERATURE_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "Warm", value: "warm" },
  { label: "Cool peripherally", value: "cool_peripherally" },
  { label: "Cold", value: "cold" },
  { label: "Diaphoretic", value: "diaphoretic" },
];

export const IV_ACCESS_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "None", value: "none" },
  { label: "Peripheral IV", value: "peripheral_iv" },
  { label: "Central line", value: "central_line" },
  { label: "IO access", value: "io_access" },
  { label: "Multiple access", value: "multiple_access" },
];

export const CIRCULATION_INTERVENTIONS = [
  { label: "IV fluids - NS", value: "iv_ns" },
  { label: "IV fluids - RL", value: "iv_rl" },
  { label: "Blood transfusion", value: "blood_transfusion" },
  { label: "Vasopressors", value: "vasopressors" },
  { label: "CPR initiated", value: "cpr" },
  { label: "Defibrillation", value: "defibrillation" },
  { label: "Cardioversion", value: "cardioversion" },
];

export const PUPIL_SIZE_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "Normal (2-4mm)", value: "normal" },
  { label: "Dilated (>4mm)", value: "dilated" },
  { label: "Constricted (<2mm)", value: "constricted" },
  { label: "Anisocoric", value: "anisocoric" },
];

export const PUPIL_REACTION_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "Reactive bilateral", value: "reactive_bilateral" },
  { label: "Sluggish bilateral", value: "sluggish_bilateral" },
  { label: "Non-reactive bilateral", value: "non_reactive_bilateral" },
  { label: "Reactive left only", value: "reactive_left" },
  { label: "Reactive right only", value: "reactive_right" },
];

export const MOTOR_RESPONSE_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "Normal power bilateral", value: "normal_bilateral" },
  { label: "Weakness left side", value: "weakness_left" },
  { label: "Weakness right side", value: "weakness_right" },
  { label: "Bilateral weakness", value: "weakness_bilateral" },
  { label: "Paralysis", value: "paralysis" },
  { label: "Posturing - Decorticate", value: "decorticate" },
  { label: "Posturing - Decerebrate", value: "decerebrate" },
];

export const DISABILITY_INTERVENTIONS = [
  { label: "Head elevation 30 degrees", value: "head_elevation" },
  { label: "Seizure precautions", value: "seizure_precautions" },
  { label: "Mannitol", value: "mannitol" },
  { label: "Hypertonic saline", value: "hypertonic_saline" },
  { label: "Anticonvulsants", value: "anticonvulsants" },
  { label: "Glucose correction", value: "glucose_correction" },
];

export const EXPOSURE_FINDINGS_OPTIONS = [
  { label: "No obvious injuries", value: "no_injuries" },
  { label: "Lacerations/Abrasions", value: "lacerations" },
  { label: "Contusions/Bruising", value: "contusions" },
  { label: "Deformity", value: "deformity" },
  { label: "Open wounds", value: "open_wounds" },
  { label: "Burns", value: "burns" },
  { label: "Rash/Skin changes", value: "rash" },
];

export const EXPOSURE_INTERVENTIONS = [
  { label: "Warming blanket", value: "warming_blanket" },
  { label: "Cooling measures", value: "cooling" },
  { label: "Log roll completed", value: "log_roll" },
  { label: "Splinting", value: "splinting" },
  { label: "Wound care", value: "wound_care" },
  { label: "Tetanus prophylaxis", value: "tetanus" },
];

export const ABG_STATUS_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "Not done", value: "not_done" },
  { label: "Normal", value: "normal" },
  { label: "Respiratory acidosis", value: "respiratory_acidosis" },
  { label: "Respiratory alkalosis", value: "respiratory_alkalosis" },
  { label: "Metabolic acidosis", value: "metabolic_acidosis" },
  { label: "Metabolic alkalosis", value: "metabolic_alkalosis" },
  { label: "Mixed disorder", value: "mixed" },
];

export const ABG_SAMPLE_TYPE_OPTIONS = [
  { label: "Arterial (ABG)", value: "arterial" },
  { label: "Venous (VBG)", value: "venous" },
  { label: "Capillary", value: "capillary" },
];

export const ECG_STATUS_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "Not done", value: "not_done" },
  { label: "Normal sinus rhythm", value: "nsr" },
  { label: "Sinus tachycardia", value: "sinus_tachy" },
  { label: "Sinus bradycardia", value: "sinus_brady" },
  { label: "Atrial fibrillation", value: "afib" },
  { label: "Atrial flutter", value: "aflutter" },
  { label: "SVT", value: "svt" },
  { label: "VT", value: "vt" },
  { label: "VF", value: "vf" },
  { label: "STEMI", value: "stemi" },
  { label: "NSTEMI/Ischemia", value: "nstemi" },
  { label: "Heart block", value: "heart_block" },
  { label: "Other abnormality", value: "other" },
];

export const EFAST_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "Not done", value: "not_done" },
  { label: "Negative", value: "negative" },
  { label: "Positive - RUQ", value: "positive_ruq" },
  { label: "Positive - LUQ", value: "positive_luq" },
  { label: "Positive - Pelvis", value: "positive_pelvis" },
  { label: "Positive - Pericardial", value: "positive_pericardial" },
  { label: "Positive - Pneumothorax", value: "positive_pneumothorax" },
  { label: "Positive - Multiple", value: "positive_multiple" },
];

export const BEDSIDE_ECHO_OPTIONS = [
  { label: "-- Select --", value: "" },
  { label: "Not done", value: "not_done" },
  { label: "Normal", value: "normal" },
  { label: "Reduced EF", value: "reduced_ef" },
  { label: "RV strain", value: "rv_strain" },
  { label: "Pericardial effusion", value: "pericardial_effusion" },
  { label: "Tamponade physiology", value: "tamponade" },
  { label: "Hypovolemia (IVC collapse)", value: "hypovolemia" },
];

export const ALLERGY_SEVERITY_OPTIONS = [
  { label: "Unknown", value: "unknown" },
  { label: "Mild", value: "mild" },
  { label: "Moderate", value: "moderate" },
  { label: "Severe/Anaphylaxis", value: "severe" },
];

export type ATLSFormData = {
  airway: {
    status: string;
    maintenance: string;
    obstructionCause: string;
    speech: string;
    compromiseSigns: string;
    interventions: string[];
    notes: string;
  };
  breathing: {
    rr: string;
    spo2: string;
    o2Device: string;
    o2Flow: string;
    pattern: string;
    chestExpansion: string;
    airEntry: string;
    effort: string;
    addedSounds: string;
    interventions: string[];
    notes: string;
  };
  circulation: {
    hr: string;
    bpSystolic: string;
    bpDiastolic: string;
    capillaryRefill: string;
    pulseQuality: string;
    skinColor: string;
    skinTemperature: string;
    ivAccess: string;
    interventions: string[];
    notes: string;
  };
  disability: {
    gcsE: string;
    gcsV: string;
    gcsM: string;
    pupilSize: string;
    pupilReaction: string;
    motorResponse: string;
    glucose: string;
    interventions: string[];
    notes: string;
  };
  exposure: {
    temperature: string;
    findings: string[];
    interventions: string[];
    notes: string;
  };
  adjuncts: {
    abgStatus: string;
    abgNotes: string;
    abgSampleType: string;
    abgPh: string;
    abgPco2: string;
    abgPo2: string;
    abgHco3: string;
    abgBe: string;
    abgLactate: string;
    abgSao2: string;
    abgFio2: string;
    abgAaGradient: string;
    abgNa: string;
    abgK: string;
    abgCl: string;
    abgAnionGap: string;
    abgGlucose: string;
    abgHb: string;
    abgInterpretation: string;
    ecgStatus: string;
    ecgNotes: string;
    efastStatus: string;
    efastNotes: string;
    echoStatus: string;
    echoNotes: string;
  };
  sample: {
    signsSymptoms: string;
    allergies: string;
    allergyDetails: Array<{ name: string; severity: string; reaction: string }>;
    medications: string;
    medicationList: string[];
    pastMedicalHistory: string;
    lastMeal: string;
    lmp: string;
    eventsHopi: string;
  };
};

export const getDefaultATLSFormData = (): ATLSFormData => ({
  airway: {
    status: "",
    maintenance: "",
    obstructionCause: "",
    speech: "",
    compromiseSigns: "",
    interventions: [],
    notes: "",
  },
  breathing: {
    rr: "",
    spo2: "",
    o2Device: "room_air",
    o2Flow: "",
    pattern: "",
    chestExpansion: "",
    airEntry: "",
    effort: "normal",
    addedSounds: "",
    interventions: [],
    notes: "",
  },
  circulation: {
    hr: "",
    bpSystolic: "",
    bpDiastolic: "",
    capillaryRefill: "",
    pulseQuality: "",
    skinColor: "",
    skinTemperature: "",
    ivAccess: "",
    interventions: [],
    notes: "",
  },
  disability: {
    gcsE: "4",
    gcsV: "5",
    gcsM: "6",
    pupilSize: "",
    pupilReaction: "",
    motorResponse: "",
    glucose: "",
    interventions: [],
    notes: "",
  },
  exposure: {
    temperature: "",
    findings: [],
    interventions: [],
    notes: "",
  },
  adjuncts: {
    abgStatus: "not_done",
    abgNotes: "",
    abgSampleType: "arterial",
    abgPh: "",
    abgPco2: "",
    abgPo2: "",
    abgHco3: "",
    abgBe: "",
    abgLactate: "",
    abgSao2: "",
    abgFio2: "",
    abgAaGradient: "",
    abgNa: "",
    abgK: "",
    abgCl: "",
    abgAnionGap: "",
    abgGlucose: "",
    abgHb: "",
    abgInterpretation: "",
    ecgStatus: "not_done",
    ecgNotes: "",
    efastStatus: "not_done",
    efastNotes: "",
    echoStatus: "not_done",
    echoNotes: "",
  },
  sample: {
    signsSymptoms: "",
    allergies: "",
    allergyDetails: [],
    medications: "",
    medicationList: [],
    pastMedicalHistory: "",
    lastMeal: "",
    lmp: "",
    eventsHopi: "",
  },
});
