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
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, "Investigations">;

const INVESTIGATION_OPTIONS = [
  { id: "cbc", name: "CBC", category: "Blood" },
  { id: "bmp", name: "BMP / RFT", category: "Blood" },
  { id: "lft", name: "LFT", category: "Blood" },
  { id: "coag", name: "PT/INR, aPTT", category: "Blood" },
  { id: "cardiac", name: "Troponin, BNP", category: "Cardiac" },
  { id: "abg", name: "ABG/VBG", category: "Blood" },
  { id: "lactate", name: "Lactate", category: "Blood" },
  { id: "ua", name: "Urinalysis", category: "Urine" },
  { id: "xray_chest", name: "CXR", category: "Imaging" },
  { id: "xray_abd", name: "X-Ray Abdomen", category: "Imaging" },
  { id: "ct_head", name: "CT Head", category: "Imaging" },
  { id: "ct_chest", name: "CT Chest", category: "Imaging" },
  { id: "ct_abd", name: "CT Abdomen", category: "Imaging" },
  { id: "usg", name: "USG / FAST", category: "Imaging" },
  { id: "ecg", name: "ECG", category: "Cardiac" },
  { id: "echo", name: "Bedside Echo", category: "Cardiac" },
];

export default function InvestigationsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { caseId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedTests, setSelectedTests] = useState<string[]>([]);
  const [testResults, setTestResults] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");

  useEffect(() => {
    loadCase();
  }, [caseId]);

  const loadCase = async () => {
    try {
      const res = await apiGet<any>(`/cases/${caseId}`);
      if (res.success && res.data?.investigations) {
        const inv = res.data.investigations;
        if (inv.ordered) setSelectedTests(inv.ordered);
        if (inv.results) setTestResults(inv.results);
        if (inv.notes) setNotes(inv.notes);
      }
    } catch (err) {
      console.error("Error loading case:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleTest = (id: string) => {
    setSelectedTests((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const updateResult = (id: string, value: string) => {
    setTestResults((prev) => ({ ...prev, [id]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiPatch(`/cases/${caseId}`, {
        investigations: {
          ordered: selectedTests,
          results: testResults,
          notes,
        },
      });

      if (res.success) {
        await invalidateCases();
        Alert.alert("Saved", "Investigations saved", [
          { text: "Continue to Treatment", onPress: () => navigation.navigate("Treatment", { caseId }) },
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

  const categories = [...new Set(INVESTIGATION_OPTIONS.map((i) => i.category))];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + Spacing["4xl"] }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={[styles.heading, { color: theme.text }]}>Order Investigations</Text>

        {categories.map((category) => (
          <View key={category} style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{category}</Text>
            <View style={styles.testsGrid}>
              {INVESTIGATION_OPTIONS.filter((i) => i.category === category).map((test) => (
                <Pressable
                  key={test.id}
                  style={[
                    styles.testBtn,
                    {
                      backgroundColor: selectedTests.includes(test.id)
                        ? theme.primary
                        : theme.backgroundSecondary,
                    },
                  ]}
                  onPress={() => toggleTest(test.id)}
                >
                  <Feather
                    name={selectedTests.includes(test.id) ? "check-square" : "square"}
                    size={16}
                    color={selectedTests.includes(test.id) ? "#FFFFFF" : theme.textSecondary}
                  />
                  <Text
                    style={{
                      color: selectedTests.includes(test.id) ? "#FFFFFF" : theme.text,
                      ...Typography.small,
                    }}
                  >
                    {test.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        {selectedTests.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Results</Text>
            {selectedTests.map((id) => {
              const test = INVESTIGATION_OPTIONS.find((t) => t.id === id);
              return (
                <View key={id} style={styles.resultRow}>
                  <Text style={[styles.resultLabel, { color: theme.textSecondary }]}>{test?.name}</Text>
                  <TextInput
                    style={[styles.resultInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                    placeholder="Enter result..."
                    placeholderTextColor={theme.textMuted}
                    value={testResults[id] || ""}
                    onChangeText={(v) => updateResult(id, v)}
                  />
                </View>
              );
            })}
          </View>
        )}

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Notes</Text>
          <TextInput
            style={[styles.notesInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder="Additional notes about investigations..."
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { padding: Spacing.lg },
  heading: { ...Typography.h3, marginBottom: Spacing.lg },
  section: { borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg },
  sectionTitle: { ...Typography.label, marginBottom: Spacing.md },
  testsGrid: { flexDirection: "row", flexWrap: "wrap", gap: Spacing.sm },
  testBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.sm,
    gap: Spacing.xs,
  },
  resultRow: { marginBottom: Spacing.md },
  resultLabel: { ...Typography.label, marginBottom: Spacing.xs },
  resultInput: {
    height: Spacing.inputHeight,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    ...Typography.body,
  },
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
});
