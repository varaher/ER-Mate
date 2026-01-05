import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { apiGet } from "@/lib/api";
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

interface CaseItem {
  id: string;
  patient: { name: string; age: string };
  status: string;
  created_at: string;
  triage_priority: number;
}

export default function LogsScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<LogItem[]>([]);

  const loadLogs = async () => {
    try {
      const res = await apiGet<CaseItem[]>("/cases");
      if (res.success && res.data) {
        const generatedLogs: LogItem[] = res.data.map((c) => ({
          id: c.id,
          action: c.status === "discharged" || c.status === "completed" ? "Discharged" : "Created",
          case_id: c.id,
          patient_name: c.patient?.name || "Unknown",
          created_at: c.created_at,
          details: `Priority: ${c.triage_priority}`,
        }));
        generatedLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setLogs(generatedLogs);
      }
    } catch (err) {
      console.error("Error loading logs:", err);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadLogs();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLogs();
    setRefreshing(false);
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getActionIcon = (action: string) => {
    if (action === "Discharged") return "check-circle";
    if (action === "Created") return "plus-circle";
    return "activity";
  };

  const getActionColor = (action: string) => {
    if (action === "Discharged") return TriageColors.green;
    if (action === "Created") return theme.primary;
    return theme.textSecondary;
  };

  const renderLog = ({ item }: { item: LogItem }) => (
    <Pressable
      style={({ pressed }) => [
        styles.logCard,
        { backgroundColor: theme.card, opacity: pressed ? 0.9 : 1 },
      ]}
      onPress={() => item.case_id && navigation.navigate("ViewCase", { caseId: item.case_id })}
    >
      <View style={[styles.iconContainer, { backgroundColor: getActionColor(item.action) + "20" }]}>
        <Feather name={getActionIcon(item.action)} size={20} color={getActionColor(item.action)} />
      </View>
      <View style={styles.logInfo}>
        <Text style={[styles.patientName, { color: theme.text }]}>{item.patient_name}</Text>
        <Text style={[styles.actionText, { color: theme.textSecondary }]}>
          {item.action} | {item.details}
        </Text>
        <Text style={[styles.timeText, { color: theme.textMuted }]}>{formatDateTime(item.created_at)}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={theme.textMuted} />
    </Pressable>
  );

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.header, { backgroundColor: theme.card, paddingTop: insets.top + Spacing.md }]}>
        <Text style={[styles.title, { color: theme.text }]}>Activity Logs</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {logs.length} activities recorded
        </Text>
      </View>

      <FlatList
        data={logs}
        renderItem={renderLog}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="list" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No activity yet</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  title: { ...Typography.h2 },
  subtitle: { ...Typography.small, marginTop: Spacing.xs },
  list: { padding: Spacing.lg, paddingBottom: 120 },
  logCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  logInfo: { flex: 1 },
  patientName: { ...Typography.bodyMedium },
  actionText: { ...Typography.small, marginTop: 2 },
  timeText: { ...Typography.caption, marginTop: 2 },
  emptyState: { alignItems: "center", paddingVertical: Spacing["4xl"] },
  emptyText: { ...Typography.body, marginTop: Spacing.md },
});
