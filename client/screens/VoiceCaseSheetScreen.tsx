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
import AsyncStorage from "@react-native-async-storage/async-storage";
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
  source: 'voice' | 'prefill' | 'missing';
  confidence: 'high' | 'medium' | 'low';
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

  // Transcript + language
  const [detectedLanguage, setDetectedLanguage] = useState("");
  const [englishTranscript, setEnglishTranscript] = useState("");

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
      const engText = (data.englishTranscript || data.transcript || "").trim();
      const lang = data.detectedLanguage || "en-IN";
      setEditedTranscript(text);
      setEnglishTranscript(engText);
      setDetectedLanguage(lang);
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

    // If the doctor edited the transcript in a non-English language, re-translate before extraction
    let extractText = text;
    const isNonEnglish = detectedLanguage && !detectedLanguage.startsWith("en");
    try {
      if (isNonEnglish) {
        const tResp = await fetch(new URL("/api/voice/translate", getApiUrl()).toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, sourceLanguage: detectedLanguage }),
        });
        if (tResp.ok) {
          const tData = await tResp.json();
          const translated = (tData.englishText || "").trim();
          if (translated) {
            extractText = translated;
            setEnglishTranscript(translated);
          }
        }
      } else if (englishTranscript && englishTranscript !== text) {
        // Original transcript was non-English but doctor switched to English editing
        extractText = englishTranscript;
      }
    } catch (_) { /* translation best-effort, fall back to edited text */ }

    try {
      const resp = await fetch(new URL("/api/voice/extract-clinical", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: extractText,
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

  const computeCompleteness = (ex: any) => {
    const ps = ex?.primarySurvey || {};
    const vs = ex?.vitalsSuggested || {};
    const hasVBGMentioned = !!(ex?.vbgResults?.ph || ex?.vbgResults?.pco2 || ex?.vbgResults?.hco3);
    const hasConsultMentioned = !!(ex?.consultations?.length > 0 || ex?.consultationGiven);

    const checks = [
      // Patient
      { label: "Patient Name", filled: !!(ex?.patientName || patientName) },
      { label: "Patient Age", filled: !!patientAge },
      // Complaint
      { label: "Chief Complaint", filled: !!(ex?.chiefComplaint) },
      { label: "Duration / Onset", filled: !!(ex?.duration || ex?.onset) },
      // History
      { label: "HPI Narrative", filled: !!(ex?.historyOfPresentIllness) },
      { label: "Past Medical History", filled: !!(ex?.pastMedicalHistory) },
      // Primary survey vitals
      { label: "BP", filled: !!(vs.bp || (ps.circulation?.bpSystolic && ps.circulation?.bpDiastolic)) },
      { label: "HR / Pulse", filled: !!(vs.hr || ps.circulation?.hr) },
      { label: "SpO2", filled: !!(vs.spo2 || ps.breathing?.spo2) },
      { label: "GCS", filled: !!(vs.gcs || ps.disability?.gcsTotal) },
      // Primary survey clinical
      { label: "Airway Assessment", filled: !!(ps.airway?.status || ps.airway?.findings) },
      { label: "Auscultation", filled: !!(ps.breathing?.auscultation) },
      // Labs always required
      { label: "Labs / Investigations", filled: !!(ex?.investigationsOrdered || ex?.imagingOrdered || hasVBGMentioned) },
      // Team
      { label: "EM Resident", filled: !!(ex?.emResident) },
      // Diagnosis + Disposition
      { label: "Working Diagnosis", filled: !!(ex?.diagnosis?.length > 0) },
      { label: "Disposition Plan", filled: !!(ex?.disposition?.plan) },
      // Conditional: VBG completeness only if VBG was mentioned
      ...(hasVBGMentioned ? [
        { label: "VBG — pH", filled: !!(ex?.vbgResults?.ph) },
        { label: "VBG — HCO3", filled: !!(ex?.vbgResults?.hco3) },
        { label: "VBG — Lactate", filled: !!(ex?.vbgResults?.lactate) },
      ] : []),
      // Conditional: consultation advice only if consultation mentioned
      ...(hasConsultMentioned ? [
        { label: "Consultation Advice", filled: !!(ex?.consultations?.[0]?.adviceGiven || ex?.consultationGiven) },
      ] : []),
    ];
    const filled = checks.filter(c => c.filled).length;
    return { filled, total: checks.length, percent: Math.round((filled / checks.length) * 100), checks };
  };

  const buildFieldList = (ex: any, transcript: string): ExtractedField[] => {
    const conf = ex?.sectionConfidence || {};
    const getConf = (section: string): 'high' | 'medium' | 'low' => {
      const c = conf[section] || '';
      if (c === 'high') return 'high';
      if (c === 'medium') return 'medium';
      return 'low';
    };

    if (!ex) return [{ key: "raw", label: "Full Transcript", value: transcript, icon: "file-text", source: 'voice', confidence: 'low' }];
    const fields: ExtractedField[] = [];

    const addVoice = (key: string, label: string, icon: string, val: string, section: string) => {
      if (val && val.trim()) {
        fields.push({ key, label, value: val, icon, source: 'voice', confidence: getConf(section) });
      }
    };
    const addMissing = (key: string, label: string, icon: string) => {
      fields.push({ key, label, value: "Not mentioned — tap to add", icon, source: 'missing', confidence: 'low' });
    };
    const addPrefill = (key: string, label: string, icon: string, val: string) => {
      fields.push({ key, label, value: val, icon, source: 'prefill', confidence: 'medium' });
    };

    // Patient
    if (ex.patientName) addVoice("patientName", "Patient Name", "user", ex.patientName, "patient");
    if (ex.emResident) addVoice("emResident", "EM Resident", "user", ex.emResident, "doctors");
    if (ex.emConsultant) addVoice("emConsultant", "EM Consultant", "user", ex.emConsultant, "doctors");

    // Consultations
    const consultList = (ex.consultations || []).filter((c: any) => c.specialty || c.doctorName);
    if (consultList.length > 0) {
      addVoice("consultations", "Specialist Consultations", "phone",
        consultList.map((c: any) => `${c.specialty}${c.doctorName ? ' (Dr. '+c.doctorName+')' : ''}${c.adviceGiven ? ': '+c.adviceGiven : ''}`).join('; '), "doctors");
    } else if (ex.consultationGiven) {
      addVoice("consultationGiven", "Specialist Consultation", "phone", ex.consultationGiven, "doctors");
    }

    // Chief Complaint
    if (ex.chiefComplaint) addVoice("chiefComplaint", "Chief Complaint", "alert-circle", ex.chiefComplaint, "chiefComplaint");
    else addMissing("chiefComplaint", "Chief Complaint", "alert-circle");

    // HPI
    if (ex.historyOfPresentIllness) addVoice("hpi", "History of Present Illness", "file-text", ex.historyOfPresentIllness, "hpi");
    else addMissing("hpi", "History of Present Illness", "file-text");

    if (ex.negativeSymptoms) addVoice("negativeSymptoms", "Pertinent Negatives", "minus-circle", ex.negativeSymptoms, "hpi");

    // Past History
    if (ex.pastMedicalHistory) addVoice("pastMedical", "Past Medical History", "archive", ex.pastMedicalHistory, "pastHistory");
    else addPrefill("pastMedical", "Past Medical History", "archive", "None significant (pre-filled normal)");
    if (ex.pastSurgicalHistory) addVoice("pastSurgical", "Past Surgical History", "scissors", ex.pastSurgicalHistory, "pastHistory");
    if (ex.allergies) addVoice("allergies", "Allergies", "alert-triangle", ex.allergies, "pastHistory");
    else addPrefill("allergies", "Allergies", "alert-triangle", "NKDA (pre-filled normal)");
    if (ex.currentMedications) addVoice("currentMeds", "Current Medications", "package", ex.currentMedications, "pastHistory");

    // Primary Survey / Vitals
    const vs = ex.vitalsSuggested || {};
    const ps = ex.primarySurvey || {};
    const vitalParts: string[] = [];
    const bp = vs.bp || (ps.circulation?.bpSystolic && ps.circulation?.bpDiastolic ? `${ps.circulation.bpSystolic}/${ps.circulation.bpDiastolic}` : "");
    const hr = vs.hr || ps.circulation?.hr || "";
    const rr = vs.rr || ps.breathing?.rr || "";
    const spo2 = vs.spo2 || ps.breathing?.spo2 || "";
    const temp = vs.temperature || ps.exposure?.temperature || "";
    const grbs = vs.grbs || ps.disability?.grbs || "";
    const gcs = vs.gcs || ps.disability?.gcsTotal || "";
    if (bp) vitalParts.push(`BP: ${bp}`);
    if (hr) vitalParts.push(`HR: ${hr}`);
    if (rr) vitalParts.push(`RR: ${rr}`);
    if (spo2) vitalParts.push(`SpO2: ${spo2}`);
    if (temp) vitalParts.push(`Temp: ${temp}`);
    if (grbs) vitalParts.push(`GRBS: ${grbs}`);
    if (gcs) vitalParts.push(`GCS: ${gcs}`);
    if (vitalParts.length > 0) addVoice("vitals", "Primary Survey / Vitals", "activity", vitalParts.join("  |  "), "primarySurvey");
    else addMissing("vitals", "Primary Survey / Vitals", "activity");

    // Airway
    if (ps.airway?.status || ps.airway?.findings) {
      addVoice("airway", "Airway", "wind", `${ps.airway.status || ""}${ps.airway.findings ? ' — '+ps.airway.findings : ''}`.trim(), "primarySurvey");
    } else {
      addPrefill("airway", "Airway", "wind", "Patent, self-maintained");
    }

    // Breathing
    if (ps.breathing?.auscultation) {
      addVoice("auscultation", "Auscultation", "headphones", ps.breathing.auscultation, "primarySurvey");
    } else {
      addPrefill("auscultation", "Auscultation", "headphones", "Air entry bilaterally equal and clear, no wheeze or crepts");
    }
    if (ps.breathing?.workOfBreathing) addVoice("wob", "Work of Breathing", "activity", ps.breathing.workOfBreathing, "primarySurvey");
    else addPrefill("wob", "Work of Breathing", "activity", "No accessory muscle use");
    if (ps.breathing?.oxygenDevice) addVoice("o2device", "Oxygen Device", "wind", ps.breathing.oxygenDevice, "primarySurvey");
    else addPrefill("o2device", "Oxygen Device", "wind", "Room air");

    // Circulation
    const crt = ps.circulation?.crt;
    const cvs = ex?.examFindings?.cvs;
    if (crt) addVoice("crt", "Capillary Refill", "clock", crt, "primarySurvey");
    else addPrefill("crt", "Capillary Refill", "clock", "< 2 seconds");
    if (cvs) addVoice("cvs", "CVS Auscultation", "heart", cvs, "examination");
    else addPrefill("cvs", "CVS Auscultation", "heart", "S1 S2 heard, no murmurs");

    // Disability
    if (ps.disability?.pupils) addVoice("pupils", "Pupils", "eye", ps.disability.pupils, "primarySurvey");
    else addPrefill("pupils", "Pupils", "eye", "Bilaterally equal and reactive to light");
    if (ps.disability?.power) addVoice("power", "Motor Power", "zap", ps.disability.power, "primarySurvey");
    else addPrefill("power", "Motor Power", "zap", "5/5 all four limbs, no focal deficit");

    // Exposure
    const exposure = ps.exposure?.findings || ex?.examFindings?.musculoskeletal;
    if (exposure) addVoice("exposure", "Exposure / Skin", "search", exposure, "primarySurvey");
    else addPrefill("exposure", "Exposure / Skin", "search", "No external injuries, no rash, no pedal oedema");

    // VBG
    if (ex.vbgResults) {
      const vbg = ex.vbgResults;
      const parts: string[] = [];
      if (vbg.ph) parts.push(`pH ${vbg.ph}`);
      if (vbg.pco2) parts.push(`PCO2 ${vbg.pco2}`);
      if (vbg.po2) parts.push(`PO2 ${vbg.po2}`);
      if (vbg.hco3) parts.push(`HCO3 ${vbg.hco3}`);
      if (vbg.lactate) parts.push(`Lac ${vbg.lactate}`);
      if (vbg.hemoglobin) parts.push(`Hb ${vbg.hemoglobin}`);
      if (vbg.sodium) parts.push(`Na ${vbg.sodium}`);
      if (vbg.potassium) parts.push(`K ${vbg.potassium}`);
      if (vbg.creatinine) parts.push(`Cr ${vbg.creatinine}`);
      if (parts.length > 0) addVoice("vbg", "VBG / ABG", "droplet", parts.join("  |  "), "investigations");
    }

    // Exam
    const ef = ex.examFindings || {};
    const examParts: string[] = [];
    if (ef.general) examParts.push(`General: ${ef.general}`);
    if (ef.cvs) examParts.push(`CVS: ${ef.cvs}`);
    if (ef.respiratory) examParts.push(`Resp: ${ef.respiratory}`);
    if (ef.abdomen) examParts.push(`Abd: ${ef.abdomen}`);
    if (ef.cns) examParts.push(`CNS: ${ef.cns}`);
    if (ef.heent) examParts.push(`HEENT: ${ef.heent}`);
    if (ef.musculoskeletal) examParts.push(`MSK: ${ef.musculoskeletal}`);
    if (examParts.length > 0) addVoice("exam", "Examination Findings", "search", examParts.join("  |  "), "examination");
    else addPrefill("exam", "Examination Findings", "search", "Within normal limits (pre-filled)");

    // Investigations
    if (ex.investigationsOrdered) addVoice("labs", "Labs Ordered", "clipboard", ex.investigationsOrdered, "investigations");
    if (ex.imagingOrdered) addVoice("imaging", "Imaging Ordered", "camera", ex.imagingOrdered, "investigations");

    // Treatment
    if (ex.prescribedMedications?.length > 0) {
      const meds = ex.prescribedMedications.filter((m: any) => m.name);
      if (meds.length > 0) addVoice("medications", `Medications (${meds.length})`, "thermometer",
        meds.map((m: any) => `${m.name} ${m.dose || ''} ${m.route || ''} ${m.frequency || ''}`.trim()).join('\n'), "treatment");
    }
    if (ex.prescribedInfusions?.length > 0) {
      const inf = ex.prescribedInfusions.filter((i: any) => i.name);
      if (inf.length > 0) addVoice("infusions", `IV Fluids (${inf.length})`, "droplet",
        inf.map((i: any) => `${i.name} ${i.dose || ''} ${i.rate ? '@ '+i.rate : ''}`.trim()).join('\n'), "treatment");
    }
    if (ex.treatmentNotes) addVoice("treatmentNotes", "Treatment Notes", "edit-3", ex.treatmentNotes, "treatment");

    // Diagnosis
    if (ex.diagnosis?.length > 0) addVoice("diagnosis", "Working Diagnosis", "clipboard", ex.diagnosis.join(', '), "diagnosis");
    else addMissing("diagnosis", "Working Diagnosis", "clipboard");
    if (ex.differentialDiagnosis?.length > 0) addVoice("differentials", "Differentials", "git-branch", ex.differentialDiagnosis.join(', '), "diagnosis");

    // Disposition
    if (ex.disposition?.plan) addVoice("disposition", "Disposition Plan", "log-out", ex.disposition.plan, "disposition");

    // Psychological screen
    const psych = ex.psychologicalAssessment;
    if (psych) {
      const flags = [
        psych.suicidalIdeation ? 'Suicidal ideation' : null,
        psych.selfHarm ? 'Self-harm history' : null,
        psych.substanceAbuse ? 'Substance abuse' : null,
        psych.psychiatricHistory ? 'Psychiatric history' : null,
      ].filter(Boolean);
      if (flags.length > 0) addVoice("psychological", "Psychological Flags", "alert-triangle", flags.join(', '), "psychological");
      else addPrefill("psychological", "Psychological Screen", "check-circle", "Screened — no flags identified");
    }

    return fields;
  };

  const computeTriageFromVitals = (vs: any) => {
    if (!vs) return { triage_color: "green", triage_priority: 4 };
    const [sys] = (vs.bp || "120/80").split("/");
    const bpSys = parseInt(sys) || 120;
    const hr = parseInt(vs.hr) || 80;
    const spo2 = parseInt(vs.spo2) || 98;
    const gcs = parseInt(vs.gcs) || 15;
    const rr = parseInt(vs.rr) || 16;
    if (spo2 < 90 || gcs < 9 || bpSys < 80)
      return { triage_color: "red", triage_priority: 1 };
    if (spo2 < 94 || gcs < 13 || bpSys < 100 || hr > 120)
      return { triage_color: "orange", triage_priority: 2 };
    if (spo2 < 96 || hr > 100 || bpSys > 160 || rr > 24)
      return { triage_color: "yellow", triage_priority: 3 };
    if (hr > 90 || bpSys > 140)
      return { triage_color: "green", triage_priority: 4 };
    return { triage_color: "blue", triage_priority: 5 };
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

  const buildClinical = (ex: any, transcript: string) => {
    const pastMedRaw = ex?.pastMedicalHistory || "";
    const pastMedArr: string[] = pastMedRaw
      ? pastMedRaw.split(/[,;\/\n]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 0)
      : [];

    const symptomsArr: string[] = [];
    if (ex?.symptoms?.length > 0) symptomsArr.push(...ex.symptoms);
    if (ex?.associatedSymptoms) symptomsArr.push(ex.associatedSymptoms);
    if (ex?.negativeSymptoms) symptomsArr.push(`Negative: ${ex.negativeSymptoms}`);

    const vbg = ex?.vbgResults;
    const vbgText = vbg ? [
      vbg.ph ? `pH ${vbg.ph}` : "",
      vbg.pco2 ? `PCO2 ${vbg.pco2}` : "",
      vbg.po2 ? `PO2 ${vbg.po2}` : "",
      vbg.hco3 ? `HCO3 ${vbg.hco3}` : "",
      vbg.lactate ? `Lactate ${vbg.lactate}` : "",
      vbg.hemoglobin ? `Hb ${vbg.hemoglobin}` : "",
      vbg.sodium ? `Na ${vbg.sodium}` : "",
      vbg.potassium ? `K ${vbg.potassium}` : "",
      vbg.creatinine ? `Cr ${vbg.creatinine}` : "",
    ].filter(Boolean).join(", ") : "";

    // Build consultation note from master schema consultations array, fallback to legacy field
    const consultationsArr: string[] = (ex?.consultations || [])
      .filter((c: any) => c.specialty || c.doctorName)
      .map((c: any) => [
        c.specialty,
        c.doctorName ? `Dr. ${c.doctorName}` : "",
        c.adviceGiven ? `— ${c.adviceGiven}` : "",
      ].filter(Boolean).join(" "));
    const consultationNote = consultationsArr.length > 0
      ? `Consultations: ${consultationsArr.join("; ")}. `
      : ex?.consultationGiven ? `Consultation: ${ex.consultationGiven}. ` : "";
    const treatmentNotes = consultationNote + (ex?.treatmentNotes || "");

    return {
      history: {
        hpi: ex?.historyOfPresentIllness || transcript,
        events_hopi: ex?.historyOfPresentIllness || transcript,
        signs_and_symptoms: symptomsArr.join(", "),
        past_medical: pastMedArr,
        past_surgical: ex?.pastSurgicalHistory || "",
        allergies: ex?.allergies ? ex.allergies.split(/[,;]+/).map((s: string) => s.trim()).filter((s: string) => s) : [],
        medications: ex?.currentMedications || "",
        drug_history: ex?.currentMedications || "",
        family_history: ex?.familyHistory || "",
        social_history: ex?.socialHistory || "",
      },
      primary_survey: {
        airway: ex?.primarySurvey?.airway?.status || ex?.primarySurvey?.airway?.findings || "Patent, self-maintained",
        airway_intervention: ex?.primarySurvey?.airway?.intervention || "",
        breathing_rate: ex?.primarySurvey?.breathing?.rr || ex?.vitalsSuggested?.rr || "",
        spo2: ex?.primarySurvey?.breathing?.spo2 || ex?.vitalsSuggested?.spo2 || "",
        auscultation: ex?.primarySurvey?.breathing?.auscultation || "Air entry bilaterally equal and clear",
        work_of_breathing: ex?.primarySurvey?.breathing?.workOfBreathing || "No accessory muscle use",
        oxygen_device: ex?.primarySurvey?.breathing?.oxygenDevice || "Room air",
        bp_systolic: ex?.primarySurvey?.circulation?.bpSystolic || "",
        bp_diastolic: ex?.primarySurvey?.circulation?.bpDiastolic || "",
        heart_rate: ex?.primarySurvey?.circulation?.hr || ex?.vitalsSuggested?.hr || "",
        crt: ex?.primarySurvey?.circulation?.crt || "< 2 seconds",
        gcs_total: ex?.primarySurvey?.disability?.gcsTotal || ex?.vitalsSuggested?.gcs || "",
        gcs_e: ex?.primarySurvey?.disability?.gcsE || "",
        gcs_v: ex?.primarySurvey?.disability?.gcsV || "",
        gcs_m: ex?.primarySurvey?.disability?.gcsM || "",
        pupils: ex?.primarySurvey?.disability?.pupils || "Bilaterally equal and reactive to light",
        power: ex?.primarySurvey?.disability?.power || "5/5 all four limbs",
        grbs: ex?.primarySurvey?.disability?.grbs || ex?.vitalsSuggested?.grbs || "",
        temperature: ex?.primarySurvey?.exposure?.temperature || ex?.vitalsSuggested?.temperature || "",
        exposure_findings: ex?.primarySurvey?.exposure?.findings || "No external injuries, no rash, no pedal oedema",
      },
      examination: {
        general_appearance: ex?.examFindings?.general || "Conscious, oriented, comfortable at rest",
        cvs_additional_notes: ex?.examFindings?.cvs || "S1 S2 heard, no murmurs",
        respiratory_additional_notes: ex?.examFindings?.respiratory || "Normal vesicular breath sounds bilaterally",
        abdomen_additional_notes: ex?.examFindings?.abdomen || "Soft, non-tender, no organomegaly",
        cns_additional_notes: ex?.examFindings?.cns || "No focal neurological deficit",
        heent: ex?.examFindings?.heent || "",
        musculoskeletal: ex?.examFindings?.musculoskeletal || "",
      },
      treatment: {
        primary_diagnosis: ex?.diagnosis?.[0] || "",
        provisional_diagnoses: ex?.diagnosis || [],
        differential_diagnoses: ex?.differentialDiagnosis || [],
        medications: ex?.prescribedMedications || [],
        infusions: ex?.prescribedInfusions || [],
        intervention_notes: treatmentNotes.trim(),
        course_in_hospital: treatmentNotes.trim(),
        consultations: (ex?.consultations || []).filter((c: any) => c.specialty || c.doctorName),
      },
      investigations: {
        individual_tests: ex?.investigationsOrdered
          ? ex.investigationsOrdered.split(/[,;]+/).map((s: string) => s.trim()).filter((s: string) => s)
          : [],
        imaging: ex?.imagingOrdered
          ? ex.imagingOrdered.split(/[,;]+/).map((s: string) => s.trim()).filter((s: string) => s)
          : [],
        vbg: vbg ? {
          ph: vbg?.ph || "",
          pco2: vbg?.pco2 || "",
          po2: vbg?.po2 || "",
          hco3: vbg?.hco3 || "",
          lactate: vbg?.lactate || "",
          hemoglobin: vbg?.hemoglobin || "",
          sodium: vbg?.sodium || "",
          potassium: vbg?.potassium || "",
          creatinine: vbg?.creatinine || "",
          raw: vbgText,
        } : undefined,
        vbg_raw: vbgText || undefined,
      },
      disposition: {
        plan: ex?.disposition?.plan || "",
        follow_up: ex?.disposition?.followUp || "",
        discharge_instructions: ex?.disposition?.dischargeInstructions || "",
      },
      psychological_assessment: ex?.psychologicalAssessment ? {
        suicidal_ideation: ex.psychologicalAssessment.suicidalIdeation || false,
        self_harm: ex.psychologicalAssessment.selfHarm || false,
        intent_to_harm_others: ex.psychologicalAssessment.intentToHarmOthers || false,
        substance_abuse: ex.psychologicalAssessment.substanceAbuse || false,
        psychiatric_history: ex.psychologicalAssessment.psychiatricHistory || false,
        currently_on_psychiatric_treatment: ex.psychologicalAssessment.currentlyOnPsychiatricTreatment || false,
        has_support_system: ex.psychologicalAssessment.hasSupportSystem || false,
        notes: ex.psychologicalAssessment.notes || "",
      } : undefined,
      voice_transcript: transcript,
      detected_language: detectedLanguage || "en-IN",
      english_transcript: englishTranscript || transcript,
    };
  };

  const handleSave = async () => {
    if (!patientName.trim()) { Alert.alert("Required", "Patient name is required"); setStep("patient"); return; }
    if (!patientAge.trim()) { Alert.alert("Required", "Patient age is required"); setStep("patient"); return; }
    setIsSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      const authHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const emResident = rawExtracted?.emResident || user?.name || "";
      const emConsultant = rawExtracted?.emConsultant || "";

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
          onset_type: rawExtracted?.onset || "Sudden",
          duration: rawExtracted?.duration || "",
          course: "",
        },
        vitals_at_arrival: buildVitals(rawExtracted?.vitalsSuggested),
        ...computeTriageFromVitals(rawExtracted?.vitalsSuggested),
        em_resident: emResident,
        em_consultant: emConsultant,
        case_type: caseType,
      });

      if (!res.success || !res.data) throw new Error(res.error || "Failed to create case");
      const caseId = String(res.data.id || res.data._id || res.data.case_id || "");

      if (caseId && user?.id) {
        const base = getApiUrl();
        try {
          const clinicalResp = await fetch(`${base}/api/clinical-data/${caseId}`, {
            method: "POST",
            headers: authHeaders,
            body: JSON.stringify({ userId: user.id, clinicalData: buildClinical(rawExtracted, editedTranscript) }),
          });
          if (!clinicalResp.ok) {
            console.warn("[VoiceCase] Clinical data save failed:", clinicalResp.status, await clinicalResp.text().catch(() => ""));
          }
        } catch (e) {
          console.warn("[VoiceCase] Clinical data save error:", e);
        }
        try {
          await fetch(`${base}/api/subscription/increment-case`, {
            method: "POST",
            headers: authHeaders,
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
          {
            text: "Dashboard",
            onPress: () => navigation.navigate("Main" as any),
          },
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
            <View style={s.transcriptBadgeRow}>
              <View style={[s.badge, { backgroundColor: `${ACCENT}15` }]}>
                <Feather name="file-text" size={13} color={ACCENT} />
                <Text style={[s.badgeText, { color: ACCENT }]}>Transcript Ready</Text>
              </View>
              {detectedLanguage && !detectedLanguage.startsWith('en') && (
                <View style={[s.badge, { backgroundColor: "#06b6d415" }]}>
                  <Feather name="globe" size={13} color="#06b6d4" />
                  <Text style={[s.badgeText, { color: "#06b6d4" }]}>{detectedLanguage.toUpperCase()}</Text>
                </View>
              )}
            </View>
            <Text style={[s.transcriptHint, { color: theme.textSecondary }]}>
              {detectedLanguage && !detectedLanguage.startsWith('en')
                ? "Original language shown — AI will extract using English translation"
                : "Review and edit if needed, then extract clinical fields"}
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
      {step === "review" && (() => {
        const completeness = computeCompleteness(rawExtracted);
        const voiceCount = extractedFields.filter(f => f.source === 'voice').length;
        const missingCount = extractedFields.filter(f => f.source === 'missing').length;
        return (
          <View style={[s.reviewRoot, { paddingBottom: botPad }]}>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.reviewScroll}>

              {/* Completeness bar */}
              <View style={[s.completenessCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <View style={s.completenessRow}>
                  <Text style={[s.completenessTitle, { color: theme.text }]}>Case Completeness</Text>
                  <Text style={[s.completenessScore, { color: completeness.percent >= 70 ? "#16a34a" : completeness.percent >= 40 ? "#d97706" : "#dc2626" }]}>
                    {completeness.filled}/{completeness.total}
                  </Text>
                </View>
                <View style={[s.progressTrack, { backgroundColor: theme.backgroundSecondary }]}>
                  <View style={[s.progressFill, {
                    width: `${completeness.percent}%` as any,
                    backgroundColor: completeness.percent >= 70 ? "#16a34a" : completeness.percent >= 40 ? "#d97706" : "#dc2626",
                  }]} />
                </View>
                <Text style={[s.completenessHint, { color: theme.textMuted }]}>
                  {completeness.percent >= 80 ? "Excellent documentation" : completeness.percent >= 60 ? "Good — consider adding missing fields" : "Add more details for complete documentation"}
                </Text>
              </View>

              {/* Legend */}
              <View style={s.legendRow}>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: "#16a34a" }]} />
                  <Text style={[s.legendText, { color: theme.textMuted }]}>Voice captured</Text>
                </View>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: "#d97706" }]} />
                  <Text style={[s.legendText, { color: theme.textMuted }]}>Not mentioned</Text>
                </View>
                <View style={s.legendItem}>
                  <View style={[s.legendDot, { backgroundColor: "#94a3b8" }]} />
                  <Text style={[s.legendText, { color: theme.textMuted }]}>Pre-filled normal</Text>
                </View>
              </View>

              {/* Language badge if non-English */}
              {detectedLanguage && !detectedLanguage.startsWith('en') && (
                <View style={[s.langBadge, { backgroundColor: "#06b6d415", borderColor: "#06b6d430" }]}>
                  <Feather name="globe" size={13} color="#06b6d4" />
                  <Text style={[s.langBadgeText, { color: "#06b6d4" }]}>
                    Dictated in {detectedLanguage} — translated to English for extraction
                  </Text>
                </View>
              )}

              {/* Patient chip */}
              <View style={[s.patientChip, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Feather name="user" size={14} color={theme.textSecondary} />
                <Text style={[s.patientChipText, { color: theme.text }]}>
                  {patientName}  ·  {patientAge} yrs  ·  {patientSex}  ·  {caseType === "pediatric" ? "Pediatric" : "Adult"}
                </Text>
              </View>

              <Text style={[s.sectionLabel, { color: theme.textSecondary, marginTop: Spacing.md }]}>
                {voiceCount} extracted  ·  {missingCount} missing
              </Text>

              {extractedFields.map(f => {
                const isVoice = f.source === 'voice';
                const isMissing = f.source === 'missing';
                const isPrefill = f.source === 'prefill';
                const borderColor = isVoice
                  ? (f.confidence === 'high' ? "#16a34a" : f.confidence === 'medium' ? "#22c55e" : "#d97706")
                  : isMissing ? "#d97706" : "#94a3b8";
                const iconBg = isVoice ? `${borderColor}18` : isPrefill ? "#94a3b818" : "#d9780618";
                const iconColor = borderColor;

                return (
                  <View key={f.key} style={[s.fieldCard, { backgroundColor: theme.card, borderColor: theme.border, borderLeftColor: borderColor, borderLeftWidth: 3 }]}>
                    <View style={[s.fieldIcon, { backgroundColor: iconBg }]}>
                      <Feather name={
                        isVoice ? (f.icon as any) : isMissing ? "alert-circle" : "check-circle"
                      } size={13} color={iconColor} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={s.fieldLabelRow}>
                        <Text style={[s.fieldLabel, { color: theme.textSecondary }]}>{f.label}</Text>
                        {isPrefill && (
                          <View style={[s.fieldBadge, { backgroundColor: "#94a3b820" }]}>
                            <Text style={[s.fieldBadgeText, { color: "#94a3b8" }]}>pre-filled</Text>
                          </View>
                        )}
                        {isMissing && (
                          <View style={[s.fieldBadge, { backgroundColor: "#d9780618" }]}>
                            <Text style={[s.fieldBadgeText, { color: "#d97706" }]}>missing</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[s.fieldValue, { color: isMissing ? theme.textMuted : theme.text }]} numberOfLines={5}>{f.value}</Text>
                    </View>
                  </View>
                );
              })}

              <View style={[s.noAiBanner, { backgroundColor: theme.card, borderColor: theme.border }]}>
                <Feather name="shield" size={14} color={theme.textSecondary} />
                <Text style={[s.noAiText, { color: theme.textSecondary }]}>
                  Saved without AI diagnosis. You can add clinical decision support from the case sheet.
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
                      <Text style={s.primaryBtnText}>Save Case</Text>
                    </>
                }
              </Pressable>
            </View>
          </View>
        );
      })()}
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
  transcriptBadgeRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, flexWrap: "wrap" },
  transcriptHint: { fontSize: Typography.sm, lineHeight: 18 },
  transcriptInput: { flex: 1, borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, fontSize: Typography.base, lineHeight: 22, marginBottom: Spacing.md },

  // Review
  reviewRoot: { flex: 1 },
  reviewScroll: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, paddingBottom: Spacing.xl },
  // Completeness
  completenessCard: { padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.sm },
  completenessRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  completenessTitle: { fontSize: Typography.sm, fontWeight: "700" },
  completenessScore: { fontSize: Typography.base, fontWeight: "800" },
  progressTrack: { height: 8, borderRadius: 4, overflow: "hidden", marginBottom: Spacing.xs },
  progressFill: { height: 8, borderRadius: 4 },
  completenessHint: { fontSize: Typography.xs },
  // Legend
  legendRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: Typography.xs },
  // Language badge
  langBadge: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, padding: Spacing.sm, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.sm },
  langBadgeText: { flex: 1, fontSize: Typography.xs, fontWeight: "500" },
  // Patient + fields
  patientChip: {
    flexDirection: "row", alignItems: "center", gap: Spacing.sm,
    padding: Spacing.sm + 2, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.xs,
  },
  patientChipText: { fontSize: Typography.sm, fontWeight: "500" },
  fieldCard: {
    flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm,
    padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.xs,
    overflow: "hidden",
  },
  fieldIcon: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 2 },
  fieldLabelRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginBottom: 3 },
  fieldLabel: { fontSize: Typography.xs, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.5 },
  fieldBadge: { paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  fieldBadgeText: { fontSize: 9, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  fieldValue: { fontSize: Typography.sm, lineHeight: 19 },
  noAiBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: Spacing.sm,
    padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, marginTop: Spacing.md,
  },
  noAiText: { flex: 1, fontSize: Typography.xs, lineHeight: 17 },
  reviewActions: {
    flexDirection: "row", gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md, borderTopWidth: StyleSheet.hairlineWidth,
  },
});
