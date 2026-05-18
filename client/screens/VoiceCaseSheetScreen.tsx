import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
  Animated,
} from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import { apiPost, invalidateCases } from "@/lib/api";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type Step = "patient" | "record" | "transcript" | "review";

const ACCENT = "#7c3aed";
const STEPS: Step[] = ["patient", "record", "transcript", "review"];
const STEP_LABELS = ["Patient", "Record", "Transcript", "Review"];

interface ExtractedField {
  key: string;
  label: string;
  value: string;
  icon: string;
}

interface WebRecState {
  mediaRecorder: MediaRecorder | null;
  audioChunks: Blob[];
  stream: MediaStream | null;
}

export default function VoiceCaseSheetScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<NavigationProp>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [step, setStep] = useState<Step>("patient");

  // Patient
  const [patientName, setPatientName] = useState("");
  const [patientAge, setPatientAge] = useState("");
  const [patientSex, setPatientSex] = useState("Male");
  const [caseType, setCaseType] = useState<"adult" | "pediatric">("adult");

  // Recording
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [recDuration, setRecDuration] = useState(0);

  // Transcript
  const [editedTranscript, setEditedTranscript] = useState("");
  const [isExtracting, setIsExtracting] = useState(false);

  // Review
  const [extractedFields, setExtractedFields] = useState<ExtractedField[]>([]);
  const [rawExtracted, setRawExtracted] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const ring1Loop = useRef<Animated.CompositeAnimation | null>(null);
  const ring2Loop = useRef<Animated.CompositeAnimation | null>(null);
  const pulseLoop = useRef<Animated.CompositeAnimation | null>(null);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const nativeRec = useRef<Audio.Recording | null>(null);
  const webRec = useRef<WebRecState>({ mediaRecorder: null, audioChunks: [], stream: null });

  // Auto-detect pediatric from age
  useEffect(() => {
    const age = parseFloat(patientAge);
    if (!isNaN(age) && age > 0) setCaseType(age <= 16 ? "pediatric" : "adult");
  }, [patientAge]);

  // Recording animations
  useEffect(() => {
    if (isRecording) {
      pulseLoop.current = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]));
      pulseLoop.current.start();

      ring1Loop.current = Animated.loop(Animated.sequence([
        Animated.timing(ring1, { toValue: 1, duration: 1400, useNativeDriver: true }),
        Animated.delay(200),
        Animated.timing(ring1, { toValue: 0, duration: 0, useNativeDriver: true }),
      ]));
      ring1Loop.current.start();

      setTimeout(() => {
        ring2Loop.current = Animated.loop(Animated.sequence([
          Animated.timing(ring2, { toValue: 1, duration: 1400, useNativeDriver: true }),
          Animated.delay(200),
          Animated.timing(ring2, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]));
        ring2Loop.current.start();
      }, 500);

      durationInterval.current = setInterval(() => setRecDuration(d => d + 1), 1000);
    } else {
      ring1Loop.current?.stop();
      ring2Loop.current?.stop();
      pulseLoop.current?.stop();
      ring1.setValue(0);
      ring2.setValue(0);
      pulseAnim.setValue(1);
      if (durationInterval.current) { clearInterval(durationInterval.current); durationInterval.current = null; }
    }
    return () => { if (durationInterval.current) clearInterval(durationInterval.current); };
  }, [isRecording]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const startRecording = async () => {
    try {
      setRecDuration(0);
      if (Platform.OS === "web") {
        if (!navigator.mediaDevices?.getUserMedia) {
          Alert.alert("Not Supported", "Voice recording is not available in this browser.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webRec.current.stream = stream;
        webRec.current.audioChunks = [];
        const mr = new MediaRecorder(stream, {
          mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
        });
        mr.ondataavailable = (e) => { if (e.data.size > 0) webRec.current.audioChunks.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(webRec.current.audioChunks, { type: mr.mimeType });
          webRec.current.stream?.getTracks().forEach(t => t.stop());
          handleTranscribe(blob, null);
        };
        webRec.current.mediaRecorder = mr;
        mr.start(100);
        setIsRecording(true);
      } else {
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Permission Required", "Microphone access is needed for voice recording.");
          return;
        }
        if (nativeRec.current) {
          try { await nativeRec.current.stopAndUnloadAsync(); } catch {}
          nativeRec.current = null;
        }
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        nativeRec.current = recording;
        setIsRecording(true);
      }
    } catch (err) {
      Alert.alert("Error", "Could not start recording. Please try again.");
    }
  };

  const stopRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    try {
      if (Platform.OS === "web") {
        const mr = webRec.current.mediaRecorder;
        if (mr && mr.state !== "inactive") mr.stop();
      } else {
        const rec = nativeRec.current;
        if (!rec) return;
        await rec.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        const uri = rec.getURI();
        nativeRec.current = null;
        if (uri) handleTranscribe(null, uri);
      }
    } catch (err) {
      nativeRec.current = null;
    }
  };

  const handleTranscribe = async (blob: Blob | null, uri: string | null) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      if (Platform.OS === "web" && blob) {
        const ext = blob.type.includes("webm") ? "webm" : "m4a";
        formData.append("audio", blob, `voice.${ext}`);
      } else if (uri) {
        const ext = uri.split(".").pop() || "m4a";
        formData.append("audio", {
          uri,
          name: `voice.${ext}`,
          type: `audio/${ext === "caf" ? "x-caf" : ext === "m4a" ? "mp4" : ext}`,
        } as any);
      }
      formData.append("mode", "field");

      const resp = await fetch(new URL("/api/voice/transcribe", getApiUrl()).toString(), {
        method: "POST",
        body: formData,
      });
      if (!resp.ok) throw new Error("Transcription failed");
      const data = await resp.json();
      const text = (data.transcript || "").trim();
      setEditedTranscript(text);
      setStep("transcript");
    } catch (err) {
      Alert.alert("Transcription Failed", "Could not process the recording. Please try again.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleExtract = async () => {
    const text = editedTranscript.trim();
    if (!text) { Alert.alert("Empty", "Please record some audio or type a transcript first."); return; }
    setIsExtracting(true);
    try {
      const resp = await fetch(new URL("/api/voice/extract-clinical", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: text,
          patientContext: { age: parseFloat(patientAge) || 0, sex: patientSex, caseType },
        }),
      });
      if (!resp.ok) throw new Error("Extraction failed");
      const data = await resp.json();
      const extracted = data.extracted || null;
      setRawExtracted(extracted);
      setExtractedFields(buildFieldList(extracted, text));
      setStep("review");
    } catch (err) {
      Alert.alert("Error", "Failed to extract clinical data. Please try again.");
    } finally {
      setIsExtracting(false);
    }
  };

  const buildFieldList = (ex: any, transcript: string): ExtractedField[] => {
    if (!ex) return [{ key: "raw", label: "Full Transcript", value: transcript, icon: "file-text" }];
    const fields: ExtractedField[] = [];
    const add = (key: string, label: string, icon: string, val?: string) => {
      const v = val ?? ex[key];
      if (v && typeof v === "string" && v.trim()) fields.push({ key, label, value: v, icon });
    };
    if (ex.patientName && !patientName) add("patientName", "Patient Name", "user");
    add("chiefComplaint", "Chief Complaint", "alert-circle");
    add("historyOfPresentIllness", "History of Present Illness", "file-text");
    add("onset", "Onset", "clock");
    add("duration", "Duration", "clock");
    add("associatedSymptoms", "Associated Symptoms", "list");
    add("negativeSymptoms", "Pertinent Negatives", "minus-circle");
    add("pastMedicalHistory", "Past Medical History", "archive");
    add("pastSurgicalHistory", "Past Surgical History", "scissors");
    add("allergies", "Allergies", "alert-triangle");
    add("currentMedications", "Current Medications", "package");
    add("treatmentNotes", "Treatment Notes", "edit-3");
    add("investigationsOrdered", "Investigations Ordered", "search");
    add("imagingOrdered", "Imaging Ordered", "camera");
    if (ex.symptoms?.length > 0) fields.push({ key: "symptoms", label: "Symptoms", value: ex.symptoms.join(", "), icon: "activity" });
    if (ex.vitalsSuggested) {
      const vs = ex.vitalsSuggested;
      const parts: string[] = [];
      if (vs.bp) parts.push(`BP: ${vs.bp}`);
      if (vs.hr) parts.push(`HR: ${vs.hr}`);
      if (vs.rr) parts.push(`RR: ${vs.rr}`);
      if (vs.spo2) parts.push(`SpO2: ${vs.spo2}`);
      if (vs.temperature) parts.push(`Temp: ${vs.temperature}`);
      if (vs.grbs) parts.push(`GRBS: ${vs.grbs}`);
      if (parts.length > 0) fields.push({ key: "vitals", label: "Vitals Mentioned", value: parts.join(" | "), icon: "activity" });
    }
    if (ex.examFindings) {
      const ef = ex.examFindings;
      const parts: string[] = [];
      if (ef.general) parts.push(`General: ${ef.general}`);
      if (ef.cvs) parts.push(`CVS: ${ef.cvs}`);
      if (ef.respiratory) parts.push(`Respiratory: ${ef.respiratory}`);
      if (ef.abdomen) parts.push(`Abdomen: ${ef.abdomen}`);
      if (ef.cns) parts.push(`CNS: ${ef.cns}`);
      if (ef.heent) parts.push(`HEENT: ${ef.heent}`);
      if (parts.length > 0) fields.push({ key: "examFindings", label: "Examination Findings", value: parts.join(" | "), icon: "search" });
    }
    if (ex.prescribedMedications?.length > 0) {
      fields.push({
        key: "medications",
        label: "Prescribed Medications",
        value: ex.prescribedMedications.map((m: any) => `${m.name} ${m.dose || ""} ${m.route || ""} ${m.frequency || ""}`.trim()).join(", "),
        icon: "thermometer",
      });
    }
    if (ex.prescribedInfusions?.length > 0) {
      fields.push({
        key: "infusions",
        label: "Infusions / IV Fluids",
        value: ex.prescribedInfusions.map((i: any) => `${i.name} ${i.dose || ""} ${i.dilution ? "in "+i.dilution : ""} ${i.rate ? "@ "+i.rate : ""}`.trim()).join(", "),
        icon: "droplet",
      });
    }
    return fields;
  };

  const buildVitals = (vs: any) => {
    if (!vs) return { hr: 80, bp_systolic: 120, bp_diastolic: 80, rr: 16, spo2: 98, temperature: 36.8, gcs_e: 4, gcs_v: 5, gcs_m: 6, grbs: 100, pain_score: 0 };
    const [sys, dia] = (vs.bp || "120/80").split("/");
    return {
      hr: parseInt(vs.hr) || 80,
      bp_systolic: parseInt(sys) || 120,
      bp_diastolic: parseInt(dia) || 80,
      rr: parseInt(vs.rr) || 16,
      spo2: parseInt(vs.spo2) || 98,
      temperature: parseFloat(vs.temperature) || 36.8,
      gcs_e: 4, gcs_v: 5, gcs_m: 6,
      grbs: parseInt(vs.grbs) || 100,
      pain_score: 0,
    };
  };

  const buildClinical = (ex: any, transcript: string) => ({
    history: {
      hpi: ex?.historyOfPresentIllness || transcript,
      events_hopi: transcript,
      past_medical: ex?.pastMedicalHistory || "",
      past_surgical: ex?.pastSurgicalHistory || "",
      allergies: ex?.allergies ? [ex.allergies] : [],
      medications: ex?.currentMedications || "",
      drug_history: ex?.currentMedications || "",
    },
    examination: ex?.examFindings ? {
      general_appearance: ex.examFindings.general || "",
      cvs_additional_notes: ex.examFindings.cvs || "",
      respiratory_additional_notes: ex.examFindings.respiratory || "",
      abdomen_additional_notes: ex.examFindings.abdomen || "",
      cns_additional_notes: ex.examFindings.cns || "",
      heent: ex.examFindings.heent || "",
    } : {},
    treatment: {
      primary_diagnosis: ex?.diagnosis?.[0] || "",
      provisional_diagnoses: ex?.diagnosis || [],
      differential_diagnoses: ex?.differentialDiagnosis || [],
      medications: ex?.prescribedMedications || [],
      infusions: ex?.prescribedInfusions || [],
      intervention_notes: ex?.treatmentNotes || "",
    },
    investigations: {
      individual_tests: ex?.investigationsOrdered ? [ex.investigationsOrdered] : [],
      imaging: ex?.imagingOrdered ? [ex.imagingOrdered] : [],
    },
    voice_transcript: transcript,
  });

  const handleSave = async () => {
    if (!patientName.trim()) { Alert.alert("Required", "Patient name is required"); setStep("patient"); return; }
    if (!patientAge.trim()) { Alert.alert("Required", "Patient age is required"); setStep("patient"); return; }
    setIsSaving(true);
    try {
      const res = await apiPost<any>("/cases", {
        patient: {
          name: patientName.trim(),
          age: patientAge.trim(),
          sex: patientSex,
          mode_of_arrival: "Walk-in",
          address: "Not provided",
          brought_by: "Self",
          informant_name: patientName.trim(),
          informant_reliability: "Reliable",
          identification_mark: "None noted",
          arrival_datetime: new Date().toISOString(),
        },
        presenting_complaint: {
          text: rawExtracted?.chiefComplaint || "",
          onset_type: rawExtracted?.onset || "",
          duration: rawExtracted?.duration || "",
          course: "",
        },
        vitals_at_arrival: buildVitals(rawExtracted?.vitalsSuggested),
        em_resident: user?.name || "",
        case_type: caseType,
      });

      if (!res.success || !res.data) throw new Error(res.error || "Failed to create case");
      const caseId = String(res.data.id || res.data._id || res.data.case_id || "");

      if (caseId && user?.id) {
        const base = getApiUrl();
        try {
          await fetch(`${base}/api/clinical-data/${caseId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id, clinicalData: buildClinical(rawExtracted, editedTranscript) }),
          });
        } catch {}
        try {
          await fetch(`${base}/api/subscription/increment-case`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id, userEmail: user.email || "" }),
          });
        } catch {}
      }

      await invalidateCases();

      Alert.alert(
        "Case Saved",
        `Voice case for ${patientName.trim()} has been saved successfully.`,
        [
          {
            text: "View Case",
            onPress: () => caseId
              ? navigation.replace("ViewCase", { caseId })
              : navigation.navigate("Main" as any),
          },
          { text: "Done", onPress: () => navigation.navigate("Main" as any) },
        ]
      );
    } catch (err) {
      Alert.alert("Error", (err as Error).message || "Failed to save case");
    } finally {
      setIsSaving(false);
    }
  };

  const stepIdx = STEPS.indexOf(step);
  const topPad = headerHeight + Spacing.md;
  const botPad = insets.bottom + 100;

  return (
    <View style={[s.root, { backgroundColor: theme.backgroundDefault }]}>
      {/* ── PROGRESS BAR ──────────────────────────────────────────────────────── */}
      <View style={[s.progressBar, { paddingTop: topPad, backgroundColor: theme.backgroundDefault, borderBottomColor: theme.border }]}>
        {STEPS.map((st, i) => {
          const done = i < stepIdx;
          const active = i === stepIdx;
          return (
            <React.Fragment key={st}>
              <View style={s.progressStep}>
                <View style={[s.dot, {
                  backgroundColor: done || active ? ACCENT : theme.backgroundSecondary,
                  width: active ? 28 : 22,
                  height: active ? 28 : 22,
                  borderRadius: 14,
                }]}>
                  {done
                    ? <Feather name="check" size={11} color="#fff" />
                    : <Text style={[s.dotNum, { color: active ? "#fff" : theme.textMuted, fontSize: active ? 12 : 10 }]}>{i + 1}</Text>
                  }
                </View>
                <Text style={[s.dotLabel, { color: active ? ACCENT : done ? theme.textSecondary : theme.textMuted, fontWeight: active ? "700" : "400" }]}>
                  {STEP_LABELS[i]}
                </Text>
              </View>
              {i < 3 && <View style={[s.progressLine, { backgroundColor: done ? ACCENT : theme.border }]} />}
            </React.Fragment>
          );
        })}
      </View>

      {/* ── STEP 1: PATIENT ────────────────────────────────────────────────────── */}
      {step === "patient" && (
        <ScrollView
          contentContainerStyle={[s.scrollContent, { paddingBottom: botPad }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[s.heroBanner, { backgroundColor: `${ACCENT}12` }]}>
            <View style={[s.heroIcon, { backgroundColor: ACCENT }]}>
              <Feather name="mic" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[s.heroTitle, { color: theme.text }]}>Voice Case Entry</Text>
              <Text style={[s.heroSubtitle, { color: theme.textSecondary }]}>
                Record the full patient story — AI extracts the clinical data for you
              </Text>
            </View>
          </View>

          <Text style={[s.sectionLabel, { color: theme.textSecondary }]}>Patient Details</Text>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <Text style={[s.inputLabel, { color: theme.textSecondary }]}>Full Name *</Text>
            <TextInput
              style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder="Enter patient name"
              placeholderTextColor={theme.textMuted}
              value={patientName}
              onChangeText={setPatientName}
              autoCapitalize="words"
            />
          </View>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <Text style={[s.inputLabel, { color: theme.textSecondary }]}>Age (years) *</Text>
            <TextInput
              style={[s.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder="Age in years"
              placeholderTextColor={theme.textMuted}
              value={patientAge}
              onChangeText={setPatientAge}
              keyboardType="numeric"
            />
            {caseType === "pediatric" && (
              <Text style={[s.pedNote, { color: "#06b6d4" }]}>
                Pediatric protocol will apply (age 16)
              </Text>
            )}
          </View>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <Text style={[s.inputLabel, { color: theme.textSecondary }]}>Sex</Text>
            <View style={s.toggleRow}>
              {["Male", "Female", "Other"].map(v => (
                <Pressable
                  key={v}
                  style={[s.toggleBtn, {
                    backgroundColor: patientSex === v ? ACCENT : theme.backgroundSecondary,
                    borderColor: patientSex === v ? ACCENT : theme.border,
                  }]}
                  onPress={() => setPatientSex(v)}
                >
                  <Text style={[s.toggleBtnText, { color: patientSex === v ? "#fff" : theme.text }]}>{v}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[s.card, { backgroundColor: theme.card }]}>
            <Text style={[s.inputLabel, { color: theme.textSecondary }]}>Case Type</Text>
            <View style={s.toggleRow}>
              {(["adult", "pediatric"] as const).map(v => (
                <Pressable
                  key={v}
                  style={[s.toggleBtn, {
                    flex: 1,
                    backgroundColor: caseType === v ? ACCENT : theme.backgroundSecondary,
                    borderColor: caseType === v ? ACCENT : theme.border,
                  }]}
                  onPress={() => setCaseType(v)}
                >
                  <Text style={[s.toggleBtnText, { color: caseType === v ? "#fff" : theme.text }]}>
                    {v === "adult" ? "Adult" : "Pediatric"}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <Pressable
            style={[s.primaryBtn, { backgroundColor: ACCENT }]}
            onPress={() => {
              if (!patientName.trim()) { Alert.alert("Required", "Please enter patient name"); return; }
              if (!patientAge.trim()) { Alert.alert("Required", "Please enter patient age"); return; }
              setStep("record");
            }}
          >
            <Feather name="mic" size={18} color="#fff" />
            <Text style={s.primaryBtnText}>Proceed to Recording</Text>
          </Pressable>

          <View style={[s.infoBox, { backgroundColor: `${ACCENT}08`, borderColor: `${ACCENT}25` }]}>
            <Feather name="info" size={14} color={ACCENT} />
            <Text style={[s.infoText, { color: theme.textSecondary }]}>
              No AI diagnosis or ABG analysis in this mode. Transcript is saved directly to the case sheet.
            </Text>
          </View>
        </ScrollView>
      )}

      {/* ── STEP 2: RECORD ─────────────────────────────────────────────────────── */}
      {step === "record" && (
        <View style={[s.recordRoot, { paddingBottom: botPad }]}>
          <Text style={[s.recordTitle, { color: theme.text }]}>
            {isTranscribing ? "Processing audio..." : isRecording ? "Recording" : "Ready to Record"}
          </Text>
          <Text style={[s.recordHint, { color: theme.textSecondary }]}>
            {isRecording
              ? "Speak naturally — history, vitals, exam findings, treatment"
              : isTranscribing
              ? "Transcribing your recording, please wait..."
              : "Tap the mic and dictate the full patient story"}
          </Text>

          <View style={s.micArea}>
            {isRecording && (
              <>
                <Animated.View style={[s.ring, {
                  borderColor: ACCENT,
                  opacity: ring1.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }),
                  transform: [{ scale: ring1.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }) }],
                }]} />
                <Animated.View style={[s.ring, {
                  borderColor: ACCENT,
                  opacity: ring2.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
                  transform: [{ scale: ring2.interpolate({ inputRange: [0, 1], outputRange: [1, 1.75] }) }],
                }]} />
              </>
            )}

            <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
              <Pressable
                style={[s.micBtn, {
                  backgroundColor: isRecording ? "#ef4444" : isTranscribing ? theme.backgroundSecondary : ACCENT,
                }]}
                onPress={isRecording ? stopRecording : isTranscribing ? undefined : startRecording}
                disabled={isTranscribing}
              >
                {isTranscribing
                  ? <ActivityIndicator size="large" color={ACCENT} />
                  : <Feather name={isRecording ? "square" : "mic"} size={52} color="#fff" />
                }
              </Pressable>
            </Animated.View>
          </View>

          {isRecording && (
            <View style={s.timerRow}>
              <View style={[s.recDot, { backgroundColor: "#ef4444" }]} />
              <Text style={[s.timerText, { color: "#ef4444" }]}>{fmtTime(recDuration)}</Text>
            </View>
          )}

          {!isRecording && !isTranscribing && (
            <View style={s.recordFooter}>
              <Text style={[s.langNote, { color: theme.textMuted }]}>
                Supports English, Hindi, Tamil, Telugu, Kannada, Bengali, Marathi and more
              </Text>
              <Pressable style={s.backLink} onPress={() => setStep("patient")}>
                <Feather name="arrow-left" size={15} color={theme.textSecondary} />
                <Text style={[s.backLinkText, { color: theme.textSecondary }]}>Back to patient details</Text>
              </Pressable>
            </View>
          )}

          <Text style={[s.recordAction, { color: theme.textMuted }]}>
            {isRecording ? "Tap the red button when done" : ""}
          </Text>
        </View>
      )}

      {/* ── STEP 3: TRANSCRIPT ─────────────────────────────────────────────────── */}
      {step === "transcript" && (
        <View style={[s.transcriptRoot, { paddingBottom: botPad }]}>
          <View style={s.transcriptHeader}>
            <View style={[s.badge, { backgroundColor: `${ACCENT}15` }]}>
              <Feather name="file-text" size={13} color={ACCENT} />
              <Text style={[s.badgeText, { color: ACCENT }]}>Transcript Ready</Text>
            </View>
            <Text style={[s.transcriptHint, { color: theme.textSecondary }]}>
              Review and edit if needed, then extract clinical fields
            </Text>
          </View>

          <TextInput
            style={[s.transcriptInput, { backgroundColor: theme.card, borderColor: theme.border, color: theme.text }]}
            multiline
            value={editedTranscript}
            onChangeText={setEditedTranscript}
            placeholder="Transcript will appear here..."
            placeholderTextColor={theme.textMuted}
            textAlignVertical="top"
          />

          <View style={s.rowBtns}>
            <Pressable
              style={[s.outlineBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
              onPress={() => { setStep("record"); setRecDuration(0); }}
            >
              <Feather name="mic" size={15} color={theme.text} />
              <Text style={[s.outlineBtnText, { color: theme.text }]}>Re-record</Text>
            </Pressable>
            <Pressable
              style={[s.primaryBtn, { flex: 1, backgroundColor: ACCENT }]}
              onPress={handleExtract}
              disabled={isExtracting}
            >
              {isExtracting
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Feather name="cpu" size={15} color="#fff" />
                    <Text style={s.primaryBtnText}>Extract Clinical Data</Text>
                  </>
              }
            </Pressable>
          </View>
        </View>
      )}

      {/* ── STEP 4: REVIEW & SAVE ──────────────────────────────────────────────── */}
      {step === "review" && (
        <View style={[s.reviewRoot, { paddingBottom: botPad }]}>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.reviewScroll}>
            <View style={[s.reviewBanner, { backgroundColor: `${ACCENT}10`, borderColor: `${ACCENT}30` }]}>
              <Feather name="check-circle" size={16} color={ACCENT} />
              <Text style={[s.reviewBannerText, { color: theme.text }]}>
                {extractedFields.length} fields extracted from voice recording
              </Text>
            </View>

            <View style={[s.patientChip, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Feather name="user" size={14} color={theme.textSecondary} />
              <Text style={[s.patientChipText, { color: theme.text }]}>
                {patientName}  ·  {patientAge} yrs  ·  {patientSex}  ·  {caseType === "pediatric" ? "Pediatric" : "Adult"}
              </Text>
            </View>

            <Text style={[s.sectionLabel, { color: theme.textSecondary, marginTop: Spacing.md }]}>
              Verify extracted fields before saving
            </Text>

            {extractedFields.length === 0 && (
              <View style={[s.emptyFields, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Feather name="alert-circle" size={20} color={theme.textMuted} />
                <Text style={[s.emptyFieldsText, { color: theme.textMuted }]}>
                  No specific fields extracted. The transcript will be saved as history.
                </Text>
              </View>
            )}

            {extractedFields.map(f => (
              <View key={f.key} style={[s.fieldCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={[s.fieldIcon, { backgroundColor: `${ACCENT}15` }]}>
                  <Feather name={f.icon as any} size={13} color={ACCENT} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>{f.label}</Text>
                  <Text style={[s.fieldValue, { color: theme.text }]} numberOfLines={4}>{f.value}</Text>
                </View>
              </View>
            ))}

            <View style={[s.noAiBanner, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Feather name="shield" size={14} color={theme.textSecondary} />
              <Text style={[s.noAiText, { color: theme.textSecondary }]}>
                This case is saved without AI diagnosis or ABG analysis. You can view and edit it from Cases.
              </Text>
            </View>
          </ScrollView>

          <View style={s.reviewActions}>
            <Pressable
              style={[s.outlineBtn, { borderColor: theme.border, backgroundColor: theme.card }]}
              onPress={() => setStep("transcript")}
            >
              <Feather name="edit-2" size={15} color={theme.text} />
              <Text style={[s.outlineBtnText, { color: theme.text }]}>Edit</Text>
            </Pressable>
            <Pressable
              style={[s.primaryBtn, { flex: 1, backgroundColor: ACCENT }]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving
                ? <ActivityIndicator size="small" color="#fff" />
                : <>
                    <Feather name="save" size={15} color="#fff" />
                    <Text style={s.primaryBtnText}>Save to Case Sheet</Text>
                  </>
              }
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1 },

  // Progress
  progressBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  progressStep: { alignItems: "center", gap: 4 },
  progressLine: { flex: 1, height: 2, marginBottom: 16 },
  dot: { alignItems: "center", justifyContent: "center" },
  dotNum: { fontWeight: "700" },
  dotLabel: { fontSize: 10 },

  // Shared
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  card: { padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.sm },
  sectionLabel: { fontSize: Typography.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 1, marginBottom: Spacing.sm, marginLeft: Spacing.xs },
  inputLabel: { fontSize: Typography.sm, fontWeight: "500", marginBottom: Spacing.xs },
  input: { height: 44, borderRadius: BorderRadius.sm, paddingHorizontal: Spacing.md, fontSize: Typography.base },
  toggleRow: { flexDirection: "row", gap: Spacing.sm },
  toggleBtn: { flex: 1, height: 40, borderRadius: BorderRadius.sm, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  toggleBtnText: { fontSize: Typography.sm, fontWeight: "600" },
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 52, borderRadius: BorderRadius.md, gap: Spacing.sm },
  primaryBtnText: { color: "#fff", fontSize: Typography.base, fontWeight: "700" },
  outlineBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: 52, borderRadius: BorderRadius.md, borderWidth: 1, paddingHorizontal: Spacing.lg, gap: Spacing.xs },
  outlineBtnText: { fontSize: Typography.sm, fontWeight: "600" },
  rowBtns: { flexDirection: "row", gap: Spacing.sm, marginTop: Spacing.sm },
  pedNote: { fontSize: Typography.xs, marginTop: Spacing.xs, fontWeight: "500" },

  // Hero / info
  heroBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
    gap: Spacing.md,
  },
  heroIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  heroTitle: { fontSize: Typography.lg, fontWeight: "700" },
  heroSubtitle: { fontSize: Typography.sm, marginTop: 2, lineHeight: 18 },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.lg,
  },
  infoText: { flex: 1, fontSize: Typography.sm, lineHeight: 18 },

  // Record screen
  recordRoot: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: Spacing.xl },
  recordTitle: { fontSize: Typography.xl, fontWeight: "700", textAlign: "center", marginBottom: Spacing.sm },
  recordHint: { fontSize: Typography.base, textAlign: "center", lineHeight: 22, marginBottom: Spacing.xl * 2 },
  micArea: { width: 160, height: 160, alignItems: "center", justifyContent: "center", marginBottom: Spacing.xl },
  ring: { position: "absolute", width: 160, height: 160, borderRadius: 80, borderWidth: 2 },
  micBtn: { width: 120, height: 120, borderRadius: 60, alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 12 },
  timerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: Spacing.xl },
  recDot: { width: 8, height: 8, borderRadius: 4 },
  timerText: { fontSize: 28, fontWeight: "700", fontVariant: ["tabular-nums"] },
  recordFooter: { alignItems: "center", gap: Spacing.md, marginTop: Spacing.xl },
  langNote: { fontSize: Typography.sm, textAlign: "center", lineHeight: 18 },
  backLink: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, padding: Spacing.sm },
  backLinkText: { fontSize: Typography.sm },
  recordAction: { fontSize: Typography.sm, marginTop: Spacing.md },

  // Transcript
  transcriptRoot: { flex: 1, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  transcriptHeader: { marginBottom: Spacing.md },
  badge: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full, marginBottom: Spacing.xs },
  badgeText: { fontSize: Typography.xs, fontWeight: "600" },
  transcriptHint: { fontSize: Typography.sm, lineHeight: 18 },
  transcriptInput: { flex: 1, borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, fontSize: Typography.base, lineHeight: 22, marginBottom: Spacing.md },

  // Review
  reviewRoot: { flex: 1 },
  reviewScroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl },
  reviewBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.md,
  },
  reviewBannerText: { flex: 1, fontSize: Typography.sm, fontWeight: "600" },
  patientChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm + 2,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  patientChipText: { fontSize: Typography.sm, fontWeight: "500" },
  emptyFields: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  emptyFieldsText: { flex: 1, fontSize: Typography.sm, lineHeight: 18 },
  fieldCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.xs,
  },
  fieldIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 2 },
  fieldLabel: { fontSize: Typography.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 },
  fieldValue: { fontSize: Typography.sm, lineHeight: 19 },
  noAiBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.md,
  },
  noAiText: { flex: 1, fontSize: Typography.xs, lineHeight: 17 },
  reviewActions: {
    flexDirection: "row",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
