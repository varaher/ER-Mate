import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  Switch,
  ScrollView,
  Modal,
  FlatList,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import VoiceRecorder, { ExtractedClinicalData } from "@/components/VoiceRecorder";
import { DocumentScanner } from "@/components/DocumentScanner";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { DropdownField } from "@/components/DropdownField";
import { CheckboxGroup } from "@/components/CheckboxGroup";
import { TextInputField } from "@/components/TextInputField";
import { AIDiagnosisPanel } from "@/components/AIDiagnosisPanel";
import SmartDictation, { SmartDictationExtracted } from "@/components/SmartDictation";
import { useTheme } from "@/hooks/useTheme";
import { useCase } from "@/context/CaseContext";
import { apiGet, apiPatch, apiPut, apiUpload, invalidateCases } from "@/lib/api";
import { cacheCasePayload } from "@/lib/caseCache";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  AIRWAY_STATUS_OPTIONS,
  AIRWAY_MAINTENANCE_OPTIONS,
  AIRWAY_OBSTRUCTION_CAUSE_OPTIONS,
  AIRWAY_SPEECH_OPTIONS,
  AIRWAY_COMPROMISE_SIGNS_OPTIONS,
  AIRWAY_INTERVENTIONS,
  O2_DEVICE_OPTIONS,
  BREATHING_PATTERN_OPTIONS,
  CHEST_EXPANSION_OPTIONS,
  AIR_ENTRY_OPTIONS,
  BREATHING_EFFORT_OPTIONS,
  ADDED_BREATH_SOUNDS_OPTIONS,
  BREATHING_INTERVENTIONS,
  PULSE_QUALITY_OPTIONS,
  CAPILLARY_REFILL_OPTIONS,
  SKIN_COLOR_OPTIONS,
  SKIN_TEMPERATURE_OPTIONS,
  IV_ACCESS_OPTIONS,
  CIRCULATION_INTERVENTIONS,
  PUPIL_SIZE_OPTIONS,
  PUPIL_REACTION_OPTIONS,
  MOTOR_RESPONSE_OPTIONS,
  DISABILITY_INTERVENTIONS,
  EXPOSURE_FINDINGS_OPTIONS,
  EXPOSURE_INTERVENTIONS,
  ABG_STATUS_OPTIONS,
  ABG_SAMPLE_TYPE_OPTIONS,
  ECG_STATUS_OPTIONS,
  EFAST_OPTIONS,
  BEDSIDE_ECHO_OPTIONS,
  ATLSFormData,
  getDefaultATLSFormData,
} from "@/constants/atlasOptions";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, "CaseSheet">;

type TabType = "patient" | "primary" | "history" | "exam" | "treatment" | "notes" | "disposition";

interface ExamFormData {
  general: {
    pallor: boolean;
    icterus: boolean;
    cyanosis: boolean;
    clubbing: boolean;
    lymphadenopathy: boolean;
    edema: boolean;
    notes: string;
  };
  cvs: {
    status: string;
    s1s2: string;
    pulse: string;
    pulseRate: string;
    apexBeat: string;
    precordialHeave: boolean;
    addedSounds: string;
    murmurs: string;
    notes: string;
  };
  respiratory: {
    status: string;
    expansion: string;
    percussion: string;
    breathSounds: string;
    vocalResonance: string;
    addedSounds: string;
    notes: string;
  };
  abdomen: {
    status: string;
    umbilical: string;
    organomegaly: string;
    percussion: string;
    bowelSounds: string;
    externalGenitalia: string;
    hernialOrifices: string;
    perRectal: string;
    perVaginal: string;
    notes: string;
  };
  cns: {
    status: string;
    higherMentalFunctions: string;
    cranialNerves: string;
    sensorySystem: string;
    motorSystem: string;
    reflexes: string;
    rombergSign: string;
    cerebellarSigns: string;
    notes: string;
  };
  extremities: {
    status: string;
    pulses: string;
    edema: boolean;
    deformity: boolean;
    notes: string;
  };
}

interface MedicationEntry {
  id: string;
  name: string;
  dose: string;
  route: string;
  frequency: string;
}

interface InfusionEntry {
  id: string;
  name: string;
  dose: string;
  dilution: string;
  rate: string;
  notes: string;
}

interface TreatmentFormData {
  labsOrdered: string;
  imaging: string;
  resultsSummary: string;
  primaryDiagnosis: string;
  differentialDiagnoses: string;
  medications: MedicationEntry[];
  infusions: InfusionEntry[];
  otherMedications: string;
  ivFluids: string;
  addendumNotes: string;
}

type ProcedureCategory = "resuscitation" | "airway" | "vascular" | "chest" | "neuro" | "gu" | "gi" | "wound" | "ortho";

interface ProceduresData {
  resuscitation: string[];
  airway: string[];
  vascular: string[];
  chest: string[];
  neuro: string[];
  gu: string[];
  gi: string[];
  wound: string[];
  ortho: string[];
  generalNotes: string;
}

interface DispositionData {
  dispositionType: string;
  admitTo: string;
  admitToRoom: string;
  referTo: string;
  erObservationNotes: string;
  durationInER: string;
}

interface PsychFormData {
  suicidalIdeation: boolean;
  selfHarmHistory: boolean;
  intentToHarmOthers: boolean;
  substanceAbuse: boolean;
  psychiatricHistory: boolean;
  currentlyOnTreatment: boolean;
  hasSupportSystem: boolean;
  notes: string;
}

interface MLCDetailsData {
  natureOfIncident: string;
  dateTimeOfIncident: string;
  placeOfIncident: string;
  identificationMark: string;
  informantBroughtBy: string;
}

interface ABCDEStatusData {
  airway: "Normal" | "Abnormal";
  breathing: "Normal" | "Abnormal";
  circulation: "Normal" | "Abnormal";
  disability: "Normal" | "Abnormal";
  exposure: "Normal" | "Abnormal";
}

const getDefaultMLCDetails = (): MLCDetailsData => ({
  natureOfIncident: "",
  dateTimeOfIncident: new Date().toISOString().slice(0, 16),
  placeOfIncident: "",
  identificationMark: "",
  informantBroughtBy: "Self",
});

const getDefaultABCDEStatus = (): ABCDEStatusData => ({
  airway: "Normal",
  breathing: "Normal",
  circulation: "Normal",
  disability: "Normal",
  exposure: "Normal",
});

const getDefaultExamFormData = (): ExamFormData => ({
  general: { pallor: false, icterus: false, cyanosis: false, clubbing: false, lymphadenopathy: false, edema: false, notes: "" },
  cvs: { status: "Normal", s1s2: "Normal", pulse: "Regular", pulseRate: "", apexBeat: "Normal", precordialHeave: false, addedSounds: "", murmurs: "", notes: "" },
  respiratory: { status: "Normal", expansion: "Equal", percussion: "Resonant", breathSounds: "Vesicular", vocalResonance: "Normal", addedSounds: "", notes: "" },
  abdomen: { status: "Normal", umbilical: "Normal", organomegaly: "", percussion: "Tympanic", bowelSounds: "Present", externalGenitalia: "Normal", hernialOrifices: "Normal", perRectal: "", perVaginal: "", notes: "" },
  cns: { status: "Normal", higherMentalFunctions: "Intact", cranialNerves: "Intact", sensorySystem: "Intact", motorSystem: "Normal", reflexes: "Normal", rombergSign: "Negative", cerebellarSigns: "Normal", notes: "" },
  extremities: { status: "Normal", pulses: "Present", edema: false, deformity: false, notes: "" },
});

const getDefaultTreatmentFormData = (): TreatmentFormData => ({
  labsOrdered: "",
  imaging: "",
  resultsSummary: "",
  primaryDiagnosis: "",
  differentialDiagnoses: "",
  medications: [],
  infusions: [],
  otherMedications: "",
  ivFluids: "",
  addendumNotes: "",
});

const getDefaultProceduresData = (): ProceduresData => ({
  resuscitation: [],
  airway: [],
  vascular: [],
  chest: [],
  neuro: [],
  gu: [],
  gi: [],
  wound: [],
  ortho: [],
  generalNotes: "",
});

const getDefaultDispositionData = (): DispositionData => ({
  dispositionType: "",
  admitTo: "",
  admitToRoom: "",
  referTo: "",
  erObservationNotes: "",
  durationInER: "",
});

const ADMIT_DESTINATIONS = [
  "General Ward",
  "Medical ICU",
  "Cardiac ICU",
  "Surgical ICU",
  "Neuro ICU",
  "Pediatric ICU",
  "NICU",
  "HDU",
  "Observation Ward",
  "Other",
];

const PROCEDURES_OPTIONS = {
  resuscitation: ["CPR"],
  airway: ["Endotracheal Intubation", "LMA Insertion", "Cricothyrotomy", "Bag-Valve-Mask Ventilation", "NIV (BiPAP/CPAP)"],
  vascular: ["Central Line Insertion", "Peripheral IV Access", "Intraosseous Access", "Arterial Line"],
  chest: ["Chest Tube Insertion", "Needle Decompression", "Pericardiocentesis", "Thoracentesis"],
  neuro: ["Lumbar Puncture"],
  gu: ["Foley's Catheter"],
  gi: ["NG Tube Insertion", "Gastric Lavage"],
  wound: ["Wound Closure/Suturing", "Wound Irrigation"],
  ortho: ["Fracture Splinting", "Joint Reduction"],
};

const getDefaultPsychFormData = (): PsychFormData => ({
  suicidalIdeation: false,
  selfHarmHistory: false,
  intentToHarmOthers: false,
  substanceAbuse: false,
  psychiatricHistory: false,
  currentlyOnTreatment: false,
  hasSupportSystem: false,
  notes: "",
});

const toStringOrEmpty = (val: any): string => {
  if (val === null || val === undefined) return "";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
};

const toFloatOrNull = (val: any): number | null => {
  if (!val) return null;
  const num = parseFloat(val);
  return isNaN(num) ? null : num;
};

const toIntOrNull = (val: any): number | null => {
  if (!val) return null;
  const num = parseInt(val, 10);
  return isNaN(num) ? null : num;
};

const toBoolean = (val: any): boolean => {
  return val === true || val === "true" || val === 1 || val === "1";
};

const mapDispositionType = (type: string): string => {
  const map: Record<string, string> = {
    "Discharge": "discharged",
    "Admit": "admitted-ward",
    "Refer": "referred",
    "LAMA": "dama",
    "Absconded": "absconded",
    "Death": "death",
  };
  return map[type] || "discharged";
};

const CHIP_OPTIONS = {
  airwayMaintenance: [
    { label: "Self-maintained", value: "self_maintained" },
    { label: "Head tilt/Chin lift", value: "head_tilt_chin_lift" },
    { label: "Jaw thrust", value: "jaw_thrust" },
  ],
  airwayStatus: [
    { label: "Patent", value: "patent" },
    { label: "Partially obstructed", value: "partially_obstructed" },
    { label: "Completely obstructed", value: "completely_obstructed" },
  ],
  airwayCause: [
    { label: "None", value: "none" },
    { label: "Tongue fall", value: "tongue_fall" },
    { label: "Secretions", value: "secretions" },
    { label: "Blood/Vomitus", value: "blood_vomitus" },
    { label: "Foreign body", value: "foreign_body" },
    { label: "Edema", value: "edema" },
  ],
  airwaySpeech: [
    { label: "Clear", value: "clear" },
    { label: "Hoarse", value: "hoarse" },
    { label: "Stridor", value: "stridor" },
    { label: "Gurgling", value: "gurgling" },
    { label: "Unable to speak", value: "unable_to_speak" },
  ],
  airwayInterventions: [
    { label: "Suction", value: "suction" },
    { label: "OPA", value: "opa" },
    { label: "NPA", value: "npa" },
    { label: "LMA", value: "lma" },
    { label: "ETT", value: "ett" },
    { label: "Cricothyrotomy", value: "cricothyrotomy" },
  ],
  breathingEffort: [
    { label: "Normal", value: "normal" },
    { label: "Mild \u2191", value: "mild" },
    { label: "Moderate \u2191", value: "moderate" },
    { label: "Severe \u2191", value: "severe" },
    { label: "Exhaustion", value: "exhaustion" },
  ],
  breathingO2Device: [
    { label: "Room air", value: "room_air" },
    { label: "Nasal prongs", value: "nasal_prongs" },
    { label: "Face mask", value: "simple_face_mask" },
    { label: "NRM", value: "nrm" },
    { label: "NIV", value: "niv_bipap" },
    { label: "Ventilator", value: "mechanical_ventilation" },
  ],
  breathingPattern: [
    { label: "Normal", value: "normal" },
    { label: "Tachypneic", value: "tachypneic" },
    { label: "Bradypneic", value: "bradypneic" },
    { label: "Kussmaul", value: "kussmaul" },
    { label: "Cheyne-Stokes", value: "cheyne_stokes" },
  ],
  breathingChestExpansion: [
    { label: "Equal", value: "equal_bilateral" },
    { label: "Reduced L", value: "reduced_left" },
    { label: "Reduced R", value: "reduced_right" },
    { label: "Reduced both", value: "reduced_bilateral" },
  ],
  breathingAirEntry: [
    { label: "Equal bilateral", value: "equal_bilateral" },
    { label: "Reduced L", value: "reduced_left" },
    { label: "Reduced R", value: "reduced_right" },
    { label: "Reduced both", value: "reduced_bilateral" },
    { label: "Absent L", value: "absent_left" },
    { label: "Absent R", value: "absent_right" },
  ],
  breathingAddedSounds: [
    { label: "None", value: "none" },
    { label: "Wheeze", value: "wheeze" },
    { label: "Crackles", value: "crackles" },
    { label: "Rhonchi", value: "rhonchi" },
    { label: "Stridor", value: "stridor" },
  ],
  breathingInterventions: [
    { label: "Nebulization", value: "nebulization" },
    { label: "ICD", value: "icd_insertion" },
    { label: "Needle decomp", value: "needle_decompression" },
    { label: "BVM", value: "bag_mask_ventilation" },
    { label: "Intubation", value: "intubation" },
  ],
  circulationRhythm: [
    { label: "Regular", value: "strong_regular" },
    { label: "Irregular", value: "irregular" },
    { label: "Thready", value: "thready" },
    { label: "Bounding", value: "bounding" },
  ],
  circulationCRT: [
    { label: "<2 sec", value: "normal" },
    { label: "2-3 sec", value: "delayed_mild" },
    { label: "3-5 sec", value: "delayed_moderate" },
    { label: ">5 sec", value: "delayed_severe" },
  ],
  circulationSkin: [
    { label: "Warm", value: "warm" },
    { label: "Cool", value: "cool_peripherally" },
    { label: "Cold", value: "cold" },
    { label: "Diaphoretic", value: "diaphoretic" },
  ],
  circulationSkinColor: [
    { label: "Normal", value: "normal" },
    { label: "Pale", value: "pale" },
    { label: "Mottled", value: "mottled" },
    { label: "Cyanotic", value: "cyanotic" },
  ],
  circulationIVAccess: [
    { label: "None", value: "none" },
    { label: "Peripheral IV", value: "peripheral_iv" },
    { label: "Central line", value: "central_line" },
    { label: "IO access", value: "io_access" },
  ],
  circulationInterventions: [
    { label: "IV fluids NS", value: "iv_ns" },
    { label: "IV fluids RL", value: "iv_rl" },
    { label: "Blood transfusion", value: "blood_transfusion" },
    { label: "Vasopressors", value: "vasopressors" },
  ],
  disabilityAVPU: [
    { label: "Weakness left", value: "weakness_left" },
    { label: "Weakness right", value: "weakness_right" },
    { label: "Bilateral weakness", value: "weakness_bilateral" },
    { label: "Paralysis", value: "paralysis" },
  ],
  disabilityPupilSize: [
    { label: "Normal", value: "normal" },
    { label: "Dilated", value: "dilated" },
    { label: "Constricted", value: "constricted" },
    { label: "Anisocoric", value: "anisocoric" },
  ],
  disabilityPupilReaction: [
    { label: "Reactive", value: "reactive_bilateral" },
    { label: "Sluggish", value: "sluggish_bilateral" },
    { label: "Non-reactive", value: "non_reactive_bilateral" },
  ],
  disabilityLateralizing: [
    { label: "Head elevation", value: "head_elevation" },
    { label: "Seizure precautions", value: "seizure_precautions" },
    { label: "Mannitol", value: "mannitol" },
    { label: "Anticonvulsants", value: "anticonvulsants" },
  ],
  exposureFindings: [
    { label: "No injuries", value: "no_injuries" },
    { label: "Lacerations", value: "lacerations" },
    { label: "Contusions", value: "contusions" },
    { label: "Deformity", value: "deformity" },
    { label: "Open wounds", value: "open_wounds" },
    { label: "Burns", value: "burns" },
    { label: "Rash", value: "rash" },
  ],
  exposureInterventions: [
    { label: "Warming blanket", value: "warming_blanket" },
    { label: "Cooling", value: "cooling" },
    { label: "Log roll", value: "log_roll" },
    { label: "Splinting", value: "splinting" },
    { label: "Wound care", value: "wound_care" },
    { label: "Tetanus", value: "tetanus" },
  ],
};

export default function CaseSheetScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { caseId } = route.params;

  const [activeTab, setActiveTab] = useState<TabType>("patient");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [caseData, setCaseData] = useState<any>(null);
  const [abgInterpreting, setAbgInterpreting] = useState(false);
  const [abgInterpretation, setAbgInterpretation] = useState<string | null>(null);
  const [formData, setFormData] = useState<ATLSFormData>(getDefaultATLSFormData());
  const [examData, setExamData] = useState<ExamFormData>(getDefaultExamFormData());
  const [psychData, setPsychData] = useState<PsychFormData>(getDefaultPsychFormData());
  const [treatmentData, setTreatmentData] = useState<TreatmentFormData>(getDefaultTreatmentFormData());
  const [proceduresData, setProceduresData] = useState<ProceduresData>(getDefaultProceduresData());
  const [dispositionData, setDispositionData] = useState<DispositionData>(getDefaultDispositionData());
  const [pastSurgicalHistory, setPastSurgicalHistory] = useState("");
  const [otherHistory, setOtherHistory] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const localDraftIdRef = useRef<string | null>(null);
  const [modeOfArrival, setModeOfArrival] = useState("Walk-in");
  const [isMLC, setIsMLC] = useState(false);
  const [mlcDetails, setMLCDetails] = useState<MLCDetailsData>(getDefaultMLCDetails());
  const [abcdeStatus, setABCDEStatus] = useState<ABCDEStatusData>(getDefaultABCDEStatus());
  const [newMedication, setNewMedication] = useState<Omit<MedicationEntry, 'id'>>({ name: "", dose: "", route: "", frequency: "stat" });
  const [newInfusion, setNewInfusion] = useState<Omit<InfusionEntry, 'id'>>({ name: "", dose: "", dilution: "", rate: "", notes: "" });
  const [showFrequencyPicker, setShowFrequencyPicker] = useState(false);
  
  const FREQUENCY_OPTIONS = [
    { label: "Stat (Single dose now)", value: "stat" },
    { label: "OD (Once daily)", value: "OD" },
    { label: "BD (Twice daily)", value: "BD" },
    { label: "TDS (Three times daily)", value: "TDS" },
    { label: "QID (Four times daily)", value: "QID" },
    { label: "Q4H (Every 4 hours)", value: "Q4H" },
    { label: "Q6H (Every 6 hours)", value: "Q6H" },
    { label: "Q8H (Every 8 hours)", value: "Q8H" },
    { label: "Q12H (Every 12 hours)", value: "Q12H" },
    { label: "PRN (As needed)", value: "PRN" },
    { label: "HS (At bedtime)", value: "HS" },
    { label: "AC (Before meals)", value: "AC" },
    { label: "PC (After meals)", value: "PC" },
    { label: "SOS (If needed)", value: "SOS" },
  ];
  
  const { saveToDraft, currentDraftId, commitDraft, initDraftForCase, loadDraft } = useCase();
  
  const loadFromCaseSheetData = (caseSheetData: any) => {
    if (!caseSheetData) return;
    
    const newFormData = getDefaultATLSFormData();
    
    if (caseSheetData.vitals_at_arrival) {
      newFormData.breathing.rr = String(caseSheetData.vitals_at_arrival.rr || "");
      newFormData.breathing.spo2 = String(caseSheetData.vitals_at_arrival.spo2 || "");
      newFormData.circulation.hr = String(caseSheetData.vitals_at_arrival.hr || "");
      newFormData.circulation.bpSystolic = String(caseSheetData.vitals_at_arrival.bp_systolic || "");
      newFormData.circulation.bpDiastolic = String(caseSheetData.vitals_at_arrival.bp_diastolic || "");
      newFormData.disability.gcsE = String(caseSheetData.vitals_at_arrival.gcs_e || "4");
      newFormData.disability.gcsV = String(caseSheetData.vitals_at_arrival.gcs_v || "5");
      newFormData.disability.gcsM = String(caseSheetData.vitals_at_arrival.gcs_m || "6");
      newFormData.disability.glucose = String(caseSheetData.vitals_at_arrival.grbs || "");
      newFormData.exposure.temperature = String(caseSheetData.vitals_at_arrival.temperature || "");
    }
    if (caseSheetData.abcde) {
      Object.assign(newFormData.airway, caseSheetData.abcde.airway || {});
      Object.assign(newFormData.breathing, caseSheetData.abcde.breathing || {});
      Object.assign(newFormData.circulation, caseSheetData.abcde.circulation || {});
      Object.assign(newFormData.disability, caseSheetData.abcde.disability || {});
      Object.assign(newFormData.exposure, caseSheetData.abcde.exposure || {});
    }
    if (caseSheetData.adjuncts) {
      Object.assign(newFormData.adjuncts, caseSheetData.adjuncts);
    }
    if (caseSheetData.sample) {
      Object.assign(newFormData.sample, caseSheetData.sample);
    }
    if (caseSheetData.history) {
      newFormData.sample.eventsHopi = caseSheetData.history.hpi || "";
      newFormData.sample.allergies = caseSheetData.history.allergies || "";
      newFormData.sample.medications = caseSheetData.history.medications || "";
      newFormData.sample.pastMedicalHistory = caseSheetData.history.past_medical || "";
      newFormData.sample.lastMeal = caseSheetData.history.last_meal || "";
      newFormData.sample.lmp = caseSheetData.history.lmp || "";
      setPastSurgicalHistory(caseSheetData.history.past_surgical || "");
      setOtherHistory(caseSheetData.history.other || "");
    }
    if (caseSheetData.psychological) {
      setPsychData({ ...getDefaultPsychFormData(), ...caseSheetData.psychological });
    }
    if (caseSheetData.examination) {
      setExamData({ ...getDefaultExamFormData(), ...caseSheetData.examination });
    }
    if (caseSheetData.treatment) {
      const loadedMeds: MedicationEntry[] = Array.isArray(caseSheetData.treatment.medications)
        ? caseSheetData.treatment.medications.map((m: any, idx: number) => ({
            id: m.id || `loaded-${idx}`,
            name: m.name || "",
            dose: m.dose || "",
            route: m.route || "",
            frequency: m.frequency || "",
          }))
        : [];
      const loadedInfusions: InfusionEntry[] = Array.isArray(caseSheetData.treatment.infusions)
        ? caseSheetData.treatment.infusions.map((inf: any, idx: number) => ({
            id: inf.id || `inf-${idx}`,
            name: inf.name || "",
            dose: inf.dose || "",
            dilution: inf.dilution || "",
            rate: inf.rate || "",
            notes: inf.notes || "",
          }))
        : [];
      setTreatmentData((prev) => ({
        ...prev,
        primaryDiagnosis: caseSheetData.treatment.primary_diagnosis || (Array.isArray(caseSheetData.treatment.provisional_diagnoses) ? caseSheetData.treatment.provisional_diagnoses.join(", ") : (caseSheetData.treatment.provisional_diagnoses || "")),
        differentialDiagnoses: Array.isArray(caseSheetData.treatment.differential_diagnoses) ? caseSheetData.treatment.differential_diagnoses.join(", ") : (caseSheetData.treatment.differential_diagnoses || ""),
        medications: loadedMeds,
        infusions: loadedInfusions,
        otherMedications: caseSheetData.treatment.other_medications || caseSheetData.treatment.intervention_notes || "",
        ivFluids: caseSheetData.treatment.fluids || "",
      }));
    }
    if (caseSheetData.investigations) {
      setTreatmentData((prev) => ({
        ...prev,
        labsOrdered: Array.isArray(caseSheetData.investigations.panels_selected) ? caseSheetData.investigations.panels_selected.join(", ") : (caseSheetData.investigations.panels_selected || ""),
        imaging: Array.isArray(caseSheetData.investigations.imaging) ? caseSheetData.investigations.imaging.join(", ") : (caseSheetData.investigations.imaging || ""),
        resultsSummary: caseSheetData.investigations.results_notes || "",
      }));
    }
    if (caseSheetData.procedures?.procedures_performed) {
      setProceduresData((prev) => {
        const updated = { ...prev };
        caseSheetData.procedures.procedures_performed.forEach((proc: any) => {
          const cat = proc.category as ProcedureCategory;
          if (cat && cat !== "generalNotes" as any && Array.isArray(updated[cat])) {
            if (!updated[cat].includes(proc.name)) {
              updated[cat] = [...updated[cat], proc.name];
            }
          }
        });
        if (caseSheetData.procedures.general_notes) {
          updated.generalNotes = caseSheetData.procedures.general_notes;
        }
        return updated;
      });
    }
    if (caseSheetData.disposition) {
      setDispositionData((prev) => ({
        ...prev,
        dispositionType: caseSheetData.disposition.type || "",
        admitTo: caseSheetData.disposition.admit_to || caseSheetData.disposition.destination || "",
        admitToRoom: caseSheetData.disposition.admit_to_room || "",
        referTo: caseSheetData.disposition.refer_to || "",
      }));
    }
    if (caseSheetData.er_observation) {
      setDispositionData((prev) => ({
        ...prev,
        erObservationNotes: caseSheetData.er_observation.notes || "",
        durationInER: caseSheetData.er_observation.duration || "",
      }));
    }
    setFormData(newFormData);
    
    if (caseSheetData.mode_of_arrival) {
      setModeOfArrival(caseSheetData.mode_of_arrival);
    }
    if (caseSheetData.mlc !== undefined) {
      setIsMLC(caseSheetData.mlc === true);
    }
    if (caseSheetData.mlc_details) {
      setMLCDetails({
        natureOfIncident: caseSheetData.mlc_details.nature_of_incident || "",
        dateTimeOfIncident: caseSheetData.mlc_details.date_time || "",
        placeOfIncident: caseSheetData.mlc_details.place || "",
        identificationMark: caseSheetData.mlc_details.identification_mark || "",
        informantBroughtBy: caseSheetData.mlc_details.informant || "",
      });
    }
    
    if (caseSheetData.abcde) {
      const newABCDEStatus: ABCDEStatusData = { airway: "Normal", breathing: "Normal", circulation: "Normal", disability: "Normal", exposure: "Normal" };
      
      const a = caseSheetData.abcde.airway || {};
      if (a.abcdeStatus) newABCDEStatus.airway = a.abcdeStatus;
      
      const b = caseSheetData.abcde.breathing || {};
      if (b.abcdeStatus) newABCDEStatus.breathing = b.abcdeStatus;
      
      const c = caseSheetData.abcde.circulation || {};
      if (c.abcdeStatus) newABCDEStatus.circulation = c.abcdeStatus;
      
      const d = caseSheetData.abcde.disability || {};
      if (d.abcdeStatus) newABCDEStatus.disability = d.abcdeStatus;
      
      const e = caseSheetData.abcde.exposure || {};
      if (e.abcdeStatus) newABCDEStatus.exposure = e.abcdeStatus;
      
      setABCDEStatus(newABCDEStatus);
    }
  };

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const loadCase = async () => {
    try {
      const draftId = await initDraftForCase(caseId);
      localDraftIdRef.current = draftId;
      const draft = await loadDraft(draftId);
      const hasLocalDraft = !!draft?.caseSheetData;
      
      const res = await apiGet<any>(`/cases/${caseId}`);
      if (res.success && res.data) {
        setCaseData(res.data);
        
        if (hasLocalDraft) {
          loadFromCaseSheetData(draft!.caseSheetData);
          setLastSaved(new Date(draft!.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        } else {
        const newFormData = getDefaultATLSFormData();
        if (res.data.vitals_at_arrival) {
          newFormData.breathing.rr = String(res.data.vitals_at_arrival.rr || "");
          newFormData.breathing.spo2 = String(res.data.vitals_at_arrival.spo2 || "");
          newFormData.circulation.hr = String(res.data.vitals_at_arrival.hr || "");
          newFormData.circulation.bpSystolic = String(res.data.vitals_at_arrival.bp_systolic || "");
          newFormData.circulation.bpDiastolic = String(res.data.vitals_at_arrival.bp_diastolic || "");
          newFormData.disability.gcsE = String(res.data.vitals_at_arrival.gcs_e || "4");
          newFormData.disability.gcsV = String(res.data.vitals_at_arrival.gcs_v || "5");
          newFormData.disability.gcsM = String(res.data.vitals_at_arrival.gcs_m || "6");
          newFormData.disability.glucose = String(res.data.vitals_at_arrival.grbs || "");
          newFormData.exposure.temperature = String(res.data.vitals_at_arrival.temperature || "");
        }
        if (res.data.abcde) {
          Object.assign(newFormData.airway, res.data.abcde.airway || {});
          Object.assign(newFormData.breathing, res.data.abcde.breathing || {});
          Object.assign(newFormData.circulation, res.data.abcde.circulation || {});
          Object.assign(newFormData.disability, res.data.abcde.disability || {});
          Object.assign(newFormData.exposure, res.data.abcde.exposure || {});
        }
        if (res.data.adjuncts) {
          Object.assign(newFormData.adjuncts, res.data.adjuncts);
        }
        if (res.data.sample) {
          Object.assign(newFormData.sample, res.data.sample);
        }
        if (res.data.history) {
          newFormData.sample.eventsHopi = res.data.history.hpi || "";
          newFormData.sample.allergies = res.data.history.allergies || "";
          newFormData.sample.medications = res.data.history.medications || "";
          newFormData.sample.pastMedicalHistory = res.data.history.past_medical || "";
          newFormData.sample.lastMeal = res.data.history.last_meal || "";
          newFormData.sample.lmp = res.data.history.lmp || "";
          setPastSurgicalHistory(res.data.history.past_surgical || "");
          setOtherHistory(res.data.history.other || "");
        }
        if (res.data.psychological) {
          setPsychData({ ...getDefaultPsychFormData(), ...res.data.psychological });
        }
        if (res.data.examination) {
          setExamData({ ...getDefaultExamFormData(), ...res.data.examination });
        }
        if (res.data.treatment) {
          const loadedMeds: MedicationEntry[] = Array.isArray(res.data.treatment.medications)
            ? res.data.treatment.medications.map((m: any, idx: number) => ({
                id: m.id || `loaded-${idx}`,
                name: m.name || "",
                dose: m.dose || "",
                route: m.route || "",
                frequency: m.frequency || "",
              }))
            : [];
          const loadedInfusions: InfusionEntry[] = Array.isArray(res.data.treatment.infusions)
            ? res.data.treatment.infusions.map((inf: any, idx: number) => ({
                id: inf.id || `inf-${idx}`,
                name: inf.name || "",
                dose: inf.dose || "",
                dilution: inf.dilution || "",
                rate: inf.rate || "",
                notes: inf.notes || "",
              }))
            : [];
          setTreatmentData((prev) => ({
            ...prev,
            primaryDiagnosis: res.data.treatment.primary_diagnosis || (Array.isArray(res.data.treatment.provisional_diagnoses) ? res.data.treatment.provisional_diagnoses.join(", ") : (res.data.treatment.provisional_diagnoses || "")),
            differentialDiagnoses: Array.isArray(res.data.treatment.differential_diagnoses) ? res.data.treatment.differential_diagnoses.join(", ") : (res.data.treatment.differential_diagnoses || ""),
            medications: loadedMeds,
            infusions: loadedInfusions,
            otherMedications: res.data.treatment.other_medications || res.data.treatment.intervention_notes || "",
            ivFluids: res.data.treatment.fluids || "",
          }));
        }
        if (res.data.investigations) {
          setTreatmentData((prev) => ({
            ...prev,
            labsOrdered: Array.isArray(res.data.investigations.panels_selected) ? res.data.investigations.panels_selected.join(", ") : (res.data.investigations.panels_selected || ""),
            imaging: Array.isArray(res.data.investigations.imaging) ? res.data.investigations.imaging.join(", ") : (res.data.investigations.imaging || ""),
            resultsSummary: res.data.investigations.results_notes || "",
          }));
        }
        if (res.data.procedures?.procedures_performed) {
          setProceduresData((prev) => {
            const updated = { ...prev };
            res.data.procedures.procedures_performed.forEach((proc: any) => {
              const cat = proc.category as ProcedureCategory;
              if (cat && cat !== "generalNotes" as any && Array.isArray(updated[cat])) {
                if (!updated[cat].includes(proc.name)) {
                  updated[cat] = [...updated[cat], proc.name];
                }
              }
            });
            if (res.data.procedures.general_notes) {
              updated.generalNotes = res.data.procedures.general_notes;
            }
            return updated;
          });
        }
        if (res.data.disposition) {
          setDispositionData((prev) => ({
            ...prev,
            dispositionType: res.data.disposition.type || "",
            admitTo: res.data.disposition.admit_to || res.data.disposition.destination || "",
            admitToRoom: res.data.disposition.admit_to_room || "",
            referTo: res.data.disposition.refer_to || "",
          }));
        }
        if (res.data.er_observation) {
          setDispositionData((prev) => ({
            ...prev,
            erObservationNotes: res.data.er_observation.notes || "",
            durationInER: res.data.er_observation.duration || "",
          }));
        }
        setFormData(newFormData);

        if (res.data.patient?.mode_of_arrival) {
          setModeOfArrival(res.data.patient.mode_of_arrival);
        }
        if (res.data.mlc !== undefined) {
          setIsMLC(res.data.mlc === true);
        }
        if (res.data.mlc_details) {
          setMLCDetails({
            natureOfIncident: res.data.mlc_details.nature_of_incident || "",
            dateTimeOfIncident: res.data.mlc_details.date_time || "",
            placeOfIncident: res.data.mlc_details.place || "",
            identificationMark: res.data.mlc_details.identification_mark || "",
            informantBroughtBy: res.data.mlc_details.informant || "Self",
          });
        }

        const newABCDEStatus: ABCDEStatusData = { airway: "Normal", breathing: "Normal", circulation: "Normal", disability: "Normal", exposure: "Normal" };
        if (res.data.abcde) {
          const a = res.data.abcde.airway || {};
          if (a.abcdeStatus) newABCDEStatus.airway = a.abcdeStatus;
          else if (
            (a.status && a.status !== "patent" && a.status !== "") ||
            (a.maintenance && a.maintenance !== "self_maintained" && a.maintenance !== "") ||
            (a.obstructionCause && a.obstructionCause !== "none" && a.obstructionCause !== "") ||
            (a.speech && a.speech !== "clear" && a.speech !== "") ||
            (a.interventions?.length > 0)
          ) {
            newABCDEStatus.airway = "Abnormal";
          }

          const b = res.data.abcde.breathing || {};
          if (b.abcdeStatus) newABCDEStatus.breathing = b.abcdeStatus;
          else if (
            (b.effort && b.effort !== "normal" && b.effort !== "") ||
            (b.pattern && b.pattern !== "regular" && b.pattern !== "") ||
            (b.chestExpansion && b.chestExpansion !== "equal_bilateral" && b.chestExpansion !== "") ||
            (b.airEntry && b.airEntry !== "equal_bilateral" && b.airEntry !== "") ||
            (b.addedSounds && b.addedSounds !== "none" && b.addedSounds !== "") ||
            (b.interventions?.length > 0)
          ) {
            newABCDEStatus.breathing = "Abnormal";
          }

          const c = res.data.abcde.circulation || {};
          if (c.abcdeStatus) newABCDEStatus.circulation = c.abcdeStatus;
          else if (
            (c.pulseQuality && c.pulseQuality !== "strong_regular" && c.pulseQuality !== "") ||
            (c.capillaryRefill && c.capillaryRefill !== "normal" && c.capillaryRefill !== "") ||
            (c.skinColor && c.skinColor !== "normal" && c.skinColor !== "") ||
            (c.skinTemperature && c.skinTemperature !== "warm" && c.skinTemperature !== "") ||
            (c.interventions?.length > 0)
          ) {
            newABCDEStatus.circulation = "Abnormal";
          }

          const d = res.data.abcde.disability || {};
          if (d.abcdeStatus) newABCDEStatus.disability = d.abcdeStatus;
          else {
            const gcsTotal = (parseInt(d.gcsE) || 4) + (parseInt(d.gcsV) || 5) + (parseInt(d.gcsM) || 6);
            if (
              gcsTotal < 15 ||
              (d.pupilSize && d.pupilSize !== "equal" && d.pupilSize !== "") ||
              (d.pupilReaction && d.pupilReaction !== "brisk" && d.pupilReaction !== "") ||
              (d.motorResponse && d.motorResponse !== "" && d.motorResponse !== "obeys") ||
              (d.interventions?.length > 0)
            ) {
              newABCDEStatus.disability = "Abnormal";
            }
          }

          const e = res.data.abcde.exposure || {};
          if (e.abcdeStatus) newABCDEStatus.exposure = e.abcdeStatus;
          else if ((e.findings?.length > 0) || (e.interventions?.length > 0)) {
            newABCDEStatus.exposure = "Abnormal";
          }
        }
        setABCDEStatus(newABCDEStatus);
        }
      }
    } catch (err) {
      console.error("Error loading case:", err);
    } finally {
      setLoading(false);
    }
  };

  const updateFormData = (section: keyof ATLSFormData, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  const updateExamData = (section: keyof ExamFormData, field: string, value: any) => {
    setExamData((prev) => ({
      ...prev,
      [section]: { ...prev[section], [field]: value },
    }));
  };

  const buildPayload = () => {
    const gcsE = parseInt(formData.disability.gcsE) || 4;
    const gcsV = parseInt(formData.disability.gcsV) || 5;
    const gcsM = parseInt(formData.disability.gcsM) || 6;
    const gcsTotal = gcsE + gcsV + gcsM;

    return {
      vitals_at_arrival: {
        hr: parseFloat(formData.circulation.hr) || 80,
        bp_systolic: parseFloat(formData.circulation.bpSystolic) || 120,
        bp_diastolic: parseFloat(formData.circulation.bpDiastolic) || 80,
        rr: parseFloat(formData.breathing.rr) || 16,
        spo2: parseFloat(formData.breathing.spo2) || 98,
        temperature: parseFloat(formData.exposure.temperature) || 36.8,
        gcs_e: gcsE,
        gcs_v: gcsV,
        gcs_m: gcsM,
        gcs_total: gcsTotal,
        grbs: parseFloat(formData.disability.glucose) || 100,
      },
      primary_assessment: {
        airway_status: formData.airway.status || "Patent",
        airway_interventions: formData.airway.interventions || [],
        airway_additional_notes: formData.airway.notes || "",
        breathing_rr: parseFloat(formData.breathing.rr) || 16,
        breathing_spo2: parseFloat(formData.breathing.spo2) || 98,
        breathing_oxygen_device: formData.breathing.o2Device || "",
        breathing_oxygen_flow: parseFloat(formData.breathing.o2Flow) || 0,
        breathing_work: formData.breathing.effort || "Normal",
        breathing_air_entry: formData.breathing.airEntry ? [formData.breathing.airEntry] : ["Equal"],
        breathing_additional_notes: formData.breathing.notes || "",
        circulation_hr: parseFloat(formData.circulation.hr) || 80,
        circulation_bp_systolic: parseFloat(formData.circulation.bpSystolic) || 120,
        circulation_bp_diastolic: parseFloat(formData.circulation.bpDiastolic) || 80,
        circulation_crt: formData.circulation.capillaryRefill === "Delayed" ? 3 : 2,
        circulation_adjuncts: formData.circulation.interventions || [],
        circulation_additional_notes: formData.circulation.notes || "",
        disability_avpu: formData.disability.motorResponse || "Alert",
        disability_gcs_e: gcsE,
        disability_gcs_v: gcsV,
        disability_gcs_m: gcsM,
        disability_grbs: parseFloat(formData.disability.glucose) || 100,
        disability_pupils_size: formData.disability.pupilSize || "Normal",
        disability_pupils_reaction: formData.disability.pupilReaction || "Reactive",
        disability_additional_notes: formData.disability.notes || "",
        exposure_temperature: parseFloat(formData.exposure.temperature) || 36.8,
        exposure_additional_notes: formData.exposure.notes || "",
      },
      abcde: {
        airway: { ...formData.airway, abcdeStatus: abcdeStatus.airway },
        breathing: { ...formData.breathing, abcdeStatus: abcdeStatus.breathing },
        circulation: { ...formData.circulation, abcdeStatus: abcdeStatus.circulation },
        disability: { ...formData.disability, abcdeStatus: abcdeStatus.disability },
        exposure: { ...formData.exposure, abcdeStatus: abcdeStatus.exposure },
      },
      adjuncts: {
        ecg_findings: formData.adjuncts.ecgNotes || "",
        bedside_echo: formData.adjuncts.echoNotes || "",
        additional_notes: formData.adjuncts.abgNotes || "",
        efast_status: formData.adjuncts.efastStatus || "",
        efast_notes: formData.adjuncts.efastNotes || "",
      },
      sample: formData.sample,
      history: {
        hpi: formData.sample.eventsHopi || "",
        events_hopi: formData.sample.eventsHopi || "",
        signs_and_symptoms: formData.sample.signsSymptoms || "",
        allergies: Array.isArray(formData.sample.allergies) ? formData.sample.allergies : (typeof formData.sample.allergies === 'string' && formData.sample.allergies ? formData.sample.allergies.split(',').map((s: string) => s.trim()).filter((s: string) => s) : []),
        medications: formData.sample.medications || "",
        drug_history: formData.sample.medications || "",
        past_medical: Array.isArray(formData.sample.pastMedicalHistory) ? formData.sample.pastMedicalHistory : (typeof formData.sample.pastMedicalHistory === 'string' && formData.sample.pastMedicalHistory ? formData.sample.pastMedicalHistory.split(',').map((s: string) => s.trim()).filter((s: string) => s) : []),
        past_surgical: pastSurgicalHistory || "",
        last_meal: formData.sample.lastMeal || "",
        lmp: formData.sample.lmp || "",
        last_meal_lmp: `${formData.sample.lastMeal || ""}${formData.sample.lmp ? ` | LMP: ${formData.sample.lmp}` : ""}`,
        additional_notes: otherHistory || "",
      },
      examination: {
        general_pallor: examData.general.pallor,
        general_icterus: examData.general.icterus,
        general_cyanosis: examData.general.cyanosis,
        general_clubbing: examData.general.clubbing,
        general_lymphadenopathy: examData.general.lymphadenopathy,
        general_edema: examData.general.edema,
        general_additional_notes: examData.general.notes || "",
        cvs_status: examData.cvs.status || "Normal",
        cvs_s1_s2: examData.cvs.s1s2 || "Normal",
        cvs_pulse: examData.cvs.pulse || "Regular",
        cvs_pulse_rate: parseInt(examData.cvs.pulseRate) || 80,
        cvs_apex_beat: examData.cvs.apexBeat || "Normal",
        cvs_added_sounds: examData.cvs.addedSounds || "",
        cvs_murmurs: examData.cvs.murmurs || "",
        cvs_additional_notes: examData.cvs.notes || "",
        respiratory_status: examData.respiratory.status || "Normal",
        respiratory_expansion: examData.respiratory.expansion || "Equal",
        respiratory_percussion: examData.respiratory.percussion || "Resonant",
        respiratory_breath_sounds: examData.respiratory.breathSounds || "Vesicular",
        respiratory_vocal_resonance: examData.respiratory.vocalResonance || "Normal",
        respiratory_added_sounds: examData.respiratory.addedSounds || "",
        respiratory_additional_notes: examData.respiratory.notes || "",
        abdomen_status: examData.abdomen.status || "Normal",
        abdomen_umbilical: examData.abdomen.umbilical || "Normal",
        abdomen_organomegaly: examData.abdomen.organomegaly || "",
        abdomen_percussion: examData.abdomen.percussion || "Tympanic",
        abdomen_bowel_sounds: examData.abdomen.bowelSounds || "Present",
        abdomen_additional_notes: examData.abdomen.notes || "",
        cns_status: examData.cns.status || "Normal",
        cns_higher_mental: examData.cns.higherMentalFunctions || "Intact",
        cns_cranial_nerves: examData.cns.cranialNerves || "Intact",
        cns_sensory_system: examData.cns.sensorySystem || "Intact",
        cns_motor_system: examData.cns.motorSystem || "Normal",
        cns_reflexes: examData.cns.reflexes || "Normal",
        cns_additional_notes: examData.cns.notes || "",
        extremities_status: examData.extremities.status || "Normal",
        extremities_findings: examData.extremities.notes || "",
      },
      treatment: {
        intervention_notes: treatmentData.otherMedications || "",
        medications: treatmentData.medications.map((m) => ({
          name: m.name,
          dose: m.dose,
          route: m.route,
          frequency: m.frequency,
        })),
        infusions: treatmentData.infusions.map((inf) => ({
          name: inf.name,
          dose: inf.dose,
          dilution: inf.dilution,
          rate: inf.rate,
          notes: inf.notes,
        })),
        other_medications: treatmentData.otherMedications || "",
        fluids: treatmentData.ivFluids || "",
        differential_diagnoses: Array.isArray(treatmentData.differentialDiagnoses) ? treatmentData.differentialDiagnoses : (typeof treatmentData.differentialDiagnoses === 'string' && treatmentData.differentialDiagnoses ? treatmentData.differentialDiagnoses.split(',').map((s: string) => s.trim()).filter((s: string) => s) : []),
        provisional_diagnoses: treatmentData.primaryDiagnosis ? [treatmentData.primaryDiagnosis.trim()] : [],
        primary_diagnosis: treatmentData.primaryDiagnosis || "",
      },
      investigations: {
        panels_selected: Array.isArray(treatmentData.labsOrdered) ? treatmentData.labsOrdered : (typeof treatmentData.labsOrdered === 'string' && treatmentData.labsOrdered ? treatmentData.labsOrdered.split(',').map((s: string) => s.trim()).filter((s: string) => s) : []),
        imaging: Array.isArray(treatmentData.imaging) ? treatmentData.imaging : (typeof treatmentData.imaging === 'string' && treatmentData.imaging ? treatmentData.imaging.split(',').map((s: string) => s.trim()).filter((s: string) => s) : []),
        results_notes: treatmentData.resultsSummary || "",
      },
      procedures: {
        procedures_performed: Object.entries(proceduresData)
          .filter(([category]) => category !== "generalNotes")
          .flatMap(([category, items]) =>
            (items as string[]).map((name: string) => ({ name, category, timestamp: new Date().toISOString() }))
          ),
        general_notes: proceduresData.generalNotes || "",
      },
      er_observation: {
        notes: dispositionData.erObservationNotes || "",
        duration: dispositionData.durationInER || "",
      },
      disposition: {
        type: dispositionData.dispositionType || "",
        destination: dispositionData.admitTo || "",
        admit_to: dispositionData.admitTo || "",
        admit_to_room: dispositionData.admitToRoom || "",
        refer_to: dispositionData.referTo || "",
      },
      addendum_notes: treatmentData.addendumNotes ? [{ text: treatmentData.addendumNotes, timestamp: new Date().toISOString() }] : [],
      mode_of_arrival: modeOfArrival,
      mlc: isMLC,
      mlc_details: isMLC ? {
        nature_of_incident: mlcDetails.natureOfIncident,
        date_time: mlcDetails.dateTimeOfIncident,
        place: mlcDetails.placeOfIncident,
        identification_mark: mlcDetails.identificationMark,
        informant: mlcDetails.informantBroughtBy,
      } : null,
    };
  };

  const handleSave = async (silent: boolean = false) => {
    if (!caseId) {
      console.error("Cannot save: No case ID");
      if (!silent) Alert.alert("Error", "No case ID available");
      return;
    }
    
    const effectiveDraftId = currentDraftId || localDraftIdRef.current;
    if (!effectiveDraftId) {
      console.error("Cannot save: No draft initialized");
      if (!silent) Alert.alert("Error", "Please wait for the case to load completely before saving.");
      return;
    }
    
    setSaving(true);
    try {
      const payload = buildPayload();
      await saveToDraft(payload);
      setLastSaved(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      if (!silent) Alert.alert("Saved Locally", "Data saved locally. It will be submitted when you click Finish in Disposition.");
    } catch (err) {
      console.error("Local save exception:", err);
      const errMsg = err instanceof Error ? err.message : String(err || "Failed to save case data");
      if (!silent) Alert.alert("Error", errMsg);
    } finally {
      setSaving(false);
    }
  };

  const commitToBackend = async () => {
    if (!caseId) {
      Alert.alert("Error", "No case ID available");
      return false;
    }
    setSaving(true);
    try {
      const payload = buildPayload();
      console.log("Committing case to backend:", caseId);
      console.log("Treatment medications being sent:", JSON.stringify(payload.treatment?.medications, null, 2));
      await cacheCasePayload(caseId, payload);
      const res = await apiPut(`/cases/${caseId}`, payload);
      console.log("Commit response:", res.success, res.error || "");
      if (res.success) {
        await invalidateCases();
        const effectiveDraftId = currentDraftId || localDraftIdRef.current;
        if (effectiveDraftId) {
          await commitDraft(caseId);
        }
        return true;
      } else {
        console.error("Commit failed:", res.error);
        const errorData = res.error as any;
        let errorMessage = "Failed to save case. Please try again.";
        if (errorData?.error === "edit_limit_reached") {
          errorMessage = errorData.message || "Edit limit reached. Please upgrade for unlimited edits.";
        } else if (Array.isArray(errorData)) {
          errorMessage = errorData.map((e: any) => e.msg || e.message).join(", ");
        } else if (typeof errorData === "string") {
          errorMessage = errorData;
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        }
        Alert.alert("Save Error", errorMessage);
        return false;
      }
    } catch (err) {
      console.error("Commit exception:", err);
      const errMsg = err instanceof Error ? err.message : String(err || "Failed to save case");
      Alert.alert("Error", errMsg);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Auto-save disabled due to backend's 2-edit limit on free plan
  // Users should manually save using the Save button to avoid hitting the limit
  // useEffect(() => {
  //   if (!caseId || loading) return;
  //   const autoSaveTimer = setTimeout(() => {
  //     handleSave(true);
  //   }, 5000);
  //   return () => clearTimeout(autoSaveTimer);
  // }, [formData, examData, treatmentData, pastSurgicalHistory, otherHistory, abcdeStatus, modeOfArrival, isMLC, mlcDetails]);

  const startVoiceRecording = async (fieldKey: string) => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Microphone access is needed for voice input");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setActiveVoiceField(fieldKey);
    } catch (err) {
      Alert.alert("Error", "Failed to start recording");
    }
  };

  const stopVoiceRecording = async () => {
    if (!recordingRef.current) return;
    try {
      await recordingRef.current.stopAndUnloadAsync();
      const uri = recordingRef.current.getURI();
      recordingRef.current = null;
      setIsRecording(false);
      if (uri && activeVoiceField) {
        await transcribeAudio(uri, activeVoiceField);
      }
      setActiveVoiceField(null);
    } catch (err) {
      console.error("Stop recording error:", err);
    }
  };

  const transcribeAudio = async (uri: string, fieldKey: string) => {
    try {
      const formDataUpload = new FormData();
      formDataUpload.append("file", { uri, name: "voice.m4a", type: "audio/m4a" } as any);
      formDataUpload.append("engine", "auto");
      formDataUpload.append("language", "en");
      const res = await apiUpload<{ transcription: string }>("/ai/voice-to-text", formDataUpload);
      if (res.success && res.data?.transcription) {
        const text = res.data.transcription;
        if (fieldKey.startsWith("sample.")) {
          const field = fieldKey.replace("sample.", "");
          const current = (formData.sample as any)[field] || "";
          updateFormData("sample", field, current ? `${current} ${text}` : text);
        } else if (fieldKey === "pastSurgicalHistory") {
          setPastSurgicalHistory((prev) => (prev ? `${prev} ${text}` : text));
        } else if (fieldKey === "otherHistory") {
          setOtherHistory((prev) => (prev ? `${prev} ${text}` : text));
        } else if (fieldKey === "psychNotes") {
          setPsychData((prev) => ({ ...prev, notes: prev.notes ? `${prev.notes} ${text}` : text }));
        } else if (fieldKey.startsWith("exam.")) {
          const [, section, field] = fieldKey.split(".");
          const current = (examData as any)[section]?.[field] || "";
          updateExamData(section as keyof ExamFormData, field, current ? `${current} ${text}` : text);
        } else if (fieldKey.startsWith("treatment.")) {
          const field = fieldKey.replace("treatment.", "") as keyof TreatmentFormData;
          const current = treatmentData[field] || "";
          setTreatmentData((prev) => ({ ...prev, [field]: current ? `${current} ${text}` : text }));
        } else if (fieldKey === "erObservationNotes") {
          setDispositionData((prev) => ({ ...prev, erObservationNotes: prev.erObservationNotes ? `${prev.erObservationNotes} ${text}` : text }));
        } else if (fieldKey === "procedures.generalNotes") {
          setProceduresData((prev) => ({ ...prev, generalNotes: prev.generalNotes ? `${prev.generalNotes} ${text}` : text }));
        } else if (fieldKey.startsWith("airway.") || fieldKey.startsWith("breathing.") || 
                   fieldKey.startsWith("circulation.") || fieldKey.startsWith("disability.") || 
                   fieldKey.startsWith("exposure.")) {
          const [section, field] = fieldKey.split(".");
          const sectionKey = section as keyof ATLSFormData;
          const current = (formData[sectionKey] as any)?.[field] || "";
          updateFormData(sectionKey, field, current ? `${current} ${text}` : text);
        }
      }
    } catch (err) {
      console.error("Transcription error:", err);
      Alert.alert("Error", "Failed to transcribe audio. Please try again.");
    }
  };

  const addMedication = () => {
    if (!newMedication.name.trim()) return;
    const newEntry: MedicationEntry = {
      id: Date.now().toString(),
      name: newMedication.name.trim(),
      dose: newMedication.dose.trim(),
      route: newMedication.route.trim(),
      frequency: newMedication.frequency.trim(),
    };
    setTreatmentData((prev) => ({
      ...prev,
      medications: [...prev.medications, newEntry],
    }));
    setNewMedication({ name: "", dose: "", route: "", frequency: "stat" });
  };

  const removeMedication = (id: string) => {
    setTreatmentData((prev) => ({
      ...prev,
      medications: prev.medications.filter((m) => m.id !== id),
    }));
  };

  const addInfusion = () => {
    if (!newInfusion.name.trim()) return;
    const newEntry: InfusionEntry = {
      id: Date.now().toString(),
      name: newInfusion.name.trim(),
      dose: newInfusion.dose.trim(),
      dilution: newInfusion.dilution.trim(),
      rate: newInfusion.rate.trim(),
      notes: newInfusion.notes.trim(),
    };
    setTreatmentData((prev) => ({
      ...prev,
      infusions: [...prev.infusions, newEntry],
    }));
    setNewInfusion({ name: "", dose: "", dilution: "", rate: "", notes: "" });
  };

  const removeInfusion = (id: string) => {
    setTreatmentData((prev) => ({
      ...prev,
      infusions: prev.infusions.filter((inf) => inf.id !== id),
    }));
  };

  const handleABGInterpretation = async () => {
    const abgFields = formData.adjuncts;
    const abgValuesArr: string[] = [];
    if (abgFields.abgPh) abgValuesArr.push(`pH: ${abgFields.abgPh}`);
    if (abgFields.abgPco2) abgValuesArr.push(`pCO2: ${abgFields.abgPco2} mmHg`);
    if (abgFields.abgPo2) abgValuesArr.push(`pO2: ${abgFields.abgPo2} mmHg`);
    if (abgFields.abgHco3) abgValuesArr.push(`HCO3: ${abgFields.abgHco3} mEq/L`);
    if (abgFields.abgBe) abgValuesArr.push(`BE: ${abgFields.abgBe} mEq/L`);
    if (abgFields.abgLactate) abgValuesArr.push(`Lactate: ${abgFields.abgLactate} mmol/L`);
    if (abgFields.abgSao2) abgValuesArr.push(`SaO2: ${abgFields.abgSao2}%`);
    if (abgFields.abgFio2) abgValuesArr.push(`FiO2: ${abgFields.abgFio2}%`);
    if (abgFields.abgNa) abgValuesArr.push(`Na: ${abgFields.abgNa} mEq/L`);
    if (abgFields.abgK) abgValuesArr.push(`K: ${abgFields.abgK} mEq/L`);
    if (abgFields.abgCl) abgValuesArr.push(`Cl: ${abgFields.abgCl} mEq/L`);
    if (abgFields.abgAnionGap) abgValuesArr.push(`AG: ${abgFields.abgAnionGap}`);
    if (abgFields.abgGlucose) abgValuesArr.push(`Glucose: ${abgFields.abgGlucose} mg/dL`);
    if (abgFields.abgHb) abgValuesArr.push(`Hb: ${abgFields.abgHb} g/dL`);
    if (abgFields.abgAaGradient) abgValuesArr.push(`A-a gradient: ${abgFields.abgAaGradient} mmHg`);
    if (abgFields.abgNotes) abgValuesArr.push(`Notes: ${abgFields.abgNotes}`);
    
    const abgValues = abgValuesArr.join(", ");
    if (abgValuesArr.length < 2) {
      Alert.alert("Missing Values", "Please enter at least 2 ABG values (pH, pCO2, pO2, HCO3, BE, Lactate, etc.)");
      return;
    }
    
    setAbgInterpreting(true);
    setAbgInterpretation(null);
    
    try {
      const { getApiUrl } = await import("@/lib/query-client");
      const response = await fetch(`${getApiUrl()}/api/ai/interpret-abg`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          abg_values: abgValues,
          patient_context: {
            age: caseData?.patient?.age,
            sex: caseData?.patient?.sex,
            presenting_complaint: caseData?.presenting_complaint?.text,
          },
        }),
      });
      
      if (!response.ok) {
        throw new Error("Failed to interpret ABG");
      }
      
      const data = await response.json();
      setAbgInterpretation(data.interpretation || "Unable to interpret ABG values");
    } catch (error) {
      console.error("ABG interpretation error:", error);
      Alert.alert("Error", "Failed to get AI interpretation. Please try again.");
    } finally {
      setAbgInterpreting(false);
    }
  };

  const markAllExamNormal = () => {
    setExamData({
      general: { pallor: false, icterus: false, cyanosis: false, clubbing: false, lymphadenopathy: false, edema: false, notes: "Patient is conscious, alert, and oriented. No pallor, icterus, cyanosis, clubbing, lymphadenopathy, or edema noted." },
      cvs: { status: "Normal", s1s2: "Normal", pulse: "Regular", pulseRate: "", apexBeat: "Normal", precordialHeave: false, addedSounds: "", murmurs: "", notes: "S1 S2 heard, normal intensity. No murmurs, gallops, or rubs. JVP not elevated. Peripheral pulses well felt bilaterally." },
      respiratory: { status: "Normal", expansion: "Equal", percussion: "Resonant", breathSounds: "Vesicular", vocalResonance: "Normal", addedSounds: "", notes: "Bilateral equal air entry. Vesicular breath sounds. No wheeze, crackles, or rhonchi. Normal percussion notes." },
      abdomen: { status: "Normal", umbilical: "Normal", organomegaly: "", percussion: "Tympanic", bowelSounds: "Present", externalGenitalia: "Normal", hernialOrifices: "Normal", perRectal: "", perVaginal: "", notes: "Soft, non-distended, non-tender. No guarding or rigidity. No organomegaly. Bowel sounds present and normal." },
      cns: { status: "Normal", higherMentalFunctions: "Intact", cranialNerves: "Intact", sensorySystem: "Intact", motorSystem: "Normal", reflexes: "Normal", rombergSign: "Negative", cerebellarSigns: "Normal", notes: "Conscious, oriented to time, place, and person. GCS 15/15. Cranial nerves intact. Pupils BERL. Motor power 5/5 in all limbs. Reflexes normal." },
      extremities: { status: "Normal", pulses: "Present", edema: false, deformity: false, notes: "No edema, cyanosis, or clubbing. Peripheral pulses well felt. Full range of motion. No deformity or swelling." },
    });
    Alert.alert("Done", "All examination sections marked as normal with detailed findings");
  };

  const handleVoiceExtraction = (data: ExtractedClinicalData) => {
    if (data.historyOfPresentIllness) {
      updateFormData("sample", "eventsHopi", (formData.sample.eventsHopi ? formData.sample.eventsHopi + " " : "") + data.historyOfPresentIllness);
    }
    if (data.pastMedicalHistory) {
      const currentPast = formData.sample.pastMedicalHistory || "";
      updateFormData("sample", "pastMedicalHistory", currentPast ? currentPast + ", " + data.pastMedicalHistory : data.pastMedicalHistory);
    }
    if (data.allergies) {
      updateFormData("sample", "allergies", (formData.sample.allergies ? formData.sample.allergies + ", " : "") + data.allergies);
    }
    if (data.medications) {
      updateFormData("sample", "medications", (formData.sample.medications ? formData.sample.medications + ", " : "") + data.medications);
    }
    if (data.symptoms && data.symptoms.length > 0) {
      const symptomsText = data.symptoms.join(", ");
      updateFormData("sample", "signsSymptoms", (formData.sample.signsSymptoms ? formData.sample.signsSymptoms + ", " : "") + symptomsText);
    }
    if (data.examFindings) {
      if (data.examFindings.general) {
        updateExamData("general", "notes", (examData.general.notes ? examData.general.notes + " " : "") + data.examFindings.general);
      }
      if (data.examFindings.cvs) {
        updateExamData("cvs", "notes", (examData.cvs.notes ? examData.cvs.notes + " " : "") + data.examFindings.cvs);
      }
      if (data.examFindings.respiratory) {
        updateExamData("respiratory", "notes", (examData.respiratory.notes ? examData.respiratory.notes + " " : "") + data.examFindings.respiratory);
      }
      if (data.examFindings.abdomen) {
        updateExamData("abdomen", "notes", (examData.abdomen.notes ? examData.abdomen.notes + " " : "") + data.examFindings.abdomen);
      }
      if (data.examFindings.cns) {
        updateExamData("cns", "notes", (examData.cns.notes ? examData.cns.notes + " " : "") + data.examFindings.cns);
      }
    }
    if (data.diagnosis && data.diagnosis.length > 0) {
      const diagnosisText = data.diagnosis.join(", ");
      setTreatmentData((prev) => ({ ...prev, primaryDiagnosis: prev.primaryDiagnosis ? prev.primaryDiagnosis + ", " + diagnosisText : diagnosisText }));
    }
    if (data.treatmentNotes) {
      setTreatmentData((prev) => ({ ...prev, addendumNotes: (prev.addendumNotes || "") + " " + data.treatmentNotes }));
    }
    handleSave(true);
  };

  const handleSmartDictation = (data: SmartDictationExtracted) => {
    if (data.chiefComplaint) {
      updateFormData("sample", "signsSymptoms", (formData.sample.signsSymptoms ? formData.sample.signsSymptoms + ", " : "") + data.chiefComplaint);
    }
    if (data.historyOfPresentIllness) {
      let hpi = data.historyOfPresentIllness;
      if (data.onset) hpi += ` Onset: ${data.onset}.`;
      if (data.duration) hpi += ` Duration: ${data.duration}.`;
      if (data.progression) hpi += ` Progression: ${data.progression}.`;
      if (data.associatedSymptoms) hpi += ` Associated symptoms: ${data.associatedSymptoms}.`;
      if (data.negativeSymptoms) hpi += ` Pertinent negatives: ${data.negativeSymptoms}.`;
      updateFormData("sample", "eventsHopi", (formData.sample.eventsHopi ? formData.sample.eventsHopi + " " : "") + hpi);
    }
    if (data.pastMedicalHistory) {
      updateFormData("sample", "pastMedicalHistory", (formData.sample.pastMedicalHistory ? formData.sample.pastMedicalHistory + ", " : "") + data.pastMedicalHistory);
    }
    if (data.pastSurgicalHistory) {
      setPastSurgicalHistory((prev) => (prev ? `${prev}, ${data.pastSurgicalHistory}` : data.pastSurgicalHistory!));
    }
    if (data.allergies) {
      updateFormData("sample", "allergies", (formData.sample.allergies ? formData.sample.allergies + ", " : "") + data.allergies);
    }
    if (data.currentMedications) {
      updateFormData("sample", "medications", (formData.sample.medications ? formData.sample.medications + ", " : "") + data.currentMedications);
    }
    if (data.familyHistory) {
      setOtherHistory((prev) => (prev ? `${prev}. Family History: ${data.familyHistory}` : `Family History: ${data.familyHistory}`));
    }
    if (data.socialHistory) {
      setOtherHistory((prev) => (prev ? `${prev}. Social History: ${data.socialHistory}` : `Social History: ${data.socialHistory}`));
    }
    if (data.menstrualHistory) {
      updateFormData("sample", "lastMenstrualPeriod", data.menstrualHistory);
    }
    if (data.symptoms && data.symptoms.length > 0) {
      const symptomsText = data.symptoms.join(", ");
      updateFormData("sample", "signsSymptoms", (formData.sample.signsSymptoms ? formData.sample.signsSymptoms + ", " : "") + symptomsText);
    }
    if (data.painDetails) {
      const pd = data.painDetails;
      const parts = [];
      if (pd.location) parts.push(`Location: ${pd.location}`);
      if (pd.severity) parts.push(`Severity: ${pd.severity}`);
      if (pd.character) parts.push(`Character: ${pd.character}`);
      if (pd.aggravatingFactors) parts.push(`Aggravating: ${pd.aggravatingFactors}`);
      if (pd.relievingFactors) parts.push(`Relieving: ${pd.relievingFactors}`);
      if (parts.length > 0) {
        const painText = parts.join(". ");
        updateFormData("sample", "eventsHopi", (formData.sample.eventsHopi ? formData.sample.eventsHopi + ". Pain: " : "Pain: ") + painText);
      }
    }
    if (data.examFindings) {
      if (data.examFindings.general) {
        updateExamData("general", "notes", (examData.general.notes ? examData.general.notes + " " : "") + data.examFindings.general);
      }
      if (data.examFindings.cvs) {
        updateExamData("cvs", "notes", (examData.cvs.notes ? examData.cvs.notes + " " : "") + data.examFindings.cvs);
      }
      if (data.examFindings.respiratory) {
        updateExamData("respiratory", "notes", (examData.respiratory.notes ? examData.respiratory.notes + " " : "") + data.examFindings.respiratory);
      }
      if (data.examFindings.abdomen) {
        updateExamData("abdomen", "notes", (examData.abdomen.notes ? examData.abdomen.notes + " " : "") + data.examFindings.abdomen);
      }
      if (data.examFindings.cns) {
        updateExamData("cns", "notes", (examData.cns.notes ? examData.cns.notes + " " : "") + data.examFindings.cns);
      }
    }
    if (data.diagnosis && data.diagnosis.length > 0) {
      const diagnosisText = data.diagnosis.join(", ");
      setTreatmentData((prev) => ({ ...prev, primaryDiagnosis: prev.primaryDiagnosis ? prev.primaryDiagnosis + ", " + diagnosisText : diagnosisText }));
    }
    if (data.differentialDiagnosis && data.differentialDiagnosis.length > 0) {
      const ddx = data.differentialDiagnosis.join(", ");
      setTreatmentData((prev) => ({ ...prev, differentialDiagnoses: prev.differentialDiagnoses ? prev.differentialDiagnoses + ", " + ddx : ddx }));
    }
    if (data.treatmentNotes) {
      setTreatmentData((prev) => ({ ...prev, addendumNotes: (prev.addendumNotes || "") + " " + data.treatmentNotes }));
    }
    if (data.investigationsOrdered) {
      setTreatmentData((prev) => ({ ...prev, labsOrdered: prev.labsOrdered ? prev.labsOrdered + ", " + data.investigationsOrdered : data.investigationsOrdered! }));
    }
    if (data.imagingOrdered) {
      setTreatmentData((prev) => ({ ...prev, imaging: prev.imaging ? prev.imaging + ", " + data.imagingOrdered : data.imagingOrdered! }));
    }
    handleSave(true);
  };

  const handleDocumentScanExtraction = (data: {
    chiefComplaint?: string;
    hpiNotes?: string;
    allergies?: string;
    pastMedicalHistory?: string;
    medications?: string;
    vitals?: { hr?: string; bp?: string; rr?: string; spo2?: string; temp?: string; grbs?: string };
    abgValues?: { ph?: string; pco2?: string; po2?: string; hco3?: string; be?: string; lactate?: string; sao2?: string; fio2?: string; na?: string; k?: string; cl?: string; anionGap?: string; glucose?: string; hb?: string };
    labResults?: string;
    imagingResults?: string;
    diagnosis?: string;
    treatmentNotes?: string;
    generalNotes?: string;
  }) => {
    if (data.chiefComplaint) {
      updateFormData("sample", "signsSymptoms", (formData.sample.signsSymptoms ? formData.sample.signsSymptoms + ", " : "") + data.chiefComplaint);
    }
    if (data.hpiNotes) {
      updateFormData("sample", "eventsHopi", (formData.sample.eventsHopi ? formData.sample.eventsHopi + " " : "") + data.hpiNotes);
    }
    if (data.allergies) {
      updateFormData("sample", "allergies", (formData.sample.allergies ? formData.sample.allergies + ", " : "") + data.allergies);
    }
    if (data.pastMedicalHistory) {
      updateFormData("sample", "pastMedicalHistory", (formData.sample.pastMedicalHistory ? formData.sample.pastMedicalHistory + ", " : "") + data.pastMedicalHistory);
    }
    if (data.medications) {
      updateFormData("sample", "medications", (formData.sample.medications ? formData.sample.medications + ", " : "") + data.medications);
    }
    if (data.vitals) {
      if (data.vitals.hr) updateFormData("circulation", "hr", data.vitals.hr.replace(/[^\d]/g, ""));
      if (data.vitals.bp) {
        const bpParts = data.vitals.bp.split("/");
        if (bpParts.length === 2) {
          updateFormData("circulation", "bpSystolic", bpParts[0].replace(/[^\d]/g, ""));
          updateFormData("circulation", "bpDiastolic", bpParts[1].replace(/[^\d]/g, ""));
        }
      }
      if (data.vitals.rr) updateFormData("breathing", "rr", data.vitals.rr.replace(/[^\d]/g, ""));
      if (data.vitals.spo2) updateFormData("breathing", "spo2", data.vitals.spo2.replace(/[^\d]/g, ""));
      if (data.vitals.temp) updateFormData("exposure", "temperature", data.vitals.temp);
      if (data.vitals.grbs) updateFormData("exposure", "grbs", data.vitals.grbs.replace(/[^\d]/g, ""));
    }
    if (data.abgValues) {
      if (data.abgValues.ph) updateFormData("adjuncts", "abgPh", data.abgValues.ph);
      if (data.abgValues.pco2) updateFormData("adjuncts", "abgPco2", data.abgValues.pco2);
      if (data.abgValues.po2) updateFormData("adjuncts", "abgPo2", data.abgValues.po2);
      if (data.abgValues.hco3) updateFormData("adjuncts", "abgHco3", data.abgValues.hco3);
      if (data.abgValues.be) updateFormData("adjuncts", "abgBe", data.abgValues.be);
      if (data.abgValues.lactate) updateFormData("adjuncts", "abgLactate", data.abgValues.lactate);
      if (data.abgValues.sao2) updateFormData("adjuncts", "abgSao2", data.abgValues.sao2);
      if (data.abgValues.fio2) updateFormData("adjuncts", "abgFio2", data.abgValues.fio2);
      if (data.abgValues.na) updateFormData("adjuncts", "abgNa", data.abgValues.na);
      if (data.abgValues.k) updateFormData("adjuncts", "abgK", data.abgValues.k);
      if (data.abgValues.cl) updateFormData("adjuncts", "abgCl", data.abgValues.cl);
      if (data.abgValues.anionGap) updateFormData("adjuncts", "abgAnionGap", data.abgValues.anionGap);
      if (data.abgValues.glucose) updateFormData("adjuncts", "abgGlucose", data.abgValues.glucose);
      if (data.abgValues.hb) updateFormData("adjuncts", "abgHb", data.abgValues.hb);
      updateFormData("adjuncts", "abgStatus", "done");
    }
    if (data.labResults) {
      setTreatmentData((prev) => ({ ...prev, labsOrdered: (prev.labsOrdered ? prev.labsOrdered + "; " : "") + data.labResults }));
    }
    if (data.imagingResults) {
      setTreatmentData((prev) => ({ ...prev, imaging: (prev.imaging ? prev.imaging + "; " : "") + data.imagingResults }));
    }
    if (data.diagnosis) {
      const diagnosis = data.diagnosis;
      setTreatmentData((prev) => ({ ...prev, primaryDiagnosis: prev.primaryDiagnosis ? prev.primaryDiagnosis + ", " + diagnosis : diagnosis }));
    }
    if (data.treatmentNotes) {
      setTreatmentData((prev) => ({ ...prev, addendumNotes: (prev.addendumNotes || "") + " " + data.treatmentNotes }));
    }
    if (data.generalNotes) {
      setProceduresData((prev) => ({ ...prev, generalNotes: (prev.generalNotes === "Nil" ? "" : prev.generalNotes || "") + " " + data.generalNotes }));
    }
    handleSave(true);
  };

  const handleNext = async () => {
    const tabs: TabType[] = ["patient", "primary", "history", "exam", "treatment", "notes", "disposition"];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
    } else {
      const success = await commitToBackend();
      if (success) {
        navigation.reset({
          index: 0,
          routes: [{ name: "Main", params: { screen: "DashboardTab" } }],
        });
      }
    }
  };

  const handlePrevious = () => {
    const tabs: TabType[] = ["patient", "primary", "history", "exam", "treatment", "notes", "disposition"];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
    }
  };

  const toggleProcedure = (category: ProcedureCategory, procedure: string) => {
    setProceduresData((prev) => {
      const current = prev[category];
      if (current.includes(procedure)) {
        return { ...prev, [category]: current.filter((p: string) => p !== procedure) };
      } else {
        return { ...prev, [category]: [...current, procedure] };
      }
    });
  };

  const ProcedureCheckbox = ({ category, procedure }: { category: ProcedureCategory; procedure: string }) => (
    <Pressable style={styles.procedureRow} onPress={() => toggleProcedure(category, procedure)}>
      <View style={[styles.checkbox, { borderColor: theme.border }, proceduresData[category].includes(procedure) && { backgroundColor: theme.primary, borderColor: theme.primary }]}>
        {proceduresData[category].includes(procedure) && <Feather name="check" size={14} color="#FFFFFF" />}
      </View>
      <Text style={[styles.procedureLabel, { color: theme.text }]}>{procedure}</Text>
    </Pressable>
  );

  const ProcedureSection = ({ title, category }: { title: string; category: ProcedureCategory }) => (
    <View>
      <View style={[styles.procedureHeader, { backgroundColor: "#E0E7FF" }]}>
        <Text style={[styles.procedureHeaderText, { color: theme.primary }]}>{title}</Text>
      </View>
      {PROCEDURES_OPTIONS[category].map((proc) => (
        <ProcedureCheckbox key={proc} category={category} procedure={proc} />
      ))}
    </View>
  );

  const OptionButtons = ({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) => (
    <View style={styles.optionButtons}>
      {options.map((opt) => (
        <Pressable key={opt} style={[styles.optionBtn, { backgroundColor: value === opt ? theme.primary : theme.backgroundSecondary }]} onPress={() => onChange(opt)}>
          <Text style={{ color: value === opt ? "#FFFFFF" : theme.text, fontWeight: "500", fontSize: 13 }}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  );

  const VoiceButton = ({ fieldKey, small }: { fieldKey: string; small?: boolean }) => (
    <Pressable
      onPressIn={() => startVoiceRecording(fieldKey)}
      onPressOut={stopVoiceRecording}
      style={[styles.voiceBtn, small && styles.voiceBtnSmall, { backgroundColor: isRecording && activeVoiceField === fieldKey ? TriageColors.red : theme.primary }]}
    >
      <Feather name="mic" size={small ? 16 : 20} color="#FFFFFF" />
    </Pressable>
  );

  const ToggleRow = ({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) => (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: theme.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: theme.backgroundSecondary, true: TriageColors.green }} thumbColor="#FFFFFF" />
    </View>
  );

  const SegmentedControl = ({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) => (
    <View style={styles.segmentedControl}>
      {options.map((opt) => (
        <Pressable key={opt} style={[styles.segmentBtn, { backgroundColor: value === opt ? (opt === "Abnormal" ? "#FFE4E4" : theme.primary) : theme.backgroundSecondary }]} onPress={() => onChange(opt)}>
          <Text style={{ color: value === opt ? (opt === "Abnormal" ? TriageColors.red : "#FFFFFF") : theme.textSecondary, fontWeight: "600", fontSize: 13 }}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  );

  const TabButton = ({ tab, label, icon }: { tab: TabType; label: string; icon: string }) => (
    <Pressable style={[styles.tabBtn, { backgroundColor: activeTab === tab ? theme.primary : theme.backgroundSecondary }]} onPress={() => setActiveTab(tab)}>
      <Feather name={icon as any} size={16} color={activeTab === tab ? "#FFFFFF" : theme.textSecondary} />
      <Text style={[styles.tabBtnText, { color: activeTab === tab ? "#FFFFFF" : theme.textSecondary }]}>{label}</Text>
    </Pressable>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const caseType = caseData?.case_type || "adult";

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={styles.headerTop}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>{caseType === "pediatric" ? "Pediatric" : "Adult"} Case Sheet</Text>
            {lastSaved && <Text style={[styles.savedText, { color: TriageColors.green }]}>Saved {lastSaved}</Text>}
            {saving && <Text style={[styles.savedText, { color: theme.primary }]}>Saving...</Text>}
          </View>
          <View style={styles.headerRight}>
            <Pressable style={styles.headerIcon}><Feather name="settings" size={20} color={theme.textSecondary} /></Pressable>
            <Pressable style={styles.headerIcon}><Feather name="mic" size={20} color={theme.textSecondary} /></Pressable>
          </View>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          <TabButton tab="patient" label="Patient" icon="user" />
          <TabButton tab="primary" label="Primary" icon="activity" />
          <TabButton tab="history" label="History" icon="file-text" />
          <TabButton tab="exam" label="Exam" icon="clipboard" />
          <TabButton tab="treatment" label="Treatment" icon="plus-square" />
          <TabButton tab="notes" label="Notes" icon="file" />
          <TabButton tab="disposition" label="Disposition" icon="log-out" />
        </ScrollView>
        <View style={styles.swipeHint}>
          <Feather name="chevron-left" size={14} color={theme.textMuted} />
          <Text style={[styles.swipeHintText, { color: theme.textMuted }]}>Swipe left/right to navigate</Text>
          <Feather name="chevron-right" size={14} color={theme.textMuted} />
        </View>
      </View>

      <KeyboardAwareScrollViewCompat contentContainerStyle={[styles.content, { paddingBottom: 100 }]} showsVerticalScrollIndicator={false}>
        {activeTab === "patient" && (
          <>
            {caseData?.patient && (
              <View style={[styles.card, { backgroundColor: theme.card }]}>
                <View style={styles.patientHeader}>
                  <View style={styles.patientInfo}>
                    <Text style={[styles.patientName, { color: theme.text }]}>{caseData.patient.name}</Text>
                    <Text style={[styles.patientDetails, { color: theme.textSecondary }]}>
                      {caseData.patient.age} yrs | {caseData.patient.sex} | {modeOfArrival}
                    </Text>
                  </View>
                  {caseData.triage_color && (
                    <View style={[styles.triageBadge, { backgroundColor: TriageColors[caseData.triage_color as keyof typeof TriageColors] || TriageColors.green }]}>
                      <Text style={styles.triageBadgeText}>P{caseData.triage_priority || "4"}</Text>
                    </View>
                  )}
                </View>
                {caseData.presenting_complaint?.text && (
                  <Text style={[styles.complaint, { color: theme.textMuted }]}>Chief Complaint: {caseData.presenting_complaint.text}</Text>
                )}
                <View style={[styles.vitalsGrid, { backgroundColor: theme.backgroundSecondary }]}>
                  <View style={styles.vitalItem}><Text style={[styles.vitalLabel, { color: theme.textMuted }]}>HR</Text><Text style={[styles.vitalValue, { color: theme.text }]}>{caseData.vitals_at_arrival?.hr || "-"}</Text></View>
                  <View style={styles.vitalItem}><Text style={[styles.vitalLabel, { color: theme.textMuted }]}>BP</Text><Text style={[styles.vitalValue, { color: theme.text }]}>{caseData.vitals_at_arrival?.bp_systolic || "-"}/{caseData.vitals_at_arrival?.bp_diastolic || "-"}</Text></View>
                  <View style={styles.vitalItem}><Text style={[styles.vitalLabel, { color: theme.textMuted }]}>RR</Text><Text style={[styles.vitalValue, { color: theme.text }]}>{caseData.vitals_at_arrival?.rr || "-"}</Text></View>
                  <View style={styles.vitalItem}><Text style={[styles.vitalLabel, { color: theme.textMuted }]}>SpO2</Text><Text style={[styles.vitalValue, { color: theme.text }]}>{caseData.vitals_at_arrival?.spo2 || "-"}%</Text></View>
                  <View style={styles.vitalItem}><Text style={[styles.vitalLabel, { color: theme.textMuted }]}>Temp</Text><Text style={[styles.vitalValue, { color: theme.text }]}>{caseData.vitals_at_arrival?.temperature || "-"}</Text></View>
                  <View style={styles.vitalItem}><Text style={[styles.vitalLabel, { color: theme.textMuted }]}>GCS</Text><Text style={[styles.vitalValue, { color: theme.text }]}>{(caseData.vitals_at_arrival?.gcs_e || 0) + (caseData.vitals_at_arrival?.gcs_v || 0) + (caseData.vitals_at_arrival?.gcs_m || 0) || "-"}/15</Text></View>
                </View>
              </View>
            )}

            <SmartDictation
              onDataExtracted={handleSmartDictation}
              patientContext={{
                age: caseData?.patient?.age ? parseFloat(caseData.patient.age) : undefined,
                sex: caseData?.patient?.sex,
                chiefComplaint: caseData?.presenting_complaint?.text,
                caseType: 'adult',
              }}
            />

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Mode of Arrival</Text>
              <View style={styles.arrivalRow}>
                {["Walk-in", "Ambulance", "Referred"].map((mode) => (
                  <Pressable
                    key={mode}
                    style={[styles.arrivalBtn, { backgroundColor: modeOfArrival === mode ? theme.primary : theme.backgroundSecondary }]}
                    onPress={() => setModeOfArrival(mode)}
                  >
                    <Text style={{ color: modeOfArrival === mode ? "#FFFFFF" : theme.text, fontWeight: "600", fontSize: 13 }}>{mode}</Text>
                  </Pressable>
                ))}
              </View>

              <View style={styles.mlcRow}>
                <Text style={[styles.fieldLabel, { color: theme.text, flex: 1 }]}>MLC Case</Text>
                <Switch
                  value={isMLC}
                  onValueChange={setIsMLC}
                  trackColor={{ false: theme.backgroundSecondary, true: TriageColors.green }}
                  thumbColor="#FFFFFF"
                />
              </View>
            </View>

            {isMLC && (
              <View style={[styles.mlcCard, { backgroundColor: "#FFF8E1", borderColor: "#FFB300" }]}>
                <View style={styles.mlcHeader}>
                  <Feather name="alert-triangle" size={18} color="#FF8F00" />
                  <Text style={[styles.mlcTitle, { color: "#FF8F00" }]}>MLC Details</Text>
                </View>

                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Nature of Incident</Text>
                  <TextInput
                    style={[styles.inputField, { backgroundColor: "#FFFFFF", color: theme.text, borderColor: "#FFB300" }]}
                    value={mlcDetails.natureOfIncident}
                    onChangeText={(v) => setMLCDetails((prev) => ({ ...prev, natureOfIncident: v }))}
                    placeholder="e.g., Road Traffic Accident, Assault"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Date & Time of Incident</Text>
                  <TextInput
                    style={[styles.inputField, { backgroundColor: "#FFFFFF", color: theme.text, borderColor: "#FFB300" }]}
                    value={mlcDetails.dateTimeOfIncident}
                    onChangeText={(v) => setMLCDetails((prev) => ({ ...prev, dateTimeOfIncident: v }))}
                    placeholder="DD/MM/YYYY HH:MM"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Place of Incident</Text>
                  <TextInput
                    style={[styles.inputField, { backgroundColor: "#FFFFFF", color: theme.text, borderColor: "#FFB300" }]}
                    value={mlcDetails.placeOfIncident}
                    onChangeText={(v) => setMLCDetails((prev) => ({ ...prev, placeOfIncident: v }))}
                    placeholder="Location where incident occurred"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Identification Mark</Text>
                  <TextInput
                    style={[styles.inputField, { backgroundColor: "#FFFFFF", color: theme.text, borderColor: "#FFB300" }]}
                    value={mlcDetails.identificationMark}
                    onChangeText={(v) => setMLCDetails((prev) => ({ ...prev, identificationMark: v }))}
                    placeholder="Any identifying marks"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>

                <View style={styles.field}>
                  <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Informant/Brought By</Text>
                  <TextInput
                    style={[styles.inputField, { backgroundColor: "#FFFFFF", color: theme.text, borderColor: "#FFB300" }]}
                    value={mlcDetails.informantBroughtBy}
                    onChangeText={(v) => setMLCDetails((prev) => ({ ...prev, informantBroughtBy: v }))}
                    placeholder="Self"
                    placeholderTextColor={theme.textMuted}
                  />
                </View>
              </View>
            )}
          </>
        )}

        {activeTab === "primary" && (
          <>
            <CollapsibleSection title="A - AIRWAY" icon="*" iconColor={TriageColors.red} defaultExpanded>
              <View style={styles.normalAbnormalRow}>
                <Pressable
                  style={[styles.normalBtn, { backgroundColor: abcdeStatus.airway === "Normal" ? "#E8F5E9" : theme.backgroundSecondary }]}
                  onPress={() => setABCDEStatus((prev) => ({ ...prev, airway: "Normal" }))}
                >
                  <Feather name="check-circle" size={16} color={abcdeStatus.airway === "Normal" ? TriageColors.green : theme.textMuted} />
                  <Text style={{ color: abcdeStatus.airway === "Normal" ? TriageColors.green : theme.textMuted, fontWeight: "600" }}>Normal</Text>
                </Pressable>
                <Pressable
                  style={[styles.abnormalBtn, { backgroundColor: abcdeStatus.airway === "Abnormal" ? "#FEE2E2" : theme.backgroundSecondary }]}
                  onPress={() => setABCDEStatus((prev) => ({ ...prev, airway: "Abnormal" }))}
                >
                  <Feather name="alert-circle" size={16} color={abcdeStatus.airway === "Abnormal" ? TriageColors.red : theme.textMuted} />
                  <Text style={{ color: abcdeStatus.airway === "Abnormal" ? TriageColors.red : theme.textMuted, fontWeight: "600" }}>Abnormal</Text>
                </Pressable>
              </View>

              {abcdeStatus.airway === "Normal" && (
                <View style={[styles.normalDescriptionBox, { backgroundColor: "#E8F5E9", borderColor: TriageColors.green }]}>
                  <Text style={[styles.normalDescriptionText, { color: TriageColors.green }]}>
                    Patent airway, self-maintained, no obstruction, speech clear, no stridor
                  </Text>
                </View>
              )}

              {abcdeStatus.airway === "Abnormal" && (
                <View style={styles.abnormalSection}>
                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Position</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.airwayMaintenance.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.airway.maintenance === opt.value && styles.chipSelected, { backgroundColor: formData.airway.maintenance === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("airway", "maintenance", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.airway.maintenance === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Patency</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.airwayStatus.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.airway.status === opt.value && styles.chipSelected, { backgroundColor: formData.airway.status === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("airway", "status", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.airway.status === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Cause</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.airwayCause.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.airway.obstructionCause === opt.value && styles.chipSelected, { backgroundColor: formData.airway.obstructionCause === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("airway", "obstructionCause", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.airway.obstructionCause === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Speech</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.airwaySpeech.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.airway.speech === opt.value && styles.chipSelected, { backgroundColor: formData.airway.speech === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("airway", "speech", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.airway.speech === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Interventions Done:</Text>
                  {CHIP_OPTIONS.airwayInterventions.map((int) => (
                    <Pressable key={int.value} style={styles.interventionRow} onPress={() => {
                      const current = formData.airway.interventions || [];
                      updateFormData("airway", "interventions", current.includes(int.value) ? current.filter((i: string) => i !== int.value) : [...current, int.value]);
                    }}>
                      <View style={[styles.interventionCheckbox, (formData.airway.interventions || []).includes(int.value) && styles.interventionCheckboxSelected]}>
                        {(formData.airway.interventions || []).includes(int.value) && <Feather name="check" size={12} color="#FFFFFF" />}
                      </View>
                      <Text style={[styles.interventionLabel, { color: theme.text }]}>{int.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={[styles.fieldWithVoice, { marginTop: Spacing.md }]}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Notes</Text>
                <VoiceButton fieldKey="airway.notes" small />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Additional airway observations..." placeholderTextColor={theme.textMuted} value={formData.airway.notes} onChangeText={(v) => updateFormData("airway", "notes", v)} multiline />
            </CollapsibleSection>

            <CollapsibleSection title="B - BREATHING" icon="*" iconColor={TriageColors.orange}>
              <View style={styles.normalAbnormalRow}>
                <Pressable style={[styles.normalBtn, { backgroundColor: abcdeStatus.breathing === "Normal" ? "#E8F5E9" : theme.backgroundSecondary }]} onPress={() => setABCDEStatus((prev) => ({ ...prev, breathing: "Normal" }))}>
                  <Feather name="check-circle" size={16} color={abcdeStatus.breathing === "Normal" ? TriageColors.green : theme.textMuted} />
                  <Text style={{ color: abcdeStatus.breathing === "Normal" ? TriageColors.green : theme.textMuted, fontWeight: "600" }}>Normal</Text>
                </Pressable>
                <Pressable style={[styles.abnormalBtn, { backgroundColor: abcdeStatus.breathing === "Abnormal" ? "#FEE2E2" : theme.backgroundSecondary }]} onPress={() => setABCDEStatus((prev) => ({ ...prev, breathing: "Abnormal" }))}>
                  <Feather name="alert-circle" size={16} color={abcdeStatus.breathing === "Abnormal" ? TriageColors.red : theme.textMuted} />
                  <Text style={{ color: abcdeStatus.breathing === "Abnormal" ? TriageColors.red : theme.textMuted, fontWeight: "600" }}>Abnormal</Text>
                </Pressable>
              </View>

              <View style={styles.abcdeVitalsRow}>
                <View style={styles.abcdeVitalInput}><TextInputField label="RR" value={formData.breathing.rr} onChangeText={(v) => updateFormData("breathing", "rr", v)} keyboardType="numeric" suffix="/min" /></View>
                <View style={styles.abcdeVitalInput}><TextInputField label="SpO2" value={formData.breathing.spo2} onChangeText={(v) => updateFormData("breathing", "spo2", v)} keyboardType="numeric" suffix="%" /></View>
                <View style={styles.abcdeVitalInput}><TextInputField label="O2 Flow" value={formData.breathing.o2Flow} onChangeText={(v) => updateFormData("breathing", "o2Flow", v)} keyboardType="numeric" suffix="L/min" /></View>
              </View>

              {abcdeStatus.breathing === "Normal" && (
                <View style={[styles.normalDescriptionBox, { backgroundColor: "#FFF3E0", borderColor: TriageColors.orange }]}>
                  <Text style={[styles.normalDescriptionText, { color: "#E65100" }]}>
                    Effortless breathing, regular pattern, bilateral chest expansion, clear air entry, no added sounds, on room air
                  </Text>
                </View>
              )}

              {abcdeStatus.breathing === "Abnormal" && (
                <View style={styles.abnormalSection}>
                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Effort</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.breathingEffort.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.breathing.effort === opt.value && styles.chipSelected, { backgroundColor: formData.breathing.effort === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("breathing", "effort", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.breathing.effort === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>O2 Device</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.breathingO2Device.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.breathing.o2Device === opt.value && styles.chipSelected, { backgroundColor: formData.breathing.o2Device === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("breathing", "o2Device", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.breathing.o2Device === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Pattern</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.breathingPattern.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.breathing.pattern === opt.value && styles.chipSelected, { backgroundColor: formData.breathing.pattern === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("breathing", "pattern", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.breathing.pattern === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Chest Expansion</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.breathingChestExpansion.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.breathing.chestExpansion === opt.value && styles.chipSelected, { backgroundColor: formData.breathing.chestExpansion === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("breathing", "chestExpansion", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.breathing.chestExpansion === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Air Entry</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.breathingAirEntry.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.breathing.airEntry === opt.value && styles.chipSelected, { backgroundColor: formData.breathing.airEntry === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("breathing", "airEntry", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.breathing.airEntry === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Added Sounds</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.breathingAddedSounds.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.breathing.addedSounds === opt.value && styles.chipSelected, { backgroundColor: formData.breathing.addedSounds === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("breathing", "addedSounds", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.breathing.addedSounds === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Interventions:</Text>
                  {CHIP_OPTIONS.breathingInterventions.map((int) => (
                    <Pressable key={int.value} style={styles.interventionRow} onPress={() => {
                      const current = formData.breathing.interventions || [];
                      updateFormData("breathing", "interventions", current.includes(int.value) ? current.filter((i: string) => i !== int.value) : [...current, int.value]);
                    }}>
                      <View style={[styles.interventionCheckbox, (formData.breathing.interventions || []).includes(int.value) && styles.interventionCheckboxSelected]}>
                        {(formData.breathing.interventions || []).includes(int.value) && <Feather name="check" size={12} color="#FFFFFF" />}
                      </View>
                      <Text style={[styles.interventionLabel, { color: theme.text }]}>{int.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={[styles.fieldWithVoice, { marginTop: Spacing.md }]}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Notes</Text>
                <VoiceButton fieldKey="breathing.notes" small />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Additional breathing observations..." placeholderTextColor={theme.textMuted} value={formData.breathing.notes} onChangeText={(v) => updateFormData("breathing", "notes", v)} multiline />
            </CollapsibleSection>

            <CollapsibleSection title="C - CIRCULATION" icon="*" iconColor={TriageColors.yellow}>
              <View style={styles.normalAbnormalRow}>
                <Pressable style={[styles.normalBtn, { backgroundColor: abcdeStatus.circulation === "Normal" ? "#E8F5E9" : theme.backgroundSecondary }]} onPress={() => setABCDEStatus((prev) => ({ ...prev, circulation: "Normal" }))}>
                  <Feather name="check-circle" size={16} color={abcdeStatus.circulation === "Normal" ? TriageColors.green : theme.textMuted} />
                  <Text style={{ color: abcdeStatus.circulation === "Normal" ? TriageColors.green : theme.textMuted, fontWeight: "600" }}>Normal</Text>
                </Pressable>
                <Pressable style={[styles.abnormalBtn, { backgroundColor: abcdeStatus.circulation === "Abnormal" ? "#FEE2E2" : theme.backgroundSecondary }]} onPress={() => setABCDEStatus((prev) => ({ ...prev, circulation: "Abnormal" }))}>
                  <Feather name="alert-circle" size={16} color={abcdeStatus.circulation === "Abnormal" ? TriageColors.red : theme.textMuted} />
                  <Text style={{ color: abcdeStatus.circulation === "Abnormal" ? TriageColors.red : theme.textMuted, fontWeight: "600" }}>Abnormal</Text>
                </Pressable>
              </View>

              <View style={styles.abcdeVitalsRow}>
                <View style={styles.abcdeVitalInput}><TextInputField label="HR" value={formData.circulation.hr} onChangeText={(v) => updateFormData("circulation", "hr", v)} keyboardType="numeric" suffix="bpm" /></View>
                <View style={styles.abcdeVitalInput}><TextInputField label="BP" value={`${formData.circulation.bpSystolic}/${formData.circulation.bpDiastolic}`} onChangeText={(v) => {
                  const parts = v.split("/");
                  updateFormData("circulation", "bpSystolic", parts[0] || "");
                  updateFormData("circulation", "bpDiastolic", parts[1] || "");
                }} placeholder="Sys/Dia" /></View>
              </View>

              {abcdeStatus.circulation === "Normal" && (
                <View style={[styles.normalDescriptionBox, { backgroundColor: "#FFFDE7", borderColor: TriageColors.yellow }]}>
                  <Text style={[styles.normalDescriptionText, { color: "#F57F17" }]}>
                    Regular pulse, CRT {"<"}2 sec, warm extremities, normal skin color, adequate perfusion
                  </Text>
                </View>
              )}

              {abcdeStatus.circulation === "Abnormal" && (
                <View style={styles.abnormalSection}>
                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Rhythm</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.circulationRhythm.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.circulation.pulseQuality === opt.value && styles.chipSelected, { backgroundColor: formData.circulation.pulseQuality === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("circulation", "pulseQuality", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.circulation.pulseQuality === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>CRT</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.circulationCRT.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.circulation.capillaryRefill === opt.value && styles.chipSelected, { backgroundColor: formData.circulation.capillaryRefill === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("circulation", "capillaryRefill", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.circulation.capillaryRefill === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Skin</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.circulationSkin.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.circulation.skinTemperature === opt.value && styles.chipSelected, { backgroundColor: formData.circulation.skinTemperature === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("circulation", "skinTemperature", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.circulation.skinTemperature === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Skin Color</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.circulationSkinColor.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.circulation.skinColor === opt.value && styles.chipSelected, { backgroundColor: formData.circulation.skinColor === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("circulation", "skinColor", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.circulation.skinColor === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>IV Access</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.circulationIVAccess.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.circulation.ivAccess === opt.value && styles.chipSelected, { backgroundColor: formData.circulation.ivAccess === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("circulation", "ivAccess", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.circulation.ivAccess === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Interventions:</Text>
                  {CHIP_OPTIONS.circulationInterventions.map((int) => (
                    <Pressable key={int.value} style={styles.interventionRow} onPress={() => {
                      const current = formData.circulation.interventions || [];
                      updateFormData("circulation", "interventions", current.includes(int.value) ? current.filter((i: string) => i !== int.value) : [...current, int.value]);
                    }}>
                      <View style={[styles.interventionCheckbox, (formData.circulation.interventions || []).includes(int.value) && styles.interventionCheckboxSelected]}>
                        {(formData.circulation.interventions || []).includes(int.value) && <Feather name="check" size={12} color="#FFFFFF" />}
                      </View>
                      <Text style={[styles.interventionLabel, { color: theme.text }]}>{int.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={[styles.fieldWithVoice, { marginTop: Spacing.md }]}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Notes</Text>
                <VoiceButton fieldKey="circulation.notes" small />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Additional circulation observations..." placeholderTextColor={theme.textMuted} value={formData.circulation.notes} onChangeText={(v) => updateFormData("circulation", "notes", v)} multiline />
            </CollapsibleSection>

            <CollapsibleSection title="D - DISABILITY (Neuro)" icon="?" iconColor={TriageColors.green}>
              <View style={styles.normalAbnormalRow}>
                <Pressable style={[styles.normalBtn, { backgroundColor: abcdeStatus.disability === "Normal" ? "#E8F5E9" : theme.backgroundSecondary }]} onPress={() => setABCDEStatus((prev) => ({ ...prev, disability: "Normal" }))}>
                  <Feather name="check-circle" size={16} color={abcdeStatus.disability === "Normal" ? TriageColors.green : theme.textMuted} />
                  <Text style={{ color: abcdeStatus.disability === "Normal" ? TriageColors.green : theme.textMuted, fontWeight: "600" }}>Normal</Text>
                </Pressable>
                <Pressable style={[styles.abnormalBtn, { backgroundColor: abcdeStatus.disability === "Abnormal" ? "#FEE2E2" : theme.backgroundSecondary }]} onPress={() => setABCDEStatus((prev) => ({ ...prev, disability: "Abnormal" }))}>
                  <Feather name="alert-circle" size={16} color={abcdeStatus.disability === "Abnormal" ? TriageColors.red : theme.textMuted} />
                  <Text style={{ color: abcdeStatus.disability === "Abnormal" ? TriageColors.red : theme.textMuted, fontWeight: "600" }}>Abnormal</Text>
                </Pressable>
              </View>

              <View style={styles.abcdeVitalsRow}>
                <View style={styles.abcdeVitalInput}><TextInputField label="GCS E" value={formData.disability.gcsE} onChangeText={(v) => updateFormData("disability", "gcsE", v)} keyboardType="numeric" suffix="1-4" /></View>
                <View style={styles.abcdeVitalInput}><TextInputField label="V" value={formData.disability.gcsV} onChangeText={(v) => updateFormData("disability", "gcsV", v)} keyboardType="numeric" suffix="1-5" /></View>
                <View style={styles.abcdeVitalInput}><TextInputField label="M" value={formData.disability.gcsM} onChangeText={(v) => updateFormData("disability", "gcsM", v)} keyboardType="numeric" suffix="1-6" /></View>
                <View style={styles.abcdeVitalInput}><TextInputField label="GRBS" value={formData.disability.glucose} onChangeText={(v) => updateFormData("disability", "glucose", v)} keyboardType="numeric" suffix="mg/dL" /></View>
              </View>

              {abcdeStatus.disability === "Normal" && (
                <View style={[styles.normalDescriptionBox, { backgroundColor: "#E8F5E9", borderColor: TriageColors.green }]}>
                  <Text style={[styles.normalDescriptionText, { color: TriageColors.green }]}>
                    GCS 15/15, AVPU: Alert, pupils equal and reactive, no focal neurological deficits, euglycemic
                  </Text>
                </View>
              )}

              {abcdeStatus.disability === "Abnormal" && (
                <View style={styles.abnormalSection}>
                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>AVPU</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.disabilityAVPU.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.disability.motorResponse === opt.value && styles.chipSelected, { backgroundColor: formData.disability.motorResponse === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("disability", "motorResponse", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.disability.motorResponse === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Pupils Size</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.disabilityPupilSize.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.disability.pupilSize === opt.value && styles.chipSelected, { backgroundColor: formData.disability.pupilSize === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("disability", "pupilSize", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.disability.pupilSize === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Pupils Reaction</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.disabilityPupilReaction.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, formData.disability.pupilReaction === opt.value && styles.chipSelected, { backgroundColor: formData.disability.pupilReaction === opt.value ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => updateFormData("disability", "pupilReaction", opt.value)}>
                        <Text style={[styles.chipText, { color: formData.disability.pupilReaction === opt.value ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Lateralizing</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.disabilityLateralizing.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, (formData.disability.interventions || []).includes(opt.value) && styles.chipSelected, { backgroundColor: (formData.disability.interventions || []).includes(opt.value) ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => {
                        const current = formData.disability.interventions || [];
                        updateFormData("disability", "interventions", current.includes(opt.value) ? current.filter((i: string) => i !== opt.value) : [...current, opt.value]);
                      }}>
                        <Text style={[styles.chipText, { color: (formData.disability.interventions || []).includes(opt.value) ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Pressable style={styles.interventionRow} onPress={() => {
                    const current = formData.disability.interventions || [];
                    const opt = "seizure_observed";
                    updateFormData("disability", "interventions", current.includes(opt) ? current.filter((i: string) => i !== opt) : [...current, opt]);
                  }}>
                    <View style={[styles.interventionCheckbox, (formData.disability.interventions || []).includes("seizure_observed") && styles.interventionCheckboxSelected]}>
                      {(formData.disability.interventions || []).includes("seizure_observed") && <Feather name="check" size={12} color="#FFFFFF" />}
                    </View>
                    <Text style={[styles.interventionLabel, { color: theme.text }]}>Seizure Observed</Text>
                  </Pressable>
                </View>
              )}

              <View style={[styles.fieldWithVoice, { marginTop: Spacing.md }]}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Notes</Text>
                <VoiceButton fieldKey="disability.notes" small />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Additional neuro observations..." placeholderTextColor={theme.textMuted} value={formData.disability.notes} onChangeText={(v) => updateFormData("disability", "notes", v)} multiline />
            </CollapsibleSection>

            <CollapsibleSection title="E - EXPOSURE" icon="*" iconColor={TriageColors.blue}>
              <View style={styles.normalAbnormalRow}>
                <Pressable style={[styles.normalBtn, { backgroundColor: abcdeStatus.exposure === "Normal" ? "#E8F5E9" : theme.backgroundSecondary }]} onPress={() => setABCDEStatus((prev) => ({ ...prev, exposure: "Normal" }))}>
                  <Feather name="check-circle" size={16} color={abcdeStatus.exposure === "Normal" ? TriageColors.green : theme.textMuted} />
                  <Text style={{ color: abcdeStatus.exposure === "Normal" ? TriageColors.green : theme.textMuted, fontWeight: "600" }}>Normal</Text>
                </Pressable>
                <Pressable style={[styles.abnormalBtn, { backgroundColor: abcdeStatus.exposure === "Abnormal" ? "#FEE2E2" : theme.backgroundSecondary }]} onPress={() => setABCDEStatus((prev) => ({ ...prev, exposure: "Abnormal" }))}>
                  <Feather name="alert-circle" size={16} color={abcdeStatus.exposure === "Abnormal" ? TriageColors.red : theme.textMuted} />
                  <Text style={{ color: abcdeStatus.exposure === "Abnormal" ? TriageColors.red : theme.textMuted, fontWeight: "600" }}>Abnormal</Text>
                </Pressable>
              </View>

              <View style={styles.abcdeVitalsRow}>
                <View style={{ flex: 1 }}><TextInputField label="Temp" value={formData.exposure.temperature} onChangeText={(v) => updateFormData("exposure", "temperature", v)} keyboardType="decimal-pad" suffix="\u00B0C" /></View>
              </View>

              {abcdeStatus.exposure === "Normal" && (
                <View style={[styles.normalDescriptionBox, { backgroundColor: "#E3F2FD", borderColor: TriageColors.blue }]}>
                  <Text style={[styles.normalDescriptionText, { color: TriageColors.blue }]}>
                    Afebrile, no visible injuries/wounds, no rashes, no active bleeding, adequately covered
                  </Text>
                </View>
              )}

              {abcdeStatus.exposure === "Abnormal" && (
                <View style={styles.abnormalSection}>
                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Findings</Text>
                  <View style={styles.chipRow}>
                    {CHIP_OPTIONS.exposureFindings.map((opt) => (
                      <Pressable key={opt.value} style={[styles.chip, (formData.exposure.findings || []).includes(opt.value) && styles.chipSelected, { backgroundColor: (formData.exposure.findings || []).includes(opt.value) ? "#FEE2E2" : "#FFFFFF" }]} onPress={() => {
                        const current = formData.exposure.findings || [];
                        updateFormData("exposure", "findings", current.includes(opt.value) ? current.filter((i: string) => i !== opt.value) : [...current, opt.value]);
                      }}>
                        <Text style={[styles.chipText, { color: (formData.exposure.findings || []).includes(opt.value) ? TriageColors.red : theme.text }]}>{opt.label}</Text>
                      </Pressable>
                    ))}
                  </View>

                  <Text style={[styles.abnormalSectionLabel, { color: theme.text }]}>Interventions:</Text>
                  {CHIP_OPTIONS.exposureInterventions.map((int) => (
                    <Pressable key={int.value} style={styles.interventionRow} onPress={() => {
                      const current = formData.exposure.interventions || [];
                      updateFormData("exposure", "interventions", current.includes(int.value) ? current.filter((i: string) => i !== int.value) : [...current, int.value]);
                    }}>
                      <View style={[styles.interventionCheckbox, (formData.exposure.interventions || []).includes(int.value) && styles.interventionCheckboxSelected]}>
                        {(formData.exposure.interventions || []).includes(int.value) && <Feather name="check" size={12} color="#FFFFFF" />}
                      </View>
                      <Text style={[styles.interventionLabel, { color: theme.text }]}>{int.label}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              <View style={[styles.fieldWithVoice, { marginTop: Spacing.md }]}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Local Exam / Notes</Text>
                <VoiceButton fieldKey="exposure.notes" small />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Additional exposure findings..." placeholderTextColor={theme.textMuted} value={formData.exposure.notes} onChangeText={(v) => updateFormData("exposure", "notes", v)} multiline />
            </CollapsibleSection>

            <Text style={[styles.sectionHeading, { color: theme.text }]}>Adjuncts to Primary Survey</Text>
            <CollapsibleSection title="ABG / VBG" icon="+" iconColor={theme.primary}>
              <View style={styles.abgRow}>
                <View style={styles.abgHalfField}>
                  <DropdownField label="Sample Type" options={ABG_SAMPLE_TYPE_OPTIONS} value={formData.adjuncts.abgSampleType} onChange={(v) => updateFormData("adjuncts", "abgSampleType", v)} />
                </View>
                <View style={styles.abgHalfField}>
                  <DropdownField label="Interpretation" options={ABG_STATUS_OPTIONS} value={formData.adjuncts.abgStatus} onChange={(v) => updateFormData("adjuncts", "abgStatus", v)} />
                </View>
              </View>
              
              <View style={[styles.abgNormalValuesCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                <Text style={[styles.abgNormalTitle, { color: theme.primary }]}>Normal Values Reference</Text>
                <View style={styles.abgNormalGrid}>
                  <View style={styles.abgNormalItem}><Text style={[styles.abgNormalLabel, { color: theme.textSecondary }]}>pH</Text><Text style={[styles.abgNormalValue, { color: theme.text }]}>7.35 - 7.45</Text></View>
                  <View style={styles.abgNormalItem}><Text style={[styles.abgNormalLabel, { color: theme.textSecondary }]}>pCO₂</Text><Text style={[styles.abgNormalValue, { color: theme.text }]}>35 - 45 mmHg</Text></View>
                  <View style={styles.abgNormalItem}><Text style={[styles.abgNormalLabel, { color: theme.textSecondary }]}>pO₂</Text><Text style={[styles.abgNormalValue, { color: theme.text }]}>80 - 100 mmHg</Text></View>
                  <View style={styles.abgNormalItem}><Text style={[styles.abgNormalLabel, { color: theme.textSecondary }]}>HCO₃</Text><Text style={[styles.abgNormalValue, { color: theme.text }]}>22 - 26 mEq/L</Text></View>
                  <View style={styles.abgNormalItem}><Text style={[styles.abgNormalLabel, { color: theme.textSecondary }]}>BE</Text><Text style={[styles.abgNormalValue, { color: theme.text }]}>-2 to +2</Text></View>
                  <View style={styles.abgNormalItem}><Text style={[styles.abgNormalLabel, { color: theme.textSecondary }]}>Lactate</Text><Text style={[styles.abgNormalValue, { color: theme.text }]}>0.5 - 2.0</Text></View>
                  <View style={styles.abgNormalItem}><Text style={[styles.abgNormalLabel, { color: theme.textSecondary }]}>SaO₂</Text><Text style={[styles.abgNormalValue, { color: theme.text }]}>95 - 100%</Text></View>
                  <View style={styles.abgNormalItem}><Text style={[styles.abgNormalLabel, { color: theme.textSecondary }]}>A-a</Text><Text style={[styles.abgNormalValue, { color: theme.text }]}>{"<"}10-15</Text></View>
                </View>
              </View>

              <Text style={[styles.abgSectionLabel, { color: theme.text }]}>Blood Gas Values (Optional)</Text>
              <View style={styles.abgGrid}>
                <View style={styles.abgSmallField}>
                  <Text style={[styles.abgFieldLabel, { color: theme.textSecondary }]}>pH</Text>
                  <TextInput style={[styles.abgInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]} placeholder="7.40" placeholderTextColor={theme.textMuted} value={formData.adjuncts.abgPh} onChangeText={(v) => updateFormData("adjuncts", "abgPh", v)} keyboardType="decimal-pad" />
                </View>
                <View style={styles.abgSmallField}>
                  <Text style={[styles.abgFieldLabel, { color: theme.textSecondary }]}>pCO₂</Text>
                  <TextInput style={[styles.abgInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]} placeholder="40" placeholderTextColor={theme.textMuted} value={formData.adjuncts.abgPco2} onChangeText={(v) => updateFormData("adjuncts", "abgPco2", v)} keyboardType="decimal-pad" />
                </View>
                <View style={styles.abgSmallField}>
                  <Text style={[styles.abgFieldLabel, { color: theme.textSecondary }]}>pO₂</Text>
                  <TextInput style={[styles.abgInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]} placeholder="95" placeholderTextColor={theme.textMuted} value={formData.adjuncts.abgPo2} onChangeText={(v) => updateFormData("adjuncts", "abgPo2", v)} keyboardType="decimal-pad" />
                </View>
                <View style={styles.abgSmallField}>
                  <Text style={[styles.abgFieldLabel, { color: theme.textSecondary }]}>HCO₃</Text>
                  <TextInput style={[styles.abgInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]} placeholder="24" placeholderTextColor={theme.textMuted} value={formData.adjuncts.abgHco3} onChangeText={(v) => updateFormData("adjuncts", "abgHco3", v)} keyboardType="decimal-pad" />
                </View>
                <View style={styles.abgSmallField}>
                  <Text style={[styles.abgFieldLabel, { color: theme.textSecondary }]}>BE</Text>
                  <TextInput style={[styles.abgInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]} placeholder="0" placeholderTextColor={theme.textMuted} value={formData.adjuncts.abgBe} onChangeText={(v) => updateFormData("adjuncts", "abgBe", v)} keyboardType="numbers-and-punctuation" />
                </View>
                <View style={styles.abgSmallField}>
                  <Text style={[styles.abgFieldLabel, { color: theme.textSecondary }]}>Lactate</Text>
                  <TextInput style={[styles.abgInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]} placeholder="1.0" placeholderTextColor={theme.textMuted} value={formData.adjuncts.abgLactate} onChangeText={(v) => updateFormData("adjuncts", "abgLactate", v)} keyboardType="decimal-pad" />
                </View>
                <View style={styles.abgSmallField}>
                  <Text style={[styles.abgFieldLabel, { color: theme.textSecondary }]}>SaO₂%</Text>
                  <TextInput style={[styles.abgInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]} placeholder="98" placeholderTextColor={theme.textMuted} value={formData.adjuncts.abgSao2} onChangeText={(v) => updateFormData("adjuncts", "abgSao2", v)} keyboardType="decimal-pad" />
                </View>
                <View style={styles.abgSmallField}>
                  <Text style={[styles.abgFieldLabel, { color: theme.textSecondary }]}>FiO₂%</Text>
                  <TextInput style={[styles.abgInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]} placeholder="21" placeholderTextColor={theme.textMuted} value={formData.adjuncts.abgFio2} onChangeText={(v) => updateFormData("adjuncts", "abgFio2", v)} keyboardType="decimal-pad" />
                </View>
              </View>

              <Text style={[styles.abgSectionLabel, { color: theme.text }]}>Electrolytes (Optional)</Text>
              <View style={styles.abgGrid}>
                <View style={styles.abgSmallField}>
                  <Text style={[styles.abgFieldLabel, { color: theme.textSecondary }]}>Na⁺</Text>
                  <TextInput style={[styles.abgInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]} placeholder="140" placeholderTextColor={theme.textMuted} value={formData.adjuncts.abgNa} onChangeText={(v) => updateFormData("adjuncts", "abgNa", v)} keyboardType="decimal-pad" />
                </View>
                <View style={styles.abgSmallField}>
                  <Text style={[styles.abgFieldLabel, { color: theme.textSecondary }]}>K⁺</Text>
                  <TextInput style={[styles.abgInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]} placeholder="4.0" placeholderTextColor={theme.textMuted} value={formData.adjuncts.abgK} onChangeText={(v) => updateFormData("adjuncts", "abgK", v)} keyboardType="decimal-pad" />
                </View>
                <View style={styles.abgSmallField}>
                  <Text style={[styles.abgFieldLabel, { color: theme.textSecondary }]}>Cl⁻</Text>
                  <TextInput style={[styles.abgInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]} placeholder="100" placeholderTextColor={theme.textMuted} value={formData.adjuncts.abgCl} onChangeText={(v) => updateFormData("adjuncts", "abgCl", v)} keyboardType="decimal-pad" />
                </View>
                <View style={styles.abgSmallField}>
                  <Text style={[styles.abgFieldLabel, { color: theme.textSecondary }]}>AG</Text>
                  <TextInput style={[styles.abgInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]} placeholder="12" placeholderTextColor={theme.textMuted} value={formData.adjuncts.abgAnionGap} onChangeText={(v) => updateFormData("adjuncts", "abgAnionGap", v)} keyboardType="decimal-pad" />
                </View>
                <View style={styles.abgSmallField}>
                  <Text style={[styles.abgFieldLabel, { color: theme.textSecondary }]}>Glucose</Text>
                  <TextInput style={[styles.abgInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]} placeholder="100" placeholderTextColor={theme.textMuted} value={formData.adjuncts.abgGlucose} onChangeText={(v) => updateFormData("adjuncts", "abgGlucose", v)} keyboardType="decimal-pad" />
                </View>
                <View style={styles.abgSmallField}>
                  <Text style={[styles.abgFieldLabel, { color: theme.textSecondary }]}>Hb</Text>
                  <TextInput style={[styles.abgInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]} placeholder="14" placeholderTextColor={theme.textMuted} value={formData.adjuncts.abgHb} onChangeText={(v) => updateFormData("adjuncts", "abgHb", v)} keyboardType="decimal-pad" />
                </View>
                <View style={styles.abgSmallField}>
                  <Text style={[styles.abgFieldLabel, { color: theme.textSecondary }]}>A-a</Text>
                  <TextInput style={[styles.abgInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]} placeholder="10" placeholderTextColor={theme.textMuted} value={formData.adjuncts.abgAaGradient} onChangeText={(v) => updateFormData("adjuncts", "abgAaGradient", v)} keyboardType="decimal-pad" />
                </View>
              </View>

              <TextInputField label="Additional Notes" value={formData.adjuncts.abgNotes} onChangeText={(v) => updateFormData("adjuncts", "abgNotes", v)} placeholder="Sample time, clinical context, etc..." multiline numberOfLines={2} />
              
              <Pressable
                style={[styles.aiInterpretBtn, { backgroundColor: "#8B5CF6", opacity: abgInterpreting ? 0.7 : 1 }]}
                onPress={handleABGInterpretation}
                disabled={abgInterpreting}
              >
                {abgInterpreting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="cpu" size={16} color="#FFFFFF" />
                )}
                <Text style={styles.aiInterpretBtnText}>{abgInterpreting ? "Interpreting..." : "AI Interpret ABG"}</Text>
              </Pressable>

              {abgInterpretation && (
                <View style={[styles.abgInterpretationCard, { backgroundColor: "#F3E8FF", borderColor: "#8B5CF6" }]}>
                  <Text style={[styles.abgInterpretationTitle, { color: "#6B21A8" }]}>AI Interpretation</Text>
                  <Text style={[styles.abgInterpretationText, { color: "#4C1D95" }]}>{abgInterpretation}</Text>
                </View>
              )}

              <TextInputField label="Your Interpretation (Optional)" value={formData.adjuncts.abgInterpretation} onChangeText={(v) => updateFormData("adjuncts", "abgInterpretation", v)} placeholder="Your clinical interpretation of the ABG..." multiline numberOfLines={2} />
            </CollapsibleSection>
            <CollapsibleSection title="ECG" icon="+" iconColor={theme.primary}>
              <DropdownField label="ECG Interpretation" options={ECG_STATUS_OPTIONS} value={formData.adjuncts.ecgStatus} onChange={(v) => updateFormData("adjuncts", "ecgStatus", v)} />
              <TextInputField label="ECG Notes" value={formData.adjuncts.ecgNotes} onChangeText={(v) => updateFormData("adjuncts", "ecgNotes", v)} placeholder="Detailed ECG findings..." multiline numberOfLines={2} />
            </CollapsibleSection>
            <CollapsibleSection title="EFAST" icon="+" iconColor={theme.primary}>
              <DropdownField label="EFAST Result" options={EFAST_OPTIONS} value={formData.adjuncts.efastStatus} onChange={(v) => updateFormData("adjuncts", "efastStatus", v)} />
              <TextInputField label="EFAST Notes" value={formData.adjuncts.efastNotes} onChangeText={(v) => updateFormData("adjuncts", "efastNotes", v)} placeholder="Detailed ultrasound findings..." multiline numberOfLines={2} />
            </CollapsibleSection>
            <CollapsibleSection title="Bedside Echo" icon="+" iconColor={theme.primary}>
              <DropdownField label="Echo Result" options={BEDSIDE_ECHO_OPTIONS} value={formData.adjuncts.echoStatus} onChange={(v) => updateFormData("adjuncts", "echoStatus", v)} />
              <TextInputField label="Echo Notes" value={formData.adjuncts.echoNotes} onChangeText={(v) => updateFormData("adjuncts", "echoNotes", v)} placeholder="EF, wall motion, valves..." multiline numberOfLines={2} />
            </CollapsibleSection>
          </>
        )}

        {activeTab === "history" && (
          <>
            <View style={styles.inputToolsRow}>
              <VoiceRecorder
                onExtractedData={handleVoiceExtraction}
                patientContext={{
                  age: caseData?.patient?.age ? parseFloat(caseData.patient.age) : undefined,
                  sex: caseData?.patient?.sex,
                  chiefComplaint: caseData?.presenting_complaint?.text,
                }}
                mode="full"
              />
              <DocumentScanner
                onDataExtracted={handleDocumentScanExtraction}
                context={{
                  patientAge: caseData?.patient?.age ? parseFloat(caseData.patient.age) : undefined,
                  patientSex: caseData?.patient?.sex,
                  presentingComplaint: caseData?.presenting_complaint?.text,
                }}
              />
            </View>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>History</Text>
              
              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Signs & Symptoms</Text>
                <VoiceButton fieldKey="sample.signsSymptoms" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Associated symptoms..." placeholderTextColor={theme.textMuted} value={formData.sample.signsSymptoms} onChangeText={(v) => updateFormData("sample", "signsSymptoms", v)} multiline />

              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Allergies</Text>
                <VoiceButton fieldKey="sample.allergies" />
              </View>
              <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="NKDA or list allergies" placeholderTextColor={theme.textMuted} value={formData.sample.allergies} onChangeText={(v) => updateFormData("sample", "allergies", v)} />

              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Medications</Text>
                <VoiceButton fieldKey="sample.medications" />
              </View>
              <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Current medications..." placeholderTextColor={theme.textMuted} value={formData.sample.medications} onChangeText={(v) => updateFormData("sample", "medications", v)} />

              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Past Medical History</Text>
                <VoiceButton fieldKey="sample.pastMedicalHistory" />
              </View>
              <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="DM, HTN, Asthma..." placeholderTextColor={theme.textMuted} value={formData.sample.pastMedicalHistory} onChangeText={(v) => updateFormData("sample", "pastMedicalHistory", v)} />

              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Past Surgical History</Text>
                <VoiceButton fieldKey="pastSurgicalHistory" />
              </View>
              <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Previous surgeries..." placeholderTextColor={theme.textMuted} value={pastSurgicalHistory} onChangeText={setPastSurgicalHistory} />

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Last Meal</Text>
              <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Time of last meal" placeholderTextColor={theme.textMuted} value={formData.sample.lastMeal} onChangeText={(v) => updateFormData("sample", "lastMeal", v)} />

              {caseData?.patient?.sex?.toLowerCase() === "female" && (
                <>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>LMP (Last Menstrual Period)</Text>
                  <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="LMP date (e.g., 15 days back, 10/01/2025)" placeholderTextColor={theme.textMuted} value={formData.sample.lmp} onChangeText={(v) => updateFormData("sample", "lmp", v)} />
                </>
              )}

              <View style={styles.fieldWithVoice}>
                <View style={styles.fieldLabelWithBar}>
                  <View style={[styles.fieldBar, { backgroundColor: theme.primary }]} />
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Events / HOPI</Text>
                </View>
                <VoiceButton fieldKey="sample.eventsHopi" />
              </View>
              <TextInput style={[styles.textAreaLarge, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Events and history of present illness..." placeholderTextColor={theme.textMuted} value={formData.sample.eventsHopi} onChangeText={(v) => updateFormData("sample", "eventsHopi", v)} multiline />

              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Any other relevant history</Text>
                <VoiceButton fieldKey="otherHistory" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Any other relevant history..." placeholderTextColor={theme.textMuted} value={otherHistory} onChangeText={setOtherHistory} multiline />
            </View>

            <CollapsibleSection title="Psychological Assessment" icon="smile" iconColor={TriageColors.green} defaultExpanded={false}>
              <ToggleRow label="Suicidal Ideation" value={psychData.suicidalIdeation} onValueChange={(v) => setPsychData((p) => ({ ...p, suicidalIdeation: v }))} />
              <ToggleRow label="Self-Harm History" value={psychData.selfHarmHistory} onValueChange={(v) => setPsychData((p) => ({ ...p, selfHarmHistory: v }))} />
              <ToggleRow label="Intent to Harm Others" value={psychData.intentToHarmOthers} onValueChange={(v) => setPsychData((p) => ({ ...p, intentToHarmOthers: v }))} />
              <ToggleRow label="Substance Abuse" value={psychData.substanceAbuse} onValueChange={(v) => setPsychData((p) => ({ ...p, substanceAbuse: v }))} />
              <ToggleRow label="Psychiatric History" value={psychData.psychiatricHistory} onValueChange={(v) => setPsychData((p) => ({ ...p, psychiatricHistory: v }))} />
              <ToggleRow label="Currently on Psychiatric Treatment" value={psychData.currentlyOnTreatment} onValueChange={(v) => setPsychData((p) => ({ ...p, currentlyOnTreatment: v }))} />
              <ToggleRow label="Has Support System" value={psychData.hasSupportSystem} onValueChange={(v) => setPsychData((p) => ({ ...p, hasSupportSystem: v }))} />
              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Notes</Text>
                <VoiceButton fieldKey="psychNotes" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Additional psychological notes..." placeholderTextColor={theme.textMuted} value={psychData.notes} onChangeText={(v) => setPsychData((p) => ({ ...p, notes: v }))} multiline />
            </CollapsibleSection>
          </>
        )}

        {activeTab === "exam" && (
          <>
            <Pressable style={[styles.markNormalBtn, { backgroundColor: "#E8F5E9" }]} onPress={markAllExamNormal}>
              <Feather name="check-circle" size={20} color={TriageColors.green} />
              <Text style={[styles.markNormalBtnText, { color: TriageColors.green }]}>Mark All Examination Normal</Text>
            </Pressable>

            <CollapsibleSection title="General Examination" icon="user" iconColor={theme.primary} defaultExpanded>
              <View style={styles.toggleGrid}>
                <View style={styles.toggleGridItem}><Text style={[styles.toggleGridLabel, { color: theme.text }]}>Pallor</Text><Switch value={examData.general.pallor} onValueChange={(v) => updateExamData("general", "pallor", v)} trackColor={{ false: theme.backgroundSecondary, true: theme.primary }} thumbColor="#FFFFFF" /></View>
                <View style={styles.toggleGridItem}><Text style={[styles.toggleGridLabel, { color: theme.text }]}>Icterus</Text><Switch value={examData.general.icterus} onValueChange={(v) => updateExamData("general", "icterus", v)} trackColor={{ false: theme.backgroundSecondary, true: theme.primary }} thumbColor="#FFFFFF" /></View>
                <View style={styles.toggleGridItem}><Text style={[styles.toggleGridLabel, { color: theme.text }]}>Cyanosis</Text><Switch value={examData.general.cyanosis} onValueChange={(v) => updateExamData("general", "cyanosis", v)} trackColor={{ false: theme.backgroundSecondary, true: theme.primary }} thumbColor="#FFFFFF" /></View>
                <View style={styles.toggleGridItem}><Text style={[styles.toggleGridLabel, { color: theme.text }]}>Clubbing</Text><Switch value={examData.general.clubbing} onValueChange={(v) => updateExamData("general", "clubbing", v)} trackColor={{ false: theme.backgroundSecondary, true: theme.primary }} thumbColor="#FFFFFF" /></View>
                <View style={styles.toggleGridItem}><Text style={[styles.toggleGridLabel, { color: theme.text }]}>Lymphadenopathy</Text><Switch value={examData.general.lymphadenopathy} onValueChange={(v) => updateExamData("general", "lymphadenopathy", v)} trackColor={{ false: theme.backgroundSecondary, true: theme.primary }} thumbColor="#FFFFFF" /></View>
                <View style={styles.toggleGridItem}><Text style={[styles.toggleGridLabel, { color: theme.text }]}>Edema</Text><Switch value={examData.general.edema} onValueChange={(v) => updateExamData("general", "edema", v)} trackColor={{ false: theme.backgroundSecondary, true: theme.primary }} thumbColor="#FFFFFF" /></View>
              </View>
              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Additional Notes</Text>
                <VoiceButton fieldKey="exam.general.notes" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="General exam notes..." placeholderTextColor={theme.textMuted} value={examData.general.notes} onChangeText={(v) => updateExamData("general", "notes", v)} multiline />
            </CollapsibleSection>

            <CollapsibleSection title="Cardiovascular System" icon="heart" iconColor={TriageColors.red}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>CVS Status</Text>
              <SegmentedControl options={["Normal", "Abnormal"]} value={examData.cvs.status} onChange={(v) => updateExamData("cvs", "status", v)} />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>S1/S2</Text>
              <SegmentedControl options={["Normal", "Soft", "Loud"]} value={examData.cvs.s1s2} onChange={(v) => updateExamData("cvs", "s1s2", v)} />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Pulse</Text>
              <SegmentedControl options={["Regular", "Irregular"]} value={examData.cvs.pulse} onChange={(v) => updateExamData("cvs", "pulse", v)} />
              <TextInputField label="Pulse Rate" value={examData.cvs.pulseRate} onChangeText={(v) => updateExamData("cvs", "pulseRate", v)} keyboardType="numeric" suffix="/min" />
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Apex Beat</Text>
              <SegmentedControl options={["Normal", "Displaced"]} value={examData.cvs.apexBeat} onChange={(v) => updateExamData("cvs", "apexBeat", v)} />
              <ToggleRow label="Precordial Heave" value={examData.cvs.precordialHeave} onValueChange={(v) => updateExamData("cvs", "precordialHeave", v)} />
              <TextInputField label="Added Sounds" value={examData.cvs.addedSounds} onChangeText={(v) => updateExamData("cvs", "addedSounds", v)} placeholder="S3, S4..." />
              <TextInputField label="Murmurs" value={examData.cvs.murmurs} onChangeText={(v) => updateExamData("cvs", "murmurs", v)} placeholder="Describe murmurs..." />
              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Additional Notes</Text>
                <VoiceButton fieldKey="exam.cvs.notes" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="CVS notes..." placeholderTextColor={theme.textMuted} value={examData.cvs.notes} onChangeText={(v) => updateExamData("cvs", "notes", v)} multiline />
            </CollapsibleSection>

            <CollapsibleSection title="Respiratory System" icon="wind" iconColor={TriageColors.orange}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Respiratory Status</Text>
              <SegmentedControl options={["Normal", "Abnormal"]} value={examData.respiratory.status} onChange={(v) => updateExamData("respiratory", "status", v)} />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Expansion</Text>
              <OptionButtons options={["Equal", "Reduced"]} value={examData.respiratory.expansion} onChange={(v) => updateExamData("respiratory", "expansion", v)} />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Percussion</Text>
              <OptionButtons options={["Resonant", "Dull", "Hyper-resonant"]} value={examData.respiratory.percussion} onChange={(v) => updateExamData("respiratory", "percussion", v)} />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Breath Sounds</Text>
              <OptionButtons options={["Vesicular", "Bronchial", "Diminished"]} value={examData.respiratory.breathSounds} onChange={(v) => updateExamData("respiratory", "breathSounds", v)} />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Vocal Resonance</Text>
              <OptionButtons options={["Normal", "Increased", "Decreased"]} value={examData.respiratory.vocalResonance} onChange={(v) => updateExamData("respiratory", "vocalResonance", v)} />
              <TextInputField label="Added Sounds" value={examData.respiratory.addedSounds} onChangeText={(v) => updateExamData("respiratory", "addedSounds", v)} placeholder="Crackles, wheezes..." />
              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Additional Notes</Text>
                <VoiceButton fieldKey="exam.respiratory.notes" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Respiratory notes..." placeholderTextColor={theme.textMuted} value={examData.respiratory.notes} onChangeText={(v) => updateExamData("respiratory", "notes", v)} multiline />
            </CollapsibleSection>

            <CollapsibleSection title="Abdomen" icon="activity" iconColor={TriageColors.yellow}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Abdomen Status</Text>
              <SegmentedControl options={["Normal", "Abnormal"]} value={examData.abdomen.status} onChange={(v) => updateExamData("abdomen", "status", v)} />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Umbilical</Text>
              <OptionButtons options={["Normal", "Herniated"]} value={examData.abdomen.umbilical} onChange={(v) => updateExamData("abdomen", "umbilical", v)} />
              <TextInputField label="Organomegaly" value={examData.abdomen.organomegaly} onChangeText={(v) => updateExamData("abdomen", "organomegaly", v)} placeholder="Hepatomegaly, splenomegaly..." />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Percussion</Text>
              <OptionButtons options={["Tympanic", "Dull", "Shifting"]} value={examData.abdomen.percussion} onChange={(v) => updateExamData("abdomen", "percussion", v)} />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Bowel Sounds</Text>
              <OptionButtons options={["Present", "Absent", "Hyperactive"]} value={examData.abdomen.bowelSounds} onChange={(v) => updateExamData("abdomen", "bowelSounds", v)} />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>External Genitalia</Text>
              <OptionButtons options={["Normal", "Abnormal"]} value={examData.abdomen.externalGenitalia} onChange={(v) => updateExamData("abdomen", "externalGenitalia", v)} />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Hernial Orifices</Text>
              <OptionButtons options={["Normal", "Hernia present"]} value={examData.abdomen.hernialOrifices} onChange={(v) => updateExamData("abdomen", "hernialOrifices", v)} />
              <TextInputField label="Per Rectal" value={examData.abdomen.perRectal} onChangeText={(v) => updateExamData("abdomen", "perRectal", v)} placeholder="If done..." />
              <TextInputField label="Per Vaginal" value={examData.abdomen.perVaginal} onChangeText={(v) => updateExamData("abdomen", "perVaginal", v)} placeholder="If done..." />
              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Additional Notes</Text>
                <VoiceButton fieldKey="exam.abdomen.notes" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Abdomen notes..." placeholderTextColor={theme.textMuted} value={examData.abdomen.notes} onChangeText={(v) => updateExamData("abdomen", "notes", v)} multiline />
            </CollapsibleSection>

            <CollapsibleSection title="Central Nervous System" icon="cpu" iconColor={TriageColors.green}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>CNS Status</Text>
              <SegmentedControl options={["Normal", "Abnormal"]} value={examData.cns.status} onChange={(v) => updateExamData("cns", "status", v)} />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Higher Mental Functions</Text>
              <OptionButtons options={["Intact", "Impaired"]} value={examData.cns.higherMentalFunctions} onChange={(v) => updateExamData("cns", "higherMentalFunctions", v)} />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Cranial Nerves</Text>
              <OptionButtons options={["Intact", "Deficit"]} value={examData.cns.cranialNerves} onChange={(v) => updateExamData("cns", "cranialNerves", v)} />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Sensory System</Text>
              <OptionButtons options={["Intact", "Impaired"]} value={examData.cns.sensorySystem} onChange={(v) => updateExamData("cns", "sensorySystem", v)} />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Motor System</Text>
              <OptionButtons options={["Normal", "Weakness"]} value={examData.cns.motorSystem} onChange={(v) => updateExamData("cns", "motorSystem", v)} />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Reflexes</Text>
              <OptionButtons options={["Normal", "Brisk", "Diminished"]} value={examData.cns.reflexes} onChange={(v) => updateExamData("cns", "reflexes", v)} />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Romberg Sign</Text>
              <OptionButtons options={["Negative", "Positive"]} value={examData.cns.rombergSign} onChange={(v) => updateExamData("cns", "rombergSign", v)} />
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Cerebellar Signs</Text>
              <OptionButtons options={["Normal", "Abnormal"]} value={examData.cns.cerebellarSigns} onChange={(v) => updateExamData("cns", "cerebellarSigns", v)} />
              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Additional Notes</Text>
                <VoiceButton fieldKey="exam.cns.notes" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="CNS notes..." placeholderTextColor={theme.textMuted} value={examData.cns.notes} onChangeText={(v) => updateExamData("cns", "notes", v)} multiline />
            </CollapsibleSection>

            <CollapsibleSection title="Extremities" icon="move" iconColor={TriageColors.blue}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Extremities Status</Text>
              <SegmentedControl options={["Normal", "Abnormal"]} value={examData.extremities.status} onChange={(v) => updateExamData("extremities", "status", v)} />
              <TextInputField label="Pulses" value={examData.extremities.pulses} onChangeText={(v) => updateExamData("extremities", "pulses", v)} placeholder="All present, absent, etc." />
              <ToggleRow label="Edema" value={examData.extremities.edema} onValueChange={(v) => updateExamData("extremities", "edema", v)} />
              <ToggleRow label="Deformity" value={examData.extremities.deformity} onValueChange={(v) => updateExamData("extremities", "deformity", v)} />
              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Additional Notes</Text>
                <VoiceButton fieldKey="exam.extremities.notes" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Extremities notes..." placeholderTextColor={theme.textMuted} value={examData.extremities.notes} onChangeText={(v) => updateExamData("extremities", "notes", v)} multiline />
            </CollapsibleSection>
          </>
        )}

        {activeTab === "treatment" && (
          <>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Investigations</Text>
              
              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Labs Ordered</Text>
                <VoiceButton fieldKey="treatment.labsOrdered" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="CBC, RFT, LFT..." placeholderTextColor={theme.textMuted} value={treatmentData.labsOrdered} onChangeText={(v) => setTreatmentData((prev) => ({ ...prev, labsOrdered: v }))} multiline />

              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Imaging</Text>
                <VoiceButton fieldKey="treatment.imaging" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="X-ray, CT, USG..." placeholderTextColor={theme.textMuted} value={treatmentData.imaging} onChangeText={(v) => setTreatmentData((prev) => ({ ...prev, imaging: v }))} multiline />

              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Results Summary</Text>
                <VoiceButton fieldKey="treatment.resultsSummary" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Key findings..." placeholderTextColor={theme.textMuted} value={treatmentData.resultsSummary} onChangeText={(v) => setTreatmentData((prev) => ({ ...prev, resultsSummary: v }))} multiline />
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Provisional Diagnosis</Text>
              
              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Primary Diagnosis</Text>
                <VoiceButton fieldKey="treatment.primaryDiagnosis" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Main diagnosis..." placeholderTextColor={theme.textMuted} value={treatmentData.primaryDiagnosis} onChangeText={(v) => setTreatmentData((prev) => ({ ...prev, primaryDiagnosis: v }))} multiline />

              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Differential Diagnoses</Text>
                <VoiceButton fieldKey="treatment.differentialDiagnoses" />
              </View>
              <TextInput style={[styles.textAreaLarge, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Other possibilities..." placeholderTextColor={theme.textMuted} value={treatmentData.differentialDiagnoses} onChangeText={(v) => setTreatmentData((prev) => ({ ...prev, differentialDiagnoses: v }))} multiline />
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <AIDiagnosisPanel
                caseId={caseId || ""}
                chiefComplaint={formData.sample.signsSymptoms || (typeof caseData?.presenting_complaint === "object" && caseData?.presenting_complaint?.text ? caseData.presenting_complaint.text : (caseData?.presenting_complaint || caseData?.chief_complaint || caseData?.triage?.chief_complaint || ""))}
                vitals={{
                  hr: formData.circulation.hr,
                  bp: `${formData.circulation.bpSystolic}/${formData.circulation.bpDiastolic}`,
                  rr: formData.breathing.rr,
                  spo2: formData.breathing.spo2,
                  gcs: `${parseInt(formData.disability.gcsE || "4") + parseInt(formData.disability.gcsV || "5") + parseInt(formData.disability.gcsM || "6")}`,
                  temp: formData.exposure.temperature,
                }}
                history={`${formData.sample.eventsHopi}\n${formData.sample.pastMedicalHistory}\n${formData.sample.medications}`}
                examination={`General: ${examData.general.notes}\nCVS: ${examData.cvs.notes}\nAbdomen: ${examData.abdomen.notes}`}
                age={parseInt(caseData?.patient?.age?.toString() || "30")}
                gender={caseData?.patient?.sex || "Unknown"}
                abgData={{
                  sampleType: formData.adjuncts.abgSampleType,
                  ph: formData.adjuncts.abgPh,
                  pco2: formData.adjuncts.abgPco2,
                  po2: formData.adjuncts.abgPo2,
                  hco3: formData.adjuncts.abgHco3,
                  be: formData.adjuncts.abgBe,
                  lactate: formData.adjuncts.abgLactate,
                  sao2: formData.adjuncts.abgSao2,
                  fio2: formData.adjuncts.abgFio2,
                  na: formData.adjuncts.abgNa,
                  k: formData.adjuncts.abgK,
                  cl: formData.adjuncts.abgCl,
                  anionGap: formData.adjuncts.abgAnionGap,
                  glucose: formData.adjuncts.abgGlucose,
                  hb: formData.adjuncts.abgHb,
                  aaGradient: formData.adjuncts.abgAaGradient,
                  interpretation: formData.adjuncts.abgInterpretation || abgInterpretation || "",
                  status: formData.adjuncts.abgStatus,
                }}
                treatmentData={{
                  medications: treatmentData.medications.filter(m => m.name),
                  fluids: treatmentData.ivFluids,
                  primaryDiagnosis: treatmentData.primaryDiagnosis,
                  differentialDiagnoses: treatmentData.differentialDiagnoses,
                  interventions: treatmentData.otherMedications,
                }}
                onDiagnosisSelect={(diagnosis) => setTreatmentData((prev) => ({ ...prev, primaryDiagnosis: diagnosis }))}
              />
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Treatment Given</Text>
              
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Medications</Text>
              
              <View style={styles.medicationInputRow}>
                <TextInput
                  style={[styles.medicationInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, flex: 2 }]}
                  placeholder="Drug Name"
                  placeholderTextColor={theme.textMuted}
                  value={newMedication.name}
                  onChangeText={(v) => setNewMedication((prev) => ({ ...prev, name: v }))}
                />
                <TextInput
                  style={[styles.medicationInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, flex: 1 }]}
                  placeholder="Dose"
                  placeholderTextColor={theme.textMuted}
                  value={newMedication.dose}
                  onChangeText={(v) => setNewMedication((prev) => ({ ...prev, dose: v }))}
                />
              </View>
              <View style={styles.medicationInputRow}>
                <TextInput
                  style={[styles.medicationInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, flex: 1 }]}
                  placeholder="Route (PO, IV, IM)"
                  placeholderTextColor={theme.textMuted}
                  value={newMedication.route}
                  onChangeText={(v) => setNewMedication((prev) => ({ ...prev, route: v }))}
                />
                <Pressable
                  style={[styles.medicationInput, styles.frequencyPicker, { backgroundColor: theme.backgroundSecondary, flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}
                  onPress={() => setShowFrequencyPicker(true)}
                >
                  <Text style={{ color: newMedication.frequency ? theme.text : theme.textMuted }}>
                    {newMedication.frequency || "Frequency"}
                  </Text>
                  <Feather name="chevron-down" size={16} color={theme.textMuted} />
                </Pressable>
              </View>
              <Pressable style={[styles.addDrugBtn, { backgroundColor: TriageColors.green }]} onPress={addMedication}>
                <Feather name="plus" size={18} color="#FFFFFF" />
                <Text style={styles.addDrugBtnText}>Add Medication</Text>
              </Pressable>

              {treatmentData.medications.length > 0 && (
                <View style={styles.medicationsList}>
                  {treatmentData.medications.map((med) => (
                    <View key={med.id} style={[styles.medicationItem, { backgroundColor: theme.backgroundSecondary }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.medicationName, { color: theme.text }]}>{med.name} {med.dose}</Text>
                        <Text style={[styles.medicationDetails, { color: theme.textSecondary }]}>{med.route} — {med.frequency}</Text>
                      </View>
                      <Pressable onPress={() => removeMedication(med.id)} hitSlop={8}>
                        <Feather name="x-circle" size={20} color={TriageColors.red} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.lg }]}>Infusions (Drips)</Text>
              
              <View style={styles.medicationInputRow}>
                <TextInput
                  style={[styles.medicationInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, flex: 2 }]}
                  placeholder="Drug (e.g., Dopamine)"
                  placeholderTextColor={theme.textMuted}
                  value={newInfusion.name}
                  onChangeText={(v) => setNewInfusion((prev) => ({ ...prev, name: v }))}
                />
                <TextInput
                  style={[styles.medicationInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, flex: 1 }]}
                  placeholder="Dose"
                  placeholderTextColor={theme.textMuted}
                  value={newInfusion.dose}
                  onChangeText={(v) => setNewInfusion((prev) => ({ ...prev, dose: v }))}
                />
              </View>
              <View style={styles.medicationInputRow}>
                <TextInput
                  style={[styles.medicationInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, flex: 1 }]}
                  placeholder="Dilution (50ml NS)"
                  placeholderTextColor={theme.textMuted}
                  value={newInfusion.dilution}
                  onChangeText={(v) => setNewInfusion((prev) => ({ ...prev, dilution: v }))}
                />
                <TextInput
                  style={[styles.medicationInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, flex: 1 }]}
                  placeholder="Rate (ml/hr)"
                  placeholderTextColor={theme.textMuted}
                  value={newInfusion.rate}
                  onChangeText={(v) => setNewInfusion((prev) => ({ ...prev, rate: v }))}
                />
              </View>
              <Pressable style={[styles.addDrugBtn, { backgroundColor: "#8B5CF6" }]} onPress={addInfusion}>
                <Feather name="plus" size={18} color="#FFFFFF" />
                <Text style={styles.addDrugBtnText}>Add Infusion</Text>
              </Pressable>

              {treatmentData.infusions.length > 0 && (
                <View style={styles.medicationsList}>
                  {treatmentData.infusions.map((inf) => (
                    <View key={inf.id} style={[styles.medicationItem, { backgroundColor: "#EDE9FE" }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.medicationName, { color: "#5B21B6" }]}>{inf.name} {inf.dose}</Text>
                        <Text style={[styles.medicationDetails, { color: "#7C3AED" }]}>In {inf.dilution} @ {inf.rate}</Text>
                      </View>
                      <Pressable onPress={() => removeInfusion(inf.id)} hitSlop={8}>
                        <Feather name="x-circle" size={20} color={TriageColors.red} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              )}

              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>IV Fluids</Text>
                <VoiceButton fieldKey="treatment.ivFluids" />
              </View>
              <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="NS, RL, etc..." placeholderTextColor={theme.textMuted} value={treatmentData.ivFluids} onChangeText={(v) => setTreatmentData((prev) => ({ ...prev, ivFluids: v }))} />
            </View>

            <Pressable style={[styles.addAddendumBtn, { borderColor: theme.border }]}>
              <Feather name="plus" size={18} color={theme.primary} />
              <Text style={[styles.addAddendumBtnText, { color: theme.primary }]}>Add Addendum Note</Text>
            </Pressable>
          </>
        )}

        {activeTab === "notes" && (
          <>
            <View style={styles.inputToolsRow}>
              <VoiceRecorder
                onExtractedData={handleVoiceExtraction}
                patientContext={{
                  age: caseData?.patient?.age ? parseFloat(caseData.patient.age) : undefined,
                  sex: caseData?.patient?.sex,
                  chiefComplaint: caseData?.presenting_complaint?.text,
                }}
                mode="full"
              />
              <DocumentScanner
                onDataExtracted={handleDocumentScanExtraction}
                context={{
                  patientAge: caseData?.patient?.age ? parseFloat(caseData.patient.age) : undefined,
                  patientSex: caseData?.patient?.sex,
                  presentingComplaint: caseData?.presenting_complaint?.text,
                }}
              />
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Procedures Performed</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Select all procedures performed and add notes</Text>
              
              <Pressable 
                style={[styles.nilProcedureRow, { borderColor: proceduresData.generalNotes === "Nil" ? TriageColors.green : theme.border }]} 
                onPress={() => {
                  if (proceduresData.generalNotes === "Nil") {
                    setProceduresData((prev) => ({ ...prev, generalNotes: "" }));
                  } else {
                    setProceduresData({
                      resuscitation: [], airway: [], vascular: [], chest: [], neuro: [], gu: [], gi: [], wound: [], ortho: [], generalNotes: "Nil",
                    });
                  }
                }}
              >
                <View style={[styles.checkbox, { borderColor: proceduresData.generalNotes === "Nil" ? TriageColors.green : theme.border }, proceduresData.generalNotes === "Nil" && { backgroundColor: TriageColors.green, borderColor: TriageColors.green }]}>
                  {proceduresData.generalNotes === "Nil" && <Feather name="check" size={14} color="#FFFFFF" />}
                </View>
                <Text style={[styles.procedureLabel, { color: theme.text, fontWeight: "600" }]}>No procedures performed (Nil)</Text>
              </Pressable>
              
              {proceduresData.generalNotes !== "Nil" && (
                <>
                  <ProcedureSection title="Resuscitation" category="resuscitation" />
                  <ProcedureSection title="Airway" category="airway" />
                  <ProcedureSection title="Vascular" category="vascular" />
                  <ProcedureSection title="Chest" category="chest" />
                  <ProcedureSection title="Neuro" category="neuro" />
                  <ProcedureSection title="GU" category="gu" />
                  <ProcedureSection title="GI" category="gi" />
                  <ProcedureSection title="Wound" category="wound" />
                  <ProcedureSection title="Ortho" category="ortho" />
                </>
              )}
            </View>

            {proceduresData.generalNotes !== "Nil" && (
              <View style={[styles.card, { backgroundColor: theme.card }]}>
                <Text style={[styles.cardTitle, { color: theme.text }]}>General Procedure Notes</Text>
                <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Detailed procedure notes and observations (included in exports)</Text>
                
                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Procedure Details</Text>
                  <VoiceButton fieldKey="procedures.generalNotes" />
                </View>
                <TextInput
                  style={[styles.textAreaLarge, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  placeholder="Document detailed procedure notes, complications, outcomes, equipment used, etc..."
                  placeholderTextColor={theme.textMuted}
                  value={proceduresData.generalNotes}
                  onChangeText={(v) => setProceduresData((prev) => ({ ...prev, generalNotes: v }))}
                  multiline
                />
              </View>
            )}
          </>
        )}

        {activeTab === "disposition" && (
          <>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Disposition</Text>
              
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Disposition Type</Text>
              <View style={styles.dispositionOptions}>
                {["Discharge", "Admit", "Refer", "LAMA", "Absconded", "Death"].map((opt) => (
                  <Pressable key={opt} style={[styles.dispositionBtn, { backgroundColor: dispositionData.dispositionType === opt ? theme.primary : theme.backgroundSecondary }]} onPress={() => setDispositionData((prev) => ({ ...prev, dispositionType: opt }))}>
                    <Text style={{ color: dispositionData.dispositionType === opt ? "#FFFFFF" : theme.text, fontWeight: "500", fontSize: 13 }}>{opt}</Text>
                  </Pressable>
                ))}
              </View>

              {dispositionData.dispositionType === "Admit" && (
                <>
                  <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Admit To</Text>
                  <View style={styles.dispositionOptions}>
                    {ADMIT_DESTINATIONS.map((dest) => (
                      <Pressable key={dest} style={[styles.dispositionBtn, { backgroundColor: dispositionData.admitTo === dest ? TriageColors.blue : theme.backgroundSecondary }]} onPress={() => setDispositionData((prev) => ({ ...prev, admitTo: dest }))}>
                        <Text style={{ color: dispositionData.admitTo === dest ? "#FFFFFF" : theme.text, fontWeight: "500", fontSize: 12 }}>{dest}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Room / Bed Number</Text>
                  <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Ward/Room/Bed number..." placeholderTextColor={theme.textMuted} value={dispositionData.admitToRoom} onChangeText={(v) => setDispositionData((prev) => ({ ...prev, admitToRoom: v }))} />
                </>
              )}

              {dispositionData.dispositionType === "Refer" && (
                <>
                  <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Refer To</Text>
                  <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Hospital / Specialty / Physician..." placeholderTextColor={theme.textMuted} value={dispositionData.referTo} onChangeText={(v) => setDispositionData((prev) => ({ ...prev, referTo: v }))} />
                </>
              )}
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Observation in ER</Text>
              
              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>ER Observation Notes</Text>
                <VoiceButton fieldKey="erObservationNotes" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Patient's course in ER, response to treatment, changes in condition..." placeholderTextColor={theme.textMuted} value={dispositionData.erObservationNotes} onChangeText={(v) => setDispositionData((prev) => ({ ...prev, erObservationNotes: v }))} multiline />

              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Duration in ER</Text>
              <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="e.g., 4 hours" placeholderTextColor={theme.textMuted} value={dispositionData.durationInER} onChangeText={(v) => setDispositionData((prev) => ({ ...prev, durationInER: v }))} />
            </View>

            <Pressable style={[styles.generateSummaryBtn, { backgroundColor: theme.primary }]} onPress={async () => {
              const success = await commitToBackend();
              if (success && caseId) {
                navigation.navigate("DischargeSummary", { caseId });
              }
            }}>
              <Feather name="file-text" size={18} color="#FFFFFF" />
              <Text style={styles.generateSummaryBtnText}>Generate Discharge Summary</Text>
            </Pressable>

            <Pressable style={[styles.saveDashboardBtn, { borderColor: theme.primary }]} onPress={async () => { const success = await commitToBackend(); if (success) navigation.reset({ index: 0, routes: [{ name: "Main", params: { screen: "DashboardTab" } }] }); }}>
              <Feather name="home" size={18} color={theme.primary} />
              <Text style={[styles.saveDashboardBtnText, { color: theme.primary }]}>Save & Go to Dashboard</Text>
            </Pressable>
          </>
        )}
      </KeyboardAwareScrollViewCompat>

      <View style={[styles.bottomNav, { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: insets.bottom + Spacing.sm }]}>
        <Pressable style={[styles.navBtn, styles.prevBtn]} onPress={handlePrevious} disabled={activeTab === "patient"}>
          <Feather name="arrow-left" size={18} color={activeTab === "patient" ? theme.textMuted : theme.text} />
          <Text style={[styles.navBtnText, { color: activeTab === "patient" ? theme.textMuted : theme.text }]}>Previous</Text>
        </Pressable>
        <Pressable style={[styles.navBtn, styles.saveNavBtn, { backgroundColor: theme.textSecondary }]} onPress={() => handleSave(false)} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <><Feather name="save" size={18} color="#FFFFFF" /><Text style={styles.saveNavBtnText}>Save</Text></>}
        </Pressable>
        <Pressable style={[styles.navBtn, styles.nextBtn, { backgroundColor: TriageColors.green }]} onPress={handleNext}>
          <Text style={styles.nextBtnText}>{activeTab === "disposition" ? "Finish" : "Next"}</Text>
          {activeTab === "disposition" ? <Feather name="check" size={18} color="#FFFFFF" /> : <Feather name="arrow-right" size={18} color="#FFFFFF" />}
        </Pressable>
      </View>

      <Modal
        visible={showFrequencyPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowFrequencyPicker(false)}
      >
        <Pressable
          style={styles.frequencyModalOverlay}
          onPress={() => setShowFrequencyPicker(false)}
        >
          <View style={[styles.frequencyModalContent, { backgroundColor: theme.card }]}>
            <Text style={[styles.frequencyModalTitle, { color: theme.text }]}>Select Frequency</Text>
            <FlatList
              data={FREQUENCY_OPTIONS}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.frequencyOption,
                    {
                      backgroundColor: pressed ? theme.backgroundSecondary : "transparent",
                      borderBottomWidth: 1,
                      borderBottomColor: theme.border,
                    },
                  ]}
                  onPress={() => {
                    setNewMedication((prev) => ({ ...prev, frequency: item.value }));
                    setShowFrequencyPicker(false);
                  }}
                >
                  <Text style={[styles.frequencyOptionText, { color: theme.text }]}>
                    {item.label}
                  </Text>
                  {newMedication.frequency === item.value && (
                    <Feather name="check" size={18} color={TriageColors.green} />
                  )}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: { borderBottomWidth: 1, paddingTop: 50 },
  headerTop: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm },
  backBtn: { padding: Spacing.sm },
  headerCenter: { flex: 1, alignItems: "center" },
  headerTitle: { ...Typography.h4 },
  savedText: { ...Typography.small, marginTop: 2 },
  headerRight: { flexDirection: "row", gap: Spacing.sm },
  headerIcon: { padding: Spacing.sm },
  tabBar: { paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingVertical: Spacing.sm },
  tabBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, gap: Spacing.xs },
  tabBtnText: { fontSize: 13, fontWeight: "600" },
  swipeHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingBottom: Spacing.sm, gap: Spacing.xs },
  swipeHintText: { ...Typography.small },
  content: { padding: Spacing.lg },
  inputToolsRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.lg },
  card: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  cardTitle: { ...Typography.h4, marginBottom: Spacing.lg },
  patientHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  patientInfo: { flex: 1 },
  patientName: { ...Typography.h3 },
  patientDetails: { ...Typography.body, marginTop: 2 },
  triageBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginLeft: Spacing.md },
  triageBadgeText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  complaint: { ...Typography.small, marginTop: Spacing.sm, fontStyle: "italic" },
  vitalsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md, marginTop: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md },
  vitalItem: { alignItems: "center", minWidth: 50 },
  vitalLabel: { ...Typography.label, fontSize: 10 },
  vitalValue: { ...Typography.bodyMedium, fontWeight: "600" },
  fieldWithVoice: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.md, marginBottom: Spacing.xs },
  fieldLabelWithBar: { flexDirection: "row", alignItems: "center" },
  fieldBar: { width: 4, height: 20, borderRadius: 2, marginRight: Spacing.sm },
  fieldLabel: { ...Typography.bodyMedium },
  voiceBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  voiceBtnSmall: { width: 28, height: 28, borderRadius: 14 },
  inputField: { height: 48, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, ...Typography.body },
  textArea: { minHeight: 80, padding: Spacing.md, borderRadius: BorderRadius.md, textAlignVertical: "top", ...Typography.body },
  textAreaLarge: { minHeight: 120, padding: Spacing.md, borderRadius: BorderRadius.md, textAlignVertical: "top", ...Typography.body },
  sectionHeading: { ...Typography.h4, marginTop: Spacing.lg, marginBottom: Spacing.md },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.sm },
  toggleLabel: { ...Typography.body },
  toggleGrid: { flexDirection: "row", flexWrap: "wrap" },
  toggleGridItem: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "50%", paddingVertical: Spacing.sm, paddingRight: Spacing.md },
  toggleGridLabel: { ...Typography.body, fontSize: 14 },
  segmentedControl: { flexDirection: "row", gap: Spacing.sm },
  segmentBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: "center", borderRadius: BorderRadius.md },
  markNormalBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm, marginBottom: Spacing.lg },
  markNormalBtnText: { ...Typography.bodyMedium, fontWeight: "600" },
  row: { flexDirection: "row", gap: Spacing.md },
  halfField: { flex: 1 },
  thirdField: { flex: 1 },
  subLabel: { ...Typography.label, marginBottom: Spacing.sm },
  gcsTotal: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  gcsTotalLabel: { ...Typography.body, marginRight: Spacing.sm },
  gcsTotalValue: { ...Typography.h3 },
  bottomNav: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, gap: Spacing.sm },
  navBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.xs },
  prevBtn: { flex: 1 },
  navBtnText: { ...Typography.bodyMedium },
  saveNavBtn: { paddingHorizontal: Spacing.lg },
  saveNavBtnText: { color: "#FFFFFF", ...Typography.bodyMedium },
  nextBtn: { flex: 1.5 },
  nextBtnText: { color: "#FFFFFF", ...Typography.bodyMedium, fontWeight: "600" },
  optionButtons: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  optionBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  actionButtonsRow: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.lg },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm },
  actionBtnText: { ...Typography.bodyMedium, fontWeight: "600" },
  cardSubtitle: { ...Typography.body, marginBottom: Spacing.md, marginTop: -Spacing.sm },
  addDrugBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.md },
  addDrugBtnText: { color: "#FFFFFF", ...Typography.bodyMedium, fontWeight: "600" },
  medicationInputRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  medicationInput: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, ...Typography.body },
  medicationsList: { marginTop: Spacing.md, gap: Spacing.sm },
  medicationItem: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md, gap: Spacing.sm },
  medicationName: { ...Typography.bodyMedium, fontWeight: "600" },
  medicationDetails: { fontSize: 13, fontWeight: "400" as const },
  addAddendumBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderStyle: "dashed", gap: Spacing.sm, marginTop: Spacing.md },
  addAddendumBtnText: { ...Typography.bodyMedium, fontWeight: "500" },
  procedureHeader: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, marginTop: Spacing.md },
  procedureHeaderText: { ...Typography.bodyMedium, fontWeight: "600" },
  procedureRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, gap: Spacing.md },
  nilProcedureRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, gap: Spacing.md, borderWidth: 1, borderRadius: BorderRadius.md, marginTop: Spacing.md, marginBottom: Spacing.sm },
  abgNormalValuesCard: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginVertical: Spacing.sm },
  abgNormalTitle: { ...Typography.bodyMedium, fontWeight: "600", marginBottom: Spacing.sm },
  abgNormalGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  abgNormalItem: { width: "48%", flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 },
  abgNormalLabel: { ...Typography.caption },
  abgNormalValue: { ...Typography.caption, fontWeight: "600" },
  aiInterpretBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm, marginTop: Spacing.sm },
  aiInterpretBtnText: { ...Typography.bodyMedium, color: "#FFFFFF", fontWeight: "600" },
  abgInterpretationCard: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.md },
  abgInterpretationTitle: { ...Typography.bodyMedium, fontWeight: "700", marginBottom: Spacing.xs },
  abgInterpretationText: { ...Typography.body, lineHeight: 22 },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderRadius: 4, justifyContent: "center", alignItems: "center" },
  procedureLabel: { ...Typography.body, flex: 1 },
  dispositionOptions: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.sm },
  dispositionBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  generateSummaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.lg, borderRadius: BorderRadius.md, gap: Spacing.sm, marginTop: Spacing.lg },
  generateSummaryBtnText: { color: "#FFFFFF", ...Typography.bodyMedium, fontWeight: "600" },
  saveDashboardBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, gap: Spacing.sm, marginTop: Spacing.md },
  saveDashboardBtnText: { ...Typography.bodyMedium, fontWeight: "600" },
  arrivalRow: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.md },
  arrivalBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: "center", borderRadius: BorderRadius.md },
  mlcRow: { flexDirection: "row", alignItems: "center", paddingTop: Spacing.sm },
  mlcCard: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg, borderWidth: 1 },
  mlcHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.lg },
  mlcTitle: { ...Typography.h4 },
  field: { marginBottom: Spacing.md },
  normalAbnormalRow: { flexDirection: "row", marginBottom: Spacing.lg },
  normalBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.xs, marginRight: Spacing.sm },
  abnormalBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.xs },
  abnormalSection: { backgroundColor: "#FFF5F5", padding: Spacing.md, borderRadius: BorderRadius.md, borderLeftWidth: 3, borderLeftColor: "#EF4444" },
  normalDescriptionBox: { padding: Spacing.md, borderRadius: BorderRadius.md, borderLeftWidth: 3, marginTop: Spacing.sm, marginBottom: Spacing.sm },
  normalDescriptionText: { ...Typography.body, fontSize: 13, fontStyle: "italic", lineHeight: 20 },
  abnormalSectionLabel: { ...Typography.bodyMedium, fontWeight: "600", marginBottom: Spacing.sm },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.md },
  chip: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, borderWidth: 1, borderColor: "#E5E7EB" },
  chipSelected: { borderColor: "#EF4444" },
  chipText: { fontSize: 13 },
  interventionRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, gap: Spacing.md },
  interventionCheckbox: { width: 20, height: 20, borderWidth: 1.5, borderColor: "#9CA3AF", borderRadius: 4, justifyContent: "center", alignItems: "center" },
  interventionCheckboxSelected: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
  interventionLabel: { ...Typography.body, flex: 1 },
  abcdeVitalsRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.md },
  abcdeVitalInput: { flex: 1 },
  abgRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.sm },
  abgHalfField: { flex: 1 },
  abgSectionLabel: { ...Typography.bodyMedium, fontWeight: "600", marginTop: Spacing.md, marginBottom: Spacing.sm },
  abgGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.md },
  abgSmallField: { width: "23%", minWidth: 70 },
  abgFieldLabel: { ...Typography.caption, marginBottom: 4 },
  abgInput: { height: 40, paddingHorizontal: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, fontSize: 14, textAlign: "center" },
  frequencyPicker: { height: 40, justifyContent: "center" },
  frequencyModalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: Spacing.lg },
  frequencyModalContent: { width: "90%", maxHeight: "70%", borderRadius: BorderRadius.lg, overflow: "hidden" },
  frequencyModalTitle: { ...Typography.h4, padding: Spacing.lg, borderBottomWidth: 1, borderBottomColor: "#E5E7EB" },
  frequencyOption: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: Spacing.md, paddingHorizontal: Spacing.lg },
  frequencyOptionText: { ...Typography.body },
});
