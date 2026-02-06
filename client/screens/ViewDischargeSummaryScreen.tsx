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
        if (savedSummary && Object.keys(savedSummary).length > 0) {
          setSummary(savedSummary);
        } else {
          const autoSummary = buildAutoSummary(mergedData);
          setSummary(autoSummary);
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

  const buildAutoSummary = (data: any) => {
    const vitals = data.vitals_at_arrival || data.vitals || {};
    const patient = data.patient || {};
    const triage = data.triage || {};
    const treatment = data.treatment || {};
    const disposition = data.disposition || {};
    const exam = data.examination || {};
    const sample = data.sample || {};
    const history = data.history || {};
    const primaryAssessment = data.primary_assessment || {};
    const abcde = data.abcde || {};

    const gcsE = vitals.gcs_e || primaryAssessment.disability_gcs_e || 4;
    const gcsV = vitals.gcs_v || primaryAssessment.disability_gcs_v || 5;
    const gcsM = vitals.gcs_m || primaryAssessment.disability_gcs_m || 6;
    const gcsTotal = vitals.gcs_total || (gcsE + gcsV + gcsM);

    const medsText = treatment.medications?.map((m: any) => `${m.name || ""} ${m.dose || ""} ${m.route || ""} ${m.frequency || ""}`.trim()).join("\n") || "";
    const infText = treatment.infusions?.map((inf: any) => `${inf.drug_name || inf.name || ""} ${inf.dose || ""} ${inf.dilution ? `in ${inf.dilution}` : ""} ${inf.rate ? `@ ${inf.rate}` : ""}`.trim()).join("\n") || "";
    const addendumNotes = data.treatment?.addendum_notes || data.addendum_notes || [];
    const notesList = Array.isArray(addendumNotes) ? addendumNotes : (addendumNotes ? [addendumNotes] : []);

    const courseParts: string[] = [];
    if (medsText) courseParts.push("MEDICATIONS GIVEN IN ER:\n" + medsText);
    if (infText) courseParts.push("INFUSIONS:\n" + infText);
    if (notesList.length > 0) courseParts.push("CLINICAL NOTES:\n" + notesList.join("\n"));

    return {
      mlc: data.mlc ?? false,
      allergy: sample.allergies || history.allergies?.join(", ") || patient.allergies || triage.allergies || "No known allergies",
      vitals_arrival: {
        hr: vitals.hr?.toString() || "",
        bp: `${vitals.bp_systolic || ""}/${vitals.bp_diastolic || ""}`,
        rr: vitals.rr?.toString() || "",
        spo2: vitals.spo2?.toString() || "",
        gcs: gcsTotal.toString(),
        pain_score: vitals.pain_score?.toString() || "",
        grbs: vitals.grbs?.toString() || "",
        temp: vitals.temperature?.toString() || "",
      },
      presenting_complaint: data.presenting_complaint?.text || triage.chief_complaint || "",
      history_of_present_illness: history.hpi || history.events_hopi || sample.eventsHopi || "",
      past_medical_history: history.past_medical?.join(", ") || sample.pastMedicalHistory || "",
      family_history: patient.family_history || "",
      lmp: history.last_meal_lmp || sample.lastMeal || "",
      primary_assessment: {
        airway: abcde.airway?.status || primaryAssessment.airway || "Patent",
        breathing: `RR: ${vitals.rr || "-"}/min, SpO2: ${vitals.spo2 || "-"}%`,
        circulation: `HR: ${vitals.hr || "-"} bpm, BP: ${vitals.bp_systolic || "-"}/${vitals.bp_diastolic || "-"} mmHg`,
        disability: `GCS: ${gcsTotal}/15, GRBS: ${vitals.grbs || "-"} mg/dL`,
        exposure: `Temp: ${vitals.temperature || "-"}`,
        efast: data.adjuncts?.efast_notes || abcde.efast || "",
      },
      secondary_assessment: {
        pallor: exam.general_pallor || exam.general?.pallor || false,
        icterus: exam.general_icterus || exam.general?.icterus || false,
        cyanosis: exam.general_cyanosis || exam.general?.cyanosis || false,
        clubbing: exam.general_clubbing || exam.general?.clubbing || false,
        lymphadenopathy: exam.general_lymphadenopathy || exam.general?.lymphadenopathy || false,
        edema: exam.general_edema || exam.general?.edema || false,
      },
      systemic_exam: {
        chest: exam.respiratory_notes || "",
        cvs: exam.cvs_notes || "",
        pa: exam.abdomen_notes || "",
        cns: exam.cns_notes || "",
        extremities: "",
      },
      course_in_hospital: courseParts.join("\n\n"),
      investigations: treatment.investigations || "",
      diagnosis: treatment.primary_diagnosis || treatment.provisional_diagnosis || "",
      discharge_medications: "",
      disposition_type: disposition.type || disposition.disposition_type || "Normal Discharge",
      condition_at_discharge: disposition.condition || disposition.condition_at_discharge || "STABLE",
      vitals_discharge: { hr: "", bp: "", rr: "", spo2: "", gcs: "", pain_score: "", grbs: "", temp: "" },
      follow_up_advice: disposition.follow_up || disposition.follow_up_instructions || "",
      ed_resident: data.em_resident || "",
      ed_consultant: "",
      discharge_date: new Date().toLocaleDateString(),
    };
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

  if (error || !summary) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: theme.backgroundDefault }]}>
        <Feather name="alert-circle" size={48} color={theme.textMuted} />
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>
          {error ? "Unable to load discharge summary" : "No discharge summary available"}
        </Text>
        <View style={styles.errorActions}>
          <Pressable style={[styles.retryBtn, { backgroundColor: theme.primary }]} onPress={loadData}>
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
          <Pressable
            style={[styles.editBtn, { backgroundColor: theme.success }]}
            onPress={() => navigation.navigate("DischargeSummary", { caseId })}
          >
            <Feather name="edit" size={16} color="#FFFFFF" />
            <Text style={styles.editBtnText}>Create Discharge Summary</Text>
          </Pressable>
        </View>
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
            style={[styles.actionBtn, { backgroundColor: theme.primary }]}
            onPress={() => navigation.navigate("DischargeSummary", { caseId })}
          >
            <Feather name="edit" size={18} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Edit Discharge Summary</Text>
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
  errorContainer: { flex: 1, justifyContent: "center", alignItems: "center", gap: Spacing.lg, padding: Spacing.xl },
  errorText: { ...Typography.body, textAlign: "center" },
  errorActions: { gap: Spacing.md, alignItems: "center" },
  retryBtn: { paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  retryBtnText: { color: "#FFFFFF", ...Typography.bodyMedium },
  editBtn: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  editBtnText: { color: "#FFFFFF", ...Typography.bodyMedium },
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
  actionBtn: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  actionBtnText: { color: "#FFFFFF", ...Typography.bodyMedium },
});
