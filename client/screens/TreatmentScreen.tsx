import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Pressable,
  FlatList,
  Modal,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { apiGet, apiPatch, apiPost, invalidateCases } from "@/lib/api";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, "Treatment">;

const COMMON_DRUGS = [
  { name: "NS 0.9%", doses: ["500mL IV", "1L IV"] },
  { name: "RL", doses: ["500mL IV", "1L IV"] },
  { name: "Paracetamol", doses: ["1g IV", "650mg PO"] },
  { name: "Ondansetron", doses: ["4mg IV", "8mg IV"] },
  { name: "Pantoprazole", doses: ["40mg IV", "40mg PO"] },
  { name: "Tramadol", doses: ["50mg IV", "100mg IV"] },
  { name: "Morphine", doses: ["2mg IV", "4mg IV"] },
  { name: "Fentanyl", doses: ["50mcg IV", "100mcg IV"] },
  { name: "Metoclopramide", doses: ["10mg IV"] },
  { name: "Diazepam", doses: ["5mg IV", "10mg IV"] },
  { name: "Midazolam", doses: ["2mg IV", "5mg IV"] },
  { name: "Adrenaline", doses: ["0.5mg IM", "1mg IV"] },
  { name: "Atropine", doses: ["0.6mg IV", "1.2mg IV"] },
  { name: "Hydrocortisone", doses: ["100mg IV", "200mg IV"] },
  { name: "Furosemide", doses: ["20mg IV", "40mg IV"] },
];

const PROCEDURES = [
  "Peripheral IV Access",
  "Central Line",
  "Arterial Line",
  "Foley Catheter",
  "NG Tube",
  "Wound Suturing",
  "Splinting",
  "Chest Tube",
  "Intubation",
  "CPR",
];

interface Drug {
  name: string;
  dose: string;
  route: string;
  time: string;
}

export default function TreatmentScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { caseId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [procedures, setProcedures] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<string | null>(null);
  const [redFlags, setRedFlags] = useState<string[]>([]);
  const [showDrugModal, setShowDrugModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const loadCase = async () => {
    try {
      const res = await apiGet<any>(`/cases/${caseId}`);
      if (res.success && res.data?.treatment) {
        const t = res.data.treatment;
        if (t.drugs) setDrugs(t.drugs);
        if (t.procedures) setProcedures(t.procedures);
        if (t.notes) setNotes(t.notes);
      }
    } catch (err) {
      console.error("Error loading case:", err);
    } finally {
      setLoading(false);
    }
  };

  const getAIDiagnosis = async () => {
    setAiLoading(true);
    try {
      const res = await apiPost<{ diagnosis: string; red_flags: string[] }>(`/ai/diagnosis`, {
        case_id: caseId,
      });

      if (res.success && res.data) {
        setAiSuggestion(res.data.diagnosis);
        setRedFlags(res.data.red_flags || []);
      } else {
        Alert.alert("Error", res.error || "Failed to get AI diagnosis");
      }
    } catch (err) {
      Alert.alert("Error", (err as Error).message);
    } finally {
      setAiLoading(false);
    }
  };

  const addDrug = (name: string, dose: string) => {
    const newDrug: Drug = {
      name,
      dose,
      route: dose.includes("IV") ? "IV" : dose.includes("IM") ? "IM" : "PO",
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
    };
    setDrugs((prev) => [...prev, newDrug]);
    setShowDrugModal(false);
  };

  const removeDrug = (index: number) => {
    setDrugs((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleProcedure = (procedure: string) => {
    setProcedures((prev) =>
      prev.includes(procedure) ? prev.filter((p) => p !== procedure) : [...prev, procedure]
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiPatch(`/cases/${caseId}`, {
        treatment: {
          drugs,
          procedures,
          notes,
          ai_diagnosis: aiSuggestion,
          red_flags: redFlags,
        },
      });

      if (res.success) {
        await invalidateCases();
        Alert.alert("Saved", "Treatment saved", [
          { text: "Continue to Disposition", onPress: () => navigation.navigate("Disposition", { caseId }) },
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

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const filteredDrugs = COMMON_DRUGS.filter((d) =>
    d.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing["4xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          style={({ pressed }) => [
            styles.aiBtn,
            { backgroundColor: theme.primaryLight, opacity: pressed || aiLoading ? 0.8 : 1 },
          ]}
          onPress={getAIDiagnosis}
          disabled={aiLoading}
        >
          {aiLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : (
            <>
              <Feather name="cpu" size={20} color={theme.primary} />
              <Text style={[styles.aiBtnText, { color: theme.primary }]}>Get AI Diagnosis</Text>
            </>
          )}
        </Pressable>

        {aiSuggestion && (
          <View style={[styles.aiCard, { backgroundColor: theme.infoLight, borderColor: theme.info }]}>
            <View style={styles.aiHeader}>
              <Feather name="zap" size={18} color={theme.info} />
              <Text style={[styles.aiTitle, { color: theme.info }]}>AI Suggested Diagnosis</Text>
            </View>
            <Text style={[styles.aiText, { color: theme.text }]}>{aiSuggestion}</Text>
          </View>
        )}

        {redFlags.length > 0 && (
          <View style={[styles.redFlagsCard, { backgroundColor: theme.dangerLight, borderColor: theme.danger }]}>
            <View style={styles.aiHeader}>
              <Feather name="alert-triangle" size={18} color={theme.danger} />
              <Text style={[styles.aiTitle, { color: theme.danger }]}>Red Flags</Text>
            </View>
            {redFlags.map((flag, i) => (
              <Text key={i} style={[styles.redFlagText, { color: theme.danger }]}>
                - {flag}
              </Text>
            ))}
          </View>
        )}

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Medications</Text>
            <Pressable
              style={[styles.addBtn, { backgroundColor: theme.primary }]}
              onPress={() => setShowDrugModal(true)}
            >
              <Feather name="plus" size={18} color="#FFFFFF" />
              <Text style={styles.addBtnText}>Add</Text>
            </Pressable>
          </View>

          {drugs.length === 0 ? (
            <Text style={[styles.emptyText, { color: theme.textMuted }]}>No medications added</Text>
          ) : (
            drugs.map((drug, index) => (
              <View key={index} style={[styles.drugRow, { backgroundColor: theme.backgroundSecondary }]}>
                <View style={styles.drugInfo}>
                  <Text style={[styles.drugName, { color: theme.text }]}>{drug.name}</Text>
                  <Text style={[styles.drugDose, { color: theme.textSecondary }]}>
                    {drug.dose} | {drug.time}
                  </Text>
                </View>
                <Pressable onPress={() => removeDrug(index)}>
                  <Feather name="x" size={20} color={theme.danger} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Procedures</Text>
          <View style={styles.proceduresGrid}>
            {PROCEDURES.map((proc) => (
              <Pressable
                key={proc}
                style={[
                  styles.procedureBtn,
                  {
                    backgroundColor: procedures.includes(proc)
                      ? theme.primary
                      : theme.backgroundSecondary,
                  },
                ]}
                onPress={() => toggleProcedure(proc)}
              >
                <Text
                  style={{
                    color: procedures.includes(proc) ? "#FFFFFF" : theme.text,
                    ...Typography.caption,
                  }}
                >
                  {proc}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Treatment Notes</Text>
          <TextInput
            style={[styles.notesInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder="Additional notes..."
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
              <Feather name="arrow-right" size={20} color="#FFFFFF" />
              <Text style={styles.saveBtnText}>Save & Continue</Text>
            </>
          )}
        </Pressable>
      </KeyboardAwareScrollViewCompat>

      <Modal visible={showDrugModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Add Medication</Text>
              <Pressable onPress={() => setShowDrugModal(false)}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <TextInput
              style={[styles.searchInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder="Search drugs..."
              placeholderTextColor={theme.textMuted}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />

            <FlatList
              data={filteredDrugs}
              keyExtractor={(item) => item.name}
              style={styles.drugList}
              renderItem={({ item }) => (
                <View style={[styles.drugItem, { borderBottomColor: theme.border }]}>
                  <Text style={[styles.drugItemName, { color: theme.text }]}>{item.name}</Text>
                  <View style={styles.doseRow}>
                    {item.doses.map((dose) => (
                      <Pressable
                        key={dose}
                        style={[styles.doseBtn, { backgroundColor: theme.primaryLight }]}
                        onPress={() => addDrug(item.name, dose)}
                      >
                        <Text style={[styles.doseBtnText, { color: theme.primary }]}>{dose}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: Spacing.lg },
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
  aiCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  aiHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
  aiTitle: { ...Typography.label },
  aiText: { ...Typography.body },
  redFlagsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  redFlagText: { ...Typography.small, marginTop: Spacing.xs },
  section: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.md },
  sectionTitle: { ...Typography.h4 },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  addBtnText: { color: "#FFFFFF", ...Typography.label },
  emptyText: { ...Typography.body, textAlign: "center", paddingVertical: Spacing.lg },
  drugRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginBottom: Spacing.sm,
  },
  drugInfo: { flex: 1 },
  drugName: { ...Typography.bodyMedium },
  drugDose: { ...Typography.caption },
  proceduresGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  procedureBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm },
  notesInput: {
    minHeight: 100,
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
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { maxHeight: "80%", borderTopLeftRadius: BorderRadius.xl, borderTopRightRadius: BorderRadius.xl, padding: Spacing.lg },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.lg },
  modalTitle: { ...Typography.h3 },
  searchInput: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  drugList: { maxHeight: 400 },
  drugItem: { paddingVertical: Spacing.md, borderBottomWidth: 1 },
  drugItemName: { ...Typography.bodyMedium, marginBottom: Spacing.sm },
  doseRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  doseBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.sm },
  doseBtnText: { ...Typography.caption },
});
