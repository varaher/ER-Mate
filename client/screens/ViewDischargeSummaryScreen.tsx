import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useNavigation, useRoute, RouteProp, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiGet } from "@/lib/api";
import { getCachedCaseData, mergeCaseWithCache } from "@/lib/caseCache";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, "ViewDischargeSummary">;

export default function ViewDischargeSummaryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { caseId } = route.params;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [hasSummary, setHasSummary] = useState(false);
  const [summary, setSummary] = useState<any>(null);
  const [patientInfo, setPatientInfo] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, [caseId]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [caseId])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      setError(false);
      const res = await apiGet<any>(`/cases/${caseId}`);
      if (res.success && res.data) {
        const cached = await getCachedCaseData(caseId);
        const mergedData = cached ? mergeCaseWithCache(res.data, cached) : res.data;

        setPatientInfo(mergedData.patient || {});

        const savedSummary = mergedData.discharge_summary;
        if (savedSummary && typeof savedSummary === "object" && Object.keys(savedSummary).length > 0 && savedSummary.presenting_complaint !== undefined) {
          setSummary(savedSummary);
          setHasSummary(true);
        } else {
          setSummary(null);
          setHasSummary(false);
        }
      } else {
        setError(true);
      }
    } catch (err) {
      console.error("Error loading discharge summary:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={[styles.section, { backgroundColor: theme.card }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {children}
    </View>
  );

  const InfoRow = ({ label, value }: { label: string; value?: string | number | null | boolean }) => {
    const displayValue = typeof value === "boolean" ? (value ? "Yes" : "No") : (value || "N/A");
    return (
      <View style={styles.infoRow}>
        <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}:</Text>
        <Text style={[styles.infoValue, { color: theme.text }]}>{displayValue}</Text>
      </View>
    );
  };

  const VitalBox = ({ label, value, unit }: { label: string; value?: string | number | null; unit: string }) => (
    <View style={[styles.vitalBox, { backgroundColor: theme.backgroundSecondary }]}>
      <Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.vitalValue, { color: theme.text }]}>{value || "-"}</Text>
      <Text style={[styles.vitalUnit, { color: theme.textMuted }]}>{unit}</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading discharge summary...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="alert-circle" size={48} color={theme.textMuted} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>Unable to load data</Text>
        <Pressable style={[styles.primaryBtn, { backgroundColor: theme.primary }]} onPress={loadData}>
          <Text style={styles.primaryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (!hasSummary || !summary) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="clipboard" size={56} color={theme.textMuted} />
        <Text style={[styles.emptyTitle, { color: theme.text }]}>No Discharge Summary Yet</Text>
        <Text style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          A discharge summary hasn't been created for this case yet. Tap below to create one.
        </Text>
        <Pressable
          style={[styles.primaryBtn, { backgroundColor: theme.success }]}
          onPress={() => navigation.navigate("DischargeSummary", { caseId })}
        >
          <Feather name="plus" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>Create Discharge Summary</Text>
        </Pressable>
      </View>
    );
  }

  const vitalsArrival = summary.vitals_arrival || {};
  const vitalsDischarge = summary.vitals_discharge || {};
  const primaryAssessment = summary.primary_assessment || {};
  const secondaryAssessment = summary.secondary_assessment || {};
  const systemicExam = summary.systemic_exam || {};

  const abnormalFindings = Object.entries(secondaryAssessment)
    .filter(([_, val]) => val === true)
    .map(([key]) => key.charAt(0).toUpperCase() + key.slice(1));

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing["4xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        <Section title="Patient Information">
          <InfoRow label="Name" value={patientInfo.name} />
          <InfoRow label="Age/Sex" value={`${patientInfo.age || "N/A"} / ${patientInfo.sex || "N/A"}`} />
          <InfoRow label="UHID" value={patientInfo.uhid} />
          <InfoRow label="MLC" value={summary.mlc} />
          <InfoRow label="Discharge Date" value={summary.discharge_date} />
        </Section>

        <Section title="Presenting Complaint">
          <Text style={[styles.text, { color: theme.text }]}>{summary.presenting_complaint || "N/A"}</Text>
        </Section>

        <Section title="History">
          <InfoRow label="Allergies" value={summary.allergy} />
          <InfoRow label="HPI" value={summary.history_of_present_illness} />
          <InfoRow label="Past Medical History" value={summary.past_medical_history} />
          {summary.family_history ? <InfoRow label="Family History" value={summary.family_history} /> : null}
          {summary.lmp ? <InfoRow label="LMP / Last Meal" value={summary.lmp} /> : null}
        </Section>

        <Section title="Vitals at Arrival">
          <View style={styles.vitalsGrid}>
            <VitalBox label="HR" value={vitalsArrival.hr} unit="bpm" />
            <VitalBox label="BP" value={vitalsArrival.bp} unit="mmHg" />
            <VitalBox label="RR" value={vitalsArrival.rr} unit="/min" />
            <VitalBox label="SpO2" value={vitalsArrival.spo2} unit="%" />
            <VitalBox label="Temp" value={vitalsArrival.temp} unit="F" />
            <VitalBox label="GCS" value={vitalsArrival.gcs} unit="/15" />
            <VitalBox label="GRBS" value={vitalsArrival.grbs} unit="mg/dL" />
            <VitalBox label="Pain" value={vitalsArrival.pain_score} unit="/10" />
          </View>
        </Section>

        <Section title="Primary Assessment (ABCDE)">
          <InfoRow label="Airway" value={primaryAssessment.airway} />
          <InfoRow label="Breathing" value={primaryAssessment.breathing} />
          <InfoRow label="Circulation" value={primaryAssessment.circulation} />
          <InfoRow label="Disability" value={primaryAssessment.disability} />
          <InfoRow label="Exposure" value={primaryAssessment.exposure} />
          {primaryAssessment.efast ? <InfoRow label="EFAST" value={primaryAssessment.efast} /> : null}
        </Section>

        <Section title="Secondary Assessment">
          {abnormalFindings.length > 0 ? (
            <Text style={[styles.text, { color: "#dc2626" }]}>Abnormal: {abnormalFindings.join(", ")}</Text>
          ) : (
            <Text style={[styles.text, { color: theme.success }]}>No abnormalities detected</Text>
          )}
        </Section>

        {(systemicExam.chest || systemicExam.cvs || systemicExam.pa || systemicExam.cns || systemicExam.extremities) ? (
          <Section title="Systemic Examination">
            {systemicExam.chest ? <InfoRow label="Chest" value={systemicExam.chest} /> : null}
            {systemicExam.cvs ? <InfoRow label="CVS" value={systemicExam.cvs} /> : null}
            {systemicExam.pa ? <InfoRow label="Per Abdomen" value={systemicExam.pa} /> : null}
            {systemicExam.cns ? <InfoRow label="CNS" value={systemicExam.cns} /> : null}
            {systemicExam.extremities ? <InfoRow label="Extremities" value={systemicExam.extremities} /> : null}
          </Section>
        ) : null}

        <Section title="Diagnosis">
          <Text style={[styles.diagnosisText, { color: theme.text }]}>{summary.diagnosis || "N/A"}</Text>
        </Section>

        {summary.investigations ? (
          <Section title="Investigations">
            <Text style={[styles.text, { color: theme.text }]}>{summary.investigations}</Text>
          </Section>
        ) : null}

        <Section title="Course in Hospital">
          <Text style={[styles.text, { color: theme.text }]}>{summary.course_in_hospital || "N/A"}</Text>
        </Section>

        {summary.discharge_medications ? (
          <Section title="Discharge Medications">
            <Text style={[styles.text, { color: theme.text }]}>{summary.discharge_medications}</Text>
          </Section>
        ) : null}

        <Section title="Disposition">
          <InfoRow label="Type" value={summary.disposition_type} />
          <InfoRow label="Condition at Discharge" value={summary.condition_at_discharge} />
        </Section>

        {(vitalsDischarge.hr || vitalsDischarge.bp || vitalsDischarge.rr || vitalsDischarge.spo2) ? (
          <Section title="Vitals at Discharge">
            <View style={styles.vitalsGrid}>
              <VitalBox label="HR" value={vitalsDischarge.hr} unit="bpm" />
              <VitalBox label="BP" value={vitalsDischarge.bp} unit="mmHg" />
              <VitalBox label="RR" value={vitalsDischarge.rr} unit="/min" />
              <VitalBox label="SpO2" value={vitalsDischarge.spo2} unit="%" />
              <VitalBox label="Temp" value={vitalsDischarge.temp} unit="F" />
              <VitalBox label="GCS" value={vitalsDischarge.gcs} unit="/15" />
            </View>
          </Section>
        ) : null}

        {summary.follow_up_advice ? (
          <Section title="Follow-up Advice">
            <Text style={[styles.text, { color: theme.text }]}>{summary.follow_up_advice}</Text>
          </Section>
        ) : null}

        <Section title="Signed By">
          <InfoRow label="ED Resident" value={summary.ed_resident} />
          {summary.sign_time_resident ? <InfoRow label="Time" value={summary.sign_time_resident} /> : null}
          <InfoRow label="ED Consultant" value={summary.ed_consultant} />
          {summary.sign_time_consultant ? <InfoRow label="Time" value={summary.sign_time_consultant} /> : null}
        </Section>

        <View style={styles.actionRow}>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate("DischargeSummary", { caseId })}
          >
            <Feather name="edit" size={18} color="#FFFFFF" />
            <Text style={styles.primaryBtnText}>Edit Discharge Summary</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: Spacing.lg, gap: Spacing.md },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.md },
  loadingText: { ...Typography.body },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.lg, padding: Spacing.xl },
  emptyTitle: { ...Typography.h3, textAlign: "center" },
  emptySubtitle: { ...Typography.body, textAlign: "center", lineHeight: 22, maxWidth: 300 },
  primaryBtn: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  primaryBtnText: { color: "#FFFFFF", ...Typography.bodyMedium },
  section: { borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.sm },
  sectionTitle: { ...Typography.h3, marginBottom: Spacing.xs },
  text: { ...Typography.body, lineHeight: 22 },
  diagnosisText: { ...Typography.bodyMedium, fontSize: 16, lineHeight: 24 },
  infoRow: { flexDirection: "row", paddingVertical: 4, gap: Spacing.sm },
  infoLabel: { ...Typography.bodyMedium, width: 140 },
  infoValue: { ...Typography.body, flex: 1 },
  vitalsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  vitalBox: { width: "22%", minWidth: 70, borderRadius: BorderRadius.md, padding: Spacing.sm, alignItems: "center" },
  vitalLabel: { ...Typography.caption, fontSize: 11 },
  vitalValue: { ...Typography.bodyMedium, fontSize: 16, marginVertical: 2 },
  vitalUnit: { ...Typography.caption, fontSize: 10 },
  actionRow: { marginTop: Spacing.lg, alignItems: "center" },
});
