import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useDepartment } from "@/context/DepartmentContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SetupDepartmentScreen() {
  const { theme } = useTheme();
  const { token, user } = useAuth();
  const { refresh } = useDepartment();
  const navigation = useNavigation<Nav>();
  const headerHeight = useHeaderHeight();

  const [deptName, setDeptName] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [morningStart, setMorningStart] = useState("06:00");
  const [morningEnd, setMorningEnd] = useState("14:00");
  const [eveningStart, setEveningStart] = useState("14:00");
  const [eveningEnd, setEveningEnd] = useState("22:00");
  const [nightStart, setNightStart] = useState("22:00");
  const [nightEnd, setNightEnd] = useState("06:00");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!deptName.trim()) {
      Alert.alert("Required", "Please enter a department name.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/department/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: deptName.trim(), hospitalName: hospitalName.trim(), morningStart, morningEnd, eveningStart, eveningEnd, nightStart, nightEnd, hodName: user?.name || "", hodEmail: (user as any)?.email || "" }),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert("Error", data.error || "Failed to create department"); return; }
      await refresh();
      Alert.alert("Department Created!", `${deptName} is ready. Now add your team members.`, [
        { text: "Manage Roster", onPress: () => navigation.replace("ManageRoster") },
      ]);
    } catch {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const TimeField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <View style={styles.timeField}>
      <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        style={[styles.timeInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
        value={value}
        onChangeText={onChange}
        placeholder="HH:MM"
        placeholderTextColor={theme.textMuted}
        maxLength={5}
      />
    </View>
  );

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundDefault }}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: 60 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>DEPARTMENT DETAILS</Text>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Department Name *</Text>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
            value={deptName}
            onChangeText={setDeptName}
            placeholder="e.g. Emergency Department"
            placeholderTextColor={theme.textMuted}
          />
        </View>
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Hospital Name</Text>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
            value={hospitalName}
            onChangeText={setHospitalName}
            placeholder="e.g. City General Hospital"
            placeholderTextColor={theme.textMuted}
          />
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.lg }]}>SHIFT TIMES</Text>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.shiftGroupTitle, { color: theme.text }]}>Morning Shift</Text>
        <View style={styles.timeRow}><TimeField label="Start" value={morningStart} onChange={setMorningStart} /><TimeField label="End" value={morningEnd} onChange={setMorningEnd} /></View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Text style={[styles.shiftGroupTitle, { color: theme.text }]}>Evening Shift</Text>
        <View style={styles.timeRow}><TimeField label="Start" value={eveningStart} onChange={setEveningStart} /><TimeField label="End" value={eveningEnd} onChange={setEveningEnd} /></View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Text style={[styles.shiftGroupTitle, { color: theme.text }]}>Night Shift</Text>
        <View style={styles.timeRow}><TimeField label="Start" value={nightStart} onChange={setNightStart} /><TimeField label="End" value={nightEnd} onChange={setNightEnd} /></View>
      </View>

      <View style={[styles.infoBox, { backgroundColor: theme.primaryLight }]}>
        <Feather name="info" size={16} color={theme.primary} />
        <Text style={[styles.infoText, { color: theme.primary }]}>
          Default capacity: 2 consultants + 6 residents per shift. You can invite members after creating the department.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.createBtn, { backgroundColor: theme.primary, opacity: pressed || loading ? 0.8 : 1 }]}
        onPress={handleCreate}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : (
          <>
            <Feather name="check-circle" size={20} color="#fff" />
            <Text style={styles.createBtnText}>Create Department</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: Spacing.sm },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  field: { marginBottom: Spacing.md },
  label: { fontSize: 14, marginBottom: 6, fontWeight: "500" },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  shiftGroupTitle: { fontSize: 16, fontWeight: "700", marginBottom: Spacing.sm },
  timeRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.sm },
  timeField: { flex: 1 },
  timeLabel: { fontSize: 12, marginBottom: 4, fontWeight: "500" },
  timeInput: { borderWidth: 1, borderRadius: BorderRadius.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, textAlign: "center" },
  divider: { height: 1, marginVertical: Spacing.md },
  infoBox: { flexDirection: "row", gap: 10, padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.sm, marginBottom: Spacing.lg },
  infoText: { flex: 1, fontSize: 14, lineHeight: 18 },
  createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: BorderRadius.lg },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
