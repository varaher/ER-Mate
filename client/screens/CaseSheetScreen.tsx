import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  Switch,
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
type RouteProps = RouteProp<RootStackParamList, "CaseSheet">;

const NORMAL_EXAM = {
  general: "Conscious, oriented, comfortable, no distress",
  cvs: "S1 S2 heard, no murmurs, pulse regular",
  rs: "Bilateral equal air entry, vesicular breath sounds, no added sounds",
  abdomen: "Soft, non-tender, bowel sounds present",
  cns: "GCS 15/15, pupils equal and reactive, no focal deficits",
};

export default function CaseSheetScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { caseId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [caseData, setCaseData] = useState<any>(null);
  const [collapsed, setCollapsed] = useState({
    airway: false,
    breathing: true,
    circulation: true,
    disability: true,
    exposure: true,
  });

  const formRef = useRef({
    airway_status: "Patent",
    airway_notes: "",
    breathing_status: "Normal",
    breathing_notes: "",
    circulation_status: "Normal",
    circulation_notes: "",
    disability_status: "Alert",
    disability_notes: "",
    exposure_notes: "",
    exam_general: "",
    exam_cvs: "",
    exam_rs: "",
    exam_abdomen: "",
    exam_cns: "",
    history_hpi: "",
    history_allergies: "",
    history_medications: "",
    history_past_medical: "",
  });

  const [, forceUpdate] = useState(0);

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const loadCase = async () => {
    try {
      const res = await apiGet<any>(`/cases/${caseId}`);
      if (res.success && res.data) {
        setCaseData(res.data);
        if (res.data.abcde) {
          Object.assign(formRef.current, {
            airway_status: res.data.abcde.airway?.status || "Patent",
            airway_notes: res.data.abcde.airway?.notes || "",
            breathing_status: res.data.abcde.breathing?.status || "Normal",
            breathing_notes: res.data.abcde.breathing?.notes || "",
            circulation_status: res.data.abcde.circulation?.status || "Normal",
            circulation_notes: res.data.abcde.circulation?.notes || "",
            disability_status: res.data.abcde.disability?.status || "Alert",
            disability_notes: res.data.abcde.disability?.notes || "",
            exposure_notes: res.data.abcde.exposure?.notes || "",
          });
        }
        if (res.data.examination) {
          Object.assign(formRef.current, {
            exam_general: res.data.examination.general || "",
            exam_cvs: res.data.examination.cvs || "",
            exam_rs: res.data.examination.rs || "",
            exam_abdomen: res.data.examination.abdomen || "",
            exam_cns: res.data.examination.cns || "",
          });
        }
        if (res.data.history) {
          Object.assign(formRef.current, {
            history_hpi: res.data.history.hpi || "",
            history_allergies: res.data.history.allergies || "",
            history_medications: res.data.history.medications || "",
            history_past_medical: res.data.history.past_medical || "",
          });
        }
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
      const payload = {
        abcde: {
          airway: { status: formRef.current.airway_status, notes: formRef.current.airway_notes },
          breathing: { status: formRef.current.breathing_status, notes: formRef.current.breathing_notes },
          circulation: { status: formRef.current.circulation_status, notes: formRef.current.circulation_notes },
          disability: { status: formRef.current.disability_status, notes: formRef.current.disability_notes },
          exposure: { notes: formRef.current.exposure_notes },
        },
        examination: {
          general: formRef.current.exam_general,
          cvs: formRef.current.exam_cvs,
          rs: formRef.current.exam_rs,
          abdomen: formRef.current.exam_abdomen,
          cns: formRef.current.exam_cns,
        },
        history: {
          hpi: formRef.current.history_hpi,
          allergies: formRef.current.history_allergies,
          medications: formRef.current.history_medications,
          past_medical: formRef.current.history_past_medical,
        },
      };

      const res = await apiPatch(`/cases/${caseId}`, payload);

      if (res.success) {
        invalidateCases();
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

  const fillNormalExam = () => {
    formRef.current.exam_general = NORMAL_EXAM.general;
    formRef.current.exam_cvs = NORMAL_EXAM.cvs;
    formRef.current.exam_rs = NORMAL_EXAM.rs;
    formRef.current.exam_abdomen = NORMAL_EXAM.abdomen;
    formRef.current.exam_cns = NORMAL_EXAM.cns;
    forceUpdate((n) => n + 1);
  };

  const toggleSection = (section: keyof typeof collapsed) => {
    setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
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

  const Section = ({
    title,
    sectionKey,
    children,
    color,
  }: {
    title: string;
    sectionKey: keyof typeof collapsed;
    children: React.ReactNode;
    color: string;
  }) => (
    <View style={[styles.section, { backgroundColor: theme.card }]}>
      <Pressable style={styles.sectionHeader} onPress={() => toggleSection(sectionKey)}>
        <View style={[styles.sectionIndicator, { backgroundColor: color }]} />
        <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
        <Feather
          name={collapsed[sectionKey] ? "chevron-down" : "chevron-up"}
          size={20}
          color={theme.textSecondary}
        />
      </Pressable>
      {!collapsed[sectionKey] && <View style={styles.sectionContent}>{children}</View>}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing["4xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        {caseData?.patient && (
          <View style={[styles.patientCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.patientName, { color: theme.text }]}>{caseData.patient.name}</Text>
            <Text style={[styles.patientDetails, { color: theme.textSecondary }]}>
              {caseData.patient.age} yrs | {caseData.patient.sex}
            </Text>
            {caseData.presenting_complaint?.text && (
              <Text style={[styles.complaint, { color: theme.textMuted }]}>
                {caseData.presenting_complaint.text}
              </Text>
            )}
          </View>
        )}

        <Text style={[styles.heading, { color: theme.text }]}>Primary Survey (ABCDE)</Text>

        <Section title="A - Airway" sectionKey="airway" color={TriageColors.red}>
          <View style={styles.statusRow}>
            {["Patent", "Compromised", "Obstructed"].map((status) => (
              <Pressable
                key={status}
                style={[
                  styles.statusBtn,
                  {
                    backgroundColor:
                      formRef.current.airway_status === status ? theme.primary : theme.backgroundSecondary,
                  },
                ]}
                onPress={() => updateField("airway_status", status)}
              >
                <Text
                  style={{
                    color: formRef.current.airway_status === status ? "#FFFFFF" : theme.textSecondary,
                    fontWeight: "600",
                    fontSize: 12,
                  }}
                >
                  {status}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder="Airway notes..."
            placeholderTextColor={theme.textMuted}
            value={formRef.current.airway_notes}
            onChangeText={(v) => updateField("airway_notes", v)}
            multiline
          />
        </Section>

        <Section title="B - Breathing" sectionKey="breathing" color={TriageColors.orange}>
          <View style={styles.statusRow}>
            {["Normal", "Distressed", "Failure"].map((status) => (
              <Pressable
                key={status}
                style={[
                  styles.statusBtn,
                  {
                    backgroundColor:
                      formRef.current.breathing_status === status ? theme.primary : theme.backgroundSecondary,
                  },
                ]}
                onPress={() => updateField("breathing_status", status)}
              >
                <Text
                  style={{
                    color: formRef.current.breathing_status === status ? "#FFFFFF" : theme.textSecondary,
                    fontWeight: "600",
                    fontSize: 12,
                  }}
                >
                  {status}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder="Breathing notes..."
            placeholderTextColor={theme.textMuted}
            value={formRef.current.breathing_notes}
            onChangeText={(v) => updateField("breathing_notes", v)}
            multiline
          />
        </Section>

        <Section title="C - Circulation" sectionKey="circulation" color={TriageColors.yellow}>
          <View style={styles.statusRow}>
            {["Normal", "Compromised", "Shock"].map((status) => (
              <Pressable
                key={status}
                style={[
                  styles.statusBtn,
                  {
                    backgroundColor:
                      formRef.current.circulation_status === status ? theme.primary : theme.backgroundSecondary,
                  },
                ]}
                onPress={() => updateField("circulation_status", status)}
              >
                <Text
                  style={{
                    color: formRef.current.circulation_status === status ? "#FFFFFF" : theme.textSecondary,
                    fontWeight: "600",
                    fontSize: 12,
                  }}
                >
                  {status}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder="Circulation notes..."
            placeholderTextColor={theme.textMuted}
            value={formRef.current.circulation_notes}
            onChangeText={(v) => updateField("circulation_notes", v)}
            multiline
          />
        </Section>

        <Section title="D - Disability" sectionKey="disability" color={TriageColors.green}>
          <View style={styles.statusRow}>
            {["Alert", "Verbal", "Pain", "Unresponsive"].map((status) => (
              <Pressable
                key={status}
                style={[
                  styles.statusBtn,
                  {
                    backgroundColor:
                      formRef.current.disability_status === status ? theme.primary : theme.backgroundSecondary,
                  },
                ]}
                onPress={() => updateField("disability_status", status)}
              >
                <Text
                  style={{
                    color: formRef.current.disability_status === status ? "#FFFFFF" : theme.textSecondary,
                    fontWeight: "600",
                    fontSize: 12,
                  }}
                >
                  {status.charAt(0)}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder="Disability notes..."
            placeholderTextColor={theme.textMuted}
            value={formRef.current.disability_notes}
            onChangeText={(v) => updateField("disability_notes", v)}
            multiline
          />
        </Section>

        <Section title="E - Exposure" sectionKey="exposure" color={TriageColors.blue}>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder="Exposure findings..."
            placeholderTextColor={theme.textMuted}
            value={formRef.current.exposure_notes}
            onChangeText={(v) => updateField("exposure_notes", v)}
            multiline
          />
        </Section>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeaderRow}>
            <Text style={[styles.heading, { color: theme.text }]}>Examination</Text>
            <Pressable style={[styles.fillBtn, { backgroundColor: theme.primaryLight }]} onPress={fillNormalExam}>
              <Text style={[styles.fillBtnText, { color: theme.primary }]}>Fill Normal</Text>
            </Pressable>
          </View>
          {[
            { label: "General", field: "exam_general" },
            { label: "CVS", field: "exam_cvs" },
            { label: "Respiratory", field: "exam_rs" },
            { label: "Abdomen", field: "exam_abdomen" },
            { label: "CNS", field: "exam_cns" },
          ].map((item) => (
            <View key={item.field} style={styles.examField}>
              <Text style={[styles.examLabel, { color: theme.textSecondary }]}>{item.label}</Text>
              <TextInput
                style={[styles.examInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                placeholder={`${item.label} findings...`}
                placeholderTextColor={theme.textMuted}
                value={(formRef.current as any)[item.field]}
                onChangeText={(v) => updateField(item.field, v)}
                multiline
              />
            </View>
          ))}
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
  patientName: { ...Typography.h3 },
  patientDetails: { ...Typography.body, marginTop: 2 },
  complaint: { ...Typography.small, marginTop: Spacing.sm, fontStyle: "italic" },
  heading: { ...Typography.h4, marginBottom: Spacing.md },
  section: { borderRadius: BorderRadius.lg, marginBottom: Spacing.md, overflow: "hidden" },
  sectionHeader: { flexDirection: "row", alignItems: "center", padding: Spacing.md },
  sectionIndicator: { width: 4, height: 24, borderRadius: 2, marginRight: Spacing.md },
  sectionTitle: { flex: 1, ...Typography.bodyMedium },
  sectionContent: { padding: Spacing.md, paddingTop: 0 },
  statusRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.md },
  statusBtn: { flex: 1, paddingVertical: Spacing.sm, alignItems: "center", borderRadius: BorderRadius.sm },
  textArea: {
    minHeight: 60,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    textAlignVertical: "top",
    ...Typography.small,
  },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: Spacing.md },
  fillBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm },
  fillBtnText: { ...Typography.label },
  examField: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  examLabel: { ...Typography.label, marginBottom: Spacing.xs },
  examInput: {
    minHeight: 50,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    textAlignVertical: "top",
    ...Typography.small,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  saveBtnText: { color: "#FFFFFF", ...Typography.h4 },
});
