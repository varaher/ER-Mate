import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { fetchCasesFromProxy, deleteCaseFromProxy } from "@/lib/api";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface LogItem {
  id: string;
  action: string;
  case_id?: string;
  patient_name?: string;
  created_at: string;
  details?: string;
}

export default function LogsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [rawCases, setRawCases] = useState<any[]>([]);

  const loadLogs = async () => {
    try {
      const cases = await fetchCasesFromProxy<any[]>();
      const arr = Array.isArray(cases) ? cases : [];
      setRawCases(arr);
      const generatedLogs: LogItem[] = arr.map((c: any) => ({
        id: c.id,
        action: c.status === "discharged" || c.status === "completed" ? "Discharged" : "Active",
        case_id: c.id,
        patient_name: c.patient?.name || c.patient_name || "Unknown",
        created_at: c.created_at,
        details: c.triage_priority ? `Priority ${c.triage_priority}` : undefined,
      }));
      generatedLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setLogs(generatedLogs);
    } catch (err) {
      console.error("Error loading logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      loadLogs();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  const handleDeleteAll = () => {
    if (rawCases.length === 0) {
      Alert.alert("Nothing to delete", "You have no cases recorded.");
      return;
    }
    Alert.alert(
      "Delete All Cases",
      `This will permanently delete all ${rawCases.length} cases from your account. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Delete ${rawCases.length} Cases`,
          style: "destructive",
          onPress: async () => {
            setDeleting(true);
            const ids = rawCases.map((c: any) => c.id).filter(Boolean);
            let deleted = 0;
            for (const id of ids) {
              try { await deleteCaseFromProxy(id); deleted++; } catch {}
            }
            setDeleting(false);
            await loadLogs();
            Alert.alert("Done", `${deleted} case${deleted !== 1 ? "s" : ""} deleted.`);
          },
        },
      ]
    );
  };

  const formatDateTime = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString("en-IN", {
        month: "short", day: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return dateString; }
  };

  const getActionColor = (action: string) => {
    if (action === "Discharged") return TriageColors.green;
    return theme.primary;
  };

  const getActionIcon = (action: string): keyof typeof Feather.glyphMap => {
    if (action === "Discharged") return "check-circle";
    return "plus-circle";
  };

  const renderLog = ({ item }: { item: LogItem }) => (
    <Pressable
      style={({ pressed }) => [
        styles.logCard,
        { backgroundColor: theme.card, opacity: pressed ? 0.88 : 1 },
      ]}
      onPress={() => item.case_id && navigation.navigate("ViewCase", { caseId: item.case_id })}
    >
      <View style={[styles.iconContainer, { backgroundColor: getActionColor(item.action) + "20" }]}>
        <Feather name={getActionIcon(item.action)} size={20} color={getActionColor(item.action)} />
      </View>
      <View style={styles.logInfo}>
        <Text style={[styles.patientName, { color: theme.text }]}>{item.patient_name}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
          <View style={[styles.actionBadge, { backgroundColor: getActionColor(item.action) + "18" }]}>
            <Text style={[styles.actionBadgeText, { color: getActionColor(item.action) }]}>{item.action}</Text>
          </View>
          {item.details ? (
            <Text style={[styles.detailText, { color: theme.textMuted }]}>{item.details}</Text>
          ) : null}
        </View>
        <Text style={[styles.timeText, { color: theme.textMuted }]}>{formatDateTime(item.created_at)}</Text>
      </View>
      <Feather name="chevron-right" size={18} color={theme.textMuted} />
    </Pressable>
  );

  if (loading) {
    return (
      <View style={[styles.center, { flex: 1, backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <FlatList
        data={logs}
        renderItem={renderLog}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: insets.top + Spacing.lg,
          paddingHorizontal: Spacing.lg,
          paddingBottom: insets.bottom + 100,
        }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />}
        ListHeaderComponent={
          logs.length > 0 ? (
            <View style={styles.listHeader}>
              <Text style={[styles.countText, { color: theme.textMuted }]}>
                {logs.length} case{logs.length !== 1 ? "s" : ""} in your account
              </Text>
              <Pressable
                onPress={handleDeleteAll}
                disabled={deleting}
                style={({ pressed }) => [styles.deleteAllBtn, { opacity: pressed || deleting ? 0.7 : 1 }]}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={theme.danger} />
                ) : (
                  <Feather name="trash-2" size={14} color={theme.danger} />
                )}
                <Text style={[styles.deleteAllText, { color: theme.danger }]}>
                  {deleting ? "Deleting…" : "Delete All"}
                </Text>
              </Pressable>
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={[styles.emptyIcon, { backgroundColor: isDark ? "#1e293b" : "#F1F5F9" }]}>
              <Feather name="list" size={32} color={theme.textMuted} />
            </View>
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No cases yet</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>
              Cases you document will appear here
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },
  listHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  countText: { fontSize: 13 },
  deleteAllBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: BorderRadius.md,
    backgroundColor: "rgba(239,68,68,0.08)",
  },
  deleteAllText: { fontSize: 13, fontWeight: "600" },
  logCard: {
    flexDirection: "row", alignItems: "center",
    padding: Spacing.md, borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm, gap: Spacing.md,
  },
  iconContainer: {
    width: 40, height: 40, borderRadius: BorderRadius.full,
    justifyContent: "center", alignItems: "center",
  },
  logInfo: { flex: 1 },
  patientName: { ...Typography.bodyMedium },
  actionBadge: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  actionBadgeText: { fontSize: 11, fontWeight: "700" },
  detailText: { fontSize: 11 },
  timeText: { ...Typography.caption, marginTop: 3 },
  emptyState: { alignItems: "center", paddingTop: 80, paddingHorizontal: 32 },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    alignItems: "center", justifyContent: "center", marginBottom: Spacing.lg,
  },
  emptyTitle: { ...Typography.h4, marginBottom: Spacing.sm },
  emptySub: { ...Typography.body, textAlign: "center", lineHeight: 22 },
});
