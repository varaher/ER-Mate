import React, { useState, useRef, useCallback, useEffect } from "react";
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
  Linking,
} from "react-native";
import { Audio } from "expo-av";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

interface HandoverVitals {
  bp?: string;
  hr?: string;
  spo2?: string;
  rr?: string;
  temp?: string;
}

interface HandoverPatient {
  bedNumber?: string;
  patientName?: string;
  age?: string;
  sex?: string;
  presentingComplaints?: string;
  pastMedicalHistory?: string;
  diagnosis?: string;
  status?: "critical" | "unstable" | "stable" | "for_discharge";
  vitals?: HandoverVitals;
  activeIssues?: string[];
  medications?: string[];
  managementDone?: string[];
  pendingTasks?: string[];
  criticalAlerts?: string[];
  awaitingResults?: string[];
  bystanderUpdateTime?: string;
}

interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

const STATUS_COLOR: Record<string, string> = {
  critical: TriageColors.red,
  unstable: TriageColors.orange,
  stable: TriageColors.green,
  for_discharge: TriageColors.blue,
};

const STATUS_LABEL: Record<string, string> = {
  critical: "CRITICAL",
  unstable: "UNSTABLE",
  stable: "STABLE",
  for_discharge: "FOR DISCHARGE",
};

const OPENING_PROMPT =
  "Tell me about your patients. Speak or type — any order, any language, as much as you want. I'll structure it.";

function buildHandoverText(
  patients: HandoverPatient[],
  fromDoctor: string,
  toDoctor: string
): string {
  const lines: string[] = [];
  const now = new Date();
  lines.push("HANDOVER SHEET");
  lines.push(`From: ${fromDoctor || "Doctor"}${toDoctor ? `  To: ${toDoctor}` : ""}`);
  lines.push(
    `Date: ${now.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" })} · ${now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false })}`
  );
  lines.push("─────────────────────────────");

  const order: Record<string, number> = { critical: 0, unstable: 1, stable: 2, for_discharge: 3 };
  const sorted = [...patients].sort(
    (a, b) => (order[a.status || "stable"] ?? 2) - (order[b.status || "stable"] ?? 2)
  );

  sorted.forEach((p) => {
    lines.push("");
    lines.push(
      `${p.bedNumber || "Bed —"} · ${p.patientName || "Unknown"}${p.age ? ` · ${p.age}${p.sex || ""}` : ""}`
    );
    if (p.presentingComplaints) lines.push(`Presenting complaints: ${p.presentingComplaints}`);
    if (p.pastMedicalHistory) lines.push(`Past medical history: ${p.pastMedicalHistory}`);
    if (p.diagnosis) lines.push(`Provisional diagnosis: ${p.diagnosis} — ${STATUS_LABEL[p.status || "stable"]}`);
    const v = p.vitals || {};
    const vitalsParts = [
      v.bp && `BP ${v.bp}`,
      v.hr && `HR ${v.hr}`,
      v.spo2 && `SpO2 ${v.spo2}%`,
      v.rr && `RR ${v.rr}`,
      v.temp && `Temp ${v.temp}`,
    ].filter(Boolean);
    if (vitalsParts.length) lines.push(vitalsParts.join(" · "));
    (p.criticalAlerts || []).forEach((a) => lines.push(`ALERT: ${a}`));
    (p.medications || []).forEach((m) => lines.push(`Running: ${m}`));
    (p.managementDone || []).forEach((m) => lines.push(`Management plan (Done): ${m}`));
    (p.pendingTasks || []).forEach((t) => lines.push(`Management plan (To be done): ${t}`));
    (p.awaitingResults || []).forEach((r) => lines.push(`Awaiting: ${r}`));
    if (p.bystanderUpdateTime) lines.push(`Bystander update given: ${p.bystanderUpdateTime}`);
  });

  lines.push("");
  lines.push("─────────────────────────────");
  lines.push("Sent via ErMate");
  return lines.join("\n");
}

function buildWhatsappText(
  patients: HandoverPatient[],
  fromDoctor: string,
  toDoctor: string
): string {
  const lines: string[] = [];
  lines.push("*ErMate Handover*");
  lines.push(`${fromDoctor || "Doctor"}${toDoctor ? ` \u2192 ${toDoctor}` : ""}`);
  lines.push("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  const order: Record<string, number> = { critical: 0, unstable: 1, stable: 2, for_discharge: 3 };
  const sorted = [...patients].sort(
    (a, b) => (order[a.status || "stable"] ?? 2) - (order[b.status || "stable"] ?? 2)
  );
  sorted.forEach((p) => {
    lines.push("");
    const emoji =
      p.status === "critical" ? "\u{1F534}" : p.status === "unstable" ? "\u{1F7E0}" : p.status === "for_discharge" ? "\u{1F535}" : "\u{1F7E2}";
    lines.push(`${emoji} *${p.bedNumber || "Bed \u2014"} \u2014 ${p.patientName || "Unknown"}${p.age ? `, ${p.age}${p.sex || ""}` : ""}*`);
    if (p.presentingComplaints) lines.push(`Presenting: ${p.presentingComplaints}`);
    if (p.pastMedicalHistory) lines.push(`PMH: ${p.pastMedicalHistory}`);
    if (p.diagnosis) lines.push(`Dx: ${p.diagnosis}`);
    const v = p.vitals || {};
    const vitalsParts = [v.bp && `BP ${v.bp}`, v.hr && `HR ${v.hr}`, v.spo2 && `SpO2 ${v.spo2}%`].filter(Boolean);
    if (vitalsParts.length) lines.push(vitalsParts.join(" \u00b7 "));
    (p.criticalAlerts || []).forEach((a) => lines.push(`\u26A0 ${a}`));
    (p.managementDone || []).forEach((m) => lines.push(`\u2705 ${m}`));
    (p.pendingTasks || []).forEach((t) => lines.push(`\u{1F4CB} ${t}`));
    if (p.bystanderUpdateTime) lines.push(`Bystander updated: ${p.bystanderUpdateTime}`);
  });
  lines.push("");
  lines.push("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  lines.push("Sent via ErMate");
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

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Route = RouteProp<RootStackParamList, "HandoverChat">;

export default function HandoverChatScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();

  const handoverId = route.params?.handoverId;
  const doctorName = (user as any)?.name || (user as any)?.fullName || user?.email || "Doctor";

  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: OPENING_PROMPT }]);
  const [inputText, setInputText] = useState("");
  const [patients, setPatients] = useState<HandoverPatient[]>([]);
  const [receivingDoctor, setReceivingDoctor] = useState("");
  const [askedFollowUp, setAskedFollowUp] = useState(false);
  const [readyToFinalize, setReadyToFinalize] = useState(false);
  const [sending, setSending] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [loadingSession, setLoadingSession] = useState(true);
  const [sessionId, setSessionId] = useState<string | undefined>(handoverId);

  const nativeRecRef = useRef<Audio.Recording | null>(null);
  const webRecRef = useRef<{ mr: MediaRecorder | null; chunks: Blob[]; stream: MediaStream | null }>({
    mr: null,
    chunks: [],
    stream: null,
  });
  const scrollRef = useRef<ScrollView>(null);

  const markAsShared = useCallback(async (sid: string | undefined, finalSheet?: object) => {
    if (!sid) return;
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      await fetch(new URL(`/api/handovers/${sid}`, getApiUrl()).toString(), {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status: "shared", finalSheet, toDoctorName: receivingDoctor, fromDoctorName: doctorName }),
      });
    } catch {
      // best-effort — share already succeeded
    }
  }, [receivingDoctor, doctorName]);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      const newMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
      setMessages(newMessages);
      setInputText("");
      setSending(true);

      try {
        const token = await AsyncStorage.getItem("token");
        const res = await fetch(new URL("/api/handover/chat", getApiUrl()).toString(), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
            currentMessage: trimmed,
            askedFollowUp,
            handoverId: sessionId,
            fromDoctorName: doctorName,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          setMessages((prev) => [...prev, { role: "assistant", content: data.error || "Something went wrong. Please try again." }]);
          return;
        }

        setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
        if (Array.isArray(data.patients) && data.patients.length > 0) setPatients(data.patients);
        if (data.receivingDoctor) setReceivingDoctor(data.receivingDoctor);
        setAskedFollowUp(!!data.askedFollowUp);
        setReadyToFinalize(!!data.readyToFinalize);
        if (data.sessionId) setSessionId(data.sessionId);
      } catch {
        setMessages((prev) => [...prev, { role: "assistant", content: "Network error. Please check your connection and try again." }]);
      } finally {
        setSending(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    },
    [messages, askedFollowUp, sending]
  );

  const handleSend = () => sendMessage(inputText);

  const transcribeAudio = async (blob: Blob | null, uri: string | null) => {
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
      } else {
        return;
      }
      formData.append("mode", "full");

      const res = await fetch(new URL("/api/voice/transcribe", getApiUrl()).toString(), {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Transcription failed");
      }
      const data = await res.json();
      const text: string = (data.transcript || "").trim();
      if (!text) {
        Alert.alert("No speech detected", "Please try again.");
        return;
      }
      setInputText((prev) => (prev.trim() ? `${prev.trim()} ${text}` : text));
    } catch (err: any) {
      Alert.alert("Transcription failed", err?.message || "Please try again or type instead.");
    } finally {
      setIsTranscribing(false);
    }
  };

  const startRecording = async () => {
    try {
      if (Platform.OS === "web") {
        if (!navigator.mediaDevices?.getUserMedia) {
          Alert.alert("Not supported", "Voice recording is not supported in this browser.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webRecRef.current.stream = stream;
        webRecRef.current.chunks = [];
        const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
        const mr = new MediaRecorder(stream, { mimeType });
        mr.ondataavailable = (e) => {
          if (e.data.size > 0) webRecRef.current.chunks.push(e.data);
        };
        mr.onstop = () => {
          const blob = new Blob(webRecRef.current.chunks, { type: mimeType });
          webRecRef.current.stream?.getTracks().forEach((t) => t.stop());
          transcribeAudio(blob, null);
        };
        webRecRef.current.mr = mr;
        mr.start(100);
      } else {
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) {
          Alert.alert("Microphone needed", "Microphone access is needed for voice dictation.");
          return;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        nativeRecRef.current = recording;
      }
      setIsRecording(true);
    } catch {
      Alert.alert("Failed to start recording", "Please try again.");
    }
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
    } catch {
      // ignore
    }
  };

  const handleMicPress = () => {
    if (sending || isTranscribing) return;
    if (isRecording) stopRecording();
    else startRecording();
  };

  const handleShareWhatsapp = async () => {
    const text = buildWhatsappText(patients, doctorName, receivingDoctor);
    const encoded = encodeURIComponent(text);
    const waAppUrl = `whatsapp://send?text=${encoded}`;
    const waWebUrl = `https://wa.me/?text=${encoded}`;
    try {
      if (Platform.OS !== "web") {
        const canOpen = await Linking.canOpenURL(waAppUrl);
        await Linking.openURL(canOpen ? waAppUrl : waWebUrl);
      } else {
        await Linking.openURL(waWebUrl);
      }
      markAsShared(sessionId, { text });
    } catch {
      Alert.alert("Couldn't open WhatsApp", "Copy the handover instead and paste it manually.");
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(buildWhatsappText(patients, doctorName, receivingDoctor));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportPdf = async () => {
    setExporting(true);
    try {
      const content = buildHandoverText(patients, doctorName, receivingDoctor);
      const res = await fetch(new URL("/api/export/text-pdf", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Handover Sheet", content, filename: "handover" }),
      });
      if (!res.ok) throw new Error("Failed to generate PDF");
      const blob = await res.blob();
      const fileName = "handover.pdf";

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
          await Sharing.shareAsync(fileUri, { mimeType: "application/pdf", dialogTitle: "Handover Sheet" });
        } else {
          Alert.alert("Saved", `PDF saved to: ${fileUri}`);
        }
      }
      markAsShared(sessionId);
    } catch {
      Alert.alert("Export failed", "Could not export PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const handleNewHandover = () => {
    // Archive current session, then go back to the list so user can start fresh
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) return;
        // Archive active session (DELETE now sets status='completed')
        await fetch(new URL("/api/handover/session", getApiUrl()).toString(), {
          method: "DELETE",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        });
      } catch {
        // best-effort
      }
    })();
    if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate("HandoverList");
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) { setLoadingSession(false); return; }

        if (handoverId) {
          // Load a specific session by ID (read-only or editable draft)
          const res = await fetch(new URL(`/api/handovers/${handoverId}`, getApiUrl()).toString(), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            const session = data?.session;
            if (session && Array.isArray(session.messages) && session.messages.length > 0) {
              setMessages(session.messages);
              setPatients(Array.isArray(session.patients) ? session.patients : []);
              setReceivingDoctor(session.receivingDoctor || "");
              setAskedFollowUp(!!session.askedFollowUp);
              setReadyToFinalize(!!session.readyToFinalize);
              setSessionId(session.id);
            }
          }
        } else {
          // Load the active session (cross-device resume)
          const res = await fetch(new URL("/api/handover/session", getApiUrl()).toString(), {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            const session = data?.session;
            if (session && Array.isArray(session.messages) && session.messages.length > 0) {
              setMessages(session.messages);
              setPatients(Array.isArray(session.patients) ? session.patients : []);
              setReceivingDoctor(session.receivingDoctor || "");
              setAskedFollowUp(!!session.askedFollowUp);
              setReadyToFinalize(!!session.readyToFinalize);
              setSessionId(session.id);
            }
          }
        }
      } catch {
        // no persisted session available — start fresh, this is non-fatal
      } finally {
        setLoadingSession(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 150);
      }
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundDefault }}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: Spacing["3xl"] },
        ]}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((m, idx) => (
          <View
            key={idx}
            style={[
              styles.messageRow,
              m.role === "user" ? styles.messageRowUser : styles.messageRowAssistant,
            ]}
          >
            {m.role === "assistant" ? (
              <View style={styles.assistantLabelRow}>
                <Feather name="zap" size={13} color={theme.primary} />
                <Text style={[styles.assistantLabel, { color: theme.primary }]}>ErMate</Text>
              </View>
            ) : null}
            <View
              style={[
                styles.bubble,
                m.role === "user"
                  ? { backgroundColor: theme.primary, alignSelf: "flex-end" }
                  : { backgroundColor: theme.card, borderWidth: 1, borderColor: theme.border, alignSelf: "flex-start" },
              ]}
            >
              <Text style={[styles.bubbleText, { color: m.role === "user" ? "#FFFFFF" : theme.text }]}>{m.content}</Text>
            </View>
          </View>
        ))}

        {sending ? (
          <View style={styles.typingRow}>
            <ActivityIndicator size="small" color={theme.primary} />
            <Text style={[styles.typingText, { color: theme.textSecondary }]}>ErMate is thinking...</Text>
          </View>
        ) : null}

        {patients.length > 0 ? (
          <View style={styles.patientsBlock}>
            {patients.map((p, idx) => {
              const color = STATUS_COLOR[p.status || "stable"];
              return (
                <View key={idx} style={[styles.patientCard, { backgroundColor: theme.card, borderLeftColor: color }]}>
                  <View style={styles.patientHeaderRow}>
                    <Text style={[styles.patientName, { color: theme.text }]}>
                      {p.bedNumber || "Bed —"} · {p.patientName || "Unknown"}
                      {p.age ? ` · ${p.age}${p.sex || ""}` : ""}
                    </Text>
                    <View style={[styles.statusChip, { backgroundColor: color }]}>
                      <Text style={styles.statusChipText}>{STATUS_LABEL[p.status || "stable"]}</Text>
                    </View>
                  </View>
                  {p.presentingComplaints ? (
                    <View style={styles.sectionBlock}>
                      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Presenting complaints</Text>
                      <Text style={[styles.itemLine, { color: theme.text }]}>{p.presentingComplaints}</Text>
                    </View>
                  ) : null}
                  {p.pastMedicalHistory ? (
                    <View style={styles.sectionBlock}>
                      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Past medical history</Text>
                      <Text style={[styles.itemLine, { color: theme.text }]}>{p.pastMedicalHistory}</Text>
                    </View>
                  ) : null}
                  {p.diagnosis ? (
                    <View style={styles.sectionBlock}>
                      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Provisional diagnosis</Text>
                      <Text style={[styles.diagnosis, { color: theme.textSecondary, marginBottom: 0 }]}>{p.diagnosis}</Text>
                    </View>
                  ) : null}
                  {p.vitals && Object.values(p.vitals).some(Boolean) ? (
                    <Text style={[styles.vitalsLine, { color: theme.textMuted }]}>
                      {[
                        p.vitals.bp && `BP ${p.vitals.bp}`,
                        p.vitals.hr && `HR ${p.vitals.hr}`,
                        p.vitals.spo2 && `SpO\u2082 ${p.vitals.spo2}%`,
                        p.vitals.rr && `RR ${p.vitals.rr}`,
                        p.vitals.temp && `Temp ${p.vitals.temp}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Text>
                  ) : null}
                  {(p.criticalAlerts || []).length > 0 ? (
                    <View style={styles.sectionBlock}>
                      {p.criticalAlerts!.map((a, i) => (
                        <Text key={i} style={[styles.alertLine, { color: theme.danger }]}>
                          ⚠ {a}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {(p.medications || []).length > 0 ? (
                    <View style={styles.sectionBlock}>
                      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Running</Text>
                      {p.medications!.map((m, i) => (
                        <Text key={i} style={[styles.itemLine, { color: theme.text }]}>
                          • {m}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {(p.managementDone || []).length > 0 ? (
                    <View style={styles.sectionBlock}>
                      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Management plan — Done</Text>
                      {p.managementDone!.map((m, i) => (
                        <Text key={i} style={[styles.itemLine, { color: theme.text }]}>
                          ✓ {m}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {(p.pendingTasks || []).length > 0 ? (
                    <View style={styles.sectionBlock}>
                      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Management plan — To be done</Text>
                      {p.pendingTasks!.map((t, i) => (
                        <Text key={i} style={[styles.itemLine, { color: theme.text }]}>
                          ☐ {t}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {(p.awaitingResults || []).length > 0 ? (
                    <View style={styles.sectionBlock}>
                      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Awaiting</Text>
                      {p.awaitingResults!.map((r, i) => (
                        <Text key={i} style={[styles.itemLine, { color: theme.text }]}>
                          • {r}
                        </Text>
                      ))}
                    </View>
                  ) : null}
                  {p.bystanderUpdateTime ? (
                    <View style={styles.sectionBlock}>
                      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Bystander update given</Text>
                      <Text style={[styles.itemLine, { color: theme.text }]}>{p.bystanderUpdateTime}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {readyToFinalize && patients.length > 0 ? (
          <View style={[styles.finalCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.finalHeaderRow}>
              <Feather name="clipboard" size={16} color={theme.primary} />
              <Text style={[styles.finalTitle, { color: theme.text }]}>Handover Sheet</Text>
            </View>
            <Text style={[styles.finalMeta, { color: theme.textSecondary }]}>
              From {doctorName}
              {receivingDoctor ? ` → ${receivingDoctor}` : ""}
            </Text>
            <View style={styles.shareRow}>
              <Pressable
                style={({ pressed }) => [styles.shareButton, { backgroundColor: "#25D366", opacity: pressed ? 0.85 : 1 }]}
                onPress={handleShareWhatsapp}
              >
                <Feather name="message-circle" size={17} color="#FFFFFF" />
                <Text style={styles.shareButtonText}>WhatsApp</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.shareButtonOutline, { borderColor: theme.border, opacity: pressed ? 0.85 : 1 }]}
                onPress={handleExportPdf}
                disabled={exporting}
              >
                {exporting ? (
                  <ActivityIndicator size="small" color={theme.text} />
                ) : (
                  <Feather name="file-text" size={17} color={theme.text} />
                )}
                <Text style={[styles.shareButtonOutlineText, { color: theme.text }]}>PDF</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.shareButtonOutline, { borderColor: theme.border, opacity: pressed ? 0.85 : 1 }]}
                onPress={handleCopy}
              >
                <Feather name={copied ? "check" : "copy"} size={17} color={theme.text} />
                <Text style={[styles.shareButtonOutlineText, { color: theme.text }]}>{copied ? "Copied" : "Copy"}</Text>
              </Pressable>
            </View>
            <Pressable style={styles.newHandoverButton} onPress={handleNewHandover}>
              <Feather name="rotate-ccw" size={14} color={theme.primary} />
              <Text style={[styles.newHandoverText, { color: theme.primary }]}>Start a new handover</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.inputBar,
          { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: insets.bottom + Spacing.sm },
        ]}
      >
        <Pressable
          onPress={handleMicPress}
          style={[
            styles.micButton,
            {
              backgroundColor: isRecording ? theme.danger : theme.backgroundSecondary,
            },
          ]}
          disabled={isTranscribing}
        >
          {isTranscribing ? (
            <ActivityIndicator size="small" color={theme.text} />
          ) : (
            <Feather name="mic" size={19} color={isRecording ? "#FFFFFF" : theme.textSecondary} />
          )}
        </Pressable>
        <TextInput
          style={[styles.textInput, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
          placeholder="Type anything..."
          placeholderTextColor={theme.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          editable={!sending}
        />
        <Pressable
          onPress={handleSend}
          style={[styles.sendButton, { backgroundColor: theme.primary, opacity: inputText.trim() && !sending ? 1 : 0.5 }]}
          disabled={!inputText.trim() || sending}
        >
          <Feather name="arrow-up" size={19} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.lg,
  },
  messageRow: {
    marginBottom: Spacing.md,
    maxWidth: "88%",
  },
  messageRowUser: {
    alignSelf: "flex-end",
  },
  messageRowAssistant: {
    alignSelf: "flex-start",
  },
  assistantLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
    marginLeft: 2,
  },
  assistantLabel: {
    ...Typography.caption,
    fontWeight: "700",
  },
  bubble: {
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  bubbleText: {
    ...Typography.body,
    lineHeight: 21,
  },
  typingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  typingText: {
    ...Typography.small,
  },
  patientsBlock: {
    marginTop: Spacing.xs,
    marginBottom: Spacing.md,
  },
  patientCard: {
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 4,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  patientHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  patientName: {
    ...Typography.h4,
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusChipText: {
    color: "#FFFFFF",
    ...Typography.caption,
    fontWeight: "800",
  },
  diagnosis: {
    ...Typography.bodyMedium,
    marginBottom: Spacing.xs,
  },
  vitalsLine: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  sectionBlock: {
    marginTop: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
  },
  itemLine: {
    ...Typography.small,
    marginBottom: 2,
  },
  alertLine: {
    ...Typography.small,
    fontWeight: "700",
    marginBottom: 2,
  },
  finalCard: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  finalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: 4,
  },
  finalTitle: {
    ...Typography.h4,
  },
  finalMeta: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  shareRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  shareButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 46,
    borderRadius: BorderRadius.lg,
  },
  shareButtonText: {
    color: "#FFFFFF",
    ...Typography.small,
    fontWeight: "700",
  },
  shareButtonOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 46,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  shareButtonOutlineText: {
    ...Typography.small,
    fontWeight: "700",
  },
  newHandoverButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingTop: Spacing.md,
  },
  newHandoverText: {
    ...Typography.small,
    fontWeight: "700",
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: Spacing.sm,
    borderTopWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  micButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  textInput: {
    flex: 1,
    ...Typography.body,
    borderRadius: BorderRadius.lg,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    maxHeight: 120,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
});
