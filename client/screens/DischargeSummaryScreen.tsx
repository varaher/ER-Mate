import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  Share,
  Platform,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { apiGet, apiPatch, apiPost, invalidateCases } from "@/lib/api";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, "DischargeSummary">;

export default function DischargeSummaryScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { caseId } = route.params;

  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingDocx, setExportingDocx] = useState(false);
  const [caseData, setCaseData] = useState<any>(null);
  const [summary, setSummary] = useState({
    diagnosis: "",
    treatment_given: "",
    condition_at_discharge: "Stable",
    medications: "",
    follow_up: "",
    instructions: "",
    doctor_name: "",
  });

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const loadCase = async () => {
    try {
      const res = await apiGet<any>(`/cases/${caseId}`);
      if (res.success && res.data) {
        setCaseData(res.data);
        if (res.data.discharge_summary) {
          setSummary((prev) => ({ ...prev, ...res.data.discharge_summary }));
        } else {
          setSummary((prev) => ({
            ...prev,
            diagnosis: res.data.final_diagnosis || res.data.treatment?.ai_diagnosis || "",
            follow_up: res.data.disposition?.follow_up || "",
          }));
        }
      }
    } catch (err) {
      console.error("Error loading case:", err);
    } finally {
      setLoading(false);
    }
  };

  const generateAISummary = async () => {
    setGenerating(true);
    try {
      const res = await apiPost<{ summary: any }>("/ai/discharge-summary", { case_id: caseId });
      if (res.success && res.data?.summary) {
        setSummary((prev) => ({ ...prev, ...res.data!.summary }));
        Alert.alert("Generated", "AI has generated the discharge summary. Please review and edit as needed.");
      } else {
        Alert.alert("Error", res.error || "Failed to generate summary");
      }
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiPatch(`/cases/${caseId}`, {
        discharge_summary: summary,
        status: "completed",
      });

      if (res.success) {
        await invalidateCases();
        Alert.alert("Saved", "Discharge summary saved successfully", [
          { text: "Share Summary", onPress: shareSummary },
          { text: "Go to Dashboard", onPress: () => navigation.popToTop() },
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

  const shareSummary = async () => {
    const patient = caseData?.patient || {};
    const summaryText = `
DISCHARGE SUMMARY
=================
Patient: ${patient.name || "N/A"}
Age/Sex: ${patient.age || "N/A"} / ${patient.sex || "N/A"}
Admission Date: ${caseData?.created_at ? new Date(caseData.created_at).toLocaleDateString() : "N/A"}
Discharge Date: ${new Date().toLocaleDateString()}

DIAGNOSIS:
${summary.diagnosis || "N/A"}

TREATMENT GIVEN:
${summary.treatment_given || "N/A"}

CONDITION AT DISCHARGE: ${summary.condition_at_discharge}

MEDICATIONS TO CONTINUE:
${summary.medications || "None"}

FOLLOW-UP:
${summary.follow_up || "As advised"}

INSTRUCTIONS:
${summary.instructions || "None"}

Doctor: ${summary.doctor_name || "N/A"}
    `.trim();

    try {
      await Share.share({ message: summaryText });
    } catch (err) {
      console.error("Share error:", err);
    }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const exportData = {
        patient: caseData?.patient || {},
        triage: caseData?.triage || {},
        vitals: caseData?.vitals || {},
        discharge_summary: summary,
        created_at: caseData?.created_at,
      };

      const baseUrl = getApiUrl();
      const exportUrl = new URL("/api/export/discharge-pdf", baseUrl);
      
      const response = await fetch(exportUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF");
      }

      const blob = await response.blob();
      const fileName = `discharge_summary_${(caseData?.patient?.name || "patient").replace(/\s+/g, "_")}.pdf`;

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
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "application/pdf",
            dialogTitle: "Share Discharge Summary",
          });
        } else {
          Alert.alert("Success", `PDF saved to: ${fileUri}`);
        }
      }
    } catch (err) {
      console.error("PDF export error:", err);
      Alert.alert("Error", "Failed to export PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(",")[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const exportDOCX = async () => {
    setExportingDocx(true);
    try {
      const exportData = {
        patient: caseData?.patient || {},
        triage: caseData?.triage || {},
        vitals: caseData?.vitals || {},
        discharge_summary: summary,
        created_at: caseData?.created_at,
      };

      const baseUrl = getApiUrl();
      const exportUrl = new URL("/api/export/discharge-docx", baseUrl);
      
      const response = await fetch(exportUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(exportData),
      });

      if (!response.ok) {
        throw new Error("Failed to generate DOCX");
      }

      const blob = await response.blob();
      const fileName = `discharge_summary_${(caseData?.patient?.name || "patient").replace(/\s+/g, "_")}.docx`;

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
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });

        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(fileUri, {
            mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            dialogTitle: "Share Discharge Summary",
          });
        } else {
          Alert.alert("Success", `Word document saved to: ${fileUri}`);
        }
      }
    } catch (err) {
      console.error("DOCX export error:", err);
      Alert.alert("Error", "Failed to export Word document. Please try again.");
    } finally {
      setExportingDocx(false);
    }
  };

  const updateField = (field: string, value: string) => {
    setSummary((prev) => ({ ...prev, [field]: value }));
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
            <Text style={[styles.patientName, { color: theme.text }]}>{caseData.patient.name}</Text>
            <Text style={[styles.patientDetails, { color: theme.textSecondary }]}>
              {caseData.patient.age} yrs | {caseData.patient.sex}
            </Text>
          </View>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.aiBtn,
            { backgroundColor: theme.primaryLight, opacity: pressed || generating ? 0.8 : 1 },
          ]}
          onPress={generateAISummary}
          disabled={generating}
        >
          {generating ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <>
              <Feather name="cpu" size={20} color={theme.primary} />
              <Text style={[styles.aiBtnText, { color: theme.primary }]}>Generate AI Summary</Text>
            </>
          )}
        </Pressable>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Final Diagnosis</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder="Enter diagnosis..."
              placeholderTextColor={theme.textMuted}
              value={summary.diagnosis}
              onChangeText={(v) => updateField("diagnosis", v)}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Treatment Given</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder="Summary of treatment..."
              placeholderTextColor={theme.textMuted}
              value={summary.treatment_given}
              onChangeText={(v) => updateField("treatment_given", v)}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Condition at Discharge</Text>
            <View style={styles.conditionRow}>
              {["Stable", "Improved", "Same", "Guarded"].map((condition) => (
                <Pressable
                  key={condition}
                  style={[
                    styles.conditionBtn,
                    {
                      backgroundColor:
                        summary.condition_at_discharge === condition ? theme.primary : theme.backgroundSecondary,
                    },
                  ]}
                  onPress={() => updateField("condition_at_discharge", condition)}
                >
                  <Text
                    style={{
                      color: summary.condition_at_discharge === condition ? "#FFFFFF" : theme.text,
                      ...Typography.caption,
                      fontWeight: "600",
                    }}
                  >
                    {condition}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Medications to Continue</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder="List medications..."
              placeholderTextColor={theme.textMuted}
              value={summary.medications}
              onChangeText={(v) => updateField("medications", v)}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Follow-up Instructions</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder="Follow-up date, OPD, etc..."
              placeholderTextColor={theme.textMuted}
              value={summary.follow_up}
              onChangeText={(v) => updateField("follow_up", v)}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Additional Instructions</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder="Diet, activity, warning signs..."
              placeholderTextColor={theme.textMuted}
              value={summary.instructions}
              onChangeText={(v) => updateField("instructions", v)}
              multiline
              textAlignVertical="top"
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Doctor's Name</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder="Dr. Name"
              placeholderTextColor={theme.textMuted}
              value={summary.doctor_name}
              onChangeText={(v) => updateField("doctor_name", v)}
            />
          </View>
        </View>

        <View style={styles.exportRow}>
          <Pressable
            style={({ pressed }) => [
              styles.exportBtn,
              { backgroundColor: theme.dangerLight, opacity: pressed || exporting ? 0.8 : 1 },
            ]}
            onPress={exportPDF}
            disabled={exporting}
          >
            {exporting ? (
              <ActivityIndicator color={theme.danger} size="small" />
            ) : (
              <>
                <Feather name="file-text" size={18} color={theme.danger} />
                <Text style={[styles.exportBtnText, { color: theme.danger }]}>PDF</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.exportBtn,
              { backgroundColor: theme.primaryLight, opacity: pressed || exportingDocx ? 0.8 : 1 },
            ]}
            onPress={exportDOCX}
            disabled={exportingDocx}
          >
            {exportingDocx ? (
              <ActivityIndicator color={theme.primary} size="small" />
            ) : (
              <>
                <Feather name="file" size={18} color={theme.primary} />
                <Text style={[styles.exportBtnText, { color: theme.primary }]}>Word</Text>
              </>
            )}
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.shareBtn,
              { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={shareSummary}
          >
            <Feather name="share-2" size={18} color={theme.primary} />
            <Text style={[styles.shareBtnText, { color: theme.primary }]}>Share</Text>
          </Pressable>
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
              <Text style={styles.saveBtnText}>Complete & Save</Text>
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
  aiBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  aiBtnText: { ...Typography.bodyMedium },
  section: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  field: { marginBottom: Spacing.lg },
  label: { ...Typography.label, marginBottom: Spacing.xs },
  input: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    ...Typography.body,
  },
  textArea: {
    minHeight: 70,
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    ...Typography.body,
  },
  conditionRow: { flexDirection: "row", gap: Spacing.sm },
  conditionBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm },
  exportRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.md },
  exportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
    flex: 1,
  },
  exportBtnText: { ...Typography.bodyMedium, fontWeight: "600" },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: Spacing.buttonHeight,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  shareBtnText: { ...Typography.bodyMedium },
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
