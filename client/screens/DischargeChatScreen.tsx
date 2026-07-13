import React, { useState, useRef, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

// ── Types ──────────────────────────────────────────────────────────────────────

interface DischargeSummary {
  patient: { name: string; age: string; sex: string; mlc: string; allergy: string };
  vitalsArrival: { hr: string; bp: string; spo2: string; painScore: string; grbs: string; temp: string };
  presentingComplaints: string;
  historyPresentIllness: string;
  pastHistory: string;
  familyHistory: string;
  lmp: string;
  generalExamination: string;
  primaryAssessment: { airway: string; breathing: string; circulation: string; disability: string; exposure: string };
  secondaryAssessment: { general: string; chest: string; cvs: string; abdomen: string; cns: string; extremities: string };
  courseInHospital: string;
  investigations: string;
  diagnosis: string;
  dischargeMedications: string;
  disposition: string;
  conditionAtDischarge: string;
  vitalsDischarge: { hr: string; bp: string; spo2: string; painScore: string; grbs: string; temp: string };
  followUpAdvice: string;
}

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

const EMPTY_SUMMARY: DischargeSummary = {
  patient: { name: "", age: "", sex: "", mlc: "", allergy: "" },
  vitalsArrival: { hr: "", bp: "", spo2: "", painScore: "", grbs: "", temp: "" },
  presentingComplaints: "",
  historyPresentIllness: "",
  pastHistory: "",
  familyHistory: "",
  lmp: "",
  generalExamination: "",
  primaryAssessment: { airway: "", breathing: "", circulation: "", disability: "", exposure: "" },
  secondaryAssessment: { general: "", chest: "", cvs: "", abdomen: "", cns: "", extremities: "" },
  courseInHospital: "",
  investigations: "",
  diagnosis: "",
  dischargeMedications: "",
  disposition: "",
  conditionAtDischarge: "",
  vitalsDischarge: { hr: "", bp: "", spo2: "", painScore: "", grbs: "", temp: "" },
  followUpAdvice: "",
};

const OPENING = "Tell me about the patient. What's the patient's name, age, and sex?";

// ── Text builders ──────────────────────────────────────────────────────────────

function buildSummaryText(s: DischargeSummary): string {
  const lines: string[] = ["DISCHARGE SUMMARY", "Emergency Department", ""];
  const p = s.patient;
  if (p.name) lines.push(`Patient: ${p.name}${p.age ? `, ${p.age}` : ""}${p.sex ? ` ${p.sex}` : ""}`);
  if (p.mlc) lines.push(`MLC: ${p.mlc}`);
  if (p.allergy) lines.push(`Allergy: ${p.allergy}`);

  const va = s.vitalsArrival;
  const vaRow = [va.hr && `HR ${va.hr}`, va.bp && `BP ${va.bp}`, va.spo2 && `SpO2 ${va.spo2}`, va.painScore && `Pain ${va.painScore}`, va.grbs && `GRBS ${va.grbs}`, va.temp && `Temp ${va.temp}`].filter(Boolean).join("  ");
  if (vaRow) lines.push(`Vitals (arrival): ${vaRow}`);

  if (s.presentingComplaints) lines.push(`\nPresenting Complaints:\n${s.presentingComplaints}`);
  if (s.historyPresentIllness) lines.push(`\nHistory of Present Illness:\n${s.historyPresentIllness}`);
  if (s.pastHistory) lines.push(`\nPast Medical/Surgical History:\n${s.pastHistory}`);
  if (s.familyHistory) lines.push(`\nFamily/Gynae History:\n${s.familyHistory}`);
  if (s.lmp) lines.push(`LMP: ${s.lmp}`);
  if (s.generalExamination) lines.push(`\nGeneral Examination:\n${s.generalExamination}`);

  const pa = s.primaryAssessment;
  const paRows = [pa.airway && `Airway: ${pa.airway}`, pa.breathing && `Breathing: ${pa.breathing}`, pa.circulation && `Circulation: ${pa.circulation}`, pa.disability && `Disability: ${pa.disability}`, pa.exposure && `Exposure: ${pa.exposure}`].filter(Boolean);
  if (paRows.length) lines.push(`\nPrimary Assessment:\n${paRows.join("\n")}`);

  const sa = s.secondaryAssessment;
  const saRows = [sa.general && `General: ${sa.general}`, sa.chest && `CHEST: ${sa.chest}`, sa.cvs && `CVS: ${sa.cvs}`, sa.abdomen && `P/A: ${sa.abdomen}`, sa.cns && `CNS: ${sa.cns}`, sa.extremities && `Extremities: ${sa.extremities}`].filter(Boolean);
  if (saRows.length) lines.push(`\nSecondary Assessment:\n${saRows.join("\n")}`);

  if (s.courseInHospital) lines.push(`\nCourse in Hospital:\n${s.courseInHospital}`);
  if (s.investigations) lines.push(`\nInvestigations:\n${s.investigations}`);
  if (s.diagnosis) lines.push(`\nDiagnosis: ${s.diagnosis}`);
  if (s.dischargeMedications) lines.push(`\nDischarge Medications:\n${s.dischargeMedications}`);
  if (s.disposition) lines.push(`\nDisposition: ${s.disposition}`);
  if (s.conditionAtDischarge) lines.push(`Condition at Discharge: ${s.conditionAtDischarge}`);

  const vd = s.vitalsDischarge;
  const vdRow = [vd.hr && `HR ${vd.hr}`, vd.bp && `BP ${vd.bp}`, vd.spo2 && `SpO2 ${vd.spo2}`, vd.painScore && `Pain ${vd.painScore}`, vd.grbs && `GRBS ${vd.grbs}`, vd.temp && `Temp ${vd.temp}`].filter(Boolean).join("  ");
  if (vdRow) lines.push(`Vitals (discharge): ${vdRow}`);

  if (s.followUpAdvice) lines.push(`\nFollow-Up Advice:\n${s.followUpAdvice}`);
  lines.push("\n---\nSent via ErMate");
  return lines.join("\n");
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ── Summary Preview Card ───────────────────────────────────────────────────────

function SummaryCard({ s, theme }: { s: DischargeSummary; theme: any }) {
  const fieldRow = (label: string, value: string) =>
    value ? (
      <View key={label} style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, { color: theme.textMuted }]}>{label}</Text>
        <Text style={[styles.fieldValue, { color: theme.text }]}>{value}</Text>
      </View>
    ) : null;

  const vitalsRow = (v: { hr: string; bp: string; spo2: string; painScore: string; grbs: string; temp: string }) => {
    const parts = [v.hr && `HR ${v.hr}`, v.bp && `BP ${v.bp}`, v.spo2 && `SpO2 ${v.spo2}`, v.painScore && `Pain ${v.painScore}`, v.grbs && `GRBS ${v.grbs}`, v.temp && `Temp ${v.temp}`].filter(Boolean);
    return parts.length ? parts.join("  ·  ") : "";
  };

  const p = s.patient;
  const hasAny = p.name || s.presentingComplaints || s.diagnosis || s.courseInHospital;
  if (!hasAny) return null;

  return (
    <View style={[styles.summaryCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <Text style={[styles.summaryTitle, { color: theme.text }]}>Discharge Summary</Text>

      {/* Patient */}
      {(p.name || p.age || p.mlc || p.allergy) ? (
        <View style={styles.summarySection}>
          <Text style={[styles.sectionHeader, { color: theme.primary }]}>Patient</Text>
          {p.name ? fieldRow("Name", `${p.name}${p.age ? `, ${p.age}` : ""}${p.sex ? ` ${p.sex}` : ""}`) : null}
          {p.mlc ? fieldRow("MLC", p.mlc) : null}
          {p.allergy ? fieldRow("Allergy", p.allergy) : null}
        </View>
      ) : null}

      {/* Vitals arrival */}
      {vitalsRow(s.vitalsArrival) ? (
        <View style={styles.summarySection}>
          <Text style={[styles.sectionHeader, { color: theme.primary }]}>Vitals at Arrival</Text>
          <Text style={[styles.fieldValue, { color: theme.text }]}>{vitalsRow(s.vitalsArrival)}</Text>
        </View>
      ) : null}

      {/* Complaints / History */}
      {(s.presentingComplaints || s.historyPresentIllness || s.pastHistory) ? (
        <View style={styles.summarySection}>
          <Text style={[styles.sectionHeader, { color: theme.primary }]}>History</Text>
          {fieldRow("Presenting Complaints", s.presentingComplaints)}
          {fieldRow("HPI", s.historyPresentIllness)}
          {fieldRow("Past History", s.pastHistory)}
          {fieldRow("Family/Gynae Hx", s.familyHistory)}
          {fieldRow("LMP", s.lmp)}
        </View>
      ) : null}

      {/* General exam */}
      {s.generalExamination ? (
        <View style={styles.summarySection}>
          <Text style={[styles.sectionHeader, { color: theme.primary }]}>General Examination</Text>
          <Text style={[styles.fieldValue, { color: theme.text }]}>{s.generalExamination}</Text>
        </View>
      ) : null}

      {/* Primary Assessment */}
      {Object.values(s.primaryAssessment).some(Boolean) ? (
        <View style={styles.summarySection}>
          <Text style={[styles.sectionHeader, { color: theme.primary }]}>Primary Assessment</Text>
          {fieldRow("Airway", s.primaryAssessment.airway)}
          {fieldRow("Breathing", s.primaryAssessment.breathing)}
          {fieldRow("Circulation", s.primaryAssessment.circulation)}
          {fieldRow("Disability", s.primaryAssessment.disability)}
          {fieldRow("Exposure", s.primaryAssessment.exposure)}
        </View>
      ) : null}

      {/* Secondary Assessment */}
      {Object.values(s.secondaryAssessment).some(Boolean) ? (
        <View style={styles.summarySection}>
          <Text style={[styles.sectionHeader, { color: theme.primary }]}>Secondary Assessment</Text>
          {fieldRow("General", s.secondaryAssessment.general)}
          {fieldRow("CHEST", s.secondaryAssessment.chest)}
          {fieldRow("CVS", s.secondaryAssessment.cvs)}
          {fieldRow("P/A", s.secondaryAssessment.abdomen)}
          {fieldRow("CNS", s.secondaryAssessment.cns)}
          {fieldRow("Extremities", s.secondaryAssessment.extremities)}
        </View>
      ) : null}

      {/* Course / Investigations / Diagnosis */}
      {(s.courseInHospital || s.investigations || s.diagnosis) ? (
        <View style={styles.summarySection}>
          <Text style={[styles.sectionHeader, { color: theme.primary }]}>Clinical</Text>
          {fieldRow("Course in Hospital", s.courseInHospital)}
          {fieldRow("Investigations", s.investigations)}
          {s.diagnosis ? (
            <View style={[styles.diagnosisBox, { backgroundColor: theme.primary + "15" }]}>
              <Text style={[styles.diagnosisText, { color: theme.primary }]}>{s.diagnosis}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Discharge plan */}
      {(s.dischargeMedications || s.disposition || s.conditionAtDischarge || vitalsRow(s.vitalsDischarge) || s.followUpAdvice) ? (
        <View style={styles.summarySection}>
          <Text style={[styles.sectionHeader, { color: theme.primary }]}>Discharge Plan</Text>
          {fieldRow("Medications", s.dischargeMedications)}
          {fieldRow("Disposition", s.disposition)}
          {fieldRow("Condition", s.conditionAtDischarge)}
          {vitalsRow(s.vitalsDischarge) ? fieldRow("Discharge Vitals", vitalsRow(s.vitalsDischarge)) : null}
          {fieldRow("Follow-Up", s.followUpAdvice)}
        </View>
      ) : null}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function DischargeChatScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: OPENING }]);
  const [inputText, setInputText] = useState("");
  const [summary, setSummary] = useState<DischargeSummary>(EMPTY_SUMMARY);
  const [currentSection, setCurrentSection] = useState("");
  const [readyToFinalize, setReadyToFinalize] = useState(false);
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);

  const nativeRecRef = useRef<Audio.Recording | null>(null);
  const webRecRef = useRef<{ mr: MediaRecorder | null; chunks: Blob[]; stream: MediaStream | null }>({ mr: null, chunks: [], stream: null });
  const scrollRef = useRef<ScrollView>(null);

  // ── Send message ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    const newMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(newMessages);
    setInputText("");
    setSending(true);

    try {
      const token = await AsyncStorage.getItem("token");
      const res = await fetch(new URL("/api/discharge/chat", getApiUrl()).toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          currentMessage: trimmed,
          currentSummary: summary,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: data.error || "Something went wrong. Please try again." }]);
        return;
      }
      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
      if (data.summary) setSummary(data.summary);
      if (data.currentSection) setCurrentSection(data.currentSection);
      setReadyToFinalize(!!data.readyToFinalize);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Network error. Please check your connection and try again." }]);
    } finally {
      setSending(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages, summary, sending]);

  // ── Voice recording ───────────────────────────────────────────────────────────

  const transcribeAudio = async (blob: Blob | null, uri: string | null) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      if (Platform.OS === "web" && blob) {
        const ext = blob.type.includes("webm") ? "webm" : "m4a";
        formData.append("audio", blob, `voice.${ext}`);
      } else if (uri) {
        const ext = uri.split(".").pop() || "m4a";
        formData.append("audio", { uri, name: `voice.${ext}`, type: `audio/${ext === "caf" ? "x-caf" : ext === "m4a" ? "mp4" : ext}` } as any);
      } else return;
      formData.append("mode", "full");
      const res = await fetch(new URL("/api/voice/transcribe", getApiUrl()).toString(), { method: "POST", body: formData });
      if (!res.ok) throw new Error("Transcription failed");
      const data = await res.json();
      const txt = (data.transcript || "").trim();
      if (!txt) { Alert.alert("No speech detected", "Please try again."); return; }
      setInputText((prev) => (prev.trim() ? `${prev.trim()} ${txt}` : txt));
    } catch (err: any) {
      Alert.alert("Transcription failed", err?.message || "Please try again or type instead.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRecording = async () => {
    try {
      if (Platform.OS === "web") {
        if (!navigator.mediaDevices?.getUserMedia) { Alert.alert("Not supported", "Voice recording not supported in this browser."); return; }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webRecRef.current.stream = stream;
        webRecRef.current.chunks = [];
        const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
        const mr = new MediaRecorder(stream, { mimeType });
        mr.ondataavailable = (e) => { if (e.data.size > 0) webRecRef.current.chunks.push(e.data); };
        mr.onstop = () => { const blob = new Blob(webRecRef.current.chunks, { type: mimeType }); webRecRef.current.stream?.getTracks().forEach((t) => t.stop()); transcribeAudio(blob, null); };
        webRecRef.current.mr = mr;
        mr.start(100);
      } else {
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) { Alert.alert("Microphone needed", "Microphone access is required for voice dictation."); return; }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        nativeRecRef.current = recording;
      }
      setIsRecording(true);
    } catch { Alert.alert("Failed to start recording", "Please try again."); }
  };

  const stopRecording = async () => {
    setIsRecording(false);
    try {
      if (Platform.OS === "web") {
        const mr = webRecRef.current.mr;
        if (mr && mr.state !== "inactive") mr.stop();
      } else {
        const rec = nativeRecRef.current;
        if (!rec) return;
        await rec.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        const uri = rec.getURI();
        nativeRecRef.current = null;
        if (uri) transcribeAudio(null, uri);
      }
    } catch { /* ignore */ }
  };

  const handleMicPress = () => {
    if (sending || isTranscribing) return;
    if (isRecording) stopRecording();
    else startRecording();
  };

  // ── Export ────────────────────────────────────────────────────────────────────

  const handleCopy = async () => {
    await Clipboard.setStringAsync(buildSummaryText(summary));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const content = buildSummaryText(summary);
      const patientName = summary.patient.name || "Patient";
      const res = await fetch(new URL("/api/export/text-pdf", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: `Discharge Summary — ${patientName}`, content, filename: "discharge_summary" }),
      });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const fileName = `discharge_${patientName.replace(/\s+/g, "_")}.pdf`;
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
          await Sharing.shareAsync(fileUri, { mimeType: "application/pdf", dialogTitle: "Discharge Summary" });
        } else {
          Alert.alert("Saved", `PDF saved to: ${fileUri}`);
        }
      }
    } catch {
      Alert.alert("Export failed", "Could not export PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleReset = () => {
    Alert.alert("Start new?", "This will clear the current discharge summary.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Start new",
        style: "destructive",
        onPress: () => {
          setMessages([{ role: "assistant", content: OPENING }]);
          setSummary(EMPTY_SUMMARY);
          setReadyToFinalize(false);
          setCurrentSection("");
        },
      },
    ]);
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  const topPad = headerHeight + Spacing.sm;
  const bottomPad = insets.bottom + 80;

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad, paddingHorizontal: Spacing.md }}
        keyboardDismissMode="on-drag"
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {/* Section badge */}
        {currentSection ? (
          <View style={[styles.sectionBadge, { backgroundColor: theme.primary + "18" }]}>
            <Feather name="edit-3" size={12} color={theme.primary} />
            <Text style={[styles.sectionBadgeText, { color: theme.primary }]}>{currentSection}</Text>
          </View>
        ) : null}

        {/* Messages */}
        {messages.map((msg, idx) => (
          <View
            key={idx}
            style={[
              styles.bubble,
              msg.role === "user"
                ? [styles.userBubble, { backgroundColor: theme.primary }]
                : [styles.aiBubble, { backgroundColor: theme.card, borderColor: theme.border }],
            ]}
          >
            {msg.role === "assistant" ? (
              <View style={styles.aiRow}>
                <View style={[styles.aiAvatar, { backgroundColor: theme.primary + "20" }]}>
                  <Feather name="file-text" size={12} color={theme.primary} />
                </View>
                <Text style={[styles.bubbleText, { color: theme.text, flex: 1 }]}>{msg.content}</Text>
              </View>
            ) : (
              <Text style={[styles.bubbleText, { color: "#fff" }]}>{msg.content}</Text>
            )}
          </View>
        ))}

        {/* Thinking indicator */}
        {sending ? (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.typingText, { color: theme.textSecondary }]}>Filling in discharge summary...</Text>
          </View>
        ) : null}

        {/* Live summary preview */}
        <SummaryCard s={summary} theme={theme} />

        {/* Finalize actions */}
        {readyToFinalize ? (
          <View style={[styles.finalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.finalTitle, { color: theme.text }]}>Discharge Summary Ready</Text>
            <Text style={[styles.finalSub, { color: theme.textSecondary }]}>
              Export as PDF, copy to clipboard, or start a new one.
            </Text>
            <View style={styles.actionRow}>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: theme.primary }]}
                onPress={handleExportPdf}
                disabled={exporting}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Feather name="download" size={16} color="#fff" />
                    <Text style={styles.actionBtnText}>Export PDF</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={[styles.actionBtn, { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border }]}
                onPress={handleCopy}
              >
                <Feather name={copied ? "check" : "copy"} size={16} color={theme.text} />
                <Text style={[styles.actionBtnText, { color: theme.text }]}>{copied ? "Copied!" : "Copy"}</Text>
              </Pressable>
            </View>
            <Pressable onPress={handleReset} style={styles.resetBtn}>
              <Text style={[styles.resetText, { color: theme.textMuted }]}>Start a new discharge summary</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {/* Input bar */}
      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: theme.card,
            borderTopColor: theme.border,
            paddingBottom: insets.bottom + Spacing.xs,
          },
        ]}
      >
        <Pressable
          onPressIn={handleMicPress}
          style={[
            styles.micBtn,
            {
              backgroundColor: isRecording
                ? "#EF4444"
                : isTranscribing
                ? theme.primary + "40"
                : theme.primary + "15",
            },
          ]}
        >
          {isTranscribing ? (
            <ActivityIndicator size="small" color={theme.primary} />
          ) : (
            <Feather name={isRecording ? "mic-off" : "mic"} size={20} color={isRecording ? "#fff" : theme.primary} />
          )}
        </Pressable>

        <TextInput
          style={[styles.input, { backgroundColor: theme.background, color: theme.text, borderColor: theme.border }]}
          value={inputText}
          onChangeText={setInputText}
          placeholder={isRecording ? "Recording... tap mic to stop" : "Type your answer or tap mic to speak..."}
          placeholderTextColor={theme.textMuted}
          multiline
          editable={!sending && !isRecording}
          onSubmitEditing={() => sendMessage(inputText)}
        />

        <Pressable
          style={[styles.sendBtn, { backgroundColor: inputText.trim() && !sending ? theme.primary : theme.primary + "40" }]}
          onPress={() => sendMessage(inputText)}
          disabled={!inputText.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Feather name="arrow-up" size={18} color="#fff" />
          )}
        </Pressable>
      </View>
    </View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1 },
  scroll: { flex: 1 },

  sectionBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    marginBottom: Spacing.sm,
  },
  sectionBadgeText: { fontSize: 12, fontWeight: "600" },

  bubble: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.sm,
    marginBottom: Spacing.sm,
    maxWidth: "90%",
  },
  aiBubble: { alignSelf: "flex-start", borderWidth: 1 },
  userBubble: { alignSelf: "flex-end" },
  aiRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  aiAvatar: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 2 },
  bubbleText: { fontSize: 14, lineHeight: 20 },

  typingRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: Spacing.xs, paddingLeft: 4 },
  typingText: { fontSize: 13 },

  // Summary card
  summaryCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  summaryTitle: { fontSize: 15, fontWeight: "700", marginBottom: Spacing.sm },
  summarySection: { marginBottom: Spacing.sm },
  sectionHeader: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 },
  fieldRow: { flexDirection: "row", gap: 6, marginBottom: 3, flexWrap: "wrap" },
  fieldLabel: { fontSize: 12, fontWeight: "600", minWidth: 80 },
  fieldValue: { fontSize: 12, flex: 1 },
  diagnosisBox: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginTop: 4 },
  diagnosisText: { fontSize: 13, fontWeight: "700" },

  // Final card
  finalCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md,
    marginTop: Spacing.sm,
  },
  finalTitle: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  finalSub: { fontSize: 13, marginBottom: Spacing.md },
  actionRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: BorderRadius.md,
  },
  actionBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  resetBtn: { alignItems: "center", paddingVertical: Spacing.xs },
  resetText: { fontSize: 13 },

  // Input bar
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
  },
  micBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    maxHeight: 120,
  },
  sendBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
});
