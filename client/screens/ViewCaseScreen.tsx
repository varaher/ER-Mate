import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Pressable,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiGet } from "@/lib/api";
import { isPediatric } from "@/lib/pediatricVitals";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, "ViewCase">;

const getPriorityColor = (level: number) => {
  switch (level) {
    case 1: return TriageColors.red;
    case 2: return TriageColors.orange;
    case 3: return TriageColors.yellow;
    case 4: return TriageColors.green;
    case 5: return TriageColors.blue;
    default: return TriageColors.gray;
  }
};

const getPriorityLabel = (level: number) => {
  switch (level) {
    case 1: return "RED - Resuscitation";
    case 2: return "ORANGE - Emergent";
    case 3: return "YELLOW - Urgent";
    case 4: return "GREEN - Less Urgent";
    case 5: return "BLUE - Non-Urgent";
    default: return "Not Assigned";
  }
};

export default function ViewCaseScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { caseId } = route.params;

  const [loading, setLoading] = useState(true);
  const [caseData, setCaseData] = useState<any>(null);

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const loadCase = async () => {
    try {
      const res = await apiGet<any>(`/cases/${caseId}`);
      if (res.success && res.data) {
        setCaseData(res.data);
      }
    } catch (err) {
      console.error("Error loading case:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  if (!caseData) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <Text style={[styles.errorText, { color: theme.textSecondary }]}>Case not found</Text>
      </View>
    );
  }

  const patient = caseData.patient || {};
  const vitals = caseData.vitals_at_arrival || {};
  const complaint = caseData.presenting_complaint || {};

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
    <View style={[styles.section, { backgroundColor: theme.card }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {children}
    </View>
  );

  const InfoRow = ({ label, value }: { label: string; value: string | number | undefined }) => (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: theme.text }]}>{value || "N/A"}</Text>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing["4xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { backgroundColor: theme.card }]}>
          <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(caseData.triage_priority) }]}>
            <Text style={styles.priorityText}>{getPriorityLabel(caseData.triage_priority)}</Text>
          </View>
          <Text style={[styles.patientName, { color: theme.text }]}>{patient.name || "Unknown"}</Text>
          <Text style={[styles.patientDetails, { color: theme.textSecondary }]}>
            {patient.age} yrs | {patient.sex} | {patient.mode_of_arrival || "Walk-in"}
          </Text>
          <Text style={[styles.caseTime, { color: theme.textMuted }]}>
            Created: {new Date(caseData.created_at).toLocaleString()}
          </Text>
        </View>

        {complaint.text && (
          <Section title="Chief Complaint">
            <Text style={[styles.complaintText, { color: theme.text }]}>{complaint.text}</Text>
          </Section>
        )}

        <Section title="Vitals at Arrival">
          <View style={styles.vitalsGrid}>
            <View style={[styles.vitalItem, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.vitalValue, { color: theme.text }]}>{vitals.hr || "-"}</Text>
              <Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>HR</Text>
            </View>
            <View style={[styles.vitalItem, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.vitalValue, { color: theme.text }]}>
                {vitals.bp_systolic || "-"}/{vitals.bp_diastolic || "-"}
              </Text>
              <Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>BP</Text>
            </View>
            <View style={[styles.vitalItem, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.vitalValue, { color: theme.text }]}>{vitals.rr || "-"}</Text>
              <Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>RR</Text>
            </View>
            <View style={[styles.vitalItem, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.vitalValue, { color: theme.text }]}>{vitals.spo2 || "-"}%</Text>
              <Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>SpO2</Text>
            </View>
            <View style={[styles.vitalItem, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.vitalValue, { color: theme.text }]}>{vitals.temperature || "-"}</Text>
              <Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>Temp</Text>
            </View>
            <View style={[styles.vitalItem, { backgroundColor: theme.backgroundSecondary }]}>
              <Text style={[styles.vitalValue, { color: theme.text }]}>{vitals.grbs || "-"}</Text>
              <Text style={[styles.vitalLabel, { color: theme.textSecondary }]}>GRBS</Text>
            </View>
          </View>
        </Section>

        {caseData.abcde && (
          <Section title="Primary Survey">
            {caseData.abcde.airway && (
              <InfoRow label="Airway" value={caseData.abcde.airway.status} />
            )}
            {caseData.abcde.breathing && (
              <InfoRow label="Breathing" value={caseData.abcde.breathing.status} />
            )}
            {caseData.abcde.circulation && (
              <InfoRow label="Circulation" value={caseData.abcde.circulation.status} />
            )}
            {caseData.abcde.disability && (
              <InfoRow label="Disability" value={caseData.abcde.disability.status} />
            )}
          </Section>
        )}

        {caseData.treatment?.ai_diagnosis && (
          <Section title="Diagnosis">
            <Text style={[styles.diagnosisText, { color: theme.text }]}>
              {caseData.treatment.ai_diagnosis}
            </Text>
          </Section>
        )}

        {caseData.disposition && (
          <Section title="Disposition">
            <InfoRow label="Type" value={caseData.disposition.type} />
            {caseData.disposition.destination && (
              <InfoRow label="Destination" value={caseData.disposition.destination} />
            )}
          </Section>
        )}

        <View style={styles.buttonRow}>
          <Pressable
            style={({ pressed }) => [
              styles.editBtn,
              { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => {
              const patientAge = parseFloat(caseData?.patient?.age) || 0;
              const screenName = isPediatric(patientAge) ? "PediatricCaseSheet" : "CaseSheet";
              navigation.navigate(screenName, { caseId });
            }}
          >
            <Feather name="edit-2" size={18} color="#FFFFFF" />
            <Text style={styles.editBtnText}>Edit Case</Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.dischargeBtn,
              { backgroundColor: theme.success, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => navigation.navigate("DischargeSummary", { caseId })}
          >
            <Feather name="file-text" size={18} color="#FFFFFF" />
            <Text style={styles.editBtnText}>Discharge</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { ...Typography.body },
  content: { padding: Spacing.lg },
  header: { padding: Spacing.lg, borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  priorityBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  priorityText: { color: "#FFFFFF", ...Typography.caption, fontWeight: "700" },
  patientName: { ...Typography.h2, marginBottom: Spacing.xs },
  patientDetails: { ...Typography.body },
  caseTime: { ...Typography.caption, marginTop: Spacing.sm },
  section: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.h4, marginBottom: Spacing.md },
  complaintText: { ...Typography.body, fontStyle: "italic" },
  vitalsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  vitalItem: {
    width: "30%",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
  },
  vitalValue: { ...Typography.h4 },
  vitalLabel: { ...Typography.caption, marginTop: 2 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  infoLabel: { ...Typography.body },
  infoValue: { ...Typography.bodyMedium },
  diagnosisText: { ...Typography.body },
  buttonRow: { flexDirection: "row", gap: Spacing.md },
  editBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  dischargeBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  editBtnText: { color: "#FFFFFF", ...Typography.bodyMedium },
});
