import React, { useState, useRef, useCallback } from "react";
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

  const formDataRef = useRef({
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

  const [, forceUpdate] = useState(0);

  const updateField = useCallback((field: string, value: string) => {
    (formDataRef.current as any)[field] = value;
    forceUpdate((n) => n + 1);
  }, []);

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
        formDataRef.current.chief_complaint = res.data.transcription;
        forceUpdate((n) => n + 1);
      }
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      setTranscribing(false);
    }
  };

  const fillDefaults = () => {
    const fd = formDataRef.current;
    if (!fd.hr) fd.hr = DEFAULT_VITALS.hr;
    if (!fd.bp_systolic) fd.bp_systolic = DEFAULT_VITALS.bp_systolic;
    if (!fd.bp_diastolic) fd.bp_diastolic = DEFAULT_VITALS.bp_diastolic;
    if (!fd.rr) fd.rr = DEFAULT_VITALS.rr;
    if (!fd.spo2) fd.spo2 = DEFAULT_VITALS.spo2;
    if (!fd.temperature) fd.temperature = DEFAULT_VITALS.temperature;
    if (!fd.gcs_e) fd.gcs_e = DEFAULT_VITALS.gcs_e;
    if (!fd.gcs_v) fd.gcs_v = DEFAULT_VITALS.gcs_v;
    if (!fd.gcs_m) fd.gcs_m = DEFAULT_VITALS.gcs_m;
    if (!fd.grbs) fd.grbs = DEFAULT_VITALS.grbs;
    forceUpdate((n) => n + 1);
  };

  const handleSave = async () => {
    const fd = formDataRef.current;

    if (!fd.name) {
      Alert.alert("Required", "Please enter patient name");
      return;
    }

    fillDefaults();
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
        triage_priority: 4,
        triage_color: "green",
        em_resident: user?.name || "",
        case_type: patientType,
      };

      const res = await apiPost<{ id: string }>("/cases", payload);

      if (res.success && res.data) {
        invalidateCases();
        Alert.alert("Success", "Patient saved successfully", [
          {
            text: "Continue to Case Sheet",
            onPress: () =>
              navigation.navigate("CaseSheet", {
                caseId: res.data!.id,
                patientType,
              }),
          },
          {
            text: "Go to Dashboard",
            onPress: () => navigation.goBack(),
            style: "cancel",
          },
        ]);
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
        value={(formDataRef.current as any)[field]}
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
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Voice Input</Text>
          <Pressable
            style={[
              styles.voiceBtn,
              { backgroundColor: isRecording ? TriageColors.red : theme.primary },
            ]}
            onPress={isRecording ? stopRecording : startRecording}
            disabled={transcribing}
          >
            {transcribing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name={isRecording ? "mic-off" : "mic"} size={24} color="#FFFFFF" />
                <Text style={styles.voiceBtnText}>{isRecording ? "Stop Recording" : "Start Recording"}</Text>
              </>
            )}
          </Pressable>
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
                        backgroundColor: formDataRef.current.sex === s ? theme.primary : "transparent",
                      },
                    ]}
                    onPress={() => updateField("sex", s)}
                  >
                    <Text
                      style={{
                        color: formDataRef.current.sex === s ? "#FFFFFF" : theme.textSecondary,
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
                GCS: {parseInt(formDataRef.current.gcs_e || "4") + parseInt(formDataRef.current.gcs_v || "5") + parseInt(formDataRef.current.gcs_m || "6")}/15
              </Text>
            </View>
          </View>
          <Pressable style={[styles.defaultBtn, { backgroundColor: theme.backgroundSecondary }]} onPress={fillDefaults}>
            <Text style={[styles.defaultBtnText, { color: theme.primary }]}>Fill Normal Values</Text>
          </Pressable>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Chief Complaint</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
            placeholder="Describe the chief complaint..."
            placeholderTextColor={theme.textMuted}
            value={formDataRef.current.chief_complaint}
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
  transcriptBox: { padding: Spacing.md, borderRadius: BorderRadius.sm, marginTop: Spacing.md },
  transcriptText: { ...Typography.small, fontStyle: "italic" },
  section: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
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
