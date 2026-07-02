import React, { useState, useRef, useEffect } from "react";
import {
  View, Text, StyleSheet, Pressable,
  TextInput, Alert, Animated, Platform,
} from "react-native";
import { Audio } from "expo-av";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { invalidateCases } from "@/lib/api";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const DARK_BG   = "#0F1419";
const ACCENT    = "#7c3aed";
const MIC_SIZE  = 88;

const parseAgeToYears = (ageStr: string | number): number => {
  if (!ageStr) return 0;
  const str = String(ageStr).toLowerCase().trim();
  if ((str.endsWith("m") || str.includes("mo") || str.includes("month")) &&
      !str.includes("yr") && !str.includes("year")) {
    return (parseFloat(str) || 0) / 12;
  }
  return parseFloat(str) || 0;
};

type Phase = "idle" | "recording" | "processing";

const PHASE_LABELS: Record<Phase, string> = {
  idle:       "Tap to speak your case",
  recording:  "Listening…  tap to stop",
  processing: "Processing…",
};

const PHASE_HINTS: Record<Phase, string> = {
  idle:       "Speak in any language — Hindi, Tamil, English, or mixed",
  recording:  "Speak naturally — age, vitals, complaints, medications",
  processing: "Sarvam AI + GPT-4o extracting clinical data",
};

interface WebRec {
  mr: MediaRecorder | null;
  chunks: Blob[];
  stream: MediaStream | null;
}

export default function VoiceCaseSheetScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { user }   = useAuth();
  const insets     = useSafeAreaInsets();

  const [patientName, setPatientName] = useState("");
  const [phase, setPhase]             = useState<Phase>("idle");
  const [recSecs, setRecSecs]         = useState(0);

  const nativeRec   = useRef<Audio.Recording | null>(null);
  const webRec      = useRef<WebRec>({ mr: null, chunks: [], stream: null });
  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const recStart    = useRef(0);

  // Animations
  const pulseAnim   = useRef(new Animated.Value(1)).current;
  const ring1       = useRef(new Animated.Value(0)).current;
  const ring2       = useRef(new Animated.Value(0)).current;
  const ring1Loop   = useRef<Animated.CompositeAnimation | null>(null);
  const ring2Loop   = useRef<Animated.CompositeAnimation | null>(null);
  const pulseLoop   = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (phase === "recording") {
      pulseLoop.current = Animated.loop(Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 650, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1,    duration: 650, useNativeDriver: true }),
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

      timerRef.current = setInterval(() => setRecSecs(s => s + 1), 1000);
    } else {
      ring1Loop.current?.stop(); ring2Loop.current?.stop(); pulseLoop.current?.stop();
      ring1.setValue(0); ring2.setValue(0); pulseAnim.setValue(1);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const startRecording = async () => {
    setRecSecs(0);
    recStart.current = Date.now();
    try {
      if (Platform.OS === "web") {
        if (!navigator.mediaDevices?.getUserMedia) {
          Alert.alert("Not supported", "Voice recording is not available in this browser.");
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        webRec.current = { mr: null, chunks: [], stream };
        const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
        const mr = new MediaRecorder(stream, { mimeType });
        mr.ondataavailable = e => { if (e.data.size > 0) webRec.current.chunks.push(e.data); };
        mr.onstop = () => {
          const blob = new Blob(webRec.current.chunks, { type: mimeType });
          stream.getTracks().forEach(t => t.stop());
          processAudio(blob, null);
        };
        webRec.current.mr = mr;
        mr.start(100);
      } else {
        const { granted } = await Audio.requestPermissionsAsync();
        if (!granted) {
          Alert.alert("Permission required", "Microphone access is needed for voice recording.");
          return;
        }
        if (nativeRec.current) {
          try { await nativeRec.current.stopAndUnloadAsync(); } catch {}
          nativeRec.current = null;
        }
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true, staysActiveInBackground: true });
        await activateKeepAwakeAsync("voice-case");
        const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
        nativeRec.current = recording;
      }
      setPhase("recording");
    } catch {
      Alert.alert("Error", "Could not start recording. Please try again.");
    }
  };

  const stopRecording = async () => {
    const elapsed = Math.floor((Date.now() - recStart.current) / 1000);
    if (elapsed < 2) {
      Alert.alert("Too short", "Please hold and speak for at least 2 seconds.");
      return;
    }
    setPhase("processing");
    try {
      if (Platform.OS === "web") {
        const mr = webRec.current.mr;
        if (mr && mr.state !== "inactive") mr.stop();
      } else {
        const rec = nativeRec.current;
        if (!rec) { setPhase("idle"); return; }
        await rec.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
        deactivateKeepAwake("voice-case");
        const uri = rec.getURI();
        nativeRec.current = null;
        if (uri) processAudio(null, uri);
        else setPhase("idle");
      }
    } catch {
      nativeRec.current = null;
      setPhase("idle");
    }
  };

  const processAudio = async (blob: Blob | null, uri: string | null) => {
    try {
      // 1. Transcribe
      const formData = new FormData();
      if (Platform.OS === "web" && blob) {
        const ext = blob.type.includes("webm") ? "webm" : "m4a";
        formData.append("audio", blob, `voice.${ext}`);
      } else if (uri) {
        const ext = uri.split(".").pop() || "m4a";
        formData.append("audio", {
          uri, name: `voice.${ext}`,
          type: `audio/${ext === "caf" ? "x-caf" : ext === "m4a" ? "mp4" : ext}`,
        } as any);
      }
      formData.append("mode", "field");

      const txResp = await fetch(new URL("/api/voice/transcribe", getApiUrl()).toString(), {
        method: "POST", body: formData,
      });
      if (!txResp.ok) throw new Error("Transcription failed");
      const txData = await txResp.json();
      const transcript: string = (txData.transcript || "").trim();
      const engTranscript: string = (txData.englishTranscript || txData.transcript || "").trim();
      const lang: string = txData.detectedLanguage || "en-IN";

      if (!transcript) throw new Error("No speech detected. Please try again.");

      // 2. Extract clinical data
      const token = await AsyncStorage.getItem("token");
      if (!token) { Alert.alert("Session expired", "Please log in again."); setPhase("idle"); return; }

      let extractText = engTranscript || transcript;
      if (lang && !lang.startsWith("en") && engTranscript !== transcript) {
        try {
          const tResp = await fetch(new URL("/api/voice/translate", getApiUrl()).toString(), {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: transcript, sourceLanguage: lang }),
          });
          if (tResp.ok) {
            const tData = await tResp.json();
            if (tData.englishText?.trim()) extractText = tData.englishText.trim();
          }
        } catch {}
      }

      const exResp = await fetch(new URL("/api/voice/extract-clinical", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          transcript: extractText,
          patientContext: { age: 0, sex: "Unknown", caseType: "adult" },
        }),
      });
      if (!exResp.ok) throw new Error(`Extraction failed (${exResp.status})`);
      const exData = await exResp.json();
      const extracted = exData.extracted;
      if (!extracted || typeof extracted !== "object") throw new Error("Could not extract clinical data. Please try again.");

      // 3. Detect adult vs pediatric from extracted age
      const rawAge = extracted.patientAge ?? extracted.age ?? "";
      const ageYears = parseAgeToYears(rawAge);
      const caseType: "adult" | "pediatric" = ageYears > 0 && ageYears <= 16 ? "pediatric" : "adult";

      // Use name from field if doctor didn't type one
      const finalName = patientName.trim() || extracted.patientName || "Unknown";
      const finalAge  = rawAge ? String(rawAge) : "";
      const finalSex  = extracted.patientSex || extracted.sex || "Unknown";

      // 4. Save case
      const svResp = await fetch(new URL("/api/voice/save-case", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          patient: {
            name: finalName,
            age: finalAge,
            sex: finalSex,
            phone: "",
            weight: extracted.patientWeight || extracted.weight || "",
            mode_of_arrival: "Walk-in",
            address: "Not provided",
            brought_by: "Self",
            informant_name: finalName,
            informant_reliability: "Reliable",
            identification_mark: "None noted",
            arrival_datetime: new Date().toISOString(),
          },
          extracted,
          transcript,
          case_type: caseType,
          userId: user?.id,
          userEmail: user?.email || "",
        }),
      });

      if (svResp.status === 401) {
        await AsyncStorage.multiRemove(["token", "user"]);
        Alert.alert("Session expired", "Please log in again.", [
          { text: "Log In", onPress: () => navigation.navigate("Login") },
        ]);
        setPhase("idle");
        return;
      }

      const svData = await svResp.json();
      if (!svData.success) throw new Error(svData.error || svData.detail || "Save failed");

      await invalidateCases();
      const caseId = String(svData.caseId);
      // Navigate to CaseChatScreen — case note appears immediately
      navigation.replace("CaseChat", { caseId, patientName: finalName });
    } catch (err: any) {
      Alert.alert(
        "Something went wrong",
        err.message || "Please try again.",
        [
          { text: "Retry", onPress: () => setPhase("idle") },
          { text: "Cancel", style: "cancel", onPress: () => { setPhase("idle"); navigation.goBack(); } },
        ]
      );
      setPhase("idle");
    }
  };

  const handleMicPress = () => {
    if (phase === "processing") return;
    if (phase === "recording") stopRecording();
    else startRecording();
  };

  const ring1Scale = ring1.interpolate({ inputRange: [0, 1], outputRange: [1, 2.0] });
  const ring1Opacity = ring1.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.35, 0] });
  const ring2Scale = ring2.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] });
  const ring2Opacity = ring2.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.25, 0] });

  const micBg = phase === "recording" ? "#ef4444" : phase === "processing" ? "#374151" : ACCENT;

  return (
    <View style={[styles.root, { backgroundColor: DARK_BG }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 32 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn} hitSlop={12}>
            <Feather name="x" size={20} color="rgba(255,255,255,0.6)" />
          </Pressable>
          <Text style={styles.headerTitle}>New Patient</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Name field */}
        <View style={styles.nameSection}>
          <Text style={styles.nameLabel}>Patient name</Text>
          <TextInput
            style={styles.nameInput}
            value={patientName}
            onChangeText={setPatientName}
            placeholder="Optional — extracted from speech"
            placeholderTextColor="rgba(255,255,255,0.25)"
            autoCapitalize="words"
            returnKeyType="done"
            editable={phase === "idle"}
          />
        </View>

        {/* Mic area */}
        <View style={styles.micArea}>
          {/* Ring animations */}
          <Animated.View
            style={[styles.micRing, {
              width: MIC_SIZE + 20, height: MIC_SIZE + 20,
              borderRadius: (MIC_SIZE + 20) / 2,
              transform: [{ scale: ring1Scale }],
              opacity: ring1Opacity,
            }]}
          />
          <Animated.View
            style={[styles.micRing, {
              width: MIC_SIZE + 20, height: MIC_SIZE + 20,
              borderRadius: (MIC_SIZE + 20) / 2,
              transform: [{ scale: ring2Scale }],
              opacity: ring2Opacity,
            }]}
          />

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Pressable
              onPress={handleMicPress}
              disabled={phase === "processing"}
              style={[styles.micBtn, { width: MIC_SIZE, height: MIC_SIZE, borderRadius: MIC_SIZE / 2, backgroundColor: micBg }]}
            >
              {phase === "processing" ? (
                <Feather name="loader" size={32} color="#FFFFFF" />
              ) : phase === "recording" ? (
                <Feather name="square" size={32} color="#FFFFFF" />
              ) : (
                <Feather name="mic" size={36} color="#FFFFFF" />
              )}
            </Pressable>
          </Animated.View>

          <Text style={styles.phaseLabel}>{PHASE_LABELS[phase]}</Text>
          {phase === "recording" && (
            <Text style={styles.recTimer}>{fmtTime(recSecs)}</Text>
          )}
          <Text style={styles.phaseHint}>{PHASE_HINTS[phase]}</Text>
        </View>

        {/* Example prompt */}
        {phase === "idle" && (
          <View style={styles.exampleBox}>
            <Text style={styles.exampleTitle}>Example</Text>
            <Text style={styles.exampleText}>
              "52 year old male with chest pain for 2 hours, BP 94 by 60, diabetic, gave aspirin and morphine, ECG shows ST elevation in V1 to V4"
            </Text>
          </View>
        )}
      </KeyboardAwareScrollViewCompat>
    </View>
  );
}

const styles = StyleSheet.create({
  root:        { flex: 1 },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: 24,
    alignItems: "stretch",
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  backBtn: {
    width: 40, height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.07)",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
    letterSpacing: 0.2,
  },
  nameSection:   { marginBottom: 48 },
  nameLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  nameInput: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.10)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: "#FFFFFF",
  },
  micArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 18,
    minHeight: 280,
  },
  micBtn: {
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#7c3aed",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 12,
  },
  micRing: {
    position: "absolute",
    backgroundColor: ACCENT,
  },
  phaseLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
    textAlign: "center",
    marginTop: 8,
  },
  recTimer: {
    fontSize: 28,
    fontWeight: "700",
    color: "#ef4444",
    letterSpacing: 2,
    fontVariant: ["tabular-nums"],
  },
  phaseHint: {
    fontSize: 14,
    color: "rgba(255,255,255,0.40)",
    textAlign: "center",
    paddingHorizontal: 32,
    lineHeight: 20,
  },
  exampleBox: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 18,
    marginTop: 8,
  },
  exampleTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: ACCENT,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  exampleText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 22,
    fontStyle: "italic",
  },
});
