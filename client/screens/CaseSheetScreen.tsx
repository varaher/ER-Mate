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
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { DropdownField } from "@/components/DropdownField";
import { CheckboxGroup } from "@/components/CheckboxGroup";
import { TextInputField } from "@/components/TextInputField";
import { useTheme } from "@/hooks/useTheme";
import { apiGet, apiPatch, apiUpload, invalidateCases } from "@/lib/api";
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
  ECG_STATUS_OPTIONS,
  EFAST_OPTIONS,
  BEDSIDE_ECHO_OPTIONS,
  ATLSFormData,
  getDefaultATLSFormData,
} from "@/constants/atlasOptions";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, "CaseSheet">;

type TabType = "patient" | "primary" | "history" | "exam";

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
    status: "Normal" | "Abnormal";
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
    status: "Normal" | "Abnormal";
    chestShape: string;
    airEntry: string;
    percussion: string;
    breathSounds: string;
    notes: string;
  };
  abdomen: {
    status: "Normal" | "Abnormal";
    shape: string;
    tenderness: string;
    guarding: boolean;
    rigidity: boolean;
    bowelSounds: string;
    organomegaly: string;
    notes: string;
  };
  cns: {
    status: "Normal" | "Abnormal";
    consciousness: string;
    orientation: string;
    speech: string;
    motorPower: string;
    reflexes: string;
    notes: string;
  };
  extremities: {
    status: "Normal" | "Abnormal";
    pulses: string;
    edema: boolean;
    deformity: boolean;
    notes: string;
  };
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

const getDefaultExamFormData = (): ExamFormData => ({
  general: { pallor: false, icterus: false, cyanosis: false, clubbing: false, lymphadenopathy: false, edema: false, notes: "" },
  cvs: { status: "Normal", s1s2: "Normal", pulse: "Regular", pulseRate: "", apexBeat: "Normal", precordialHeave: false, addedSounds: "", murmurs: "", notes: "" },
  respiratory: { status: "Normal", chestShape: "Normal", airEntry: "Bilateral equal", percussion: "Resonant", breathSounds: "Vesicular", notes: "" },
  abdomen: { status: "Normal", shape: "Flat", tenderness: "Nil", guarding: false, rigidity: false, bowelSounds: "Normal", organomegaly: "Nil", notes: "" },
  cns: { status: "Normal", consciousness: "Alert", orientation: "Oriented", speech: "Normal", motorPower: "5/5", reflexes: "Normal", notes: "" },
  extremities: { status: "Normal", pulses: "Present", edema: false, deformity: false, notes: "" },
});

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
  const [formData, setFormData] = useState<ATLSFormData>(getDefaultATLSFormData());
  const [examData, setExamData] = useState<ExamFormData>(getDefaultExamFormData());
  const [psychData, setPsychData] = useState<PsychFormData>(getDefaultPsychFormData());
  const [pastSurgicalHistory, setPastSurgicalHistory] = useState("");
  const [otherHistory, setOtherHistory] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [activeVoiceField, setActiveVoiceField] = useState<string | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const loadCase = async () => {
    try {
      const res = await apiGet<any>(`/cases/${caseId}`);
      if (res.success && res.data) {
        setCaseData(res.data);
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
          setPastSurgicalHistory(res.data.history.past_surgical || "");
          setOtherHistory(res.data.history.other || "");
        }
        if (res.data.psychological) {
          setPsychData({ ...getDefaultPsychFormData(), ...res.data.psychological });
        }
        if (res.data.examination) {
          setExamData({ ...getDefaultExamFormData(), ...res.data.examination });
        }
        setFormData(newFormData);
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const gcsTotal = (parseInt(formData.disability.gcsE) || 0) + (parseInt(formData.disability.gcsV) || 0) + (parseInt(formData.disability.gcsM) || 0);
      const payload = {
        abcde: {
          airway: formData.airway,
          breathing: formData.breathing,
          circulation: formData.circulation,
          disability: formData.disability,
          exposure: formData.exposure,
        },
        adjuncts: formData.adjuncts,
        sample: formData.sample,
        history: {
          hpi: formData.sample.eventsHopi,
          allergies: formData.sample.allergies,
          medications: formData.sample.medications,
          past_medical: formData.sample.pastMedicalHistory,
          past_surgical: pastSurgicalHistory,
          other: otherHistory,
        },
        vitals_at_arrival: {
          hr: parseFloat(formData.circulation.hr) || undefined,
          bp_systolic: parseFloat(formData.circulation.bpSystolic) || undefined,
          bp_diastolic: parseFloat(formData.circulation.bpDiastolic) || undefined,
          rr: parseFloat(formData.breathing.rr) || undefined,
          spo2: parseFloat(formData.breathing.spo2) || undefined,
          temperature: parseFloat(formData.exposure.temperature) || undefined,
          gcs_e: parseInt(formData.disability.gcsE) || 4,
          gcs_v: parseInt(formData.disability.gcsV) || 5,
          gcs_m: parseInt(formData.disability.gcsM) || 6,
          gcs_total: gcsTotal || 15,
          grbs: parseFloat(formData.disability.glucose) || undefined,
        },
      };
      const res = await apiPatch(`/cases/${caseId}`, payload);
      if (res.success) {
        await invalidateCases();
        setLastSaved(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } else {
        Alert.alert("Error", res.error || "Failed to save");
      }
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

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
        }
      }
    } catch (err) {
      console.error("Transcription error:", err);
    }
  };

  const markAllExamNormal = () => {
    setExamData({
      general: { pallor: false, icterus: false, cyanosis: false, clubbing: false, lymphadenopathy: false, edema: false, notes: "" },
      cvs: { status: "Normal", s1s2: "Normal", pulse: "Regular", pulseRate: "", apexBeat: "Normal", precordialHeave: false, addedSounds: "", murmurs: "", notes: "" },
      respiratory: { status: "Normal", chestShape: "Normal", airEntry: "Bilateral equal", percussion: "Resonant", breathSounds: "Vesicular", notes: "" },
      abdomen: { status: "Normal", shape: "Flat", tenderness: "Nil", guarding: false, rigidity: false, bowelSounds: "Normal", organomegaly: "Nil", notes: "" },
      cns: { status: "Normal", consciousness: "Alert", orientation: "Oriented", speech: "Normal", motorPower: "5/5", reflexes: "Normal", notes: "" },
      extremities: { status: "Normal", pulses: "Present", edema: false, deformity: false, notes: "" },
    });
  };

  const handleNext = () => {
    const tabs: TabType[] = ["patient", "primary", "history", "exam"];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex < tabs.length - 1) {
      setActiveTab(tabs[currentIndex + 1]);
    } else {
      handleSave();
      navigation.navigate("PhysicalExam", { caseId });
    }
  };

  const handlePrevious = () => {
    const tabs: TabType[] = ["patient", "primary", "history", "exam"];
    const currentIndex = tabs.indexOf(activeTab);
    if (currentIndex > 0) {
      setActiveTab(tabs[currentIndex - 1]);
    }
  };

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
                      {caseData.patient.age} yrs | {caseData.patient.sex} | {caseData.patient.mode_of_arrival || "Walk-in"}
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
          </>
        )}

        {activeTab === "primary" && (
          <>
            <CollapsibleSection title="AIRWAY" icon="A" iconColor={TriageColors.red} defaultExpanded>
              <DropdownField label="Airway Status" options={AIRWAY_STATUS_OPTIONS} value={formData.airway.status} onChange={(v) => updateFormData("airway", "status", v)} />
              <DropdownField label="Airway Maintenance" options={AIRWAY_MAINTENANCE_OPTIONS} value={formData.airway.maintenance} onChange={(v) => updateFormData("airway", "maintenance", v)} />
              <DropdownField label="Obstruction Cause" options={AIRWAY_OBSTRUCTION_CAUSE_OPTIONS} value={formData.airway.obstructionCause} onChange={(v) => updateFormData("airway", "obstructionCause", v)} />
              <DropdownField label="Speech" options={AIRWAY_SPEECH_OPTIONS} value={formData.airway.speech} onChange={(v) => updateFormData("airway", "speech", v)} />
              <DropdownField label="Signs of Compromise" options={AIRWAY_COMPROMISE_SIGNS_OPTIONS} value={formData.airway.compromiseSigns} onChange={(v) => updateFormData("airway", "compromiseSigns", v)} />
              <CheckboxGroup label="Interventions Done" options={AIRWAY_INTERVENTIONS} selectedValues={formData.airway.interventions} onChange={(v) => updateFormData("airway", "interventions", v)} columns={3} />
              <TextInputField label="Additional Notes" value={formData.airway.notes} onChangeText={(v) => updateFormData("airway", "notes", v)} placeholder="Additional airway observations..." multiline numberOfLines={3} />
            </CollapsibleSection>

            <CollapsibleSection title="BREATHING" icon="B" iconColor={TriageColors.orange}>
              <View style={styles.row}>
                <View style={styles.halfField}><TextInputField label="RR (/min)" value={formData.breathing.rr} onChangeText={(v) => updateFormData("breathing", "rr", v)} keyboardType="numeric" /></View>
                <View style={styles.halfField}><TextInputField label="SpO2 (%)" value={formData.breathing.spo2} onChangeText={(v) => updateFormData("breathing", "spo2", v)} keyboardType="numeric" /></View>
              </View>
              <DropdownField label="O2 Device" options={O2_DEVICE_OPTIONS} value={formData.breathing.o2Device} onChange={(v) => updateFormData("breathing", "o2Device", v)} />
              <TextInputField label="O2 Flow (L/min)" value={formData.breathing.o2Flow} onChangeText={(v) => updateFormData("breathing", "o2Flow", v)} keyboardType="numeric" />
              <DropdownField label="Breathing Pattern" options={BREATHING_PATTERN_OPTIONS} value={formData.breathing.pattern} onChange={(v) => updateFormData("breathing", "pattern", v)} />
              <DropdownField label="Chest Expansion" options={CHEST_EXPANSION_OPTIONS} value={formData.breathing.chestExpansion} onChange={(v) => updateFormData("breathing", "chestExpansion", v)} />
              <DropdownField label="Air Entry" options={AIR_ENTRY_OPTIONS} value={formData.breathing.airEntry} onChange={(v) => updateFormData("breathing", "airEntry", v)} />
              <DropdownField label="Effort" options={BREATHING_EFFORT_OPTIONS} value={formData.breathing.effort} onChange={(v) => updateFormData("breathing", "effort", v)} />
              <DropdownField label="Added Breath Sounds" options={ADDED_BREATH_SOUNDS_OPTIONS} value={formData.breathing.addedSounds} onChange={(v) => updateFormData("breathing", "addedSounds", v)} />
              <CheckboxGroup label="Interventions Done" options={BREATHING_INTERVENTIONS} selectedValues={formData.breathing.interventions} onChange={(v) => updateFormData("breathing", "interventions", v)} columns={2} />
              <TextInputField label="Additional Notes" value={formData.breathing.notes} onChangeText={(v) => updateFormData("breathing", "notes", v)} placeholder="Additional breathing observations..." multiline numberOfLines={3} />
            </CollapsibleSection>

            <CollapsibleSection title="CIRCULATION" icon="C" iconColor={TriageColors.yellow}>
              <View style={styles.row}>
                <View style={styles.halfField}><TextInputField label="Heart Rate (bpm)" value={formData.circulation.hr} onChangeText={(v) => updateFormData("circulation", "hr", v)} keyboardType="numeric" /></View>
                <View style={styles.halfField}><DropdownField label="Pulse Quality" options={PULSE_QUALITY_OPTIONS} value={formData.circulation.pulseQuality} onChange={(v) => updateFormData("circulation", "pulseQuality", v)} /></View>
              </View>
              <View style={styles.row}>
                <View style={styles.halfField}><TextInputField label="BP Systolic" value={formData.circulation.bpSystolic} onChangeText={(v) => updateFormData("circulation", "bpSystolic", v)} keyboardType="numeric" /></View>
                <View style={styles.halfField}><TextInputField label="BP Diastolic" value={formData.circulation.bpDiastolic} onChangeText={(v) => updateFormData("circulation", "bpDiastolic", v)} keyboardType="numeric" /></View>
              </View>
              <DropdownField label="Capillary Refill" options={CAPILLARY_REFILL_OPTIONS} value={formData.circulation.capillaryRefill} onChange={(v) => updateFormData("circulation", "capillaryRefill", v)} />
              <View style={styles.row}>
                <View style={styles.halfField}><DropdownField label="Skin Color" options={SKIN_COLOR_OPTIONS} value={formData.circulation.skinColor} onChange={(v) => updateFormData("circulation", "skinColor", v)} /></View>
                <View style={styles.halfField}><DropdownField label="Skin Temperature" options={SKIN_TEMPERATURE_OPTIONS} value={formData.circulation.skinTemperature} onChange={(v) => updateFormData("circulation", "skinTemperature", v)} /></View>
              </View>
              <DropdownField label="IV Access" options={IV_ACCESS_OPTIONS} value={formData.circulation.ivAccess} onChange={(v) => updateFormData("circulation", "ivAccess", v)} />
              <CheckboxGroup label="Interventions Done" options={CIRCULATION_INTERVENTIONS} selectedValues={formData.circulation.interventions} onChange={(v) => updateFormData("circulation", "interventions", v)} columns={2} />
              <TextInputField label="Additional Notes" value={formData.circulation.notes} onChangeText={(v) => updateFormData("circulation", "notes", v)} placeholder="Additional circulation observations..." multiline numberOfLines={3} />
            </CollapsibleSection>

            <CollapsibleSection title="DISABILITY" icon="D" iconColor={TriageColors.green}>
              <Text style={[styles.subLabel, { color: theme.textSecondary }]}>Glasgow Coma Scale</Text>
              <View style={styles.row}>
                <View style={styles.thirdField}><TextInputField label="Eye (1-4)" value={formData.disability.gcsE} onChangeText={(v) => updateFormData("disability", "gcsE", v)} keyboardType="numeric" /></View>
                <View style={styles.thirdField}><TextInputField label="Verbal (1-5)" value={formData.disability.gcsV} onChangeText={(v) => updateFormData("disability", "gcsV", v)} keyboardType="numeric" /></View>
                <View style={styles.thirdField}><TextInputField label="Motor (1-6)" value={formData.disability.gcsM} onChangeText={(v) => updateFormData("disability", "gcsM", v)} keyboardType="numeric" /></View>
              </View>
              <View style={[styles.gcsTotal, { backgroundColor: theme.backgroundSecondary }]}>
                <Text style={[styles.gcsTotalLabel, { color: theme.textSecondary }]}>GCS Total:</Text>
                <Text style={[styles.gcsTotalValue, { color: theme.text }]}>{(parseInt(formData.disability.gcsE) || 0) + (parseInt(formData.disability.gcsV) || 0) + (parseInt(formData.disability.gcsM) || 0)}/15</Text>
              </View>
              <View style={styles.row}>
                <View style={styles.halfField}><DropdownField label="Pupil Size" options={PUPIL_SIZE_OPTIONS} value={formData.disability.pupilSize} onChange={(v) => updateFormData("disability", "pupilSize", v)} /></View>
                <View style={styles.halfField}><DropdownField label="Pupil Reaction" options={PUPIL_REACTION_OPTIONS} value={formData.disability.pupilReaction} onChange={(v) => updateFormData("disability", "pupilReaction", v)} /></View>
              </View>
              <DropdownField label="Motor Response" options={MOTOR_RESPONSE_OPTIONS} value={formData.disability.motorResponse} onChange={(v) => updateFormData("disability", "motorResponse", v)} />
              <TextInputField label="Glucose (mg/dL)" value={formData.disability.glucose} onChangeText={(v) => updateFormData("disability", "glucose", v)} keyboardType="numeric" />
              <CheckboxGroup label="Interventions Done" options={DISABILITY_INTERVENTIONS} selectedValues={formData.disability.interventions} onChange={(v) => updateFormData("disability", "interventions", v)} columns={2} />
              <TextInputField label="Additional Notes" value={formData.disability.notes} onChangeText={(v) => updateFormData("disability", "notes", v)} placeholder="Additional neurological observations..." multiline numberOfLines={3} />
            </CollapsibleSection>

            <CollapsibleSection title="EXPOSURE" icon="E" iconColor={TriageColors.blue}>
              <TextInputField label="Temperature" value={formData.exposure.temperature} onChangeText={(v) => updateFormData("exposure", "temperature", v)} keyboardType="decimal-pad" suffix="C" />
              <CheckboxGroup label="Findings" options={EXPOSURE_FINDINGS_OPTIONS} selectedValues={formData.exposure.findings} onChange={(v) => updateFormData("exposure", "findings", v)} columns={2} />
              <CheckboxGroup label="Interventions Done" options={EXPOSURE_INTERVENTIONS} selectedValues={formData.exposure.interventions} onChange={(v) => updateFormData("exposure", "interventions", v)} columns={2} />
              <TextInputField label="Additional Notes" value={formData.exposure.notes} onChangeText={(v) => updateFormData("exposure", "notes", v)} placeholder="Additional exposure findings..." multiline numberOfLines={3} />
            </CollapsibleSection>

            <Text style={[styles.sectionHeading, { color: theme.text }]}>Adjuncts to Primary Survey</Text>
            <CollapsibleSection title="ABG / VBG" icon="+" iconColor={theme.primary}>
              <DropdownField label="ABG Status" options={ABG_STATUS_OPTIONS} value={formData.adjuncts.abgStatus} onChange={(v) => updateFormData("adjuncts", "abgStatus", v)} />
              <TextInputField label="ABG Notes / Values" value={formData.adjuncts.abgNotes} onChangeText={(v) => updateFormData("adjuncts", "abgNotes", v)} placeholder="pH, pCO2, pO2, HCO3, BE, Lactate..." multiline numberOfLines={2} />
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

              <Text style={[styles.fieldLabel, { color: theme.text }]}>Last Meal / LMP</Text>
              <TextInput style={[styles.inputField, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Time of last meal/LMP date" placeholderTextColor={theme.textMuted} value={formData.sample.lastMeal} onChangeText={(v) => updateFormData("sample", "lastMeal", v)} />

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
              <TextInputField label="Chest Shape" value={examData.respiratory.chestShape} onChangeText={(v) => updateExamData("respiratory", "chestShape", v)} placeholder="Normal, Barrel, etc." />
              <TextInputField label="Air Entry" value={examData.respiratory.airEntry} onChangeText={(v) => updateExamData("respiratory", "airEntry", v)} placeholder="Bilateral equal, reduced, etc." />
              <TextInputField label="Percussion" value={examData.respiratory.percussion} onChangeText={(v) => updateExamData("respiratory", "percussion", v)} placeholder="Resonant, dull, etc." />
              <TextInputField label="Breath Sounds" value={examData.respiratory.breathSounds} onChangeText={(v) => updateExamData("respiratory", "breathSounds", v)} placeholder="Vesicular, bronchial, etc." />
              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Additional Notes</Text>
                <VoiceButton fieldKey="exam.respiratory.notes" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Respiratory notes..." placeholderTextColor={theme.textMuted} value={examData.respiratory.notes} onChangeText={(v) => updateExamData("respiratory", "notes", v)} multiline />
            </CollapsibleSection>

            <CollapsibleSection title="Abdomen" icon="activity" iconColor={TriageColors.yellow}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Abdomen Status</Text>
              <SegmentedControl options={["Normal", "Abnormal"]} value={examData.abdomen.status} onChange={(v) => updateExamData("abdomen", "status", v)} />
              <TextInputField label="Shape" value={examData.abdomen.shape} onChangeText={(v) => updateExamData("abdomen", "shape", v)} placeholder="Flat, distended, etc." />
              <TextInputField label="Tenderness" value={examData.abdomen.tenderness} onChangeText={(v) => updateExamData("abdomen", "tenderness", v)} placeholder="Nil, RIF, epigastric, etc." />
              <ToggleRow label="Guarding" value={examData.abdomen.guarding} onValueChange={(v) => updateExamData("abdomen", "guarding", v)} />
              <ToggleRow label="Rigidity" value={examData.abdomen.rigidity} onValueChange={(v) => updateExamData("abdomen", "rigidity", v)} />
              <TextInputField label="Bowel Sounds" value={examData.abdomen.bowelSounds} onChangeText={(v) => updateExamData("abdomen", "bowelSounds", v)} placeholder="Normal, hyperactive, etc." />
              <TextInputField label="Organomegaly" value={examData.abdomen.organomegaly} onChangeText={(v) => updateExamData("abdomen", "organomegaly", v)} placeholder="Nil, hepatomegaly, etc." />
              <View style={styles.fieldWithVoice}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Additional Notes</Text>
                <VoiceButton fieldKey="exam.abdomen.notes" />
              </View>
              <TextInput style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]} placeholder="Abdomen notes..." placeholderTextColor={theme.textMuted} value={examData.abdomen.notes} onChangeText={(v) => updateExamData("abdomen", "notes", v)} multiline />
            </CollapsibleSection>

            <CollapsibleSection title="Central Nervous System" icon="cpu" iconColor={TriageColors.green}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>CNS Status</Text>
              <SegmentedControl options={["Normal", "Abnormal"]} value={examData.cns.status} onChange={(v) => updateExamData("cns", "status", v)} />
              <TextInputField label="Consciousness" value={examData.cns.consciousness} onChangeText={(v) => updateExamData("cns", "consciousness", v)} placeholder="Alert, drowsy, etc." />
              <TextInputField label="Orientation" value={examData.cns.orientation} onChangeText={(v) => updateExamData("cns", "orientation", v)} placeholder="Oriented to TPP, disoriented, etc." />
              <TextInputField label="Speech" value={examData.cns.speech} onChangeText={(v) => updateExamData("cns", "speech", v)} placeholder="Normal, slurred, etc." />
              <TextInputField label="Motor Power" value={examData.cns.motorPower} onChangeText={(v) => updateExamData("cns", "motorPower", v)} placeholder="5/5 all limbs, etc." />
              <TextInputField label="Reflexes" value={examData.cns.reflexes} onChangeText={(v) => updateExamData("cns", "reflexes", v)} placeholder="Normal, hyperreflexia, etc." />
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
      </KeyboardAwareScrollViewCompat>

      <View style={[styles.bottomNav, { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: insets.bottom + Spacing.sm }]}>
        <Pressable style={[styles.navBtn, styles.prevBtn]} onPress={handlePrevious} disabled={activeTab === "patient"}>
          <Feather name="arrow-left" size={18} color={activeTab === "patient" ? theme.textMuted : theme.text} />
          <Text style={[styles.navBtnText, { color: activeTab === "patient" ? theme.textMuted : theme.text }]}>Previous</Text>
        </Pressable>
        <Pressable style={[styles.navBtn, styles.saveNavBtn, { backgroundColor: theme.textSecondary }]} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <><Feather name="save" size={18} color="#FFFFFF" /><Text style={styles.saveNavBtnText}>Save</Text></>}
        </Pressable>
        <Pressable style={[styles.navBtn, styles.nextBtn, { backgroundColor: TriageColors.green }]} onPress={handleNext}>
          <Text style={styles.nextBtnText}>Next</Text>
          <Feather name="arrow-right" size={18} color="#FFFFFF" />
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
  headerIcon: { padding: Spacing.sm },
  tabBar: { paddingHorizontal: Spacing.md, gap: Spacing.sm, paddingVertical: Spacing.sm },
  tabBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full, gap: Spacing.xs },
  tabBtnText: { fontSize: 13, fontWeight: "600" },
  swipeHint: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingBottom: Spacing.sm, gap: Spacing.xs },
  swipeHintText: { ...Typography.small },
  content: { padding: Spacing.lg },
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
});
