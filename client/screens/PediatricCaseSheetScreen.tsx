import React, { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, TextInput, StyleSheet, Pressable, ActivityIndicator, ScrollView, Switch, Alert } from "react-native";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import VoiceRecorder, { ExtractedClinicalData } from "@/components/VoiceRecorder";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { useTheme } from "@/hooks/useTheme";
import { apiGet, apiPatch, apiPut, invalidateCases } from "@/lib/api";
import { useCase } from "@/context/CaseContext";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getAgeGroupLabel, getAgeGroup } from "@/lib/pediatricVitals";

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

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type PediatricCaseSheetRouteProp = RouteProp<RootStackParamList, "PediatricCaseSheet">;

type TabKey = "patient" | "primary" | "history" | "exam" | "treatment" | "notes" | "disposition";

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: "patient", label: "Patient", icon: "user" },
  { key: "primary", label: "Primary", icon: "activity" },
  { key: "history", label: "History", icon: "file-text" },
  { key: "exam", label: "Exam", icon: "search" },
  { key: "treatment", label: "Treatment", icon: "briefcase" },
  { key: "notes", label: "Notes", icon: "edit-3" },
  { key: "disposition", label: "Disposition", icon: "log-out" },
];

interface PatientInfo {
  id: string;
  name: string;
  age: number;
  sex: string;
  phone: string;
  address: string;
  brought_by: string;
  informant_name: string;
  informant_reliability: string;
  chief_complaint: string;
  triage_category: string;
  vitals: {
    hr: string;
    bp_systolic: string;
    bp_diastolic: string;
    rr: string;
    spo2: string;
    temperature: string;
    gcs_e: string;
    gcs_v: string;
    gcs_m: string;
    grbs: string;
  };
}

interface PATFormData {
  appearance: {
    tone: string;
    interactivity: string;
    consolability: string;
    lookGaze: string;
    speechCry: string;
  };
  workOfBreathing: string;
  circulationToSkin: string;
}

interface AirwayFormData {
  cry: string;
  status: string;
  intervention: string;
}

interface BreathingFormData {
  respiratoryRate: string;
  spo2: string;
  workOfBreathing: string[];
  abnormalPositioning: string;
  airEntry: string;
  subcutaneousEmphysema: string;
  intervention: string;
}

interface CirculationFormData {
  crt: string;
  heartRate: string;
  bloodPressure: string;
  skinColorTemp: string;
  distendedNeckVeins: string;
  intervention: string;
}

interface DisabilityFormData {
  avpuGcs: string;
  pupils: string;
  abnormalResponses: string;
  glucose: string;
}

interface ExposureFormData {
  temperature: string;
  trauma: string;
  signsOfTraumaIllness: string[];
  evidenceOfInfection: string;
  longBoneDeformities: string;
  extremities: string;
  immobilize: string;
}

interface EFASTFormData {
  heart: string;
  abdomen: string;
  lungs: string;
  pelvis: string;
}

interface PediatricHistoryFormData {
  allergies: string;
  currentMedications: string;
  lastDoseMedications: string;
  medicationsInEnvironment: string;
  healthHistory: string;
  underlyingConditions: string;
  immunizationStatus: string;
  lastMeal: string;
  lmp: string;
  events: string;
  treatmentBeforeArrival: string;
  signsAndSymptoms: {
    breathingDifficulty: boolean;
    fever: boolean;
    vomiting: boolean;
    timeCourse: string;
    decreasedOralIntake: boolean;
  };
}

interface HEENTFormData {
  head: string;
  eyes: string;
  ears: string;
  nose: string;
  throat: string;
  lymphNodes: string;
}

interface PediatricExamFormData {
  heent: HEENTFormData;
  respiratory: string;
  cardiovascular: string;
  abdomen: string;
  back: string;
  extremities: string;
}

interface InfusionEntry {
  id: string;
  name: string;
  dose: string;
  dilution: string;
  rate: string;
}

interface TreatmentFormData {
  labsOrdered: string;
  imaging: string;
  resultsSummary: string;
  primaryDiagnosis: string;
  differentialDiagnoses: string;
  otherMedications: string;
  ivFluids: string;
  infusions: InfusionEntry[];
}

interface ProceduresData {
  resuscitation: { cpr: boolean };
  airway: { intubation: boolean; lma: boolean; cricothyrotomy: boolean; bvm: boolean };
  vascular: { centralLine: boolean; peripheralIV: boolean; io: boolean; arterialLine: boolean };
  chest: { chestTube: boolean; needleDecompression: boolean; pericardiocentesis: boolean; thoracentesis: boolean };
  neuro: { lumbarPuncture: boolean };
  gu: { foleysCatheter: boolean };
  gi: { ngTube: boolean; gastricLavage: boolean };
  wound: { suturing: boolean; irrigation: boolean };
  ortho: { splinting: boolean; jointReduction: boolean };
}

interface DispositionData {
  dispositionType: string;
  admitTo: string;
  admitToRoom: string;
  referTo: string;
  erObservationNotes: string;
  durationInER: string;
  conditionAtShift: string;
  emResident: string;
  emConsultant: string;
}

const ADMIT_DESTINATIONS = [
  "Pediatric Ward",
  "Pediatric ICU",
  "NICU",
  "Medical ICU",
  "Surgical ICU",
  "HDU",
  "Observation Ward",
  "Other",
];

const WOB_SIGNS = ["Nasal Flaring", "Retractions", "Grunting", "Wheezing", "Stridor", "Snoring", "Gurgling"];
const TRAUMA_ILLNESS_SIGNS = ["Rashes", "Petechiae", "Ecchymosis", "Bruises", "Burns", "Purpura"];

export default function PediatricCaseSheetScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<PediatricCaseSheetRouteProp>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const { caseId, triageData } = route.params;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("patient");
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [patient, setPatient] = useState<PatientInfo | null>(null);

  const [patData, setPatData] = useState<PATFormData>({
    appearance: { tone: "", interactivity: "", consolability: "", lookGaze: "", speechCry: "" },
    workOfBreathing: "",
    circulationToSkin: "",
  });
  const [airwayData, setAirwayData] = useState<AirwayFormData>({ cry: "", status: "", intervention: "" });
  const [breathingData, setBreathingData] = useState<BreathingFormData>({
    respiratoryRate: "", spo2: "", workOfBreathing: [], abnormalPositioning: "", airEntry: "", subcutaneousEmphysema: "", intervention: ""
  });
  const [circulationData, setCirculationData] = useState<CirculationFormData>({
    crt: "", heartRate: "", bloodPressure: "", skinColorTemp: "", distendedNeckVeins: "", intervention: ""
  });
  const [disabilityData, setDisabilityData] = useState<DisabilityFormData>({ avpuGcs: "", pupils: "", abnormalResponses: "", glucose: "" });
  const [exposureData, setExposureData] = useState<ExposureFormData>({
    temperature: "", trauma: "", signsOfTraumaIllness: [], evidenceOfInfection: "", longBoneDeformities: "", extremities: "", immobilize: ""
  });
  const [efastData, setEfastData] = useState<EFASTFormData>({ heart: "", abdomen: "", lungs: "", pelvis: "" });
  const [historyData, setHistoryData] = useState<PediatricHistoryFormData>({
    allergies: "", currentMedications: "", lastDoseMedications: "", medicationsInEnvironment: "", healthHistory: "", underlyingConditions: "", immunizationStatus: "", lastMeal: "", lmp: "", events: "", treatmentBeforeArrival: "",
    signsAndSymptoms: { breathingDifficulty: false, fever: false, vomiting: false, timeCourse: "", decreasedOralIntake: false }
  });
  const [examData, setExamData] = useState<PediatricExamFormData>({
    heent: { head: "", eyes: "", ears: "", nose: "", throat: "", lymphNodes: "" },
    respiratory: "", cardiovascular: "", abdomen: "", back: "", extremities: ""
  });
  const [treatmentData, setTreatmentData] = useState<TreatmentFormData>({
    labsOrdered: "", imaging: "", resultsSummary: "", primaryDiagnosis: "", differentialDiagnoses: "", otherMedications: "", ivFluids: "", infusions: []
  });
  const [proceduresData, setProceduresData] = useState<ProceduresData>({
    resuscitation: { cpr: false },
    airway: { intubation: false, lma: false, cricothyrotomy: false, bvm: false },
    vascular: { centralLine: false, peripheralIV: false, io: false, arterialLine: false },
    chest: { chestTube: false, needleDecompression: false, pericardiocentesis: false, thoracentesis: false },
    neuro: { lumbarPuncture: false },
    gu: { foleysCatheter: false },
    gi: { ngTube: false, gastricLavage: false },
    wound: { suturing: false, irrigation: false },
    ortho: { splinting: false, jointReduction: false }
  });
  const [dispositionData, setDispositionData] = useState<DispositionData>({
    dispositionType: "", admitTo: "", admitToRoom: "", referTo: "", erObservationNotes: "", durationInER: "", conditionAtShift: "", emResident: "", emConsultant: ""
  });

  const [isRecording, setIsRecording] = useState(false);
  const [recordingField, setRecordingField] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const localDraftIdRef = useRef<string | null>(null);
  
  const { saveToDraft, currentDraftId, commitDraft, initDraftForCase, loadDraft } = useCase();

  useEffect(() => {
    loadCase();
    return () => {
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, [caseId]);

  const loadFromCaseSheetData = (caseSheetData: any) => {
    if (!caseSheetData) return false;
    
    if (caseSheetData.primary_assessment?.pat) {
      setPatData(caseSheetData.primary_assessment.pat);
    }
    if (caseSheetData.primary_assessment?.airway) {
      setAirwayData(caseSheetData.primary_assessment.airway);
    }
    if (caseSheetData.primary_assessment?.breathing) {
      setBreathingData(caseSheetData.primary_assessment.breathing);
    }
    if (caseSheetData.primary_assessment?.circulation) {
      setCirculationData(caseSheetData.primary_assessment.circulation);
    }
    if (caseSheetData.primary_assessment?.disability) {
      setDisabilityData(caseSheetData.primary_assessment.disability);
    }
    if (caseSheetData.primary_assessment?.exposure) {
      setExposureData(caseSheetData.primary_assessment.exposure);
    }
    if (caseSheetData.primary_assessment?.efast) {
      setEfastData(caseSheetData.primary_assessment.efast);
    }
    if (caseSheetData.history) {
      setHistoryData(caseSheetData.history);
    }
    if (caseSheetData.examination) {
      setExamData(caseSheetData.examination);
    }
    if (caseSheetData.treatment) {
      const loadedInfusions = Array.isArray(caseSheetData.treatment.infusions) 
        ? caseSheetData.treatment.infusions.map((inf: any) => ({
            id: inf.id || Date.now().toString() + Math.random(),
            name: inf.name || "",
            dose: inf.dose || "",
            dilution: inf.dilution || "",
            rate: inf.rate || "",
          }))
        : [];
      setTreatmentData({
        labsOrdered: Array.isArray(caseSheetData.treatment.panels_selected) ? caseSheetData.treatment.panels_selected.join(", ") : "",
        imaging: Array.isArray(caseSheetData.treatment.imaging) ? caseSheetData.treatment.imaging.join(", ") : "",
        resultsSummary: caseSheetData.treatment.results_notes || "",
        primaryDiagnosis: caseSheetData.treatment.primary_diagnosis || "",
        differentialDiagnoses: Array.isArray(caseSheetData.treatment.differential_diagnoses) ? caseSheetData.treatment.differential_diagnoses.join(", ") : "",
        otherMedications: caseSheetData.treatment.other_medications || "",
        ivFluids: caseSheetData.treatment.fluids || "",
        infusions: loadedInfusions,
      });
    }
    if (caseSheetData.disposition) {
      setDispositionData((prev) => ({
        ...prev,
        dispositionType: caseSheetData.disposition.type || "",
        admitTo: caseSheetData.disposition.admit_to || "",
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
    return true;
  };
  
  const loadCase = async () => {
    try {
      setLoading(true);
      
      const draftId = await initDraftForCase(caseId);
      localDraftIdRef.current = draftId;
      const draft = await loadDraft(draftId);
      const hasLocalDraft = draft?.caseSheetData && loadFromCaseSheetData(draft.caseSheetData);
      if (hasLocalDraft) {
        setLastSaved(new Date(draft!.updatedAt));
      }
      
      if (triageData) {
        setPatient({
          id: caseId,
          name: triageData.name || "Unknown",
          age: parseFloat(triageData.age) || 0,
          sex: triageData.sex || "Unknown",
          phone: triageData.phone || "",
          address: triageData.address || "",
          brought_by: triageData.brought_by || "",
          informant_name: triageData.informant_name || "",
          informant_reliability: triageData.informant_reliability || "",
          chief_complaint: triageData.chief_complaint || "",
          triage_category: triageData.triage_category || "green",
          vitals: {
            hr: triageData.hr || "",
            bp_systolic: triageData.bp_systolic || "",
            bp_diastolic: triageData.bp_diastolic || "",
            rr: triageData.rr || "",
            spo2: triageData.spo2 || "",
            temperature: triageData.temperature || "",
            gcs_e: triageData.gcs_e || "4",
            gcs_v: triageData.gcs_v || "5",
            gcs_m: triageData.gcs_m || "6",
            grbs: triageData.grbs || "",
          },
        });
      } else {
        const data = await apiGet(`/cases/${caseId}`) as any;
        if (data) {
          setPatient({
            id: data.id || caseId,
            name: data.name || "Unknown",
            age: parseFloat(data.age) || 0,
            sex: data.sex || "Unknown",
            phone: data.phone || "",
            address: data.address || "",
            brought_by: data.brought_by || "",
            informant_name: data.informant_name || "",
            informant_reliability: data.informant_reliability || "",
            chief_complaint: data.chief_complaint || "",
            triage_category: data.triage_category || "green",
            vitals: data.vitals || {},
          });
        }
      }
    } catch (error) {
      console.error("Failed to load case:", error);
    } finally {
      setLoading(false);
    }
  };

  const buildPayload = () => {
    return {
      vitals_at_arrival: {
        hr: parseFloat(circulationData.heartRate) || 100,
        rr: parseFloat(breathingData.respiratoryRate) || 20,
        spo2: parseFloat(breathingData.spo2) || 98,
        temperature: parseFloat(exposureData.temperature) || 36.8,
        grbs: parseFloat(disabilityData.glucose) || 100,
      },
      primary_assessment: {
        pat: patData,
        airway: airwayData,
        breathing: breathingData,
        circulation: circulationData,
        disability: disabilityData,
        exposure: exposureData,
        efast: efastData,
        airway_status: airwayData.status || "Patent",
        breathing_rr: parseFloat(breathingData.respiratoryRate) || 20,
        breathing_spo2: parseFloat(breathingData.spo2) || 98,
        breathing_work: breathingData.workOfBreathing?.join(", ") || "Normal",
        circulation_hr: parseFloat(circulationData.heartRate) || 100,
        circulation_crt: circulationData.crt === "Normal (<2s)" ? 2 : 3,
        disability_avpu: disabilityData.avpuGcs || "Alert",
        disability_pupils_size: disabilityData.pupils || "Normal",
        exposure_temperature: parseFloat(exposureData.temperature) || 36.8,
      },
      history: {
        ...historyData,
        hpi: historyData.events || "",
        events_hopi: historyData.events || "",
        allergies: Array.isArray(historyData.allergies) ? historyData.allergies : (typeof historyData.allergies === 'string' && historyData.allergies ? historyData.allergies.split(',').map((s: string) => s.trim()).filter((s: string) => s) : []),
        medications: historyData.currentMedications || "",
        drug_history: historyData.currentMedications || "",
        past_medical: Array.isArray(historyData.healthHistory) ? historyData.healthHistory : (typeof historyData.healthHistory === 'string' && historyData.healthHistory ? historyData.healthHistory.split(',').map((s: string) => s.trim()).filter((s: string) => s) : []),
        last_meal: historyData.lastMeal || "",
        lmp: historyData.lmp || "",
        last_meal_lmp: `${historyData.lastMeal || ""}${historyData.lmp ? ` | LMP: ${historyData.lmp}` : ""}`,
      },
      physical_exam: examData,
      examination: {
        general_additional_notes: examData.heent?.head || "",
        respiratory_status: "Normal",
        respiratory_additional_notes: examData.respiratory || "",
        cvs_status: "Normal",
        cvs_additional_notes: examData.cardiovascular || "",
        abdomen_status: "Normal",
        abdomen_additional_notes: examData.abdomen || "",
        extremities_status: "Normal",
        extremities_findings: examData.extremities || "",
      },
      heent: examData.heent,
      treatment: {
        primary_diagnosis: treatmentData.primaryDiagnosis || "",
        provisional_diagnosis: treatmentData.primaryDiagnosis || "",
        differential_diagnoses: treatmentData.differentialDiagnoses || "",
        labs_ordered: treatmentData.labsOrdered || "",
        imaging: treatmentData.imaging || "",
        results_summary: treatmentData.resultsSummary || "",
        medications: treatmentData.otherMedications || "",
        iv_fluids: treatmentData.ivFluids || "",
        infusions: treatmentData.infusions.filter((i: InfusionEntry) => i.name.trim() !== "").map((i: InfusionEntry) => ({
          name: i.name,
          dose: i.dose,
          dilution: i.dilution,
          rate: i.rate,
        })),
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
        condition: dispositionData.conditionAtShift || "",
      },
      em_resident: dispositionData.emResident || "",
      em_consultant: dispositionData.emConsultant || "",
      procedures: proceduresData,
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
    
    try {
      setSaving(true);
      const payload = buildPayload();
      await saveToDraft(payload);
      setLastSaved(new Date());
      if (!silent) Alert.alert("Saved Locally", "Data saved locally. It will be submitted when you click Finish.");
    } catch (error) {
      console.error("Failed to save locally:", error);
      const errMsg = error instanceof Error ? error.message : String(error || "Failed to save case data");
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
    try {
      setSaving(true);
      const payload = buildPayload();
      console.log("Committing pediatric case to backend:", caseId);
      const res = await apiPut(`/cases/${caseId}`, payload);
      console.log("Pediatric commit response:", res);
      if (res && res.success !== false) {
        await invalidateCases();
        const effectiveDraftId = currentDraftId || localDraftIdRef.current;
        if (effectiveDraftId) {
          await commitDraft(caseId);
        }
        return true;
      } else {
        console.error("Pediatric commit failed:", res);
        const errorData = res.error as any;
        let errorMessage = "Failed to save case data. Please try again.";
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
    } catch (error) {
      console.error("Failed to commit:", error);
      Alert.alert("Error", "Failed to save case data");
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
  // }, [patData, airwayData, breathingData, circulationData, disabilityData, exposureData, efastData, historyData, examData]);

  const handleNext = async () => {
    const currentIndex = TABS.findIndex((t) => t.key === activeTab);
    if (currentIndex < TABS.length - 1) {
      setActiveTab(TABS[currentIndex + 1].key);
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

  const markAllAsNormal = () => {
    setPatData({
      appearance: { tone: "Moves spontaneously", interactivity: "Alert", consolability: "Stops crying with caregiver", lookGaze: "Makes eye contact", speechCry: "Strong cry" },
      workOfBreathing: "Normal",
      circulationToSkin: "Pink",
    });
    setAirwayData({ cry: "Good", status: "Patent", intervention: "None required" });
    setBreathingData({
      respiratoryRate: "", spo2: "98", workOfBreathing: [], abnormalPositioning: "None", airEntry: "Normal", subcutaneousEmphysema: "No", intervention: "None required"
    });
    setCirculationData({
      crt: "Normal (<2s)", heartRate: "", bloodPressure: "", skinColorTemp: "Pink", distendedNeckVeins: "No", intervention: "None required"
    });
    setDisabilityData({ avpuGcs: "Alert", pupils: "Equal, round, reactive", abnormalResponses: "None noted", glucose: "" });
    setExposureData({
      temperature: "36.8", trauma: "No signs of trauma", signsOfTraumaIllness: [], evidenceOfInfection: "None", longBoneDeformities: "None", extremities: "Normal", immobilize: "Not required"
    });
    setEfastData({ heart: "Normal", abdomen: "No free fluid", lungs: "No pneumothorax", pelvis: "Normal" });
    setExamData({
      heent: { head: "Normocephalic, atraumatic", eyes: "PERRLA, conjunctiva clear", ears: "TM intact bilaterally", nose: "No discharge, septum midline", throat: "Pharynx clear, tonsils normal", lymphNodes: "No lymphadenopathy" },
      respiratory: "Clear breath sounds bilaterally, no wheezing/crackles/stridor, chest expansion symmetric",
      cardiovascular: "S1S2 normal, no murmurs, regular rhythm, peripheral pulses strong and equal",
      abdomen: "Soft, non-tender, non-distended, no organomegaly, bowel sounds present",
      back: "No spinal tenderness, no deformity",
      extremities: "No swelling, deformity or tenderness, full range of motion, pulses intact"
    });
    Alert.alert("Done", "All sections marked as normal");
  };

  const handleVoiceExtraction = (data: ExtractedClinicalData) => {
    if (data.historyOfPresentIllness) {
      setHistoryData((prev) => ({ ...prev, events: (prev.events ? prev.events + " " : "") + data.historyOfPresentIllness }));
    }
    if (data.pastMedicalHistory) {
      setHistoryData((prev) => ({ ...prev, healthHistory: (prev.healthHistory ? prev.healthHistory + ", " : "") + data.pastMedicalHistory }));
    }
    if (data.allergies) {
      setHistoryData((prev) => ({ ...prev, allergies: (prev.allergies ? prev.allergies + ", " : "") + data.allergies }));
    }
    if (data.medications) {
      setHistoryData((prev) => ({ ...prev, currentMedications: (prev.currentMedications ? prev.currentMedications + ", " : "") + data.medications }));
    }
    if (data.examFindings) {
      if (data.examFindings.general) {
        setExamData((prev) => ({ ...prev, heent: { ...prev.heent, head: (prev.heent.head ? prev.heent.head + " " : "") + data.examFindings!.general } }));
      }
      if (data.examFindings.respiratory) {
        setExamData((prev) => ({ ...prev, respiratory: (prev.respiratory ? prev.respiratory + " " : "") + data.examFindings!.respiratory }));
      }
      if (data.examFindings.cvs) {
        setExamData((prev) => ({ ...prev, cardiovascular: (prev.cardiovascular ? prev.cardiovascular + " " : "") + data.examFindings!.cvs }));
      }
      if (data.examFindings.abdomen) {
        setExamData((prev) => ({ ...prev, abdomen: (prev.abdomen ? prev.abdomen + " " : "") + data.examFindings!.abdomen }));
      }
    }
    if (data.diagnosis && data.diagnosis.length > 0) {
      const diagnosisText = data.diagnosis.join(", ");
      setTreatmentData((prev) => ({ ...prev, primaryDiagnosis: (prev.primaryDiagnosis ? prev.primaryDiagnosis + ", " : "") + diagnosisText }));
    }
    if (data.treatmentNotes) {
      setTreatmentData((prev) => ({ ...prev, resultsSummary: (prev.resultsSummary ? prev.resultsSummary + " " : "") + data.treatmentNotes }));
    }
    if (data.symptoms && data.symptoms.length > 0) {
      const symptomsText = data.symptoms.join(", ");
      setHistoryData((prev) => ({ ...prev, events: (prev.events ? prev.events + ", " : "") + symptomsText }));
    }
    handleSave(true);
  };

  const handlePrevious = () => {
    const currentIndex = TABS.findIndex((t) => t.key === activeTab);
    if (currentIndex > 0) {
      setActiveTab(TABS[currentIndex - 1].key);
    }
  };

  const getTriageColor = (category: string) => {
    const colors: Record<string, string> = { red: TriageColors.red, orange: TriageColors.orange, yellow: TriageColors.yellow, green: TriageColors.green, blue: TriageColors.blue };
    return colors[category] || TriageColors.green;
  };

  const OptionButtons = ({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) => (
    <View style={styles.optionButtons}>
      {options.map((opt) => (
        <Pressable key={opt} style={[styles.optionBtn, { backgroundColor: value === opt ? theme.primary : theme.backgroundSecondary }]} onPress={() => onChange(opt)}>
          <Text style={{ color: value === opt ? "#FFFFFF" : theme.text, fontSize: 13, fontWeight: "500" }}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  );

  const MultiSelectOptions = ({ options, values, onChange }: { options: string[]; values: string[]; onChange: (v: string[]) => void }) => (
    <View style={styles.optionButtons}>
      {options.map((opt) => {
        const selected = values.includes(opt);
        return (
          <Pressable key={opt} style={[styles.optionBtn, { backgroundColor: selected ? theme.primary : theme.backgroundSecondary }]} onPress={() => onChange(selected ? values.filter((v) => v !== opt) : [...values, opt])}>
            <Text style={{ color: selected ? "#FFFFFF" : theme.text, fontSize: 13, fontWeight: "500" }}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );

  const SegmentedControl = ({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) => (
    <View style={styles.segmentedControl}>
      {options.map((opt) => (
        <Pressable key={opt} style={[styles.segmentBtn, { backgroundColor: value === opt ? theme.primary : theme.backgroundSecondary }]} onPress={() => onChange(opt)}>
          <Text style={{ color: value === opt ? "#FFFFFF" : theme.text, fontSize: 13, fontWeight: "500" }}>{opt}</Text>
        </Pressable>
      ))}
    </View>
  );

  const ToggleRow = ({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) => (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: theme.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ false: theme.backgroundSecondary, true: theme.primary }} thumbColor="#FFFFFF" />
    </View>
  );

  const VoiceButton = ({ fieldKey }: { fieldKey: string }) => {
    const active = isRecording && recordingField === fieldKey;
    return (
      <Pressable style={[styles.voiceBtn, styles.voiceBtnSmall, { backgroundColor: active ? TriageColors.red : theme.backgroundSecondary }]} onPressIn={() => startRecording(fieldKey)} onPressOut={stopRecording}>
        <Feather name={active ? "mic" : "mic"} size={14} color={active ? "#FFFFFF" : theme.textMuted} />
      </Pressable>
    );
  };

  const startRecording = async (fieldKey: string) => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) return;
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingField(fieldKey);
    } catch (error) {
      console.error("Failed to start recording:", error);
    }
  };

  const stopRecording = async () => {
    try {
      if (!recordingRef.current) return;
      await recordingRef.current.stopAndUnloadAsync();
      recordingRef.current = null;
      setIsRecording(false);
      setRecordingField(null);
    } catch (error) {
      console.error("Failed to stop recording:", error);
    }
  };

  const ProcedureSection = ({ title, category }: { title: string; category: keyof ProceduresData }) => {
    const items = proceduresData[category];
    const labels: Record<string, string> = {
      cpr: "CPR", intubation: "Endotracheal Intubation", lma: "LMA Insertion", cricothyrotomy: "Cricothyrotomy", bvm: "Bag-Valve-Mask",
      centralLine: "Central Line", peripheralIV: "Peripheral IV", io: "Intraosseous Access", arterialLine: "Arterial Line",
      chestTube: "Chest Tube", needleDecompression: "Needle Decompression", pericardiocentesis: "Pericardiocentesis", thoracentesis: "Thoracentesis",
      lumbarPuncture: "Lumbar Puncture", foleysCatheter: "Foley's Catheter", ngTube: "NG Tube", gastricLavage: "Gastric Lavage",
      suturing: "Wound Suturing", irrigation: "Wound Irrigation", splinting: "Fracture Splinting", jointReduction: "Joint Reduction"
    };
    return (
      <>
        <View style={[styles.procedureHeader, { backgroundColor: theme.backgroundSecondary }]}>
          <Text style={[styles.procedureHeaderText, { color: theme.text }]}>{title}</Text>
        </View>
        {Object.keys(items).map((key) => (
          <Pressable key={key} style={styles.procedureRow} onPress={() => setProceduresData((prev) => ({ ...prev, [category]: { ...prev[category], [key]: !prev[category][key as keyof typeof prev[typeof category]] } }))}>
            <View style={[styles.checkbox, { borderColor: items[key as keyof typeof items] ? theme.primary : theme.border, backgroundColor: items[key as keyof typeof items] ? theme.primary : "transparent" }]}>
              {items[key as keyof typeof items] && <Feather name="check" size={14} color="#FFFFFF" />}
            </View>
            <Text style={[styles.procedureLabel, { color: theme.text }]}>{labels[key] || key}</Text>
          </Pressable>
        ))}
      </>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const ageGroupLabel = patient ? getAgeGroupLabel(getAgeGroup(patient.age)) : "";

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <View style={styles.headerTop}>
          <Pressable style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={[styles.headerTitle, { color: theme.text }]}>Pediatric Case Sheet</Text>
            {lastSaved && <Text style={[styles.savedText, { color: theme.textSecondary }]}>Saved {lastSaved.toLocaleTimeString()}</Text>}
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.palsLabel, { color: TriageColors.blue }]}>PALS</Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabBar}>
          {TABS.map((tab) => (
            <Pressable key={tab.key} style={[styles.tabBtn, { backgroundColor: activeTab === tab.key ? theme.primary : "transparent" }]} onPress={() => setActiveTab(tab.key)}>
              <Feather name={tab.icon as any} size={16} color={activeTab === tab.key ? "#FFFFFF" : theme.textSecondary} />
              <Text style={[styles.tabBtnText, { color: activeTab === tab.key ? "#FFFFFF" : theme.textSecondary }]}>{tab.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <KeyboardAwareScrollViewCompat contentContainerStyle={styles.content}>
        {activeTab === "patient" && patient && (
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <View style={styles.patientHeader}>
              <View style={styles.patientInfo}>
                <Text style={[styles.patientName, { color: theme.text }]}>{patient.name}</Text>
                <Text style={[styles.patientDetails, { color: theme.textSecondary }]}>{patient.age} years, {patient.sex}</Text>
                <Text style={[styles.ageGroupBadge, { color: TriageColors.blue }]}>{ageGroupLabel}</Text>
              </View>
              <View style={[styles.triageBadge, { backgroundColor: getTriageColor(patient.triage_category) }]}>
                <Text style={styles.triageBadgeText}>{patient.triage_category[0]?.toUpperCase()}</Text>
              </View>
            </View>
            {patient.chief_complaint && <Text style={[styles.complaint, { color: theme.textSecondary }]}>Chief Complaint: {patient.chief_complaint}</Text>}
            
            <View style={[styles.vitalsGrid, { backgroundColor: theme.backgroundSecondary }]}>
              <View style={styles.vitalItem}><Text style={[styles.vitalValue, { color: theme.text }]}>{patient.vitals.hr || "--"}</Text><Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>HR</Text></View>
              <View style={styles.vitalItem}><Text style={[styles.vitalValue, { color: theme.text }]}>{patient.vitals.bp_systolic || "--"}/{patient.vitals.bp_diastolic || "--"}</Text><Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>BP</Text></View>
              <View style={styles.vitalItem}><Text style={[styles.vitalValue, { color: theme.text }]}>{patient.vitals.rr || "--"}</Text><Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>RR</Text></View>
              <View style={styles.vitalItem}><Text style={[styles.vitalValue, { color: theme.text }]}>{patient.vitals.spo2 || "--"}%</Text><Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>SpO2</Text></View>
              <View style={styles.vitalItem}><Text style={[styles.vitalValue, { color: theme.text }]}>{patient.vitals.temperature || "--"}</Text><Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>Temp</Text></View>
            </View>

            <View style={styles.infoSection}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Brought By</Text>
              <Text style={[styles.fieldValue, { color: theme.textSecondary }]}>{patient.brought_by || "Not specified"}</Text>
              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Informant</Text>
              <Text style={[styles.fieldValue, { color: theme.textSecondary }]}>{patient.informant_name || "Not specified"}{patient.informant_reliability ? ` (${patient.informant_reliability})` : ""}</Text>
            </View>
          </View>
        )}

        {activeTab === "primary" && (
          <>
            <Pressable style={[styles.markNormalBtn, { backgroundColor: TriageColors.green }]} onPress={markAllAsNormal}>
              <Feather name="check-circle" size={18} color="#FFFFFF" />
              <Text style={styles.markNormalBtnText}>Mark Everything as Normal</Text>
            </Pressable>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Pediatric Assessment Triangle (PAT)</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Quick visual assessment without touching the child</Text>

              <CollapsibleSection title="Appearance" icon="eye" iconColor={TriageColors.blue}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Tone (muscle tone and movement)</Text>
                <OptionButtons options={["Moves spontaneously", "Resists examination", "Sits or stands", "Floppy"]} value={patData.appearance.tone} onChange={(v) => setPatData((p) => ({ ...p, appearance: { ...p.appearance, tone: v } }))} />
                
                <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Interactivity</Text>
                <OptionButtons options={["Alert", "Engaged", "Interacts well", "Reaches for objects", "Unresponsive"]} value={patData.appearance.interactivity} onChange={(v) => setPatData((p) => ({ ...p, appearance: { ...p.appearance, interactivity: v } }))} />
                
                <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Consolability</Text>
                <OptionButtons options={["Stops crying with caregiver", "Inconsolable"]} value={patData.appearance.consolability} onChange={(v) => setPatData((p) => ({ ...p, appearance: { ...p.appearance, consolability: v } }))} />
                
                <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Look or Gaze</Text>
                <OptionButtons options={["Makes eye contact", "Tracks visually", "Normal behavior", "Abnormal behavior"]} value={patData.appearance.lookGaze} onChange={(v) => setPatData((p) => ({ ...p, appearance: { ...p.appearance, lookGaze: v } }))} />
                
                <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Speech/Cry</Text>
                <OptionButtons options={["Age appropriate speech", "Strong cry", "Weak cry", "No cry"]} value={patData.appearance.speechCry} onChange={(v) => setPatData((p) => ({ ...p, appearance: { ...p.appearance, speechCry: v } }))} />
              </CollapsibleSection>

              <CollapsibleSection title="Work of Breathing" icon="wind" iconColor={TriageColors.orange}>
                <OptionButtons options={["Normal", "Increased", "Decreased/Absent"]} value={patData.workOfBreathing} onChange={(v) => setPatData((p) => ({ ...p, workOfBreathing: v }))} />
              </CollapsibleSection>

              <CollapsibleSection title="Circulation to Skin" icon="droplet" iconColor={TriageColors.red}>
                <OptionButtons options={["Pink", "Pale", "Mottled", "Cyanotic"]} value={patData.circulationToSkin} onChange={(v) => setPatData((p) => ({ ...p, circulationToSkin: v }))} />
              </CollapsibleSection>
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>ABCDE Assessment</Text>

              <CollapsibleSection title="A - Airway" icon="activity" iconColor={TriageColors.red}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Cry</Text>
                <OptionButtons options={["Good", "Weak", "No Cry"]} value={airwayData.cry} onChange={(v) => setAirwayData((p) => ({ ...p, cry: v }))} />
                
                <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Airway Status</Text>
                <OptionButtons options={["Patent", "Threatened", "Compromised"]} value={airwayData.status} onChange={(v) => setAirwayData((p) => ({ ...p, status: v }))} />
                
                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Intervention</Text>
                  <VoiceButton fieldKey="airway.intervention" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Airway clearance, repositioning, intubation..." placeholderTextColor={theme.textMuted} value={airwayData.intervention} onChangeText={(v) => setAirwayData((p) => ({ ...p, intervention: v }))} multiline />
              </CollapsibleSection>

              <CollapsibleSection title="B - Breathing" icon="wind" iconColor={TriageColors.orange}>
                <View style={styles.row}>
                  <View style={styles.halfField}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>Respiratory Rate</Text>
                    <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="RR" placeholderTextColor={theme.textMuted} value={breathingData.respiratoryRate} onChangeText={(v) => setBreathingData((p) => ({ ...p, respiratoryRate: v }))} keyboardType="numeric" />
                  </View>
                  <View style={styles.halfField}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>SpO2</Text>
                    <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="%" placeholderTextColor={theme.textMuted} value={breathingData.spo2} onChangeText={(v) => setBreathingData((p) => ({ ...p, spo2: v }))} keyboardType="numeric" />
                  </View>
                </View>

                <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Work of Breathing (WOB) Signs</Text>
                <MultiSelectOptions options={WOB_SIGNS} values={breathingData.workOfBreathing} onChange={(v) => setBreathingData((p) => ({ ...p, workOfBreathing: v }))} />

                <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Abnormal Positioning</Text>
                <OptionButtons options={["None", "Tripod", "Sniffing", "Prefers seated"]} value={breathingData.abnormalPositioning} onChange={(v) => setBreathingData((p) => ({ ...p, abnormalPositioning: v }))} />

                <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Air Entry</Text>
                <OptionButtons options={["Normal", "Abnormal"]} value={breathingData.airEntry} onChange={(v) => setBreathingData((p) => ({ ...p, airEntry: v }))} />

                <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Subcutaneous Emphysema</Text>
                <OptionButtons options={["No", "Yes"]} value={breathingData.subcutaneousEmphysema} onChange={(v) => setBreathingData((p) => ({ ...p, subcutaneousEmphysema: v }))} />

                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Intervention</Text>
                  <VoiceButton fieldKey="breathing.intervention" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="O2 administration, CPAP, intubation..." placeholderTextColor={theme.textMuted} value={breathingData.intervention} onChangeText={(v) => setBreathingData((p) => ({ ...p, intervention: v }))} multiline />
              </CollapsibleSection>

              <CollapsibleSection title="C - Circulation" icon="heart" iconColor={TriageColors.red}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Capillary Refill Time (CRT)</Text>
                <OptionButtons options={["Normal (<2s)", "Delayed (>2s)"]} value={circulationData.crt} onChange={(v) => setCirculationData((p) => ({ ...p, crt: v }))} />

                <View style={styles.row}>
                  <View style={styles.halfField}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>Heart Rate</Text>
                    <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="HR" placeholderTextColor={theme.textMuted} value={circulationData.heartRate} onChangeText={(v) => setCirculationData((p) => ({ ...p, heartRate: v }))} keyboardType="numeric" />
                  </View>
                  <View style={styles.halfField}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>Blood Pressure</Text>
                    <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="BP" placeholderTextColor={theme.textMuted} value={circulationData.bloodPressure} onChangeText={(v) => setCirculationData((p) => ({ ...p, bloodPressure: v }))} />
                  </View>
                </View>

                <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Skin Color and Temperature</Text>
                <OptionButtons options={["Pink", "Pale", "Cyanosed", "Mottled"]} value={circulationData.skinColorTemp} onChange={(v) => setCirculationData((p) => ({ ...p, skinColorTemp: v }))} />

                <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Distended Neck Veins</Text>
                <OptionButtons options={["No", "Yes"]} value={circulationData.distendedNeckVeins} onChange={(v) => setCirculationData((p) => ({ ...p, distendedNeckVeins: v }))} />

                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Intervention</Text>
                  <VoiceButton fieldKey="circulation.intervention" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="IV fluids, medications..." placeholderTextColor={theme.textMuted} value={circulationData.intervention} onChangeText={(v) => setCirculationData((p) => ({ ...p, intervention: v }))} multiline />
              </CollapsibleSection>

              <CollapsibleSection title="D - Disability" icon="zap" iconColor={TriageColors.yellow}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>AVPU/GCS</Text>
                <OptionButtons options={["Alert", "Verbal", "Pain", "Unresponsive"]} value={disabilityData.avpuGcs} onChange={(v) => setDisabilityData((p) => ({ ...p, avpuGcs: v }))} />

                <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Pupils</Text>
                <OptionButtons options={["Equal, round, reactive", "Pinpoint", "Dilated", "Unilaterally dilated"]} value={disabilityData.pupils} onChange={(v) => setDisabilityData((p) => ({ ...p, pupils: v }))} />

                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Abnormal Responses</Text>
                  <VoiceButton fieldKey="disability.abnormalResponses" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Possible causes..." placeholderTextColor={theme.textMuted} value={disabilityData.abnormalResponses} onChangeText={(v) => setDisabilityData((p) => ({ ...p, abnormalResponses: v }))} multiline />

                <Text style={[styles.fieldLabel, { color: theme.text }]}>Glucose (GRBS)</Text>
                <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="mg/dL" placeholderTextColor={theme.textMuted} value={disabilityData.glucose} onChangeText={(v) => setDisabilityData((p) => ({ ...p, glucose: v }))} keyboardType="numeric" />
              </CollapsibleSection>

              <CollapsibleSection title="E - Exposure" icon="thermometer" iconColor={TriageColors.blue}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Temperature</Text>
                <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Check for fever/hypothermia" placeholderTextColor={theme.textMuted} value={exposureData.temperature} onChangeText={(v) => setExposureData((p) => ({ ...p, temperature: v }))} />

                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Trauma</Text>
                  <VoiceButton fieldKey="exposure.trauma" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Logroll to inspect back, assess hidden injuries..." placeholderTextColor={theme.textMuted} value={exposureData.trauma} onChangeText={(v) => setExposureData((p) => ({ ...p, trauma: v }))} multiline />

                <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Signs of Trauma or Illness</Text>
                <MultiSelectOptions options={TRAUMA_ILLNESS_SIGNS} values={exposureData.signsOfTraumaIllness} onChange={(v) => setExposureData((p) => ({ ...p, signsOfTraumaIllness: v }))} />

                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Evidence of Infection or Bleeding</Text>
                  <VoiceButton fieldKey="exposure.evidenceOfInfection" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Petechiae, purpura..." placeholderTextColor={theme.textMuted} value={exposureData.evidenceOfInfection} onChangeText={(v) => setExposureData((p) => ({ ...p, evidenceOfInfection: v }))} multiline />

                <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Long Bone Deformities</Text>
                <OptionButtons options={["No", "Yes"]} value={exposureData.longBoneDeformities} onChange={(v) => setExposureData((p) => ({ ...p, longBoneDeformities: v }))} />

                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Extremities</Text>
                  <VoiceButton fieldKey="exposure.extremities" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Check for deformities, bruising, tenderness..." placeholderTextColor={theme.textMuted} value={exposureData.extremities} onChangeText={(v) => setExposureData((p) => ({ ...p, extremities: v }))} multiline />
              </CollapsibleSection>
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Adjunct: EFAST (If Trauma Suspected)</Text>

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Heart</Text>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Check for pericardial effusion..." placeholderTextColor={theme.textMuted} value={efastData.heart} onChangeText={(v) => setEfastData((p) => ({ ...p, heart: v }))} multiline />

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Abdomen</Text>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Assess for free fluid (hemoperitoneum)..." placeholderTextColor={theme.textMuted} value={efastData.abdomen} onChangeText={(v) => setEfastData((p) => ({ ...p, abdomen: v }))} multiline />

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Lungs</Text>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Check for pleural effusion or pneumothorax..." placeholderTextColor={theme.textMuted} value={efastData.lungs} onChangeText={(v) => setEfastData((p) => ({ ...p, lungs: v }))} multiline />

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Pelvis</Text>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Check for pelvic fractures or injury..." placeholderTextColor={theme.textMuted} value={efastData.pelvis} onChangeText={(v) => setEfastData((p) => ({ ...p, pelvis: v }))} multiline />
            </View>
          </>
        )}

        {activeTab === "history" && (
          <>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Focused History (SAMPLE)</Text>

              <CollapsibleSection title="Signs and Symptoms" icon="alert-circle" iconColor={TriageColors.orange}>
                <ToggleRow label="Breathing difficulty (cough, wheezing, tachypnea)" value={historyData.signsAndSymptoms.breathingDifficulty} onValueChange={(v) => setHistoryData((p) => ({ ...p, signsAndSymptoms: { ...p.signsAndSymptoms, breathingDifficulty: v } }))} />
                <ToggleRow label="Fever, headache, fatigue, abdominal pain" value={historyData.signsAndSymptoms.fever} onValueChange={(v) => setHistoryData((p) => ({ ...p, signsAndSymptoms: { ...p.signsAndSymptoms, fever: v } }))} />
                <ToggleRow label="Vomiting, diarrhea, bleeding, agitation" value={historyData.signsAndSymptoms.vomiting} onValueChange={(v) => setHistoryData((p) => ({ ...p, signsAndSymptoms: { ...p.signsAndSymptoms, vomiting: v } }))} />
                <ToggleRow label="Decreased oral intake, fatigue, irritability" value={historyData.signsAndSymptoms.decreasedOralIntake} onValueChange={(v) => setHistoryData((p) => ({ ...p, signsAndSymptoms: { ...p.signsAndSymptoms, decreasedOralIntake: v } }))} />
                
                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Time Course of Symptoms</Text>
                  <VoiceButton fieldKey="history.timeCourse" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Onset: sudden, gradual..." placeholderTextColor={theme.textMuted} value={historyData.signsAndSymptoms.timeCourse} onChangeText={(v) => setHistoryData((p) => ({ ...p, signsAndSymptoms: { ...p.signsAndSymptoms, timeCourse: v } }))} multiline />
              </CollapsibleSection>

              <CollapsibleSection title="Allergies" icon="alert-triangle" iconColor={TriageColors.red}>
                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Allergies</Text>
                  <VoiceButton fieldKey="history.allergies" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Medications, foods, latex, etc. (include any associated reactions)..." placeholderTextColor={theme.textMuted} value={historyData.allergies} onChangeText={(v) => setHistoryData((p) => ({ ...p, allergies: v }))} multiline />
              </CollapsibleSection>

              <CollapsibleSection title="Medications" icon="package" iconColor={TriageColors.blue}>
                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Current Medications</Text>
                  <VoiceButton fieldKey="history.currentMedications" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Including OTC drugs, vitamins, inhalers..." placeholderTextColor={theme.textMuted} value={historyData.currentMedications} onChangeText={(v) => setHistoryData((p) => ({ ...p, currentMedications: v }))} multiline />

                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Last Dose and Time of Recent Medications</Text>
                  <VoiceButton fieldKey="history.lastDoseMedications" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Drug name, dose, time..." placeholderTextColor={theme.textMuted} value={historyData.lastDoseMedications} onChangeText={(v) => setHistoryData((p) => ({ ...p, lastDoseMedications: v }))} multiline />

                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Medications Found in Child's Environment</Text>
                  <VoiceButton fieldKey="history.medicationsInEnvironment" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Any medications child may have accessed..." placeholderTextColor={theme.textMuted} value={historyData.medicationsInEnvironment} onChangeText={(v) => setHistoryData((p) => ({ ...p, medicationsInEnvironment: v }))} multiline />
              </CollapsibleSection>

              <CollapsibleSection title="Past Medical History" icon="file-text" iconColor={TriageColors.yellow}>
                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Health History</Text>
                  <VoiceButton fieldKey="history.healthHistory" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Premature birth, significant illnesses, hospitalizations..." placeholderTextColor={theme.textMuted} value={historyData.healthHistory} onChangeText={(v) => setHistoryData((p) => ({ ...p, healthHistory: v }))} multiline />

                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Underlying Conditions</Text>
                  <VoiceButton fieldKey="history.underlyingConditions" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Asthma, diabetes, heart disease, etc..." placeholderTextColor={theme.textMuted} value={historyData.underlyingConditions} onChangeText={(v) => setHistoryData((p) => ({ ...p, underlyingConditions: v }))} multiline />

                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Immunization Status</Text>
                  <VoiceButton fieldKey="history.immunizationStatus" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Past surgeries and immunization status..." placeholderTextColor={theme.textMuted} value={historyData.immunizationStatus} onChangeText={(v) => setHistoryData((p) => ({ ...p, immunizationStatus: v }))} multiline />
              </CollapsibleSection>

              <CollapsibleSection title="Last Meal" icon="coffee" iconColor={TriageColors.green}>
                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Last Oral Intake</Text>
                  <VoiceButton fieldKey="history.lastMeal" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Time and nature of last intake (liquid/food), especially important for anesthesia or intubation..." placeholderTextColor={theme.textMuted} value={historyData.lastMeal} onChangeText={(v) => setHistoryData((p) => ({ ...p, lastMeal: v }))} multiline />

                {patient?.sex?.toLowerCase() === "female" && (
                  <>
                    <View style={styles.fieldWithVoice}>
                      <Text style={[styles.fieldLabel, { color: theme.text }]}>LMP (Last Menstrual Period)</Text>
                      <VoiceButton fieldKey="history.lmp" />
                    </View>
                    <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="LMP date (e.g., 15 days back, 10/01/2025)" placeholderTextColor={theme.textMuted} value={historyData.lmp} onChangeText={(v) => setHistoryData((p) => ({ ...p, lmp: v }))} />
                  </>
                )}
              </CollapsibleSection>

              <CollapsibleSection title="Events" icon="clock" iconColor={TriageColors.orange}>
                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Events Leading to Current Illness/Injury</Text>
                  <VoiceButton fieldKey="history.events" />
                </View>
                <TextInput style={[styles.textAreaLarge, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Onset of symptoms, trauma, or injury..." placeholderTextColor={theme.textMuted} value={historyData.events} onChangeText={(v) => setHistoryData((p) => ({ ...p, events: v }))} multiline />

                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Treatment Before Arrival</Text>
                  <VoiceButton fieldKey="history.treatmentBeforeArrival" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Treatment provided during the interval between the event and presentation..." placeholderTextColor={theme.textMuted} value={historyData.treatmentBeforeArrival} onChangeText={(v) => setHistoryData((p) => ({ ...p, treatmentBeforeArrival: v }))} multiline />
              </CollapsibleSection>
            </View>
          </>
        )}

        {activeTab === "exam" && (
          <>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Focused Physical Examination</Text>

              <CollapsibleSection title="HEENT" icon="eye" iconColor={TriageColors.blue}>
                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Head</Text>
                  <VoiceButton fieldKey="exam.heent.head" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Inspect the head..." placeholderTextColor={theme.textMuted} value={examData.heent.head} onChangeText={(v) => setExamData((p) => ({ ...p, heent: { ...p.heent, head: v } }))} multiline />

                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Eyes</Text>
                  <VoiceButton fieldKey="exam.heent.eyes" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Examine the eyes..." placeholderTextColor={theme.textMuted} value={examData.heent.eyes} onChangeText={(v) => setExamData((p) => ({ ...p, heent: { ...p.heent, eyes: v } }))} multiline />

                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Ears</Text>
                  <VoiceButton fieldKey="exam.heent.ears" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Check the ears..." placeholderTextColor={theme.textMuted} value={examData.heent.ears} onChangeText={(v) => setExamData((p) => ({ ...p, heent: { ...p.heent, ears: v } }))} multiline />

                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Nose</Text>
                  <VoiceButton fieldKey="exam.heent.nose" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Examine the nose..." placeholderTextColor={theme.textMuted} value={examData.heent.nose} onChangeText={(v) => setExamData((p) => ({ ...p, heent: { ...p.heent, nose: v } }))} multiline />

                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Throat</Text>
                  <VoiceButton fieldKey="exam.heent.throat" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Evaluate the throat, palpate thyroid..." placeholderTextColor={theme.textMuted} value={examData.heent.throat} onChangeText={(v) => setExamData((p) => ({ ...p, heent: { ...p.heent, throat: v } }))} multiline />

                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Lymph Nodes</Text>
                  <VoiceButton fieldKey="exam.heent.lymphNodes" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Palpate lymph nodes..." placeholderTextColor={theme.textMuted} value={examData.heent.lymphNodes} onChangeText={(v) => setExamData((p) => ({ ...p, heent: { ...p.heent, lymphNodes: v } }))} multiline />
              </CollapsibleSection>

              <CollapsibleSection title="Respiratory System" icon="wind" iconColor={TriageColors.orange}>
                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Respiratory Exam</Text>
                  <VoiceButton fieldKey="exam.respiratory" />
                </View>
                <TextInput style={[styles.textAreaLarge, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Chest inspection, listen for abnormal breathing sounds (stridor, wheezing, crackles), check for nasal obstruction, retractions, abnormal chest movement..." placeholderTextColor={theme.textMuted} value={examData.respiratory} onChangeText={(v) => setExamData((p) => ({ ...p, respiratory: v }))} multiline />
              </CollapsibleSection>

              <CollapsibleSection title="Cardiovascular" icon="heart" iconColor={TriageColors.red}>
                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Cardiovascular Exam</Text>
                  <VoiceButton fieldKey="exam.cardiovascular" />
                </View>
                <TextInput style={[styles.textAreaLarge, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Check for signs of heart failure (gallop rhythm, crackles, peripheral edema). Also check signs of poor perfusion like cyanosis, feeble pulse, cold extremities, flushed skin..." placeholderTextColor={theme.textMuted} value={examData.cardiovascular} onChangeText={(v) => setExamData((p) => ({ ...p, cardiovascular: v }))} multiline />
              </CollapsibleSection>

              <CollapsibleSection title="Abdomen" icon="circle" iconColor={TriageColors.yellow}>
                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Abdominal Exam</Text>
                  <VoiceButton fieldKey="exam.abdomen" />
                </View>
                <TextInput style={[styles.textAreaLarge, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Check for tenderness, distension, or signs of injury and hepatomegaly..." placeholderTextColor={theme.textMuted} value={examData.abdomen} onChangeText={(v) => setExamData((p) => ({ ...p, abdomen: v }))} multiline />
              </CollapsibleSection>

              <CollapsibleSection title="Back" icon="maximize" iconColor={TriageColors.blue}>
                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Back Exam</Text>
                  <VoiceButton fieldKey="exam.back" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Check for any signs of spine or vertebral injury..." placeholderTextColor={theme.textMuted} value={examData.back} onChangeText={(v) => setExamData((p) => ({ ...p, back: v }))} multiline />
              </CollapsibleSection>

              <CollapsibleSection title="Extremities" icon="move" iconColor={TriageColors.green}>
                <View style={styles.fieldWithVoice}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>Extremities Exam</Text>
                  <VoiceButton fieldKey="exam.extremities" />
                </View>
                <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Assess for fractures, swelling, bruising, or deformities..." placeholderTextColor={theme.textMuted} value={examData.extremities} onChangeText={(v) => setExamData((p) => ({ ...p, extremities: v }))} multiline />
              </CollapsibleSection>
            </View>
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
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="e.g., respiratory distress, dehydration, head injury, trauma, sepsis, respiratory failure..." placeholderTextColor={theme.textMuted} value={treatmentData.primaryDiagnosis} onChangeText={(v) => setTreatmentData((prev) => ({ ...prev, primaryDiagnosis: v }))} multiline />

              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Differential Diagnoses</Text>
                <VoiceButton fieldKey="treatment.differentialDiagnoses" />
              </View>
              <TextInput style={[styles.textAreaLarge, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Other possibilities based on primary and secondary assessments..." placeholderTextColor={theme.textMuted} value={treatmentData.differentialDiagnoses} onChangeText={(v) => setTreatmentData((prev) => ({ ...prev, differentialDiagnoses: v }))} multiline />
            </View>

            <View style={styles.actionButtonsRow}>
              <Pressable style={[styles.actionBtn, { backgroundColor: "#FEE2E2" }]}>
                <Feather name="alert-triangle" size={18} color={TriageColors.red} />
                <Text style={[styles.actionBtnText, { color: TriageColors.red }]}>Red Flags</Text>
              </Pressable>
              <Pressable style={[styles.actionBtn, { backgroundColor: "#E0E7FF" }]}>
                <Feather name="zap" size={18} color={theme.primary} />
                <Text style={[styles.actionBtnText, { color: theme.primary }]}>AI Diagnosis</Text>
              </Pressable>
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Treatment Given</Text>
              
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Medications (Pediatric Formulary)</Text>
              <Pressable style={[styles.addDrugBtn, { backgroundColor: TriageColors.green }]}>
                <Feather name="plus" size={18} color="#FFFFFF" />
                <Text style={styles.addDrugBtnText}>Add Drug from List</Text>
              </Pressable>

              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Other Medications</Text>
                <VoiceButton fieldKey="treatment.otherMedications" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Additional drugs not in list..." placeholderTextColor={theme.textMuted} value={treatmentData.otherMedications} onChangeText={(v) => setTreatmentData((prev) => ({ ...prev, otherMedications: v }))} multiline />

              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>IV Fluids</Text>
                <VoiceButton fieldKey="treatment.ivFluids" />
              </View>
              <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="NS, RL, etc..." placeholderTextColor={theme.textMuted} value={treatmentData.ivFluids} onChangeText={(v) => setTreatmentData((prev) => ({ ...prev, ivFluids: v }))} />
            </View>

            <View style={[styles.card, { backgroundColor: theme.card, borderLeftWidth: 4, borderLeftColor: "#9333EA" }]}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md }}>
                <View>
                  <Text style={[styles.cardTitle, { color: theme.text, marginBottom: 2 }]}>Infusions / Drips</Text>
                  <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>IV medications with continuous rate</Text>
                </View>
                <Pressable
                  style={[styles.addDrugBtn, { backgroundColor: "#9333EA", paddingHorizontal: 12, paddingVertical: 8 }]}
                  onPress={() => {
                    const newInfusion: InfusionEntry = { id: Date.now().toString(), name: "", dose: "", dilution: "", rate: "" };
                    setTreatmentData((prev) => ({ ...prev, infusions: [...prev.infusions, newInfusion] }));
                  }}
                >
                  <Feather name="plus" size={16} color="#FFFFFF" />
                  <Text style={[styles.addDrugBtnText, { fontSize: 13 }]}>Add Infusion</Text>
                </Pressable>
              </View>

              {treatmentData.infusions.map((infusion, index) => (
                <View key={infusion.id} style={{ backgroundColor: theme.backgroundSecondary, borderRadius: 12, padding: Spacing.md, marginBottom: Spacing.sm }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm }}>
                    <Text style={[styles.fieldLabel, { color: "#9333EA", fontWeight: "600" }]}>Infusion #{index + 1}</Text>
                    <Pressable
                      onPress={() => setTreatmentData((prev) => ({ ...prev, infusions: prev.infusions.filter((i) => i.id !== infusion.id) }))}
                      style={{ padding: 6 }}
                    >
                      <Feather name="trash-2" size={18} color={TriageColors.red} />
                    </Pressable>
                  </View>
                  <Text style={[styles.fieldLabel, { color: theme.text, marginBottom: 4 }]}>Drug Name</Text>
                  <TextInput
                    style={[styles.inputField, { backgroundColor: theme.card, color: theme.text, marginBottom: Spacing.sm }]}
                    placeholder="e.g., Dopamine, Noradrenaline..."
                    placeholderTextColor={theme.textMuted}
                    value={infusion.name}
                    onChangeText={(v) => setTreatmentData((prev) => ({ ...prev, infusions: prev.infusions.map((i) => i.id === infusion.id ? { ...i, name: v } : i) }))}
                  />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: theme.text, marginBottom: 4, fontSize: 12 }]}>Dose</Text>
                      <TextInput
                        style={[styles.inputField, { backgroundColor: theme.card, color: theme.text }]}
                        placeholder="e.g., 5 mcg/kg/min"
                        placeholderTextColor={theme.textMuted}
                        value={infusion.dose}
                        onChangeText={(v) => setTreatmentData((prev) => ({ ...prev, infusions: prev.infusions.map((i) => i.id === infusion.id ? { ...i, dose: v } : i) }))}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fieldLabel, { color: theme.text, marginBottom: 4, fontSize: 12 }]}>Dilution</Text>
                      <TextInput
                        style={[styles.inputField, { backgroundColor: theme.card, color: theme.text }]}
                        placeholder="e.g., in 50ml NS"
                        placeholderTextColor={theme.textMuted}
                        value={infusion.dilution}
                        onChangeText={(v) => setTreatmentData((prev) => ({ ...prev, infusions: prev.infusions.map((i) => i.id === infusion.id ? { ...i, dilution: v } : i) }))}
                      />
                    </View>
                  </View>
                  <View style={{ marginTop: Spacing.sm }}>
                    <Text style={[styles.fieldLabel, { color: theme.text, marginBottom: 4, fontSize: 12 }]}>Rate</Text>
                    <TextInput
                      style={[styles.inputField, { backgroundColor: theme.card, color: theme.text }]}
                      placeholder="e.g., 5 ml/hr"
                      placeholderTextColor={theme.textMuted}
                      value={infusion.rate}
                      onChangeText={(v) => setTreatmentData((prev) => ({ ...prev, infusions: prev.infusions.map((i) => i.id === infusion.id ? { ...i, rate: v } : i) }))}
                    />
                  </View>
                </View>
              ))}

              {treatmentData.infusions.length === 0 && (
                <View style={{ padding: Spacing.lg, alignItems: "center" }}>
                  <Text style={{ color: theme.textMuted, fontStyle: "italic" }}>No infusions added yet</Text>
                </View>
              )}
            </View>

            <Pressable style={[styles.addAddendumBtn, { borderColor: theme.border }]}>
              <Feather name="plus" size={18} color={theme.primary} />
              <Text style={[styles.addAddendumBtnText, { color: theme.primary }]}>Add Addendum Note</Text>
            </Pressable>
          </>
        )}

        {activeTab === "notes" && (
          <>
            <VoiceRecorder
              onExtractedData={handleVoiceExtraction}
              patientContext={{
                age: patient?.age,
                sex: patient?.sex,
                chiefComplaint: patient?.chief_complaint,
              }}
              mode="full"
            />

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Procedures Performed</Text>
              <Text style={[styles.cardSubtitle, { color: theme.textSecondary }]}>Select all procedures performed and add notes</Text>
              
              <ProcedureSection title="Resuscitation" category="resuscitation" />
              <ProcedureSection title="Airway" category="airway" />
              <ProcedureSection title="Vascular" category="vascular" />
              <ProcedureSection title="Chest" category="chest" />
              <ProcedureSection title="Neuro" category="neuro" />
              <ProcedureSection title="GU" category="gu" />
              <ProcedureSection title="GI" category="gi" />
              <ProcedureSection title="Wound" category="wound" />
              <ProcedureSection title="Ortho" category="ortho" />
            </View>
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

              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Condition at Time of Shift</Text>
              <OptionButtons options={["Stable", "Unstable"]} value={dispositionData.conditionAtShift} onChange={(v) => setDispositionData((p) => ({ ...p, conditionAtShift: v }))} />
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Observation in ER</Text>
              
              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>ER Observation Notes</Text>
                <VoiceButton fieldKey="erObservationNotes" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Course in ER, response to treatment, changes in condition..." placeholderTextColor={theme.textMuted} value={dispositionData.erObservationNotes} onChangeText={(v) => setDispositionData((prev) => ({ ...prev, erObservationNotes: v }))} multiline />

              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>Duration in ER</Text>
              <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="e.g., 4 hours" placeholderTextColor={theme.textMuted} value={dispositionData.durationInER} onChangeText={(v) => setDispositionData((prev) => ({ ...prev, durationInER: v }))} />
            </View>

            <View style={[styles.card, { backgroundColor: theme.card }]}>
              <Text style={[styles.cardTitle, { color: theme.text }]}>Staff</Text>
              
              <Text style={[styles.fieldLabel, { color: theme.text }]}>EM Resident</Text>
              <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Resident name" placeholderTextColor={theme.textMuted} value={dispositionData.emResident} onChangeText={(v) => setDispositionData((prev) => ({ ...prev, emResident: v }))} />

              <Text style={[styles.fieldLabel, { color: theme.text, marginTop: Spacing.md }]}>EM Consultant</Text>
              <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Consultant name" placeholderTextColor={theme.textMuted} value={dispositionData.emConsultant} onChangeText={(v) => setDispositionData((prev) => ({ ...prev, emConsultant: v }))} />
            </View>

            <Pressable style={[styles.generateSummaryBtn, { backgroundColor: theme.primary }]}>
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
  palsLabel: { ...Typography.bodyMedium, fontWeight: "700" },
  tabBar: { paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingVertical: Spacing.sm },
  tabBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, gap: Spacing.xs },
  tabBtnText: { fontSize: 13, fontWeight: "600" },
  content: { padding: Spacing.lg },
  markNormalBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm, marginBottom: Spacing.lg },
  markNormalBtnText: { color: "#FFFFFF", ...Typography.bodyMedium, fontWeight: "600" },
  card: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  cardTitle: { ...Typography.h4, marginBottom: Spacing.lg },
  cardSubtitle: { ...Typography.body, marginBottom: Spacing.md, marginTop: -Spacing.sm },
  patientHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  patientInfo: { flex: 1 },
  patientName: { ...Typography.h3 },
  patientDetails: { ...Typography.body, marginTop: 2 },
  ageGroupBadge: { ...Typography.small, fontWeight: "600", marginTop: 4 },
  triageBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginLeft: Spacing.md },
  triageBadgeText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  complaint: { ...Typography.small, marginTop: Spacing.sm, fontStyle: "italic" },
  vitalsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.md, marginTop: Spacing.md, padding: Spacing.md, borderRadius: BorderRadius.md },
  vitalItem: { alignItems: "center", minWidth: 50 },
  vitalValue: { ...Typography.bodyMedium, fontWeight: "600" },
  vitalLabel: { ...Typography.small },
  infoSection: { marginTop: Spacing.lg },
  fieldWithVoice: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.md, marginBottom: Spacing.sm },
  fieldLabel: { ...Typography.bodyMedium },
  fieldValue: { ...Typography.body },
  voiceBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  voiceBtnSmall: { width: 28, height: 28, borderRadius: 14 },
  inputField: { height: 48, paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md, ...Typography.body },
  textArea: { minHeight: 80, padding: Spacing.md, borderRadius: BorderRadius.md, textAlignVertical: "top", ...Typography.body },
  textAreaLarge: { minHeight: 120, padding: Spacing.md, borderRadius: BorderRadius.md, textAlignVertical: "top", ...Typography.body },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.sm },
  toggleLabel: { ...Typography.body, flex: 1, marginRight: Spacing.md },
  segmentedControl: { flexDirection: "row", gap: Spacing.sm },
  segmentBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: "center", borderRadius: BorderRadius.md },
  row: { flexDirection: "row", gap: Spacing.md },
  halfField: { flex: 1 },
  optionButtons: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  optionBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  actionButtonsRow: { flexDirection: "row", gap: Spacing.md, marginTop: Spacing.lg },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm },
  actionBtnText: { ...Typography.bodyMedium, fontWeight: "600" },
  addDrugBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm, marginTop: Spacing.sm, marginBottom: Spacing.md },
  addDrugBtnText: { color: "#FFFFFF", ...Typography.bodyMedium, fontWeight: "600" },
  addAddendumBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, borderStyle: "dashed", gap: Spacing.sm, marginTop: Spacing.md },
  addAddendumBtnText: { ...Typography.bodyMedium, fontWeight: "500" },
  procedureHeader: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, marginTop: Spacing.md },
  procedureHeaderText: { ...Typography.bodyMedium, fontWeight: "600" },
  procedureRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.md, paddingHorizontal: Spacing.md, gap: Spacing.md },
  checkbox: { width: 22, height: 22, borderWidth: 2, borderRadius: 4, justifyContent: "center", alignItems: "center" },
  procedureLabel: { ...Typography.body, flex: 1 },
  dispositionOptions: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginTop: Spacing.sm },
  dispositionBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.md },
  generateSummaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.lg, borderRadius: BorderRadius.md, gap: Spacing.sm, marginTop: Spacing.lg },
  generateSummaryBtnText: { color: "#FFFFFF", ...Typography.bodyMedium, fontWeight: "600" },
  saveDashboardBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.lg, borderRadius: BorderRadius.md, borderWidth: 1, gap: Spacing.sm, marginTop: Spacing.md },
  saveDashboardBtnText: { ...Typography.bodyMedium, fontWeight: "600" },
  bottomNav: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, paddingTop: Spacing.md, borderTopWidth: 1, gap: Spacing.sm },
  navBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.xs },
  prevBtn: { flex: 1 },
  navBtnText: { ...Typography.bodyMedium },
  saveNavBtn: { paddingHorizontal: Spacing.lg },
  saveNavBtnText: { color: "#FFFFFF", ...Typography.bodyMedium },
  nextBtn: { flex: 1.5 },
  nextBtnText: { color: "#FFFFFF", ...Typography.bodyMedium, fontWeight: "600" },
});
