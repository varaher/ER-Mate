import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiGet, apiPut } from "@/lib/api";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, "AddendumNotes">;

export default function AddendumNotesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { caseId } = route.params;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [patientName, setPatientName] = useState("");
  const [existingNotes, setExistingNotes] = useState<string[]>([]);
  const noteRef = useRef("");
  const [noteText, setNoteText] = useState("");

  useEffect(() => {
    loadCaseData();
  }, [caseId]);

  const loadCaseData = async () => {
    try {
      setLoading(true);
      const res = await apiGet<any>(`/cases/${caseId}`);
      if (res.success && res.data) {
        setPatientName(res.data.patient?.name || "Patient");
        const notes = res.data.treatment?.addendum_notes || res.data.addendum_notes || [];
        setExistingNotes(Array.isArray(notes) ? notes : (notes ? [notes] : []));
      }
    } catch (err) {
      console.error("Error loading case:", err);
      Alert.alert("Error", "Unable to load case data");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const newNote = noteRef.current.trim();
    if (!newNote) {
      Alert.alert("Note Required", "Please enter a note before saving.");
      return;
    }

    setSaving(true);
    try {
      const timestamp = new Date().toLocaleString("en-IN");
      const formattedNote = `[${timestamp}] ${newNote}`;
      const updatedNotes = [...existingNotes, formattedNote];

      const res = await apiPut(`/cases/${caseId}`, {
        treatment: {
          addendum_notes: updatedNotes,
        },
        addendum_notes: updatedNotes,
      });

      if (res.success) {
        Alert.alert("Saved", "Addendum note added successfully", [
          { text: "OK", onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert("Error", "Failed to save addendum note");
      }
    } catch (err) {
      console.error("Error saving addendum:", err);
      Alert.alert("Error", "Unable to save addendum note");
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
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingTop: Spacing.lg, paddingBottom: insets.bottom + 100 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Feather name="edit-3" size={24} color={theme.warning} />
          <View style={styles.headerText}>
            <Text style={[styles.title, { color: theme.text }]}>Addendum Notes</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>{patientName}</Text>
          </View>
        </View>

        {existingNotes.length > 0 && (
          <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Previous Notes</Text>
            {existingNotes.map((note, idx) => (
              <View key={idx} style={[styles.noteItem, { borderBottomColor: theme.border }]}>
                <Text style={[styles.noteText, { color: theme.text }]}>{note}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.section, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Add New Note</Text>
          <Text style={[styles.hint, { color: theme.textMuted }]}>
            Add additional observations, follow-up notes, or corrections to the case record.
          </Text>
          <TextInput
            style={[styles.textArea, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
            placeholder="Enter addendum note here..."
            placeholderTextColor={theme.textMuted}
            defaultValue=""
            onChangeText={(text) => {
              noteRef.current = text;
              setNoteText(text);
            }}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: theme.card, borderTopColor: theme.border, paddingBottom: insets.bottom + Spacing.md }]}>
        <Pressable
          style={[styles.cancelBtn, { borderColor: theme.border }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Cancel</Text>
        </Pressable>
        <Pressable
          style={[styles.saveBtn, { backgroundColor: theme.warning, opacity: saving ? 0.7 : 1 }]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="save" size={18} color="#FFFFFF" />
              <Text style={styles.saveText}>Save Note</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollView: { flex: 1, paddingHorizontal: Spacing.lg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  headerText: { flex: 1 },
  title: { ...Typography.h3 },
  subtitle: { ...Typography.body, marginTop: 2 },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  sectionTitle: { ...Typography.h4, marginBottom: Spacing.sm },
  hint: { ...Typography.caption, marginBottom: Spacing.md },
  noteItem: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  noteText: { ...Typography.body },
  textArea: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 150,
    ...Typography.body,
  },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    gap: Spacing.md,
    padding: Spacing.lg,
    borderTopWidth: 1,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { ...Typography.body, fontWeight: "600" },
  saveBtn: {
    flex: 2,
    flexDirection: "row",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
  },
  saveText: { color: "#FFFFFF", ...Typography.body, fontWeight: "700" },
});
