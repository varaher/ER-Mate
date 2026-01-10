import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
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

export default function CaseSheetScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { caseId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [caseData, setCaseData] = useState<any>(null);
  const [formData, setFormData] = useState<ATLSFormData>(getDefaultATLSFormData());
  const [isRecording, setIsRecording] = useState(false);
  const [isContinuousRecording, setIsContinuousRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [activeField, setActiveField] = useState<string>("sample.eventsHopi");
  const recordingRef = useRef<Audio.Recording | null>(null);
  const transcriptionIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isContinuousRecordingRef = useRef(false);

  useEffect(() => {
    return () => {
      isContinuousRecordingRef.current = false;
      if (transcriptionIntervalRef.current) {
        clearTimeout(transcriptionIntervalRef.current);
      }
      if (recordingRef.current) {
        recordingRef.current.stopAndUnloadAsync().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    isContinuousRecordingRef.current = isContinuousRecording;
  }, [isContinuousRecording]);

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
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const gcsTotal = (parseInt(formData.disability.gcsE) || 0) + 
                       (parseInt(formData.disability.gcsV) || 0) + 
                       (parseInt(formData.disability.gcsM) || 0);
      
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
        Alert.alert("Saved", "Case sheet updated", [
          { text: "Continue to Physical Exam", onPress: () => navigation.navigate("PhysicalExam", { caseId }) },
          { text: "Stay Here", style: "cancel" },
        ]);
      } else {
        Alert.alert("Error", res.error || "Failed to save");
      }
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const transcribeAudio = async (uri: string) => {
    try {
      setTranscribing(true);
      const formDataUpload = new FormData();
      formDataUpload.append("file", {
        uri,
        name: "voice.m4a",
        type: "audio/m4a",
      } as any);
      formDataUpload.append("engine", "auto");
      formDataUpload.append("language", "en");

      const res = await apiUpload<{ transcription: string }>("/ai/voice-to-text", formDataUpload);

      if (res.success && res.data?.transcription) {
        const [section, field] = activeField.split(".") as [keyof ATLSFormData, string];
        const currentValue = (formData[section] as any)[field] || "";
        updateFormData(section, field, currentValue ? `${currentValue} ${res.data.transcription}` : res.data.transcription);
      }
    } catch (err) {
      console.error("Transcription error:", err);
    } finally {
      setTranscribing(false);
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
          if (uri) await transcribeAudio(uri);
          if (isContinuousRecordingRef.current) recordChunk();
        }
      }, 5000);
    } catch (err) {
      console.error("Chunk recording error:", err);
    }
  };

  const startContinuousRecording = async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Microphone access is needed for voice input");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      setIsContinuousRecording(true);
      isContinuousRecordingRef.current = true;
      recordChunk();
    } catch (err) {
      Alert.alert("Error", "Failed to start recording");
    }
  };

  const stopContinuousRecording = async () => {
    setIsContinuousRecording(false);
    isContinuousRecordingRef.current = false;
    if (transcriptionIntervalRef.current) clearTimeout(transcriptionIntervalRef.current);
    if (recordingRef.current) {
      try {
        await recordingRef.current.stopAndUnloadAsync();
        const uri = recordingRef.current.getURI();
        recordingRef.current = null;
        setIsRecording(false);
        if (uri) await transcribeAudio(uri);
      } catch {}
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing["4xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        {caseData?.patient && (
          <View style={[styles.patientCard, { backgroundColor: theme.card }]}>
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
              <Text style={[styles.complaint, { color: theme.textMuted }]}>
                Chief Complaint: {caseData.presenting_complaint.text}
              </Text>
            )}
          </View>
        )}

        <View style={[styles.voiceSection, { backgroundColor: theme.card }]}>
          <Text style={[styles.voiceTitle, { color: theme.text }]}>Voice Dictation</Text>
          <Text style={[styles.voiceSubtitle, { color: theme.textSecondary }]}>
            Select field, then speak to auto-populate
          </Text>
          <View style={styles.fieldSelector}>
            {[
              { key: "sample.eventsHopi", label: "HOPI" },
              { key: "sample.signsSymptoms", label: "Signs" },
              { key: "airway.notes", label: "Airway" },
              { key: "breathing.notes", label: "Breathing" },
              { key: "circulation.notes", label: "Circulation" },
            ].map((f) => (
              <Pressable
                key={f.key}
                style={[
                  styles.fieldBtn,
                  { backgroundColor: activeField === f.key ? theme.primary : theme.backgroundSecondary },
                ]}
                onPress={() => setActiveField(f.key)}
              >
                <Text style={{ color: activeField === f.key ? "#FFFFFF" : theme.textSecondary, fontSize: 12, fontWeight: "600" }}>
                  {f.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={[styles.voiceBtn, { backgroundColor: isContinuousRecording ? TriageColors.red : theme.primary }]}
            onPress={isContinuousRecording ? stopContinuousRecording : startContinuousRecording}
            disabled={transcribing}
          >
            {transcribing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Feather name={isContinuousRecording ? "mic-off" : "mic"} size={20} color="#FFFFFF" />
                <Text style={styles.voiceBtnText}>{isContinuousRecording ? "Stop Recording" : "Start Continuous Recording"}</Text>
              </>
            )}
          </Pressable>
          {isRecording && (
            <View style={styles.recordingIndicator}>
              <View style={[styles.recordingDot, { backgroundColor: TriageColors.red }]} />
              <Text style={[styles.recordingText, { color: TriageColors.red }]}>Recording...</Text>
            </View>
          )}
        </View>

        <Text style={[styles.heading, { color: theme.text }]}>Primary Survey (ABCDE)</Text>

        <CollapsibleSection title="AIRWAY" icon="A" iconColor={TriageColors.red} defaultExpanded>
          <DropdownField
            label="Airway Status"
            options={AIRWAY_STATUS_OPTIONS}
            value={formData.airway.status}
            onChange={(v) => updateFormData("airway", "status", v)}
          />
          <DropdownField
            label="Airway Maintenance"
            options={AIRWAY_MAINTENANCE_OPTIONS}
            value={formData.airway.maintenance}
            onChange={(v) => updateFormData("airway", "maintenance", v)}
          />
          <DropdownField
            label="Obstruction Cause"
            options={AIRWAY_OBSTRUCTION_CAUSE_OPTIONS}
            value={formData.airway.obstructionCause}
            onChange={(v) => updateFormData("airway", "obstructionCause", v)}
          />
          <DropdownField
            label="Speech"
            options={AIRWAY_SPEECH_OPTIONS}
            value={formData.airway.speech}
            onChange={(v) => updateFormData("airway", "speech", v)}
          />
          <DropdownField
            label="Signs of Compromise"
            options={AIRWAY_COMPROMISE_SIGNS_OPTIONS}
            value={formData.airway.compromiseSigns}
            onChange={(v) => updateFormData("airway", "compromiseSigns", v)}
          />
          <CheckboxGroup
            label="Interventions Done"
            options={AIRWAY_INTERVENTIONS}
            selectedValues={formData.airway.interventions}
            onChange={(v) => updateFormData("airway", "interventions", v)}
            columns={3}
          />
          <TextInputField
            label="Additional Notes"
            value={formData.airway.notes}
            onChangeText={(v) => updateFormData("airway", "notes", v)}
            placeholder="Additional airway observations..."
            multiline
            numberOfLines={3}
          />
        </CollapsibleSection>

        <CollapsibleSection title="BREATHING" icon="B" iconColor={TriageColors.orange}>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <TextInputField
                label="RR (/min)"
                value={formData.breathing.rr}
                onChangeText={(v) => updateFormData("breathing", "rr", v)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfField}>
              <TextInputField
                label="SpO2 (%)"
                value={formData.breathing.spo2}
                onChangeText={(v) => updateFormData("breathing", "spo2", v)}
                keyboardType="numeric"
              />
            </View>
          </View>
          <DropdownField
            label="O2 Device"
            options={O2_DEVICE_OPTIONS}
            value={formData.breathing.o2Device}
            onChange={(v) => updateFormData("breathing", "o2Device", v)}
          />
          <TextInputField
            label="O2 Flow (L/min)"
            value={formData.breathing.o2Flow}
            onChangeText={(v) => updateFormData("breathing", "o2Flow", v)}
            keyboardType="numeric"
          />
          <DropdownField
            label="Breathing Pattern"
            options={BREATHING_PATTERN_OPTIONS}
            value={formData.breathing.pattern}
            onChange={(v) => updateFormData("breathing", "pattern", v)}
          />
          <DropdownField
            label="Chest Expansion"
            options={CHEST_EXPANSION_OPTIONS}
            value={formData.breathing.chestExpansion}
            onChange={(v) => updateFormData("breathing", "chestExpansion", v)}
          />
          <DropdownField
            label="Air Entry"
            options={AIR_ENTRY_OPTIONS}
            value={formData.breathing.airEntry}
            onChange={(v) => updateFormData("breathing", "airEntry", v)}
          />
          <DropdownField
            label="Effort"
            options={BREATHING_EFFORT_OPTIONS}
            value={formData.breathing.effort}
            onChange={(v) => updateFormData("breathing", "effort", v)}
          />
          <DropdownField
            label="Added Breath Sounds"
            options={ADDED_BREATH_SOUNDS_OPTIONS}
            value={formData.breathing.addedSounds}
            onChange={(v) => updateFormData("breathing", "addedSounds", v)}
          />
          <CheckboxGroup
            label="Interventions Done"
            options={BREATHING_INTERVENTIONS}
            selectedValues={formData.breathing.interventions}
            onChange={(v) => updateFormData("breathing", "interventions", v)}
            columns={2}
          />
          <TextInputField
            label="Additional Notes"
            value={formData.breathing.notes}
            onChangeText={(v) => updateFormData("breathing", "notes", v)}
            placeholder="Additional breathing observations..."
            multiline
            numberOfLines={3}
          />
        </CollapsibleSection>

        <CollapsibleSection title="CIRCULATION" icon="C" iconColor={TriageColors.yellow}>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <TextInputField
                label="Heart Rate (bpm)"
                value={formData.circulation.hr}
                onChangeText={(v) => updateFormData("circulation", "hr", v)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfField}>
              <DropdownField
                label="Pulse Quality"
                options={PULSE_QUALITY_OPTIONS}
                value={formData.circulation.pulseQuality}
                onChange={(v) => updateFormData("circulation", "pulseQuality", v)}
              />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <TextInputField
                label="BP Systolic"
                value={formData.circulation.bpSystolic}
                onChangeText={(v) => updateFormData("circulation", "bpSystolic", v)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.halfField}>
              <TextInputField
                label="BP Diastolic"
                value={formData.circulation.bpDiastolic}
                onChangeText={(v) => updateFormData("circulation", "bpDiastolic", v)}
                keyboardType="numeric"
              />
            </View>
          </View>
          <DropdownField
            label="Capillary Refill"
            options={CAPILLARY_REFILL_OPTIONS}
            value={formData.circulation.capillaryRefill}
            onChange={(v) => updateFormData("circulation", "capillaryRefill", v)}
          />
          <View style={styles.row}>
            <View style={styles.halfField}>
              <DropdownField
                label="Skin Color"
                options={SKIN_COLOR_OPTIONS}
                value={formData.circulation.skinColor}
                onChange={(v) => updateFormData("circulation", "skinColor", v)}
              />
            </View>
            <View style={styles.halfField}>
              <DropdownField
                label="Skin Temperature"
                options={SKIN_TEMPERATURE_OPTIONS}
                value={formData.circulation.skinTemperature}
                onChange={(v) => updateFormData("circulation", "skinTemperature", v)}
              />
            </View>
          </View>
          <DropdownField
            label="IV Access"
            options={IV_ACCESS_OPTIONS}
            value={formData.circulation.ivAccess}
            onChange={(v) => updateFormData("circulation", "ivAccess", v)}
          />
          <CheckboxGroup
            label="Interventions Done"
            options={CIRCULATION_INTERVENTIONS}
            selectedValues={formData.circulation.interventions}
            onChange={(v) => updateFormData("circulation", "interventions", v)}
            columns={2}
          />
          <TextInputField
            label="Additional Notes"
            value={formData.circulation.notes}
            onChangeText={(v) => updateFormData("circulation", "notes", v)}
            placeholder="Additional circulation observations..."
            multiline
            numberOfLines={3}
          />
        </CollapsibleSection>

        <CollapsibleSection title="DISABILITY" icon="D" iconColor={TriageColors.green}>
          <Text style={[styles.subLabel, { color: theme.textSecondary }]}>Glasgow Coma Scale</Text>
          <View style={styles.row}>
            <View style={styles.thirdField}>
              <TextInputField
                label="Eye (1-4)"
                value={formData.disability.gcsE}
                onChangeText={(v) => updateFormData("disability", "gcsE", v)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.thirdField}>
              <TextInputField
                label="Verbal (1-5)"
                value={formData.disability.gcsV}
                onChangeText={(v) => updateFormData("disability", "gcsV", v)}
                keyboardType="numeric"
              />
            </View>
            <View style={styles.thirdField}>
              <TextInputField
                label="Motor (1-6)"
                value={formData.disability.gcsM}
                onChangeText={(v) => updateFormData("disability", "gcsM", v)}
                keyboardType="numeric"
              />
            </View>
          </View>
          <View style={[styles.gcsTotal, { backgroundColor: theme.backgroundSecondary }]}>
            <Text style={[styles.gcsTotalLabel, { color: theme.textSecondary }]}>GCS Total:</Text>
            <Text style={[styles.gcsTotalValue, { color: theme.text }]}>
              {(parseInt(formData.disability.gcsE) || 0) + (parseInt(formData.disability.gcsV) || 0) + (parseInt(formData.disability.gcsM) || 0)}/15
            </Text>
          </View>
          <View style={styles.row}>
            <View style={styles.halfField}>
              <DropdownField
                label="Pupil Size"
                options={PUPIL_SIZE_OPTIONS}
                value={formData.disability.pupilSize}
                onChange={(v) => updateFormData("disability", "pupilSize", v)}
              />
            </View>
            <View style={styles.halfField}>
              <DropdownField
                label="Pupil Reaction"
                options={PUPIL_REACTION_OPTIONS}
                value={formData.disability.pupilReaction}
                onChange={(v) => updateFormData("disability", "pupilReaction", v)}
              />
            </View>
          </View>
          <DropdownField
            label="Motor Response"
            options={MOTOR_RESPONSE_OPTIONS}
            value={formData.disability.motorResponse}
            onChange={(v) => updateFormData("disability", "motorResponse", v)}
          />
          <TextInputField
            label="Glucose (mg/dL)"
            value={formData.disability.glucose}
            onChangeText={(v) => updateFormData("disability", "glucose", v)}
            keyboardType="numeric"
          />
          <CheckboxGroup
            label="Interventions Done"
            options={DISABILITY_INTERVENTIONS}
            selectedValues={formData.disability.interventions}
            onChange={(v) => updateFormData("disability", "interventions", v)}
            columns={2}
          />
          <TextInputField
            label="Additional Notes"
            value={formData.disability.notes}
            onChangeText={(v) => updateFormData("disability", "notes", v)}
            placeholder="Additional neurological observations..."
            multiline
            numberOfLines={3}
          />
        </CollapsibleSection>

        <CollapsibleSection title="EXPOSURE" icon="E" iconColor={TriageColors.blue}>
          <TextInputField
            label="Temperature"
            value={formData.exposure.temperature}
            onChangeText={(v) => updateFormData("exposure", "temperature", v)}
            keyboardType="decimal-pad"
            suffix="C"
          />
          <CheckboxGroup
            label="Findings"
            options={EXPOSURE_FINDINGS_OPTIONS}
            selectedValues={formData.exposure.findings}
            onChange={(v) => updateFormData("exposure", "findings", v)}
            columns={2}
          />
          <CheckboxGroup
            label="Interventions Done"
            options={EXPOSURE_INTERVENTIONS}
            selectedValues={formData.exposure.interventions}
            onChange={(v) => updateFormData("exposure", "interventions", v)}
            columns={2}
          />
          <TextInputField
            label="Additional Notes"
            value={formData.exposure.notes}
            onChangeText={(v) => updateFormData("exposure", "notes", v)}
            placeholder="Additional exposure findings..."
            multiline
            numberOfLines={3}
          />
        </CollapsibleSection>

        <Text style={[styles.heading, { color: theme.text }]}>Adjuncts to Primary Survey</Text>

        <CollapsibleSection title="ABG / VBG" icon="+" iconColor={theme.primary}>
          <DropdownField
            label="ABG Status"
            options={ABG_STATUS_OPTIONS}
            value={formData.adjuncts.abgStatus}
            onChange={(v) => updateFormData("adjuncts", "abgStatus", v)}
          />
          <TextInputField
            label="ABG Notes / Values"
            value={formData.adjuncts.abgNotes}
            onChangeText={(v) => updateFormData("adjuncts", "abgNotes", v)}
            placeholder="pH, pCO2, pO2, HCO3, BE, Lactate..."
            multiline
            numberOfLines={2}
          />
        </CollapsibleSection>

        <CollapsibleSection title="ECG" icon="+" iconColor={theme.primary}>
          <DropdownField
            label="ECG Interpretation"
            options={ECG_STATUS_OPTIONS}
            value={formData.adjuncts.ecgStatus}
            onChange={(v) => updateFormData("adjuncts", "ecgStatus", v)}
          />
          <TextInputField
            label="ECG Notes"
            value={formData.adjuncts.ecgNotes}
            onChangeText={(v) => updateFormData("adjuncts", "ecgNotes", v)}
            placeholder="Detailed ECG findings..."
            multiline
            numberOfLines={2}
          />
        </CollapsibleSection>

        <CollapsibleSection title="EFAST" icon="+" iconColor={theme.primary}>
          <DropdownField
            label="EFAST Result"
            options={EFAST_OPTIONS}
            value={formData.adjuncts.efastStatus}
            onChange={(v) => updateFormData("adjuncts", "efastStatus", v)}
          />
          <TextInputField
            label="EFAST Notes"
            value={formData.adjuncts.efastNotes}
            onChangeText={(v) => updateFormData("adjuncts", "efastNotes", v)}
            placeholder="Detailed ultrasound findings..."
            multiline
            numberOfLines={2}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Bedside Echo" icon="+" iconColor={theme.primary}>
          <DropdownField
            label="Echo Result"
            options={BEDSIDE_ECHO_OPTIONS}
            value={formData.adjuncts.echoStatus}
            onChange={(v) => updateFormData("adjuncts", "echoStatus", v)}
          />
          <TextInputField
            label="Echo Notes"
            value={formData.adjuncts.echoNotes}
            onChangeText={(v) => updateFormData("adjuncts", "echoNotes", v)}
            placeholder="EF, wall motion, valves..."
            multiline
            numberOfLines={2}
          />
        </CollapsibleSection>

        <Text style={[styles.heading, { color: theme.text }]}>SAMPLE History</Text>

        <CollapsibleSection title="Signs & Symptoms" icon="S" iconColor={TriageColors.orange} defaultExpanded>
          <TextInputField
            label="Signs and Symptoms"
            value={formData.sample.signsSymptoms}
            onChangeText={(v) => updateFormData("sample", "signsSymptoms", v)}
            placeholder="Current signs and symptoms..."
            multiline
            numberOfLines={4}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Allergies" icon="A" iconColor={TriageColors.red}>
          <TextInputField
            label="Known Allergies"
            value={formData.sample.allergies}
            onChangeText={(v) => updateFormData("sample", "allergies", v)}
            placeholder="Drug allergies, food allergies, environmental..."
            multiline
            numberOfLines={3}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Medications" icon="M" iconColor={TriageColors.yellow}>
          <TextInputField
            label="Current Medications"
            value={formData.sample.medications}
            onChangeText={(v) => updateFormData("sample", "medications", v)}
            placeholder="List current medications with dosages..."
            multiline
            numberOfLines={4}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Past Medical History" icon="P" iconColor={TriageColors.green}>
          <TextInputField
            label="Past Medical History"
            value={formData.sample.pastMedicalHistory}
            onChangeText={(v) => updateFormData("sample", "pastMedicalHistory", v)}
            placeholder="Previous illnesses, surgeries, hospitalizations..."
            multiline
            numberOfLines={4}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Last Meal / LMP" icon="L" iconColor={TriageColors.blue}>
          <TextInputField
            label="Last Oral Intake"
            value={formData.sample.lastMeal}
            onChangeText={(v) => updateFormData("sample", "lastMeal", v)}
            placeholder="Time and content of last meal..."
          />
          <TextInputField
            label="LMP (if applicable)"
            value={formData.sample.lmp}
            onChangeText={(v) => updateFormData("sample", "lmp", v)}
            placeholder="Last menstrual period date..."
          />
        </CollapsibleSection>

        <CollapsibleSection title="Events / HOPI" icon="E" iconColor={theme.primary} defaultExpanded>
          <TextInputField
            label="Events Leading to Presentation / History of Present Illness"
            value={formData.sample.eventsHopi}
            onChangeText={(v) => updateFormData("sample", "eventsHopi", v)}
            placeholder="Detailed history of present illness..."
            multiline
            numberOfLines={6}
          />
        </CollapsibleSection>

        <Pressable
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: theme.primary, opacity: pressed || saving ? 0.8 : 1 },
          ]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Feather name="save" size={20} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Save & Continue</Text>
            </>
          )}
        </Pressable>
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
  patientInfo: { flex: 1 },
  patientName: { ...Typography.h3 },
  patientDetails: { ...Typography.body, marginTop: 2 },
  triageBadge: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center", marginLeft: Spacing.md },
  triageBadgeText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  complaint: { ...Typography.small, marginTop: Spacing.sm, fontStyle: "italic" },
  voiceSection: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  voiceTitle: { ...Typography.h4, marginBottom: Spacing.xs },
  voiceSubtitle: { ...Typography.small, marginBottom: Spacing.md },
  fieldSelector: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm, marginBottom: Spacing.md },
  fieldBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm },
  voiceBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: Spacing.md, borderRadius: BorderRadius.md, gap: Spacing.sm },
  voiceBtnText: { color: "#FFFFFF", ...Typography.bodyMedium },
  recordingIndicator: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: Spacing.sm, gap: Spacing.xs },
  recordingDot: { width: 10, height: 10, borderRadius: 5 },
  recordingText: { ...Typography.small, fontWeight: "600" },
  heading: { ...Typography.h4, marginBottom: Spacing.md, marginTop: Spacing.md },
  row: { flexDirection: "row", gap: Spacing.md },
  halfField: { flex: 1 },
  thirdField: { flex: 1 },
  subLabel: { ...Typography.label, marginBottom: Spacing.sm },
  gcsTotal: { flexDirection: "row", alignItems: "center", justifyContent: "center", padding: Spacing.md, borderRadius: BorderRadius.md, marginBottom: Spacing.md },
  gcsTotalLabel: { ...Typography.body, marginRight: Spacing.sm },
  gcsTotalValue: { ...Typography.h3 },
  saveBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", height: Spacing.buttonHeight, borderRadius: BorderRadius.md, gap: Spacing.sm, marginTop: Spacing.lg },
  saveBtnText: { color: "#FFFFFF", ...Typography.h4 },
});
