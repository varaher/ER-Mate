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
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { apiGet, apiPatch, invalidateCases } from "@/lib/api";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, "Disposition">;

const DISPOSITION_OPTIONS = [
  { id: "discharge", label: "Discharge Home", icon: "home", color: TriageColors.green },
  { id: "admit", label: "Admit to Ward", icon: "log-in", color: TriageColors.yellow },
  { id: "icu", label: "Admit to ICU", icon: "alert-circle", color: TriageColors.orange },
  { id: "transfer", label: "Transfer Out", icon: "send", color: TriageColors.blue },
  { id: "surgery", label: "To Surgery/OT", icon: "activity", color: TriageColors.red },
  { id: "absconded", label: "LAMA/Absconded", icon: "user-x", color: TriageColors.gray },
  { id: "expired", label: "Expired", icon: "x-circle", color: "#1e293b" },
];

export default function DispositionScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { caseId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [disposition, setDisposition] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [diagnosis, setDiagnosis] = useState("");

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const loadCase = async () => {
    try {
      const res = await apiGet<any>(`/cases/${caseId}`);
      if (res.success && res.data?.disposition) {
        const d = res.data.disposition;
        if (d.type) setDisposition(d.type);
        if (d.destination) setDestination(d.destination);
        if (d.notes) setNotes(d.notes);
        if (d.follow_up) setFollowUp(d.follow_up);
      }
      if (res.success && res.data?.treatment?.ai_diagnosis) {
        setDiagnosis(res.data.treatment.ai_diagnosis);
      }
    } catch (err) {
      console.error("Error loading case:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!disposition) {
      Alert.alert("Required", "Please select a disposition type");
      return;
    }

    setSaving(true);
    try {
      const res = await apiPatch(`/cases/${caseId}`, {
        disposition: {
          type: disposition,
          destination,
          notes,
          follow_up: followUp,
          timestamp: new Date().toISOString(),
        },
        status: disposition === "discharge" ? "discharged" : "active",
        final_diagnosis: diagnosis,
      });

      if (res.success) {
        await invalidateCases();
        if (disposition === "discharge") {
          Alert.alert("Saved", "Patient ready for discharge", [
            { text: "Generate Discharge Summary", onPress: () => navigation.navigate("DischargeSummary", { caseId }) },
            { text: "Go to Dashboard", onPress: () => navigation.popToTop(), style: "cancel" },
          ]);
        } else {
          Alert.alert("Saved", "Disposition saved successfully", [
            { text: "OK", onPress: () => navigation.popToTop() },
          ]);
        }
      } else {
        Alert.alert("Error", res.error || "Failed to save");
      }
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setSaving(false);
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
        <Text style={[styles.heading, { color: theme.text }]}>Patient Disposition</Text>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Select Outcome</Text>
          <View style={styles.optionsGrid}>
            {DISPOSITION_OPTIONS.map((opt) => (
              <Pressable
                key={opt.id}
                style={[
                  styles.optionBtn,
                  {
                    backgroundColor: disposition === opt.id ? opt.color + "20" : theme.backgroundSecondary,
                    borderColor: disposition === opt.id ? opt.color : "transparent",
                    borderWidth: 2,
                  },
                ]}
                onPress={() => setDisposition(opt.id)}
              >
                <Feather
                  name={opt.icon as any}
                  size={24}
                  color={disposition === opt.id ? opt.color : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.optionLabel,
                    { color: disposition === opt.id ? opt.color : theme.text },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {disposition === "admit" || disposition === "icu" || disposition === "transfer" ? (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Destination</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder={
                disposition === "transfer"
                  ? "Hospital name..."
                  : disposition === "icu"
                  ? "ICU type (MICU, SICU, etc.)..."
                  : "Ward name..."
              }
              placeholderTextColor={theme.textMuted}
              value={destination}
              onChangeText={setDestination}
            />
          </View>
        ) : null}

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Final Diagnosis</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder="Enter final diagnosis..."
            placeholderTextColor={theme.textMuted}
            value={diagnosis}
            onChangeText={setDiagnosis}
            multiline
            textAlignVertical="top"
          />
        </View>

        {disposition === "discharge" && (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Follow-up Instructions</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder="Follow-up date, OPD, etc..."
              placeholderTextColor={theme.textMuted}
              value={followUp}
              onChangeText={setFollowUp}
              multiline
              textAlignVertical="top"
            />
          </View>
        )}

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Additional Notes</Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder="Any additional notes..."
            placeholderTextColor={theme.textMuted}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlignVertical="top"
          />
        </View>

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
              <Feather name="check" size={20} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Complete Disposition</Text>
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
  heading: { ...Typography.h3, marginBottom: Spacing.lg },
  section: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.h4, marginBottom: Spacing.md },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionBtn: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  optionLabel: { ...Typography.small, flex: 1 },
  input: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    ...Typography.body,
  },
  textArea: {
    minHeight: 80,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
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
