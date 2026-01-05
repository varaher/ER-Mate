import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { fetchFromApi } from "@/lib/api";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface CaseItem {
  id: string;
  patient: {
    name: string;
    age: string;
    sex: string;
  };
  presenting_complaint?: {
    text: string;
  };
  triage_priority: number;
  status: string;
  created_at: string;
}

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

export default function CasesScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "discharged">("all");

  const { data: rawCases = [], isLoading: loading, refetch, isRefetching } = useQuery<CaseItem[]>({
    queryKey: ["cases"],
    queryFn: () => fetchFromApi<CaseItem[]>("/cases"),
    refetchOnMount: true,
  });

  const cases = useMemo(() => {
    const sorted = [...rawCases];
    sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted;
  }, [rawCases]);

  const refreshing = isRefetching;

  const onRefresh = async () => {
    await refetch();
  };

  const filteredCases = cases.filter((c) => {
    const matchesSearch =
      c.patient?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.presenting_complaint?.text?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filter === "all" ||
      (filter === "active" && c.status !== "completed" && c.status !== "discharged") ||
      (filter === "discharged" && (c.status === "completed" || c.status === "discharged"));

    return matchesSearch && matchesFilter;
  });

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const renderCase = ({ item }: { item: CaseItem }) => (
    <Pressable
      style={({ pressed }) => [
        styles.caseCard,
        { backgroundColor: theme.card, opacity: pressed ? 0.9 : 1 },
      ]}
      onPress={() => navigation.navigate("CaseSheet", { caseId: item.id })}
    >
      <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(item.triage_priority) }]} />
      <View style={styles.caseInfo}>
        <Text style={[styles.patientName, { color: theme.text }]}>{item.patient?.name || "Unknown"}</Text>
        <Text style={[styles.patientDetails, { color: theme.textSecondary }]}>
          {item.patient?.age} yrs | {item.patient?.sex} | {formatDate(item.created_at)}
        </Text>
        {item.presenting_complaint?.text ? (
          <Text style={[styles.complaint, { color: theme.textMuted }]} numberOfLines={1}>
            {item.presenting_complaint.text}
          </Text>
        ) : null}
      </View>
      <View
        style={[
          styles.statusBadge,
          {
            backgroundColor:
              item.status === "completed" || item.status === "discharged"
                ? theme.successLight
                : theme.primaryLight,
          },
        ]}
      >
        <Text
          style={[
            styles.statusText,
            {
              color:
                item.status === "completed" || item.status === "discharged"
                  ? theme.success
                  : theme.primary,
            },
          ]}
        >
          {item.status === "completed" || item.status === "discharged" ? "Done" : "Active"}
        </Text>
      </View>
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
        <Text style={[styles.title, { color: theme.text }]}>All Cases</Text>
        <View style={[styles.searchContainer, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="search" size={18} color={theme.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Search patients..."
            placeholderTextColor={theme.textMuted}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <View style={styles.filterRow}>
          {(["all", "active", "discharged"] as const).map((f) => (
            <Pressable
              key={f}
              style={[
                styles.filterBtn,
                { backgroundColor: filter === f ? theme.primary : theme.backgroundSecondary },
              ]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterText, { color: filter === f ? "#FFFFFF" : theme.textSecondary }]}>
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <FlatList
        data={filteredCases}
        renderItem={renderCase}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="folder" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No cases found</Text>
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
    gap: Spacing.md,
  },
  title: { ...Typography.h2 },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: BorderRadius.md,
    gap: Spacing.sm,
  },
  searchInput: { flex: 1, ...Typography.body },
  filterRow: { flexDirection: "row", gap: Spacing.sm },
  filterBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  filterText: { ...Typography.label },
  list: { padding: Spacing.lg, paddingBottom: 120 },
  caseCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
  },
  priorityDot: { width: 12, height: 12, borderRadius: BorderRadius.full },
  caseInfo: { flex: 1 },
  patientName: { ...Typography.bodyMedium },
  patientDetails: { ...Typography.caption, marginTop: 2 },
  complaint: { ...Typography.caption, marginTop: 4, fontStyle: "italic" },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusText: { ...Typography.caption, fontWeight: "600" },
  emptyState: { alignItems: "center", paddingVertical: Spacing["4xl"] },
  emptyText: { ...Typography.body, marginTop: Spacing.md },
});
