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
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, "PhysicalExam">;

const NORMAL_FINDINGS = {
  general: "Patient conscious, alert, oriented. Comfortable at rest, no distress. No pallor, icterus, cyanosis, clubbing, or edema.",
  heent: "Head normocephalic, atraumatic. Pupils equal, round, reactive to light. TMs normal. Throat clear, no erythema.",
  neck: "Supple, no lymphadenopathy, no JVD. Trachea midline.",
  chest: "Chest symmetric, normal expansion. No tenderness or deformity.",
  heart: "Regular rate and rhythm. S1 S2 normal. No murmurs, rubs, or gallops.",
  lungs: "Clear to auscultation bilaterally. No wheezes, rhonchi, or crackles.",
  abdomen: "Soft, non-tender, non-distended. Bowel sounds present. No organomegaly.",
  extremities: "No edema, cyanosis, or clubbing. Pulses intact. Normal range of motion.",
  neuro: "GCS 15/15. Cranial nerves II-XII intact. Motor 5/5 all extremities. Sensory intact.",
  skin: "Warm, dry, intact. No rashes, lesions, or wounds.",
};

export default function PhysicalExamScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { caseId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const formRef = useRef({
    general: "",
    heent: "",
    neck: "",
    chest: "",
    heart: "",
    lungs: "",
    abdomen: "",
    extremities: "",
    neuro: "",
    skin: "",
    additional_notes: "",
  });

  const [, forceUpdate] = useState(0);

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const loadCase = async () => {
    try {
      const res = await apiGet<any>(`/cases/${caseId}`);
      if (res.success && res.data?.physical_exam) {
        Object.assign(formRef.current, res.data.physical_exam);
        forceUpdate((n) => n + 1);
      }
    } catch (err) {
      console.error("Error loading case:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiPatch(`/cases/${caseId}`, {
        physical_exam: formRef.current,
      });

      if (res.success) {
        await invalidateCases();
        Alert.alert("Saved", "Physical exam saved", [
          { text: "Continue to Investigations", onPress: () => navigation.navigate("Investigations", { caseId }) },
          { text: "Stay Here", style: "cancel" },
        ]);
      } else {
        const errMsg = typeof res.error === 'string' ? res.error : JSON.stringify(res.error || "Failed to save");
        Alert.alert("Error", errMsg);
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err || "Failed to save");
      Alert.alert("Error", errMsg);
    } finally {
      setSaving(false);
    }
  };

  const fillNormal = () => {
    Object.assign(formRef.current, NORMAL_FINDINGS);
    forceUpdate((n) => n + 1);
  };

  const updateField = (field: string, value: string) => {
    (formRef.current as any)[field] = value;
    forceUpdate((n) => n + 1);
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const ExamField = ({ label, field }: { label: string; field: string }) => (
    <View style={styles.fieldContainer}>
      <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
        placeholder={`${label} findings...`}
        placeholderTextColor={theme.textMuted}
        value={(formRef.current as any)[field]}
        onChangeText={(v) => updateField(field, v)}
        multiline
        textAlignVertical="top"
      />
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing["4xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.heading, { color: theme.text }]}>Physical Examination</Text>
          <Pressable style={[styles.fillBtn, { backgroundColor: theme.primaryLight }]} onPress={fillNormal}>
            <Feather name="check-circle" size={16} color={theme.primary} />
            <Text style={[styles.fillBtnText, { color: theme.primary }]}>Normal</Text>
          </Pressable>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <ExamField label="General Appearance" field="general" />
          <ExamField label="HEENT" field="heent" />
          <ExamField label="Neck" field="neck" />
          <ExamField label="Chest" field="chest" />
          <ExamField label="Heart / CVS" field="heart" />
          <ExamField label="Lungs / Respiratory" field="lungs" />
          <ExamField label="Abdomen" field="abdomen" />
          <ExamField label="Extremities" field="extremities" />
          <ExamField label="Neurological" field="neuro" />
          <ExamField label="Skin" field="skin" />
          <ExamField label="Additional Notes" field="additional_notes" />
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
              <Feather name="arrow-right" size={20} color="#FFFFFF" />
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
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  heading: { ...Typography.h3 },
  fillBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  fillBtnText: { ...Typography.label },
  section: { borderRadius: BorderRadius.lg, padding: Spacing.lg },
  fieldContainer: { marginBottom: Spacing.lg },
  fieldLabel: { ...Typography.label, marginBottom: Spacing.xs },
  fieldInput: {
    minHeight: 70,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    ...Typography.small,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  saveBtnText: { color: "#FFFFFF", ...Typography.h4 },
});
