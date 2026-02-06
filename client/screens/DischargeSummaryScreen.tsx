import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  Share,
  Platform,
  ScrollView,
  Switch,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { useTheme } from "@/hooks/useTheme";
import { apiGet, apiPatch, apiPost, apiPut, invalidateCases } from "@/lib/api";
import { getCachedCaseData, mergeCaseWithCache, cacheDischargeSummary } from "@/lib/caseCache";
import { getApiUrl } from "@/lib/query-client";
import { isPediatric } from "@/lib/pediatricVitals";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, "DischargeSummary">;

interface DischargeSummaryData {
  mlc: boolean;
  allergy: string;
  vitals_arrival: {
    hr: string;
    bp: string;
    rr: string;
    spo2: string;
    gcs: string;
    pain_score: string;
    grbs: string;
    temp: string;
  };
  presenting_complaint: string;
  history_of_present_illness: string;
  past_medical_history: string;
  family_history: string;
  lmp: string;
  primary_assessment: {
    airway: string;
    breathing: string;
    circulation: string;
    disability: string;
    exposure: string;
    efast: string;
  };
  secondary_assessment: {
    pallor: boolean;
    icterus: boolean;
    cyanosis: boolean;
    clubbing: boolean;
    lymphadenopathy: boolean;
    edema: boolean;
  };
  systemic_exam: {
    chest: string;
    cvs: string;
    pa: string;
    cns: string;
    extremities: string;
  };
  course_in_hospital: string;
  investigations: string;
  diagnosis: string;
  discharge_medications: string;
  disposition_type: string;
  condition_at_discharge: string;
  vitals_discharge: {
    hr: string;
    bp: string;
    rr: string;
    spo2: string;
    gcs: string;
    pain_score: string;
    grbs: string;
    temp: string;
  };
  follow_up_advice: string;
  ed_resident: string;
  ed_consultant: string;
  sign_time_resident: string;
  sign_time_consultant: string;
  discharge_date: string;
}

const defaultSummary: DischargeSummaryData = {
  mlc: false,
  allergy: "No known allergies",
  vitals_arrival: { hr: "", bp: "", rr: "", spo2: "", gcs: "", pain_score: "", grbs: "", temp: "" },
  presenting_complaint: "",
  history_of_present_illness: "",
  past_medical_history: "",
  family_history: "",
  lmp: "",
  primary_assessment: { airway: "", breathing: "", circulation: "", disability: "", exposure: "", efast: "" },
  secondary_assessment: { pallor: false, icterus: false, cyanosis: false, clubbing: false, lymphadenopathy: false, edema: false },
  systemic_exam: { chest: "", cvs: "", pa: "", cns: "", extremities: "" },
  course_in_hospital: "",
  investigations: "",
  diagnosis: "",
  discharge_medications: "",
  disposition_type: "Normal Discharge",
  condition_at_discharge: "STABLE",
  vitals_discharge: { hr: "", bp: "", rr: "", spo2: "", gcs: "", pain_score: "", grbs: "", temp: "" },
  follow_up_advice: "",
  ed_resident: "",
  ed_consultant: "",
  sign_time_resident: "",
  sign_time_consultant: "",
  discharge_date: new Date().toLocaleDateString(),
};

export default function DischargeSummaryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { caseId } = route.params;

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [caseData, setCaseData] = useState<any>(null);
  const summaryRef = useRef<DischargeSummaryData>({ ...defaultSummary });
  const [updateCounter, setUpdateCounter] = useState(0);
  const [courseInHospitalKey, setCourseInHospitalKey] = useState(0);
  const forceUpdate = () => setUpdateCounter(c => c + 1);

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const loadCase = async () => {
    try {
      const res = await apiGet<any>(`/cases/${caseId}`);
      if (res.success && res.data) {
        const cached = await getCachedCaseData(caseId);
        const mergedData = cached ? mergeCaseWithCache(res.data, cached) : res.data;
        setCaseData(mergedData);
        populateFromCaseData(mergedData);
      }
    } catch (err) {
      console.error("Error loading case:", err);
    } finally {
      setLoading(false);
    }
  };

  const populateFromCaseData = (data: any) => {
    const vitals = data.vitals_at_arrival || data.vitals || {};
    const abcde = data.abcde || {};
    const patient = data.patient || {};
    const triage = data.triage || {};
    const treatment = data.treatment || {};
    const disposition = data.disposition || {};
    const exam = data.examination || {};
    const sample = data.sample || {};
    const history = data.history || {};
    const primaryAssessment = data.primary_assessment || {};
    const savedSummary = data.discharge_summary || {};

    const gcsE = vitals.gcs_e || primaryAssessment.disability_gcs_e || 4;
    const gcsV = vitals.gcs_v || primaryAssessment.disability_gcs_v || 5;
    const gcsM = vitals.gcs_m || primaryAssessment.disability_gcs_m || 6;
    const gcsTotal = vitals.gcs_total || (gcsE + gcsV + gcsM);

    const autoMeds = formatMedications(treatment.medications || data.medications);
    const autoInfusions = formatInfusions(treatment.infusions);
    const autoFluids = formatFluids(treatment.fluids);
    const addendumNotes = data.treatment?.addendum_notes || data.addendum_notes || [];
    const notesList = Array.isArray(addendumNotes) ? addendumNotes : (addendumNotes ? [addendumNotes] : []);
    const autoCourseInHospital = buildCourseInHospital(autoMeds, autoInfusions, autoFluids, notesList, treatment);

    summaryRef.current = {
      ...defaultSummary,
      mlc: savedSummary.mlc ?? data.mlc ?? false,
      allergy: savedSummary.allergy || sample.allergies || history.allergies?.join(", ") || patient.allergies || triage.allergies || "No known allergies",
      vitals_arrival: savedSummary.vitals_arrival || {
        hr: vitals.hr?.toString() || vitals.heart_rate?.toString() || primaryAssessment.circulation_hr?.toString() || "",
        bp: `${vitals.bp_systolic || primaryAssessment.circulation_bp_systolic || ""}/${vitals.bp_diastolic || primaryAssessment.circulation_bp_diastolic || ""}`,
        rr: vitals.rr?.toString() || vitals.respiratory_rate?.toString() || primaryAssessment.breathing_rr?.toString() || "",
        spo2: vitals.spo2?.toString() || vitals.oxygen_saturation?.toString() || primaryAssessment.breathing_spo2?.toString() || "",
        gcs: gcsTotal.toString(),
        pain_score: vitals.pain_score?.toString() || "",
        grbs: vitals.grbs?.toString() || vitals.blood_glucose?.toString() || primaryAssessment.disability_grbs?.toString() || "",
        temp: vitals.temperature?.toString() || primaryAssessment.exposure_temperature?.toString() || "",
      },
      presenting_complaint: savedSummary.presenting_complaint || data.presenting_complaint?.text || triage.chief_complaint || "",
      history_of_present_illness: savedSummary.history_of_present_illness || history.hpi || history.events_hopi || sample.eventsHopi || data.history_of_present_illness || triage.history || "",
      past_medical_history: savedSummary.past_medical_history || history.past_medical?.join(", ") || sample.pastMedicalHistory || patient.past_medical_history || triage.past_medical_history || "",
      family_history: savedSummary.family_history || patient.family_history || "",
      lmp: savedSummary.lmp || history.last_meal_lmp || sample.lastMeal || patient.lmp || "",
      primary_assessment: savedSummary.primary_assessment || {
        airway: formatAirwayFromData(abcde.airway, primaryAssessment),
        breathing: formatBreathingFromData(abcde.breathing, vitals, primaryAssessment),
        circulation: formatCirculationFromData(abcde.circulation, primaryAssessment),
        disability: formatDisabilityFromData(abcde.disability, primaryAssessment, gcsTotal),
        exposure: formatExposureFromData(abcde.exposure, primaryAssessment),
        efast: data.adjuncts?.efast_notes || abcde.efast || "",
      },
      secondary_assessment: savedSummary.secondary_assessment || {
        pallor: exam.general_pallor || exam.general?.pallor || false,
        icterus: exam.general_icterus || exam.general?.icterus || false,
        cyanosis: exam.general_cyanosis || exam.general?.cyanosis || false,
        clubbing: exam.general_clubbing || exam.general?.clubbing || false,
        lymphadenopathy: exam.general_lymphadenopathy || exam.general?.lymphadenopathy || false,
        edema: exam.general_edema || exam.general?.edema || false,
      },
      systemic_exam: savedSummary.systemic_exam || {
        chest: formatSystemicExam("respiratory", exam),
        cvs: formatSystemicExam("cvs", exam),
        pa: formatSystemicExam("abdomen", exam),
        cns: formatSystemicExam("cns", exam),
        extremities: formatSystemicExam("extremities", exam),
      },
      course_in_hospital: savedSummary.course_in_hospital || autoCourseInHospital,
      investigations: savedSummary.investigations || formatInvestigations(treatment.investigations || data.investigations),
      diagnosis: savedSummary.diagnosis || treatment.primary_diagnosis || treatment.provisional_diagnosis || treatment.ai_diagnosis || data.final_diagnosis || data.treatment?.primary_diagnosis || "",
      discharge_medications: savedSummary.discharge_medications || "",
      disposition_type: savedSummary.disposition_type || disposition.type || disposition.disposition_type || "Normal Discharge",
      condition_at_discharge: savedSummary.condition_at_discharge || disposition.condition || disposition.condition_at_discharge || "STABLE",
      vitals_discharge: savedSummary.vitals_discharge || { hr: "", bp: "", rr: "", spo2: "", gcs: "", pain_score: "", grbs: "", temp: "" },
      follow_up_advice: savedSummary.follow_up_advice || disposition.follow_up || disposition.follow_up_instructions || "",
      ed_resident: savedSummary.ed_resident || data.em_resident || "",
      ed_consultant: savedSummary.ed_consultant || "",
      sign_time_resident: savedSummary.sign_time_resident || "",
      sign_time_consultant: savedSummary.sign_time_consultant || "",
      discharge_date: savedSummary.discharge_date || new Date().toLocaleDateString(),
    };

    if (savedSummary.course_in_hospital) {
      setCourseInHospitalKey(k => k + 1);
    }

    forceUpdate();
  };

  const formatAirway = (airway: any): string => {
    if (!airway) return "";
    const status = airway.status || "";
    const intervention = airway.intervention || "";
    return `${status}${intervention ? `, Intervention: ${intervention}` : ""}`;
  };

  const formatBreathing = (breathing: any, vitals: any): string => {
    if (!breathing && !vitals) return "";
    const parts = [];
    if (breathing?.work_of_breathing) parts.push(`WOB: ${breathing.work_of_breathing}`);
    if (breathing?.air_entry) parts.push(`Air Entry: ${breathing.air_entry}`);
    if (vitals?.spo2) parts.push(`SpO2: ${vitals.spo2}%`);
    if (breathing?.intervention) parts.push(`Intervention: ${breathing.intervention}`);
    return parts.join(", ");
  };

  const formatCirculation = (circulation: any): string => {
    if (!circulation) return "";
    const parts = [];
    if (circulation.crt) parts.push(`CRT: ${circulation.crt}`);
    if (circulation.pulse_quality) parts.push(`Pulse: ${circulation.pulse_quality}`);
    if (circulation.skin_color) parts.push(`Skin: ${circulation.skin_color}`);
    if (circulation.intervention) parts.push(`Intervention: ${circulation.intervention}`);
    return parts.join(", ");
  };

  const formatDisability = (disability: any): string => {
    if (!disability) return "";
    const parts = [];
    if (disability.avpu) parts.push(`AVPU: ${disability.avpu}`);
    if (disability.gcs) parts.push(`GCS: ${disability.gcs}`);
    if (disability.pupils) parts.push(`Pupils: ${disability.pupils}`);
    if (disability.grbs) parts.push(`GRBS: ${disability.grbs}`);
    return parts.join(", ");
  };

  const formatExposure = (exposure: any): string => {
    if (!exposure) return "";
    const parts = [];
    if (exposure.temperature) parts.push(`Temp: ${exposure.temperature}°C`);
    if (exposure.trauma) parts.push(`Trauma: ${exposure.trauma}`);
    if (exposure.logroll) parts.push(`Logroll: ${exposure.logroll}`);
    return parts.join(", ");
  };

  const formatAirwayFromData = (abcdeAirway: any, primaryAssessment: any): string => {
    const parts = [];
    const status = abcdeAirway?.abcdeStatus || (abcdeAirway?.status ? "Abnormal" : "Normal");
    if (status === "Normal") {
      return "Patent, self-maintained, no obstruction";
    }
    if (abcdeAirway?.status) parts.push(abcdeAirway.status);
    if (abcdeAirway?.maintenance) parts.push(abcdeAirway.maintenance);
    if (primaryAssessment?.airway_status) parts.push(primaryAssessment.airway_status);
    if (abcdeAirway?.interventions?.length) parts.push(`Interventions: ${abcdeAirway.interventions.join(", ")}`);
    if (abcdeAirway?.notes) parts.push(abcdeAirway.notes);
    return parts.length > 0 ? parts.join(", ") : "Patent";
  };

  const formatBreathingFromData = (abcdeBreathing: any, vitals: any, primaryAssessment: any): string => {
    const parts = [];
    const status = abcdeBreathing?.abcdeStatus || "Normal";
    const rr = vitals?.rr || primaryAssessment?.breathing_rr || abcdeBreathing?.rr;
    const spo2 = vitals?.spo2 || primaryAssessment?.breathing_spo2 || abcdeBreathing?.spo2;
    if (rr) parts.push(`RR: ${rr}/min`);
    if (spo2) parts.push(`SpO2: ${spo2}%`);
    if (status === "Normal") {
      parts.push("Effortless, bilateral air entry");
    } else {
      if (abcdeBreathing?.effort) parts.push(`WOB: ${abcdeBreathing.effort}`);
      if (abcdeBreathing?.airEntry) parts.push(`Air Entry: ${abcdeBreathing.airEntry}`);
      if (abcdeBreathing?.o2Device) parts.push(`O2: ${abcdeBreathing.o2Device}`);
    }
    return parts.join(", ");
  };

  const formatCirculationFromData = (abcdeCirculation: any, primaryAssessment: any): string => {
    const parts = [];
    const status = abcdeCirculation?.abcdeStatus || "Normal";
    const hr = abcdeCirculation?.hr || primaryAssessment?.circulation_hr;
    const bpSys = abcdeCirculation?.bpSystolic || primaryAssessment?.circulation_bp_systolic;
    const bpDia = abcdeCirculation?.bpDiastolic || primaryAssessment?.circulation_bp_diastolic;
    if (hr) parts.push(`HR: ${hr} bpm`);
    if (bpSys && bpDia) parts.push(`BP: ${bpSys}/${bpDia} mmHg`);
    if (status === "Normal") {
      parts.push("Regular pulse, CRT <2s, warm");
    } else {
      if (abcdeCirculation?.pulseQuality) parts.push(`Rhythm: ${abcdeCirculation.pulseQuality}`);
      if (abcdeCirculation?.capillaryRefill) parts.push(`CRT: ${abcdeCirculation.capillaryRefill}`);
      if (abcdeCirculation?.skinTemperature) parts.push(`Skin: ${abcdeCirculation.skinTemperature}`);
    }
    return parts.join(", ");
  };

  const formatDisabilityFromData = (abcdeDisability: any, primaryAssessment: any, gcsTotal: number): string => {
    const parts = [];
    const status = abcdeDisability?.abcdeStatus || "Normal";
    parts.push(`GCS: ${gcsTotal}/15`);
    if (status === "Normal") {
      parts.push("Alert, PERL, no focal deficits");
    } else {
      const avpu = abcdeDisability?.motorResponse || primaryAssessment?.disability_avpu;
      if (avpu) parts.push(`AVPU: ${avpu}`);
      if (abcdeDisability?.pupilSize) parts.push(`Pupils: ${abcdeDisability.pupilSize}`);
      if (abcdeDisability?.pupilReaction) parts.push(abcdeDisability.pupilReaction);
    }
    const grbs = abcdeDisability?.glucose || primaryAssessment?.disability_grbs;
    if (grbs) parts.push(`GRBS: ${grbs} mg/dL`);
    return parts.join(", ");
  };

  const formatExposureFromData = (abcdeExposure: any, primaryAssessment: any): string => {
    const parts = [];
    const status = abcdeExposure?.abcdeStatus || "Normal";
    const temp = abcdeExposure?.temperature || primaryAssessment?.exposure_temperature;
    if (temp) parts.push(`Temp: ${temp}°C`);
    if (status === "Normal") {
      parts.push("No external injuries, no bleeding");
    } else {
      if (abcdeExposure?.findings) parts.push(abcdeExposure.findings);
      if (abcdeExposure?.notes) parts.push(abcdeExposure.notes);
    }
    return parts.join(", ");
  };

  const formatSystemicExam = (system: string, exam: any): string => {
    if (!exam) return "";
    
    if (system === "respiratory") {
      const notes = exam.respiratory_additional_notes || exam.respiratory?.notes || exam.chest || "";
      if (notes) return notes;
      const status = exam.respiratory_status || exam.respiratory?.status || "Normal";
      if (status === "Normal") {
        return "Bilateral equal air entry, vesicular breath sounds, no added sounds";
      }
      const parts = [];
      if (exam.respiratory_expansion) parts.push(`Expansion: ${exam.respiratory_expansion}`);
      if (exam.respiratory_breath_sounds) parts.push(`Breath Sounds: ${exam.respiratory_breath_sounds}`);
      if (exam.respiratory_added_sounds) parts.push(`Added: ${exam.respiratory_added_sounds}`);
      return parts.join(", ") || "";
    }
    
    if (system === "cvs") {
      const notes = exam.cvs_additional_notes || exam.cardiovascular?.notes || exam.cvs || "";
      if (notes) return notes;
      const status = exam.cvs_status || exam.cardiovascular?.status || "Normal";
      if (status === "Normal") {
        return "S1 S2 heard, no murmurs, JVP normal";
      }
      const parts = [];
      if (exam.cvs_s1_s2) parts.push(`S1S2: ${exam.cvs_s1_s2}`);
      if (exam.cvs_murmurs) parts.push(`Murmurs: ${exam.cvs_murmurs}`);
      if (exam.cvs_added_sounds) parts.push(`Added: ${exam.cvs_added_sounds}`);
      return parts.join(", ") || "";
    }
    
    if (system === "abdomen") {
      const notes = exam.abdomen_additional_notes || exam.abdomen?.notes || exam.pa || "";
      if (notes) return notes;
      const status = exam.abdomen_status || exam.abdomen?.status || "Normal";
      if (status === "Normal") {
        return "Soft, non-tender, no organomegaly, bowel sounds present";
      }
      const parts = [];
      if (exam.abdomen_organomegaly) parts.push(`Organomegaly: ${exam.abdomen_organomegaly}`);
      if (exam.abdomen_bowel_sounds) parts.push(`Bowel Sounds: ${exam.abdomen_bowel_sounds}`);
      return parts.join(", ") || "";
    }
    
    if (system === "cns") {
      const notes = exam.cns_additional_notes || exam.neurological?.notes || exam.cns || "";
      if (notes) return notes;
      const status = exam.cns_status || exam.neurological?.status || "Normal";
      if (status === "Normal") {
        return "Higher functions intact, no focal deficits, reflexes normal";
      }
      const parts = [];
      if (exam.cns_higher_mental) parts.push(`HMF: ${exam.cns_higher_mental}`);
      if (exam.cns_motor_system) parts.push(`Motor: ${exam.cns_motor_system}`);
      if (exam.cns_reflexes) parts.push(`Reflexes: ${exam.cns_reflexes}`);
      return parts.join(", ") || "";
    }
    
    if (system === "extremities") {
      const notes = exam.extremities_findings || exam.extremities?.notes || "";
      if (notes) return notes;
      const status = exam.extremities_status || exam.extremities?.status || "Normal";
      if (status === "Normal") {
        return "Pulses present, no edema, no deformity";
      }
      return "";
    }
    
    return "";
  };

  const formatInvestigations = (investigations: any): string => {
    if (!investigations) return "";
    if (typeof investigations === "string") return investigations;
    if (Array.isArray(investigations)) {
      return investigations.map((inv: any) => `${inv.name || inv.test}: ${inv.result || inv.value || "Pending"}`).join("\n");
    }
    if (typeof investigations === "object") {
      const parts: string[] = [];
      if (investigations.panels_selected && Array.isArray(investigations.panels_selected) && investigations.panels_selected.length > 0) {
        parts.push("Panels: " + investigations.panels_selected.join(", "));
      }
      if (investigations.individual_tests && Array.isArray(investigations.individual_tests) && investigations.individual_tests.length > 0) {
        parts.push("Tests: " + investigations.individual_tests.join(", "));
      }
      if (investigations.results_notes && investigations.results_notes.trim()) {
        parts.push("Results: " + investigations.results_notes);
      }
      if (investigations.labs_ordered) {
        parts.push("Labs: " + investigations.labs_ordered);
      }
      if (investigations.imaging) {
        parts.push("Imaging: " + investigations.imaging);
      }
      if (parts.length > 0) {
        return parts.join("\n");
      }
    }
    return "";
  };

  const formatMedications = (medications: any): string => {
    if (!medications) return "";
    if (typeof medications === "string") return medications;
    if (Array.isArray(medications)) {
      return medications.map((med: any) => `${med.name} ${med.dose || ""} ${med.route || ""} ${med.frequency || ""}`).join("\n");
    }
    return "";
  };

  const formatInfusions = (infusions: any): string => {
    if (!infusions) return "";
    if (typeof infusions === "string") return infusions;
    if (Array.isArray(infusions) && infusions.length > 0) {
      return infusions.map((inf: any) => {
        const parts = [inf.drug_name || inf.name || ""];
        if (inf.dose) parts.push(inf.dose);
        if (inf.dilution) parts.push(`in ${inf.dilution}`);
        if (inf.rate) parts.push(`@ ${inf.rate}`);
        return parts.filter(Boolean).join(" ");
      }).join("\n");
    }
    return "";
  };

  const formatFluids = (fluids: any): string => {
    if (!fluids) return "";
    if (typeof fluids === "string") return fluids;
    if (Array.isArray(fluids) && fluids.length > 0) {
      return fluids.map((f: any) => {
        const parts = [f.type || f.name || ""];
        if (f.volume) parts.push(f.volume);
        if (f.rate) parts.push(`@ ${f.rate}`);
        return parts.filter(Boolean).join(" ");
      }).join("\n");
    }
    if (typeof fluids === "object") {
      const parts: string[] = [];
      if (fluids.type) parts.push(fluids.type);
      if (fluids.volume) parts.push(fluids.volume);
      if (fluids.rate) parts.push(`@ ${fluids.rate}`);
      if (fluids.notes) parts.push(fluids.notes);
      return parts.join(" ");
    }
    return "";
  };

  const buildCourseInHospital = (meds: string, infusions: string, fluids: string, addendumNotes: string[], treatment: any): string => {
    const sections: string[] = [];

    if (meds) {
      sections.push("MEDICATIONS GIVEN IN ER:\n" + meds);
    }

    if (infusions) {
      sections.push("INFUSIONS:\n" + infusions);
    }

    if (fluids) {
      sections.push("IV FLUIDS:\n" + fluids);
    }

    if (treatment.interventions?.length > 0) {
      sections.push("INTERVENTIONS:\n" + treatment.interventions.join(", "));
    }

    if (treatment.intervention_notes) {
      sections.push("INTERVENTION NOTES:\n" + treatment.intervention_notes);
    }

    if (addendumNotes.length > 0) {
      sections.push("CLINICAL NOTES:\n" + addendumNotes.join("\n"));
    }

    return sections.join("\n\n");
  };

  const generateCourseInHospital = async () => {
    setGenerating(true);
    console.log("[AI] Generating course in hospital...");
    try {
      const baseUrl = getApiUrl();
      const endpoint = new URL("/api/ai/discharge-summary", baseUrl);
      console.log("[AI] Endpoint:", endpoint.toString());
      console.log("[AI] Summary data:", JSON.stringify(summaryRef.current, null, 2));
      
      const response = await fetch(endpoint.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          summary_data: summaryRef.current
        }),
      });
      
      console.log("[AI] Response status:", response.status);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.log("[AI] Error data:", errorData);
        throw new Error(errorData.error || "Failed to generate summary");
      }
      
      const res = await response.json();
      console.log("[AI] Response:", JSON.stringify(res, null, 2));
      
      if (res.success && res.summary) {
        if (res.summary.course_in_hospital) {
          console.log("[AI] Setting course_in_hospital:", res.summary.course_in_hospital.substring(0, 100) + "...");
          summaryRef.current.course_in_hospital = res.summary.course_in_hospital;
          // Force TextInput to remount with new value by changing its key
          setCourseInHospitalKey(k => k + 1);
        }
        if (res.summary.diagnosis && !summaryRef.current.diagnosis) {
          console.log("[AI] Setting diagnosis:", res.summary.diagnosis);
          summaryRef.current.diagnosis = res.summary.diagnosis;
        }
        console.log("[AI] Calling forceUpdate...");
        forceUpdate();
        Alert.alert("Generated", "AI has generated the Course in Hospital section. Please review and edit as needed.");
      } else {
        const errMsg = typeof res.error === 'string' ? res.error : JSON.stringify(res.error || "Failed to generate summary");
        console.log("[AI] Error response:", errMsg);
        Alert.alert("Error", errMsg);
      }
    } catch (err) {
      console.error("[AI] Catch error:", err);
      const errMsg = err instanceof Error ? err.message : String(err || "Failed to generate summary");
      Alert.alert("Error", errMsg);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await cacheDischargeSummary(caseId, summaryRef.current);

      const res = await apiPut(`/cases/${caseId}`, {
        discharge_summary: summaryRef.current,
        status: "completed",
      });

      if (res.success) {
        await invalidateCases();
        Alert.alert("Success", "Discharge summary saved successfully");
      } else {
        Alert.alert("Saved Locally", "Discharge summary saved locally. Backend sync may have failed.");
      }
    } catch (err) {
      Alert.alert("Saved Locally", "Discharge summary saved locally. Backend sync may have failed.");
    } finally {
      setSaving(false);
    }
  };

  const handleGoToDashboard = () => {
    navigation.popToTop();
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      await cacheDischargeSummary(caseId, summaryRef.current);
      await apiPut(`/cases/${caseId}`, {
        discharge_summary: summaryRef.current,
        status: "completed",
      });

      const exportData = {
        patient: caseData?.patient || {},
        discharge_summary: summaryRef.current,
        created_at: caseData?.created_at,
      };

      const baseUrl = getApiUrl();
      const exportUrl = new URL("/api/export/discharge-pdf", baseUrl);
      console.log("[PDF Export] URL:", exportUrl.toString());
      console.log("[PDF Export] Data:", JSON.stringify(exportData, null, 2));
      
      const response = await fetch(exportUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportData),
      });

      console.log("[PDF Export] Response status:", response.status, response.headers.get("content-type"));
      if (!response.ok) throw new Error("Failed to generate PDF");

      const blob = await response.blob();
      const fileName = `discharge_summary_${(caseData?.patient?.name || "patient").replace(/\s+/g, "_")}.pdf`;

      if (Platform.OS === "web") {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const fileUri = FileSystem.documentDirectory + fileName;
        const base64 = await blobToBase64(blob);
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: "application/pdf", dialogTitle: "Share Discharge Summary" });
        } else {
          Alert.alert("Success", `PDF saved to: ${fileUri}`);
        }
      }
    } catch (err) {
      console.error("PDF export error:", err);
      Alert.alert("Error", "Failed to export PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const exportDOCX = async () => {
    setExportingDocx(true);
    try {
      await cacheDischargeSummary(caseId, summaryRef.current);
      await apiPut(`/cases/${caseId}`, {
        discharge_summary: summaryRef.current,
        status: "completed",
      });

      const exportData = {
        patient: caseData?.patient || {},
        discharge_summary: summaryRef.current,
        created_at: caseData?.created_at,
      };

      const baseUrl = getApiUrl();
      const exportUrl = new URL("/api/export/discharge-docx", baseUrl);
      console.log("[DOCX Export] URL:", exportUrl.toString());
      console.log("[DOCX Export] Data:", JSON.stringify(exportData, null, 2));
      
      const response = await fetch(exportUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportData),
      });

      console.log("[DOCX Export] Response status:", response.status, response.headers.get("content-type"));
      if (!response.ok) throw new Error("Failed to generate DOCX");

      const blob = await response.blob();
      const fileName = `discharge_summary_${(caseData?.patient?.name || "patient").replace(/\s+/g, "_")}.docx`;

      if (Platform.OS === "web") {
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const fileUri = FileSystem.documentDirectory + fileName;
        const base64 = await blobToBase64(blob);
        await FileSystem.writeAsStringAsync(fileUri, base64, { encoding: FileSystem.EncodingType.Base64 });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", dialogTitle: "Share Discharge Summary" });
        } else {
          Alert.alert("Success", `Word document saved to: ${fileUri}`);
        }
      }
    } catch (err) {
      console.error("DOCX export error:", err);
      Alert.alert("Error", "Failed to export Word document. Please try again.");
    } finally {
      setExportingDocx(false);
    }
  };

  const updateField = (path: string, value: any) => {
    const keys = path.split(".");
    let obj: any = summaryRef.current;
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
    forceUpdate();
  };

  const updateFieldSilent = (path: string, value: any) => {
    const keys = path.split(".");
    let obj: any = summaryRef.current;
    for (let i = 0; i < keys.length - 1; i++) {
      obj = obj[keys[i]];
    }
    obj[keys[keys.length - 1]] = value;
  };

  const DebouncedVitalInput = React.memo(({ 
    fieldPath, 
    initialValue, 
    placeholder = "-" 
  }: { 
    fieldPath: string; 
    initialValue: string; 
    placeholder?: string;
  }) => {
    const localRef = useRef(initialValue);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);
    
    const handleChange = (text: string) => {
      localRef.current = text;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        updateFieldSilent(fieldPath, text);
      }, 300);
    };
    
    return (
      <TextInput
        style={[styles.vitalInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
        defaultValue={initialValue}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        keyboardType="default"
      />
    );
  });

  const VitalsGrid = ({ prefix, data }: { prefix: string; data: any }) => (
    <View style={styles.vitalsGrid}>
      {[
        { key: "hr", label: "HR" },
        { key: "bp", label: "BP" },
        { key: "rr", label: "RR" },
        { key: "spo2", label: "SpO2" },
        { key: "gcs", label: "GCS" },
        { key: "pain_score", label: "Pain" },
        { key: "grbs", label: "GRBS" },
        { key: "temp", label: "Temp (°F)" },
      ].map(({ key, label }) => (
        <View key={`${prefix}-${key}`} style={styles.vitalItem}>
          <Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>{label}</Text>
          <DebouncedVitalInput
            fieldPath={`${prefix}.${key}`}
            initialValue={data[key] || ""}
          />
        </View>
      ))}
    </View>
  );

  const ToggleItem = ({ label, value, path }: { label: string; value: boolean; path: string }) => (
    <View style={styles.toggleRow}>
      <Text style={[styles.toggleLabel, { color: theme.text }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={(v) => updateField(path, v)}
        trackColor={{ false: theme.backgroundSecondary, true: theme.primaryLight }}
        thumbColor={value ? theme.primary : theme.textMuted}
      />
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const patient = caseData?.patient || {};
  const pediatric = isPediatric(parseFloat(patient.age) || 0);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing["4xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.patientCard, { backgroundColor: theme.card }]}>
          <View style={styles.patientHeader}>
            <View>
              <Text style={[styles.patientName, { color: theme.text }]}>{patient.name || "Patient"}</Text>
              <Text style={[styles.patientDetails, { color: theme.textSecondary }]}>
                {patient.age} yrs | {patient.sex} {pediatric ? "| Pediatric" : ""}
              </Text>
            </View>
            <View style={[styles.mlcBadge, { backgroundColor: summaryRef.current.mlc ? TriageColors.red : theme.successLight }]}>
              <Text style={[styles.mlcText, { color: summaryRef.current.mlc ? "#FFFFFF" : theme.success }]}>
                {summaryRef.current.mlc ? "MLC" : "Non-MLC"}
              </Text>
            </View>
          </View>
          <View style={styles.mlcToggle}>
            <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Medico-Legal Case</Text>
            <Switch
              value={summaryRef.current.mlc}
              onValueChange={(v) => updateField("mlc", v)}
              trackColor={{ false: theme.backgroundSecondary, true: TriageColors.red }}
              thumbColor={summaryRef.current.mlc ? "#FFFFFF" : theme.textMuted}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <CollapsibleSection title="Patient Information & Arrival" icon="user" iconColor={theme.primary}>
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Allergy</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={summaryRef.current.allergy}
                onChangeText={(v) => updateField("allergy", v)}
                placeholder="Known allergies..."
                placeholderTextColor={theme.textMuted}
              />
            </View>

            <Text style={[styles.subheading, { color: theme.text }]}>Vitals at Time of Arrival</Text>
            <VitalsGrid prefix="vitals_arrival" data={summaryRef.current.vitals_arrival} />

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Presenting Complaints</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={summaryRef.current.presenting_complaint}
                onChangeText={(v) => updateField("presenting_complaint", v)}
                placeholder="Chief complaint..."
                placeholderTextColor={theme.textMuted}
                multiline
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>History of Present Illness</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={summaryRef.current.history_of_present_illness}
                onChangeText={(v) => updateField("history_of_present_illness", v)}
                placeholder="Detailed history..."
                placeholderTextColor={theme.textMuted}
                multiline
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Past Medical/Surgical Histories</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={summaryRef.current.past_medical_history}
                onChangeText={(v) => updateField("past_medical_history", v)}
                placeholder="Previous medical conditions, surgeries..."
                placeholderTextColor={theme.textMuted}
                multiline
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Family / Gynae History</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={summaryRef.current.family_history}
                onChangeText={(v) => updateField("family_history", v)}
                placeholder="Family history..."
                placeholderTextColor={theme.textMuted}
              />
            </View>

            {patient.sex === "Female" || patient.sex === "F" ? (
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>LMP</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  value={summaryRef.current.lmp}
                  onChangeText={(v) => updateField("lmp", v)}
                  placeholder="Last menstrual period..."
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            ) : null}
          </CollapsibleSection>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <CollapsibleSection title="Primary Assessment (ABCDE)" icon="activity" iconColor={TriageColors.red}>
            {[
              { key: "airway", label: "Airway", placeholder: "Patent / Threatened / Compromised, Intervention" },
              { key: "breathing", label: "Breathing", placeholder: "WOB, Air entry, CCT, Subcutaneous emphysema, EFAST, Intervention" },
              { key: "circulation", label: "Circulation", placeholder: "CRT, Distended Neck Veins, PCT, Long bone deformity, FAST, Interventions" },
              { key: "disability", label: "Disability", placeholder: "AVPU/GCS, Pupils, GRBS" },
              { key: "exposure", label: "Exposure", placeholder: "Temp, Trauma, Logroll" },
            ].map(({ key, label, placeholder }) => (
              <View key={key} style={styles.field}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
                <TextInput
                  style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  value={(summaryRef.current.primary_assessment as any)[key]}
                  onChangeText={(v) => updateField(`primary_assessment.${key}`, v)}
                  placeholder={placeholder}
                  placeholderTextColor={theme.textMuted}
                  multiline
                />
              </View>
            ))}

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>EFAST</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={summaryRef.current.primary_assessment.efast}
                onChangeText={(v) => updateField("primary_assessment.efast", v)}
                placeholder="EFAST findings..."
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </CollapsibleSection>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <CollapsibleSection title="Secondary Assessment" icon="clipboard" iconColor={TriageColors.orange}>
            <Text style={[styles.subheading, { color: theme.text }]}>General Examination</Text>
            <View style={styles.toggleGrid}>
              <ToggleItem label="Pallor" value={summaryRef.current.secondary_assessment.pallor} path="secondary_assessment.pallor" />
              <ToggleItem label="Icterus" value={summaryRef.current.secondary_assessment.icterus} path="secondary_assessment.icterus" />
              <ToggleItem label="Cyanosis" value={summaryRef.current.secondary_assessment.cyanosis} path="secondary_assessment.cyanosis" />
              <ToggleItem label="Clubbing" value={summaryRef.current.secondary_assessment.clubbing} path="secondary_assessment.clubbing" />
              <ToggleItem label="Lymphadenopathy" value={summaryRef.current.secondary_assessment.lymphadenopathy} path="secondary_assessment.lymphadenopathy" />
              <ToggleItem label="Edema" value={summaryRef.current.secondary_assessment.edema} path="secondary_assessment.edema" />
            </View>

            <Text style={[styles.subheading, { color: theme.text, marginTop: Spacing.lg }]}>Systemic Examination</Text>
            {[
              { key: "chest", label: "CHEST" },
              { key: "cvs", label: "CVS" },
              { key: "pa", label: "P/A" },
              { key: "cns", label: "CNS" },
              { key: "extremities", label: "EXTREMITIES" },
            ].map(({ key, label }) => (
              <View key={key} style={styles.field}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  value={(summaryRef.current.systemic_exam as any)[key]}
                  onChangeText={(v) => updateField(`systemic_exam.${key}`, v)}
                  placeholder={`${label} findings...`}
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            ))}
          </CollapsibleSection>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <CollapsibleSection title="Hospital Course & Treatment" icon="file-text" iconColor={TriageColors.blue}>
            <Pressable
              style={({ pressed }) => [styles.aiBtn, { backgroundColor: theme.primaryLight, opacity: pressed || generating ? 0.8 : 1, marginBottom: Spacing.md }]}
              onPress={generateCourseInHospital}
              disabled={generating}
            >
              {generating ? (
                <ActivityIndicator color={theme.primary} />
              ) : (
                <>
                  <Feather name="cpu" size={20} color={theme.primary} />
                  <Text style={[styles.aiBtnText, { color: theme.primary }]}>Generate Course in Hospital</Text>
                </>
              )}
            </Pressable>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Course in Hospital with Medications and Procedures</Text>
              <TextInput
                key={`course_in_hospital_${courseInHospitalKey}`}
                style={[styles.textAreaLarge, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                defaultValue={summaryRef.current.course_in_hospital}
                onChangeText={(v) => updateField("course_in_hospital", v)}
                placeholder="Detailed course in hospital (AI will generate this)..."
                placeholderTextColor={theme.textMuted}
                multiline
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Investigations</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={summaryRef.current.investigations}
                onChangeText={(v) => updateField("investigations", v)}
                placeholder="Investigation results..."
                placeholderTextColor={theme.textMuted}
                multiline
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Diagnosis at Time of Discharge</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={summaryRef.current.diagnosis}
                onChangeText={(v) => updateField("diagnosis", v)}
                placeholder="Final diagnosis..."
                placeholderTextColor={theme.textMuted}
                multiline
              />
            </View>
          </CollapsibleSection>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <CollapsibleSection title="Discharge Information" icon="log-out" iconColor={TriageColors.green}>
            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Discharge Medications</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={summaryRef.current.discharge_medications}
                onChangeText={(v) => updateField("discharge_medications", v)}
                placeholder="Medications to continue..."
                placeholderTextColor={theme.textMuted}
                multiline
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Disposition</Text>
              <View style={styles.dispositionOptions}>
                {["Normal Discharge", "Discharge at Request", "Discharge Against Medical Advice", "Referred"].map((type) => (
                  <Pressable
                    key={type}
                    style={[
                      styles.dispositionBtn,
                      { 
                        backgroundColor: summaryRef.current.disposition_type === type ? theme.primary : theme.backgroundSecondary,
                        borderColor: summaryRef.current.disposition_type === type ? theme.primary : theme.border,
                      },
                    ]}
                    onPress={() => updateField("disposition_type", type)}
                  >
                    <View style={[styles.checkbox, { borderColor: summaryRef.current.disposition_type === type ? "#FFFFFF" : theme.textMuted }]}>
                      {summaryRef.current.disposition_type === type ? <Feather name="check" size={12} color="#FFFFFF" /> : null}
                    </View>
                    <Text style={[styles.dispositionText, { color: summaryRef.current.disposition_type === type ? "#FFFFFF" : theme.text }]}>
                      {type}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Condition at Time of Discharge</Text>
              <View style={styles.conditionRow}>
                {["STABLE", "UNSTABLE"].map((condition) => (
                  <Pressable
                    key={condition}
                    style={[
                      styles.conditionBtn,
                      { 
                        backgroundColor: summaryRef.current.condition_at_discharge === condition 
                          ? (condition === "STABLE" ? TriageColors.green : TriageColors.red) 
                          : theme.backgroundSecondary 
                      },
                    ]}
                    onPress={() => updateField("condition_at_discharge", condition)}
                  >
                    <Text style={[styles.conditionText, { color: summaryRef.current.condition_at_discharge === condition ? "#FFFFFF" : theme.text }]}>
                      {condition}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Text style={[styles.subheading, { color: theme.text }]}>Vitals at Time of Discharge</Text>
            <VitalsGrid prefix="vitals_discharge" data={summaryRef.current.vitals_discharge} />

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Follow-Up Advice</Text>
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={summaryRef.current.follow_up_advice}
                onChangeText={(v) => updateField("follow_up_advice", v)}
                placeholder="Follow-up instructions, OPD appointments..."
                placeholderTextColor={theme.textMuted}
                multiline
              />
            </View>
          </CollapsibleSection>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <CollapsibleSection title="Signatures & Documentation" icon="edit-3" iconColor={theme.textSecondary}>
            <View style={styles.signatureRow}>
              <View style={styles.signatureCol}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>ED Resident</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  value={summaryRef.current.ed_resident}
                  onChangeText={(v) => updateField("ed_resident", v)}
                  placeholder="Name"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
              <View style={styles.signatureCol}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>ED Consultant</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  value={summaryRef.current.ed_consultant}
                  onChangeText={(v) => updateField("ed_consultant", v)}
                  placeholder="Name"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>

            <View style={styles.signatureRow}>
              <View style={styles.signatureCol}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Sign and Time (Resident)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  value={summaryRef.current.sign_time_resident}
                  onChangeText={(v) => updateField("sign_time_resident", v)}
                  placeholder="Time"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
              <View style={styles.signatureCol}>
                <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Sign and Time (Consultant)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                  value={summaryRef.current.sign_time_consultant}
                  onChangeText={(v) => updateField("sign_time_consultant", v)}
                  placeholder="Time"
                  placeholderTextColor={theme.textMuted}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Date</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                value={summaryRef.current.discharge_date}
                onChangeText={(v) => updateField("discharge_date", v)}
                placeholder="Discharge date"
                placeholderTextColor={theme.textMuted}
              />
            </View>
          </CollapsibleSection>
        </View>

        <View style={[styles.disclaimer, { backgroundColor: theme.backgroundSecondary }]}>
          <Text style={[styles.disclaimerText, { color: theme.textMuted }]}>
            This discharge summary provides clinical information meant to facilitate continuity of patient care. For statutory purposes, a treatment/discharge certificate shall be issued on request. For a disability certificate, approach a Government-constituted Medical Board.
          </Text>
        </View>

        <View style={styles.exportRow}>
          <Pressable
            style={({ pressed }) => [styles.exportBtn, { backgroundColor: theme.dangerLight, opacity: pressed || exporting ? 0.8 : 1 }]}
            onPress={exportPDF}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color={theme.danger} size="small" />
            ) : (
              <>
                <Feather name="file-text" size={18} color={theme.danger} />
                <Text style={[styles.exportBtnText, { color: theme.danger }]}>PDF</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.exportBtn, { backgroundColor: theme.primaryLight, opacity: pressed || exportingDocx ? 0.8 : 1 }]}
            onPress={exportDOCX}
            disabled={exportingDocx}
          >
            {exportingDocx ? (
              <ActivityIndicator color={theme.primary} size="small" />
            ) : (
              <>
                <Feather name="file" size={18} color={theme.primary} />
                <Text style={[styles.exportBtnText, { color: theme.primary }]}>Word</Text>
              </>
            )}
          </Pressable>
        </View>

        <View style={styles.actionBtnsRow}>
          <Pressable
            style={({ pressed }) => [styles.saveBtn, styles.saveBtnHalf, { backgroundColor: theme.success, opacity: pressed || saving ? 0.8 : 1 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name="save" size={18} color="#FFFFFF" />
                <Text style={styles.saveBtnText}>Save</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.saveBtn, styles.saveBtnHalf, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}
            onPress={handleGoToDashboard}
          >
            <Feather name="home" size={18} color="#FFFFFF" />
            <Text style={styles.saveBtnText}>Dashboard</Text>
          </Pressable>
        </View>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: Spacing.lg },
  patientCard: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  patientHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  patientName: { ...Typography.h3 },
  patientDetails: { ...Typography.body, marginTop: 2 },
  mlcBadge: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs, borderRadius: BorderRadius.sm },
  mlcText: { ...Typography.caption, fontWeight: "700" },
  mlcToggle: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: Spacing.md },
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  aiBtnText: { ...Typography.bodyMedium },
  section: { borderRadius: BorderRadius.lg, marginBottom: Spacing.lg, overflow: "hidden" },
  field: { marginBottom: Spacing.md },
  fieldLabel: { ...Typography.label, marginBottom: Spacing.xs },
  subheading: { ...Typography.bodyMedium, fontWeight: "600", marginBottom: Spacing.sm, marginTop: Spacing.md },
  input: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    ...Typography.body,
  },
  textArea: {
    minHeight: 70,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    ...Typography.body,
    textAlignVertical: "top",
  },
  textAreaLarge: {
    minHeight: 120,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    ...Typography.body,
    textAlignVertical: "top",
  },
  vitalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  vitalItem: { width: "23%", minWidth: 70 },
  vitalLabel: { ...Typography.caption, marginBottom: 2 },
  vitalInput: {
    height: 36,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.sm,
    ...Typography.body,
    textAlign: "center",
  },
  toggleGrid: { gap: Spacing.xs },
  toggleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: Spacing.xs },
  toggleLabel: { ...Typography.body },
  conditionRow: { flexDirection: "row", gap: Spacing.md },
  conditionBtn: { flex: 1, paddingVertical: Spacing.md, borderRadius: BorderRadius.md, alignItems: "center" },
  conditionText: { ...Typography.bodyMedium, fontWeight: "700" },
  dispositionOptions: { gap: Spacing.sm },
  dispositionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: Spacing.sm,
  },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderWidth: 2, justifyContent: "center", alignItems: "center" },
  dispositionText: { ...Typography.body, flex: 1 },
  signatureRow: { flexDirection: "row", gap: Spacing.md },
  signatureCol: { flex: 1 },
  disclaimer: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  disclaimerText: { ...Typography.caption, fontStyle: "italic", textAlign: "center" },
  exportRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.md },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    flex: 1,
  },
  exportBtnText: { ...Typography.bodyMedium, fontWeight: "600" },
  actionBtnsRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  saveBtnHalf: {
    flex: 1,
  },
  saveBtnText: { color: "#FFFFFF", ...Typography.bodyMedium },
});
