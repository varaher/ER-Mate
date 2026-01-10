import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  Switch,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { apiPost, apiUpload, invalidateCases } from "@/lib/api";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getVitalRanges, getAgeGroup, getAgeGroupLabel, isPediatric, type VitalRanges } from "@/lib/pediatricVitals";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DEFAULT_VITALS = {
  hr: "80",
  bp_systolic: "120",
  bp_diastolic: "80",
  rr: "16",
  spo2: "98",
  temperature: "36.8",
  gcs_e: "4",
  gcs_v: "5",
  gcs_m: "6",
  grbs: "100",
};

const SEX_OPTIONS = ["Male", "Female", "Other"];
const MODE_OPTIONS = ["Walk-in", "Ambulance", "Referred", "Police"];

type TriageCategory = "red" | "orange" | "yellow" | "green" | "blue";

interface SymptomItem {
  label: string;
  key: string;
  color: string;
}

interface SymptomCategory {
  title: string;
  symptoms: SymptomItem[];
}

const SYMPTOM_CATEGORIES: SymptomCategory[] = [
  {
    title: "Airway / Breathing",
    symptoms: [
      { label: "Obstructed Airway", key: "obstructed_airway", color: "#ef4444" },
      { label: "Stridor", key: "stridor", color: "#ef4444" },
      { label: "Severe Resp Distress", key: "severe_respiratory_distress", color: "#ef4444" },
      { label: "Moderate Resp Distress", key: "moderate_respiratory_distress", color: "#f97316" },
      { label: "Cyanosis", key: "cyanosis", color: "#ef4444" },
    ],
  },
  {
    title: "Circulation",
    symptoms: [
      { label: "Shock", key: "shock", color: "#ef4444" },
      { label: "Severe Bleeding", key: "severe_bleeding", color: "#ef4444" },
      { label: "Chest Pain", key: "chest_pain", color: "#f97316" },
    ],
  },
  {
    title: "Neurological",
    symptoms: [
      { label: "Seizure (Ongoing)", key: "seizure_ongoing", color: "#ef4444" },
      { label: "Confusion", key: "confusion", color: "#f97316" },
      { label: "Lethargic/Unconscious", key: "lethargic_unconscious", color: "#ef4444" },
      { label: "Focal Deficits", key: "focal_deficits", color: "#f97316" },
    ],
  },
  {
    title: "Trauma / Other",
    symptoms: [
      { label: "Major Trauma", key: "major_trauma", color: "#ef4444" },
      { label: "Moderate Trauma", key: "moderate_trauma", color: "#f97316" },
      { label: "Minor Injury", key: "minor_injury", color: "#22c55e" },
      { label: "Fever", key: "fever", color: "#eab308" },
      { label: "Abdominal Pain", key: "abdominal_pain", color: "#f97316" },
      { label: "Vomiting/Diarrhea", key: "vomiting_diarrhea", color: "#eab308" },
      { label: "Allergic Reaction", key: "allergic_reaction", color: "#f97316" },
    ],
  },
];

const TRIAGE_PRIORITY_MAP: Record<TriageCategory, number> = {
  red: 1,
  orange: 2,
  yellow: 3,
  green: 4,
  blue: 5,
};

export default function TriageScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const recordingRef = useRef<Audio.Recording | null>(null);

  const [patientType, setPatientType] = useState<"adult" | "pediatric">("adult");
  const [mlc, setMlc] = useState(false);
  const [selectedTriageColor, setSelectedTriageColor] = useState<TriageCategory>("green");
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(new Set(["normal_no_symptoms"]));
  const [isContinuousRecording, setIsContinuousRecording] = useState(false);
  const [vitalRanges, setVitalRanges] = useState<VitalRanges>(getVitalRanges(30));
  const [ageGroupLabel, setAgeGroupLabel] = useState<string>("Adult (18+ years)");
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isContinuousRecordingRef = useRef(false);

  const [formData, setFormData] = useState({
    name: "",
    age: "",
    sex: "Male",
    phone: "",
    mode_of_arrival: "Walk-in",
    chief_complaint: "",
    hr: "",
    bp_systolic: "",
    bp_diastolic: "",
    rr: "",
    spo2: "",
    temperature: "",
    gcs_e: "",
    gcs_v: "",
    gcs_m: "",
    grbs: "",
  });

  useEffect(() => {
    return () => {
      isContinuousRecordingRef.current = false;
      if (transcriptionIntervalRef.current) {
        clearTimeout(transcriptionIntervalRef.current);
        transcriptionIntervalRef.current = null;
      }
      const recording = recordingRef.current;
      if (recording) {
        recordingRef.current = null;
        (async () => {
          try {
            await recording.stopAndUnloadAsync();
          } catch {
          }
        })();
      }
    };
  }, []);

  useEffect(() => {
    isContinuousRecordingRef.current = isContinuousRecording;
  }, [isContinuousRecording]);

  const updateField = useCallback((field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === "age") {
      const ageValue = parseFloat(value) || 0;
      const newPatientType = isPediatric(ageValue) ? "pediatric" : "adult";
      setPatientType(newPatientType);
      setVitalRanges(getVitalRanges(ageValue));
      setAgeGroupLabel(getAgeGroupLabel(getAgeGroup(ageValue)));
    }
  }, []);

  const recalculateTriageColor = useCallback((symptoms: Set<string>) => {
    if (symptoms.size === 0 || symptoms.has("normal_no_symptoms")) {
      return "green" as TriageCategory;
    }
    
    let highestPriority: TriageCategory = "green";
    const allSymptoms = SYMPTOM_CATEGORIES.flatMap(cat => cat.symptoms);
    
    symptoms.forEach(key => {
      const symptom = allSymptoms.find(s => s.key === key);
      if (symptom) {
        if (symptom.color === "#ef4444") highestPriority = "red";
        else if (symptom.color === "#f97316" && highestPriority !== "red") highestPriority = "orange";
        else if (symptom.color === "#eab308" && highestPriority !== "red" && highestPriority !== "orange") highestPriority = "yellow";
      }
    });
    
    return highestPriority;
  }, []);

  const normalizeComplaint = (text: string): string => {
    return text
      .split(",")
      .map(s => s.trim())
      .filter(s => s.length > 0)
      .join(", ");
  };

  const toggleSymptom = useCallback((symptomKey: string, symptomLabel: string, symptomColor: string) => {
    setSelectedSymptoms((prev) => {
      const next = new Set(prev);
      
      if (symptomKey === "normal_no_symptoms") {
        next.clear();
        next.add("normal_no_symptoms");
        setFormData(prev => ({ ...prev, chief_complaint: "" }));
        setSelectedTriageColor("green");
        return next;
      }
      
      next.delete("normal_no_symptoms");
      
      let currentComplaint = formData.chief_complaint;
      
      if (next.has(symptomKey)) {
        next.delete(symptomKey);
        const complaints = currentComplaint.split(",").map(s => s.trim()).filter(c => c !== symptomLabel && c.length > 0);
        const newComplaint = complaints.join(", ");
        
        if (next.size === 0) {
          next.add("normal_no_symptoms");
          setFormData(prev => ({ ...prev, chief_complaint: "" }));
        } else {
          setFormData(prev => ({ ...prev, chief_complaint: newComplaint }));
        }
      } else {
        next.add(symptomKey);
        if (currentComplaint.trim()) {
          setFormData(prev => ({ ...prev, chief_complaint: normalizeComplaint(`${currentComplaint}, ${symptomLabel}`) }));
        } else {
          setFormData(prev => ({ ...prev, chief_complaint: symptomLabel }));
        }
      }
      
      const newColor = recalculateTriageColor(next);
      setSelectedTriageColor(newColor);
      return next;
    });
  }, [formData.chief_complaint, recalculateTriageColor]);

  const startContinuousRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Microphone access is needed for voice input");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      setIsContinuousRecording(true);
      isContinuousRecordingRef.current = true;
      recordChunk();
    } catch (err) {
      console.error("Recording error:", err);
      Alert.alert("Error", "Failed to start recording");
    }
  };

  const recordChunk = async () => {
    if (!isContinuousRecordingRef.current) return;
    
    try {
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
      
      transcriptionIntervalRef.current = setTimeout(async () => {
        if (recordingRef.current && isContinuousRecordingRef.current) {
          await recordingRef.current.stopAndUnloadAsync();
          const uri = recordingRef.current.getURI();
          recordingRef.current = null;
          setIsRecording(false);
          
          if (uri) {
            await transcribeAudio(uri);
          }
          
          if (isContinuousRecordingRef.current) {
            recordChunk();
          }
        }
      }, 5000);
    } catch (err) {
      console.error("Chunk recording error:", err);
    }
  };

  const stopContinuousRecording = async () => {
    setIsContinuousRecording(false);
    isContinuousRecordingRef.current = false;
    if (transcriptionIntervalRef.current) {
      clearTimeout(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        recordingRef.current = null;
        setIsRecording(false);
        if (uri) {
          await transcribeAudio(uri);
        }
      } catch (err) {
        console.error("Stop recording error:", err);
      }
    }
  };

  const startRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Microphone access is needed for voice input");
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setIsRecording(true);
    } catch (err) {
      console.error("Recording error:", err);
      Alert.alert("Error", "Failed to start recording");
    }
  };

  const stopRecording = async () => {
    if (!recordingRef.current) return;

    setIsRecording(false);
    await recordingRef.current.stopAndUnloadAsync();
    const uri = recordingRef.current.getURI();
    recordingRef.current = null;

    if (uri) {
      await transcribeAudio(uri);
    }
  };

  const transcribeAudio = async (uri: string) => {
    try {
      setTranscribing(true);

      const formData = new FormData();
      formData.append("file", {
        uri,
        name: "voice.m4a",
        type: "audio/m4a",
      } as any);
      formData.append("engine", "auto");
      formData.append("language", "en");

      const res = await apiUpload<{ transcription: string }>("/ai/voice-to-text", formData);

      if (res.success && res.data?.transcription) {
        setVoiceText((prev) => (prev ? `${prev}\n${res.data!.transcription}` : res.data!.transcription));
        setFormData(prev => ({ ...prev, chief_complaint: res.data!.transcription }));
      }
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      setTranscribing(false);
    }
  };

  const getFormWithDefaults = () => {
    return {
      ...formData,
      hr: formData.hr || DEFAULT_VITALS.hr,
      bp_systolic: formData.bp_systolic || DEFAULT_VITALS.bp_systolic,
      bp_diastolic: formData.bp_diastolic || DEFAULT_VITALS.bp_diastolic,
      rr: formData.rr || DEFAULT_VITALS.rr,
      spo2: formData.spo2 || DEFAULT_VITALS.spo2,
      temperature: formData.temperature || DEFAULT_VITALS.temperature,
      gcs_e: formData.gcs_e || DEFAULT_VITALS.gcs_e,
      gcs_v: formData.gcs_v || DEFAULT_VITALS.gcs_v,
      gcs_m: formData.gcs_m || DEFAULT_VITALS.gcs_m,
      grbs: formData.grbs || DEFAULT_VITALS.grbs,
    };
  };

  const fillDefaults = () => {
    setFormData(prev => ({
      ...prev,
      hr: prev.hr || DEFAULT_VITALS.hr,
      bp_systolic: prev.bp_systolic || DEFAULT_VITALS.bp_systolic,
      bp_diastolic: prev.bp_diastolic || DEFAULT_VITALS.bp_diastolic,
      rr: prev.rr || DEFAULT_VITALS.rr,
      spo2: prev.spo2 || DEFAULT_VITALS.spo2,
      temperature: prev.temperature || DEFAULT_VITALS.temperature,
      gcs_e: prev.gcs_e || DEFAULT_VITALS.gcs_e,
      gcs_v: prev.gcs_v || DEFAULT_VITALS.gcs_v,
      gcs_m: prev.gcs_m || DEFAULT_VITALS.gcs_m,
      grbs: prev.grbs || DEFAULT_VITALS.grbs,
    }));
  };

  const handleSave = async () => {
    if (!formData.name) {
      Alert.alert("Required", "Please enter patient name");
      return;
    }

    const fd = getFormWithDefaults();
    setLoading(true);

    try {
      const payload = {
        patient: {
          name: fd.name,
          age: fd.age,
          sex: fd.sex,
          phone: fd.phone,
          mode_of_arrival: fd.mode_of_arrival,
          mlc,
          arrival_datetime: new Date().toISOString(),
        },
        vitals_at_arrival: {
          hr: parseFloat(fd.hr) || 80,
          bp_systolic: parseFloat(fd.bp_systolic) || 120,
          bp_diastolic: parseFloat(fd.bp_diastolic) || 80,
          rr: parseFloat(fd.rr) || 16,
          spo2: parseFloat(fd.spo2) || 98,
          temperature: parseFloat(fd.temperature) || 36.8,
          gcs_e: parseInt(fd.gcs_e) || 4,
          gcs_v: parseInt(fd.gcs_v) || 5,
          gcs_m: parseInt(fd.gcs_m) || 6,
          grbs: parseFloat(fd.grbs) || 100,
        },
        presenting_complaint: {
          text: fd.chief_complaint || voiceText,
          onset_type: "Sudden",
          course: "Progressive",
        },
        triage_priority: TRIAGE_PRIORITY_MAP[selectedTriageColor],
        triage_color: selectedTriageColor,
        em_resident: user?.name || "",
        case_type: patientType,
      };

      const res = await apiPost<{ id: string }>("/cases", payload);

      if (res.success && res.data) {
        await invalidateCases();
        navigation.navigate("CaseSheet", {
          caseId: res.data.id,
          patientType,
          triageData: payload,
        });
      } else {
        Alert.alert("Error", res.error || "Failed to save patient");
      }
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const InputField = ({
    label,
    field,
    keyboardType = "default",
    placeholder = "",
  }: {
    label: string;
    field: string;
    keyboardType?: "default" | "numeric" | "phone-pad";
    placeholder?: string;
  }) => (
    <View style={styles.inputGroup}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        value={(formData as any)[field]}
        onChangeText={(v) => updateField(field, v)}
        keyboardType={keyboardType}
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing["4xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.typeSelector}>
          {(["adult", "pediatric"] as const).map((type) => (
            <Pressable
              key={type}
              style={[
                styles.typeBtn,
                { backgroundColor: patientType === type ? theme.primary : theme.backgroundSecondary },
              ]}
              onPress={() => setPatientType(type)}
            >
              <Feather
                name={type === "adult" ? "user" : "smile"}
                size={18}
                color={patientType === type ? "#FFFFFF" : theme.textSecondary}
              />
              <Text style={{ color: patientType === type ? "#FFFFFF" : theme.textSecondary, fontWeight: "600" }}>
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.voiceSection, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Voice Input (Continuous)</Text>
          <View style={styles.voiceBtnRow}>
            <Pressable
              style={[
                styles.voiceBtn,
                { 
                  backgroundColor: isContinuousRecording ? TriageColors.red : theme.primary,
                  flex: 1,
                },
              ]}
              onPress={isContinuousRecording ? stopContinuousRecording : startContinuousRecording}
              disabled={transcribing}
            >
              {transcribing ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Feather name={isContinuousRecording ? "mic-off" : "mic"} size={24} color="#FFFFFF" />
                  <Text style={styles.voiceBtnText}>
                    {isContinuousRecording ? "Stop" : "Start Continuous"}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
          {isRecording ? (
            <View style={styles.recordingIndicator}>
              <View style={[styles.recordingDot, { backgroundColor: TriageColors.red }]} />
              <Text style={[styles.recordingText, { color: TriageColors.red }]}>Recording...</Text>
            </View>
          ) : null}
          {voiceText ? (
            <View style={[styles.transcriptBox, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.transcriptText, { color: theme.text }]}>{voiceText}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Patient Information</Text>
          <InputField label="Name *" field="name" placeholder="Patient name" />
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <InputField label="Age" field="age" keyboardType="numeric" placeholder="Age" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Sex</Text>
              <View style={styles.segmentedControl}>
                {SEX_OPTIONS.map((s) => (
                  <Pressable
                    key={s}
                    style={[
                      styles.segmentBtn,
                      {
                        backgroundColor: formData.sex === s ? theme.primary : "transparent",
                      },
                    ]}
                    onPress={() => updateField("sex", s)}
                  >
                    <Text
                      style={{
                        color: formData.sex === s ? "#FFFFFF" : theme.textSecondary,
                        fontSize: 12,
                        fontWeight: "600",
                      }}
                    >
                      {s.charAt(0)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          </View>
          <InputField label="Phone" field="phone" keyboardType="phone-pad" placeholder="Phone number" />
          <View style={styles.mlcRow}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>MLC Case</Text>
            <Switch value={mlc} onValueChange={setMlc} trackColor={{ true: theme.primary }} />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Vitals</Text>
          <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>Enter patient vital signs</Text>
          
          <View style={[styles.vitalReferenceCard, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            <View style={styles.vitalReferenceHeader}>
              <Feather name="bar-chart-2" size={16} color={theme.primary} />
              <Text style={[styles.vitalReferenceTitle, { color: theme.text }]}>
                Normal Vitals Reference ({patientType === "pediatric" ? "Pediatric" : "Adult"})
              </Text>
            </View>
            <Text style={[styles.ageGroupText, { color: theme.textSecondary }]}>{ageGroupLabel}</Text>
            <View style={styles.vitalReferenceGrid}>
              <View style={styles.vitalRefItem}>
                <Text style={[styles.vitalRefLabel, { color: theme.primary }]}>HR:</Text>
                <Text style={[styles.vitalRefValue, { color: theme.primary }]}>{vitalRanges.hr.label}</Text>
              </View>
              <View style={styles.vitalRefItem}>
                <Text style={[styles.vitalRefLabel, { color: theme.primary }]}>BP:</Text>
                <Text style={[styles.vitalRefValue, { color: theme.primary }]}>
                  {vitalRanges.bp_systolic.min}-{vitalRanges.bp_systolic.max}/{vitalRanges.bp_diastolic.min}-{vitalRanges.bp_diastolic.max}
                </Text>
              </View>
              <View style={styles.vitalRefItem}>
                <Text style={[styles.vitalRefLabel, { color: theme.primary }]}>RR:</Text>
                <Text style={[styles.vitalRefValue, { color: theme.primary }]}>{vitalRanges.rr.label}</Text>
              </View>
              <View style={styles.vitalRefItem}>
                <Text style={[styles.vitalRefLabel, { color: theme.primary }]}>SpO2:</Text>
                <Text style={[styles.vitalRefValue, { color: theme.primary }]}>{vitalRanges.spo2.label}</Text>
              </View>
              <View style={styles.vitalRefItem}>
                <Text style={[styles.vitalRefLabel, { color: theme.primary }]}>Temp:</Text>
                <Text style={[styles.vitalRefValue, { color: theme.primary }]}>{vitalRanges.temperature.label}</Text>
              </View>
              <View style={styles.vitalRefItem}>
                <Text style={[styles.vitalRefLabel, { color: theme.primary }]}>GCS:</Text>
                <Text style={[styles.vitalRefValue, { color: theme.primary }]}>{vitalRanges.gcs.label}</Text>
              </View>
            </View>
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <InputField label="HR (bpm)" field="hr" keyboardType="numeric" placeholder="80" />
            </View>
            <View style={{ flex: 1 }}>
              <InputField label="RR (/min)" field="rr" keyboardType="numeric" placeholder="16" />
            </View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <InputField label="BP Sys" field="bp_systolic" keyboardType="numeric" placeholder="120" />
            </View>
            <View style={{ flex: 1 }}>
              <InputField label="BP Dia" field="bp_diastolic" keyboardType="numeric" placeholder="80" />
            </View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <InputField label="SpO2 (%)" field="spo2" keyboardType="numeric" placeholder="98" />
            </View>
            <View style={{ flex: 1 }}>
              <InputField label="Temp (C)" field="temperature" keyboardType="numeric" placeholder="36.8" />
            </View>
          </View>
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <InputField label="GRBS" field="grbs" keyboardType="numeric" placeholder="100" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                GCS: {parseInt(formData.gcs_e || "4") + parseInt(formData.gcs_v || "5") + parseInt(formData.gcs_m || "6")}/15
              </Text>
            </View>
          </View>
          <Pressable style={[styles.defaultBtn, { backgroundColor: theme.backgroundSecondary }]} onPress={fillDefaults}>
            <Text style={[styles.defaultBtnText, { color: theme.primary }]}>Fill Normal Values</Text>
          </Pressable>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Triage Category</Text>
          <View style={styles.triagePriorityRow}>
            {(["red", "orange", "yellow", "green", "blue"] as TriageCategory[]).map((color) => (
              <Pressable
                key={color}
                style={[
                  styles.triagePriorityBtn,
                  { 
                    backgroundColor: TriageColors[color],
                    opacity: selectedTriageColor === color ? 1 : 0.4,
                    borderWidth: selectedTriageColor === color ? 3 : 0,
                    borderColor: theme.text,
                  },
                ]}
                onPress={() => setSelectedTriageColor(color)}
              >
                <Text style={styles.triagePriorityText}>{TRIAGE_PRIORITY_MAP[color]}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[styles.triageCategoryLabel, { color: TriageColors[selectedTriageColor] }]}>
            {selectedTriageColor === "red" ? "Critical (Immediate)" :
             selectedTriageColor === "orange" ? "Urgent (< 10 min)" :
             selectedTriageColor === "yellow" ? "Semi-Urgent (< 30 min)" :
             selectedTriageColor === "green" ? "Non-Urgent (< 60 min)" : "Minor (< 120 min)"}
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Symptoms Assessment</Text>
          
          <Pressable
            style={[
              styles.symptomCheckbox,
              {
                backgroundColor: selectedSymptoms.has("normal_no_symptoms") ? "#22c55e" : theme.backgroundSecondary,
                borderColor: "#22c55e",
              },
            ]}
            onPress={() => toggleSymptom("normal_no_symptoms", "Normal (No critical symptoms)", "#22c55e")}
          >
            <Feather
              name={selectedSymptoms.has("normal_no_symptoms") ? "check-square" : "square"}
              size={20}
              color={selectedSymptoms.has("normal_no_symptoms") ? "#FFFFFF" : "#22c55e"}
            />
            <Text style={[styles.symptomLabel, { color: selectedSymptoms.has("normal_no_symptoms") ? "#FFFFFF" : theme.text }]}>
              Normal (No critical symptoms)
            </Text>
          </Pressable>

          {SYMPTOM_CATEGORIES.map((category) => (
            <View key={category.title} style={styles.symptomSection}>
              <Text style={[styles.symptomCategoryTitle, { color: theme.textSecondary }]}>{category.title}</Text>
              <View style={styles.symptomsGrid}>
                {category.symptoms.map((symptom) => {
                  const isSelected = selectedSymptoms.has(symptom.key);
                  return (
                    <Pressable
                      key={symptom.key}
                      style={[
                        styles.symptomCheckbox,
                        {
                          backgroundColor: isSelected ? symptom.color : theme.backgroundSecondary,
                          borderColor: symptom.color,
                        },
                      ]}
                      onPress={() => toggleSymptom(symptom.key, symptom.label, symptom.color)}
                    >
                      <Feather
                        name={isSelected ? "check-square" : "square"}
                        size={18}
                        color={isSelected ? "#FFFFFF" : symptom.color}
                      />
                      <Text style={[styles.symptomLabel, { color: isSelected ? "#FFFFFF" : theme.text }]}>
                        {symptom.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Chief Complaint</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
            placeholder="Describe the chief complaint or select from above..."
            placeholderTextColor={theme.textMuted}
            value={formData.chief_complaint}
            onChangeText={(v) => updateField("chief_complaint", v)}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: theme.primary, opacity: pressed || loading ? 0.8 : 1 },
          ]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Feather name="save" size={20} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Save to Case Sheet</Text>
            </>
          )}
        </Pressable>
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg },
  typeSelector: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  typeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  voiceSection: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.h4, marginBottom: Spacing.md },
  voiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.lg,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  voiceBtnText: { color: "#FFFFFF", ...Typography.bodyMedium },
  voiceBtnRow: { flexDirection: "row", gap: Spacing.sm },
  recordingIndicator: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: Spacing.sm, gap: Spacing.xs },
  recordingDot: { width: 10, height: 10, borderRadius: 5 },
  recordingText: { ...Typography.small, fontWeight: "600" },
  transcriptBox: { padding: Spacing.md, borderRadius: BorderRadius.sm, marginTop: Spacing.md },
  transcriptText: { ...Typography.small, fontStyle: "italic" },
  section: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  sectionSubtitle: { ...Typography.small, marginBottom: Spacing.md },
  vitalReferenceCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  vitalReferenceHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  vitalReferenceTitle: {
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  ageGroupText: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  vitalReferenceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  vitalRefItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: "45%",
  },
  vitalRefLabel: {
    ...Typography.small,
    fontWeight: "600",
  },
  vitalRefValue: {
    ...Typography.small,
  },
  inputGroup: { marginBottom: Spacing.md },
  label: { ...Typography.label, marginBottom: Spacing.xs },
  input: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    ...Typography.body,
  },
  row: { flexDirection: "row", gap: Spacing.md },
  segmentedControl: {
    flexDirection: "row",
    borderRadius: BorderRadius.sm,
    overflow: "hidden",
    height: Spacing.inputHeight,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  segmentBtn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  mlcRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  defaultBtn: { alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.sm, marginTop: Spacing.md },
  defaultBtnText: { ...Typography.label },
  textArea: {
    height: 100,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    ...Typography.body,
  },
  triagePriorityRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  triagePriorityBtn: {
    flex: 1,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  triagePriorityText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  triageCategoryLabel: {
    textAlign: "center",
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  symptomSection: {
    marginTop: Spacing.md,
  },
  symptomCategoryTitle: {
    ...Typography.label,
    marginBottom: Spacing.sm,
  },
  symptomsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  symptomCheckbox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  symptomLabel: {
    ...Typography.small,
    fontWeight: "500",
  },
  complaintCategory: {
    marginBottom: Spacing.sm,
  },
  categoryHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
  },
  categoryHeaderText: {
    color: "#FFFFFF",
    ...Typography.bodyMedium,
    fontWeight: "600",
  },
  complaintsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: Spacing.sm,
    gap: Spacing.xs,
    borderBottomLeftRadius: BorderRadius.sm,
    borderBottomRightRadius: BorderRadius.sm,
  },
  complaintChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  complaintChipText: {
    ...Typography.small,
    fontWeight: "500",
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  saveBtnText: { color: "#FFFFFF", ...Typography.h4 },
});
