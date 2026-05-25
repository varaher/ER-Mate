import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  SectionList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { fetchCasesFromProxy, deleteCaseFromProxy } from "@/lib/api";
import { isPediatric } from "@/lib/pediatricVitals";
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
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "discharged">("all");
  const [viewMode, setViewMode] = useState<"list" | "grouped">("list");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

  const { data: rawCases = [], isLoading: loading, refetch, isRefetching } = useQuery<CaseItem[]>({
    queryKey: ["cases", user?.id],
    queryFn: () => fetchCasesFromProxy<CaseItem[]>(),
    refetchOnMount: true,
    enabled: !!user?.id,
  });

  const handleClearAll = () => {
    const count = rawCases.length;
    if (count === 0) {
      Alert.alert("No Cases", "There are no cases to delete.");
      return;
    }
    Alert.alert(
      "Clear All Cases",
      `This will permanently delete all ${count} cases. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Delete All ${count}`,
          style: "destructive",
          onPress: async () => {
            setClearingAll(true);
            const ids = rawCases.map((c) => c.id).filter(Boolean);
            let deleted = 0;
            for (const id of ids) {
              try { await deleteCaseFromProxy(id); deleted++; } catch {}
            }
            queryClient.setQueryData(["cases", user?.id], []);
            setClearingAll(false);
            Alert.alert("Done", `${deleted} of ${count} cases deleted.`);
          },
        },
      ]
    );
  };

  const handleDeleteCase = (item: CaseItem) => {
    Alert.alert(
      "Delete Case",
      `Delete ${item.patient?.name || "this patient"}'s case? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setDeletingId(item.id);
            try {
              await deleteCaseFromProxy(item.id);
              queryClient.setQueryData<CaseItem[]>(
                ["cases", user?.id],
                (old) => (old ? old.filter((c) => c.id !== item.id) : [])
              );
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete case");
            } finally {
              setDeletingId(null);
            }
          },
        },
      ]
    );
  };

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

  const groupedSections = useMemo(() => {
    if (viewMode !== "grouped") return [];
    const groups: Record<string, CaseItem[]> = {};
    filteredCases.forEach((c) => {
      const key = c.presenting_complaint?.text?.trim() || "No Complaint Recorded";
      if (!groups[key]) groups[key] = [];
      groups[key].push(c);
    });
    return Object.entries(groups)
      .sort((a, b) => b[1].length - a[1].length)
      .map(([title, data]) => ({ title, data }));
  }, [filteredCases, viewMode]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const navigateToCase = (item: CaseItem) => {
    const patientAge = parseFloat(item.patient?.age) || 0;
    const screenName = isPediatric(patientAge) ? "PediatricCaseSheet" : "CaseSheet";
    navigation.navigate(screenName, { caseId: item.id });
  };

  const renderCase = ({ item }: { item: CaseItem }) => (
    <Pressable
      style={({ pressed }) => [
        styles.caseCard,
        { backgroundColor: theme.card, opacity: pressed ? 0.9 : 1 },
      ]}
      onPress={() => navigateToCase(item)}
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
      <Pressable
        style={styles.deleteBtn}
        onPress={() => handleDeleteCase(item)}
        hitSlop={8}
      >
        {deletingId === item.id ? (
          <ActivityIndicator size="small" color={theme.error || "#EF4444"} />
        ) : (
          <Feather name="trash-2" size={16} color={theme.error || "#EF4444"} />
        )}
      </Pressable>
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
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]}>All Cases</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
            <Pressable
              onPress={handleClearAll}
              disabled={clearingAll || rawCases.length === 0}
              style={[styles.clearAllBtn, { backgroundColor: theme.backgroundSecondary }]}
            >
              <Feather name="trash-2" size={15} color={rawCases.length === 0 ? theme.textMuted : "#ef4444"} />
              <Text style={[styles.clearAllText, { color: rawCases.length === 0 ? theme.textMuted : "#ef4444" }]}>
                {clearingAll ? "Deleting..." : "Clear All"}
              </Text>
            </Pressable>
            <View style={[styles.viewToggle, { backgroundColor: theme.backgroundSecondary }]}>
              <Pressable
                style={[styles.toggleBtn, viewMode === "list" && { backgroundColor: theme.card }]}
                onPress={() => setViewMode("list")}
              >
                <Feather name="list" size={16} color={viewMode === "list" ? theme.primary : theme.textMuted} />
              </Pressable>
              <Pressable
                style={[styles.toggleBtn, viewMode === "grouped" && { backgroundColor: theme.card }]}
                onPress={() => setViewMode("grouped")}
              >
                <Feather name="tag" size={16} color={viewMode === "grouped" ? theme.primary : theme.textMuted} />
              </Pressable>
            </View>
          </View>
        </View>
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

      {viewMode === "grouped" ? (
        <SectionList
          sections={groupedSections}
          keyExtractor={(item) => item.id}
          renderItem={renderCase}
          renderSectionHeader={({ section }) => (
            <View style={[styles.sectionHeader, { backgroundColor: theme.backgroundDefault }]}>
              <View style={[styles.sectionDot, { backgroundColor: theme.primary }]} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
              <Text style={[styles.sectionCount, { color: theme.textMuted }]}>
                {section.data.length}
              </Text>
            </View>
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="folder" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No cases found</Text>
            </View>
          }
          stickySectionHeadersEnabled={true}
        />
      ) : (
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
      )}
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
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { ...Typography.h2 },
  viewToggle: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    padding: 3,
    gap: 2,
  },
  toggleBtn: {
    padding: 6,
    borderRadius: BorderRadius.sm,
  },
  clearAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  clearAllText: {
    fontSize: Typography.xs,
    fontWeight: "600",
  },
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  sectionDot: { width: 8, height: 8, borderRadius: 4 },
  sectionTitle: { flex: 1, ...Typography.bodyMedium, fontSize: 13 },
  sectionCount: {
    fontSize: 12,
    fontWeight: "600",
    minWidth: 22,
    textAlign: "center" as const,
  },
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
  deleteBtn: { padding: 6, marginLeft: 4 },
  emptyState: { alignItems: "center", paddingVertical: Spacing["4xl"] },
  emptyText: { ...Typography.body, marginTop: Spacing.md },
});
