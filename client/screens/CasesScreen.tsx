import React, { useState, useMemo, useCallback } from "react";
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

  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const { data: rawCases = [], isLoading: loading, refetch, isRefetching } = useQuery<CaseItem[]>({
    queryKey: ["cases", user?.id],
    queryFn: () => fetchCasesFromProxy<CaseItem[]>(),
    refetchOnMount: true,
    enabled: !!user?.id,
  });

  const enterEditMode = useCallback((preselectId?: string) => {
    setEditMode(true);
    setSelectedIds(preselectId ? new Set([preselectId]) : new Set());
  }, []);

  const exitEditMode = useCallback(() => {
    setEditMode(false);
    setSelectedIds(new Set());
  }, []);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback((cases: CaseItem[]) => {
    setSelectedIds(new Set(cases.map((c) => c.id)));
  }, []);

  const handleDeleteSelected = () => {
    const count = selectedIds.size;
    if (count === 0) return;
    Alert.alert(
      "Delete Cases",
      `Permanently delete ${count} selected case${count > 1 ? "s" : ""}? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Delete ${count}`,
          style: "destructive",
          onPress: async () => {
            setBulkDeleting(true);
            const ids = Array.from(selectedIds);
            for (const id of ids) {
              try { await deleteCaseFromProxy(id); } catch {}
            }
            queryClient.setQueryData<CaseItem[]>(
              ["cases", user?.id],
              (old) => (old ? old.filter((c) => !selectedIds.has(c.id)) : [])
            );
            setBulkDeleting(false);
            exitEditMode();
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

  const renderCase = ({ item }: { item: CaseItem }) => {
    const isSelected = selectedIds.has(item.id);

    return (
      <Pressable
        style={({ pressed }) => [
          styles.caseCard,
          {
            backgroundColor: isSelected
              ? theme.primaryLight
              : theme.card,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
        onPress={() => {
          if (editMode) {
            toggleSelect(item.id);
          } else {
            navigateToCase(item);
          }
        }}
        onLongPress={() => {
          if (!editMode) enterEditMode(item.id);
        }}
        delayLongPress={350}
      >
        {editMode ? (
          <View style={[
            styles.checkbox,
            {
              borderColor: isSelected ? theme.primary : theme.textMuted,
              backgroundColor: isSelected ? theme.primary : "transparent",
            },
          ]}>
            {isSelected ? (
              <Feather name="check" size={13} color="#FFFFFF" />
            ) : null}
          </View>
        ) : (
          <View style={[styles.priorityDot, { backgroundColor: getPriorityColor(item.triage_priority) }]} />
        )}

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

        {editMode ? null : (
          <>
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
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              {deletingId === item.id ? (
                <ActivityIndicator size="small" color={theme.danger || "#EF4444"} />
              ) : (
                <Feather name="trash-2" size={16} color={theme.danger || "#EF4444"} />
              )}
            </Pressable>
          </>
        )}
      </Pressable>
    );
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  const allSelected = filteredCases.length > 0 && filteredCases.every((c) => selectedIds.has(c.id));

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.header, { backgroundColor: theme.card, paddingTop: insets.top + Spacing.md }]}>

        {editMode ? (
          <View style={styles.editModeBar}>
            <Pressable onPress={exitEditMode} style={styles.editAction}>
              <Text style={[styles.editActionText, { color: theme.primary }]}>Cancel</Text>
            </Pressable>

            <Text style={[styles.selectionCount, { color: theme.text }]}>
              {selectedIds.size === 0
                ? "Select items"
                : `${selectedIds.size} selected`}
            </Text>

            <Pressable
              onPress={() => (allSelected ? setSelectedIds(new Set()) : selectAll(filteredCases))}
              style={styles.editAction}
            >
              <Text style={[styles.editActionText, { color: theme.primary }]}>
                {allSelected ? "Deselect All" : "Select All"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]}>All Cases</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
              <Pressable
                onPress={() => enterEditMode()}
                disabled={rawCases.length === 0}
                style={[styles.editBtn, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Text style={[styles.editBtnText, { color: rawCases.length === 0 ? theme.textMuted : theme.primary }]}>
                  Edit
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
        )}

        {!editMode && (
          <>
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
          </>
        )}
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
          contentContainerStyle={[styles.list, editMode && styles.listEditMode]}
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
          contentContainerStyle={[styles.list, editMode && styles.listEditMode]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Feather name="folder" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No cases found</Text>
            </View>
          }
        />
      )}

      {editMode ? (
        <View style={[styles.deleteBar, { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.md }]}>
          <Pressable
            onPress={handleDeleteSelected}
            disabled={selectedIds.size === 0 || bulkDeleting}
            style={[
              styles.deleteSelectedBtn,
              {
                backgroundColor: selectedIds.size > 0 ? "#EF4444" : theme.backgroundSecondary,
                opacity: selectedIds.size === 0 || bulkDeleting ? 0.5 : 1,
              },
            ]}
          >
            {bulkDeleting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather
                  name="trash-2"
                  size={17}
                  color={selectedIds.size > 0 ? "#FFFFFF" : theme.textMuted}
                />
                <Text
                  style={[
                    styles.deleteSelectedText,
                    { color: selectedIds.size > 0 ? "#FFFFFF" : theme.textMuted },
                  ]}
                >
                  {selectedIds.size > 0
                    ? `Delete ${selectedIds.size} Case${selectedIds.size > 1 ? "s" : ""}`
                    : "Select cases to delete"}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}
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
  editBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  editBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
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
  editModeBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 2,
  },
  editAction: {
    paddingVertical: 4,
  },
  editActionText: {
    fontSize: 14,
    fontWeight: "600",
  },
  selectionCount: {
    ...Typography.bodyMedium,
    textAlign: "center",
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
  listEditMode: { paddingBottom: 140 },
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
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  priorityDot: { width: 12, height: 12, borderRadius: BorderRadius.full, flexShrink: 0 },
  caseInfo: { flex: 1 },
  patientName: { ...Typography.bodyMedium },
  patientDetails: { ...Typography.caption, marginTop: 2 },
  complaint: { ...Typography.caption, marginTop: 4, fontStyle: "italic" },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusText: { ...Typography.caption, fontWeight: "600" },
  deleteBtn: { padding: 6 },
  emptyState: { alignItems: "center", paddingVertical: Spacing["4xl"] },
  emptyText: { ...Typography.body, marginTop: Spacing.md },
  deleteBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.07)",
  },
  deleteSelectedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  deleteSelectedText: {
    fontSize: 15,
    fontWeight: "600",
  },
});
