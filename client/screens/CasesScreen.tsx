import React, { useState, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useDepartment } from "@/context/DepartmentContext";
import { fetchCasesFromProxy, deleteCaseFromProxy } from "@/lib/api";
import { getApiUrl } from "@/lib/query-client";
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

interface ShiftCaseItem {
  id: number;
  caseId: string;
  departmentId: number;
  shiftSessionId: number | null;
  bedNumber: string | null;
  patientName: string | null;
  patientAge: string | null;
  chiefComplaint: string | null;
  triagePriority: number | null;
  doctorUserId: string | null;
  doctorName: string | null;
  roleForShift: string | null;
  consultantReviewedBy: string | null;
  consultantReviewedAt: string | null;
  consultantNote: string | null;
  handoverStatus: string | null;
  isOwn: boolean;
}

const getPriorityColor = (level: number | null) => {
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
  const { user, token } = useAuth();
  const { shiftSession, activeShift, membership, isHOD } = useDepartment();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "discharged">("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const [reviewModal, setReviewModal] = useState<ShiftCaseItem | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);

  const isConsultantOrHOD =
    isHOD || membership?.role === "consultant" || shiftSession?.roleForShift === "consultant";

  const { data: rawCases = [], isLoading: loading, refetch, isRefetching } = useQuery<CaseItem[]>({
    queryKey: ["cases", user?.id],
    queryFn: () => fetchCasesFromProxy<CaseItem[]>(),
    refetchOnMount: true,
    enabled: !!user?.id,
  });

  const { data: shiftCasesData, refetch: refetchShift } = useQuery<{
    cases: ShiftCaseItem[];
    myRole: string;
  }>({
    queryKey: ["shift-cases", activeShift?.id],
    queryFn: async () => {
      if (!activeShift?.id || !token) return { cases: [], myRole: "resident" };
      const res = await fetch(`${getApiUrl()}/api/shifts/${activeShift.id}/cases`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { cases: [], myRole: "resident" };
      return res.json();
    },
    enabled: !!activeShift?.id && !!token,
    refetchInterval: 30000,
  });

  const shiftCases = shiftCasesData?.cases || [];

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
    Alert.alert("Delete Cases", `Permanently delete ${count} selected case${count > 1 ? "s" : ""}? This cannot be undone.`, [
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
          queryClient.setQueryData<CaseItem[]>(["cases", user?.id], (old) =>
            old ? old.filter((c) => !selectedIds.has(c.id)) : []
          );
          setBulkDeleting(false);
          exitEditMode();
        },
      },
    ]);
  };

  const handleDeleteCase = (item: CaseItem) => {
    Alert.alert("Delete Case", `Delete ${item.patient?.name || "this patient"}'s case? This cannot be undone.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setDeletingId(item.id);
          try {
            await deleteCaseFromProxy(item.id);
            queryClient.setQueryData<CaseItem[]>(["cases", user?.id], (old) =>
              old ? old.filter((c) => c.id !== item.id) : []
            );
          } catch (err: any) {
            Alert.alert("Error", err.message || "Failed to delete case");
          } finally {
            setDeletingId(null);
          }
        },
      },
    ]);
  };

  const cases = useMemo(() => {
    const sorted = [...rawCases];
    sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return sorted;
  }, [rawCases]);

  const onRefresh = async () => {
    await Promise.all([refetch(), refetchShift()]);
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

  const navigateToCase = (item: CaseItem) => {
    const patientAge = parseFloat(item.patient?.age) || 0;
    const screenName = isPediatric(patientAge) ? "PediatricCaseSheet" : "CaseSheet";
    navigation.navigate(screenName, { caseId: item.id });
  };

  const handleShiftCaseTap = (sc: ShiftCaseItem) => {
    if (sc.isOwn) {
      const patientAge = parseFloat(sc.patientAge || "0") || 0;
      const screenName = isPediatric(patientAge) ? "PediatricCaseSheet" : "CaseSheet";
      navigation.navigate(screenName, { caseId: sc.caseId });
    } else if (isConsultantOrHOD) {
      setReviewNote(sc.consultantNote || "");
      setReviewModal(sc);
    }
  };

  const submitReview = async () => {
    if (!reviewModal || !reviewNote.trim()) return;
    setSubmittingReview(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/cases/${reviewModal.caseId}/consultant-review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ note: reviewNote.trim(), departmentId: reviewModal.departmentId }),
      });
      if (res.ok) {
        refetchShift();
        setReviewModal(null);
        setReviewNote("");
      } else {
        Alert.alert("Error", "Failed to save review");
      }
    } catch {
      Alert.alert("Error", "Network error");
    } finally {
      setSubmittingReview(false);
    }
  };

  const renderShiftCase = (sc: ShiftCaseItem) => {
    const color = getPriorityColor(sc.triagePriority);
    const isReviewed = !!sc.consultantReviewedBy;
    const isHandedOver = sc.handoverStatus === "handed_over";
    return (
      <Pressable
        key={sc.id}
        style={({ pressed }) => [
          styles.shiftCard,
          { backgroundColor: sc.isOwn ? theme.primaryLight : theme.card, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={() => handleShiftCaseTap(sc)}
      >
        <View style={[styles.shiftPriorityBar, { backgroundColor: color }]} />
        <View style={{ flex: 1, paddingLeft: Spacing.sm }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.xs, flexWrap: "wrap" }}>
            {sc.bedNumber ? (
              <View style={[styles.bedBadge, { backgroundColor: theme.backgroundSecondary }]}>
                <Text style={[styles.bedText, { color: theme.textSecondary }]}>Bed {sc.bedNumber}</Text>
              </View>
            ) : null}
            {sc.triagePriority ? (
              <View style={[styles.pBadge, { backgroundColor: color + "22" }]}>
                <Text style={[styles.pText, { color }]}>P{sc.triagePriority}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.shiftPatientName, { color: theme.text }]} numberOfLines={1}>
            {sc.patientName || "Unknown patient"}
          </Text>
          {sc.chiefComplaint ? (
            <Text style={[styles.shiftComplaint, { color: theme.textMuted }]} numberOfLines={1}>
              {sc.chiefComplaint}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
            <Text style={[styles.shiftDoctor, { color: theme.textSecondary }]}>
              {sc.isOwn ? "Your case" : (sc.doctorName || "Dr. ...")}
            </Text>
            {sc.roleForShift ? (
              <View style={[styles.rolePill, { backgroundColor: sc.roleForShift === "consultant" ? "#dbeafe" : "#f3f4f6" }]}>
                <Text style={[styles.roleText, { color: sc.roleForShift === "consultant" ? "#1d4ed8" : "#374151" }]}>
                  {sc.roleForShift === "consultant" ? "Con" : "Res"}
                </Text>
              </View>
            ) : null}
            {isReviewed ? (
              <View style={[styles.reviewedBadge, { backgroundColor: "#d1fae5" }]}>
                <Feather name="check-circle" size={10} color="#065f46" />
                <Text style={styles.reviewedText}>Reviewed</Text>
              </View>
            ) : null}
            {isHandedOver ? (
              <View style={[styles.handoverBadge, { backgroundColor: "#fef3c7" }]}>
                <Text style={styles.handoverText}>Handed over</Text>
              </View>
            ) : null}
          </View>
        </View>
        {isConsultantOrHOD && !sc.isOwn ? (
          <Feather name="message-square" size={16} color={isReviewed ? "#10b981" : theme.textMuted} />
        ) : (
          <Feather name="chevron-right" size={16} color={theme.textMuted} />
        )}
      </Pressable>
    );
  };

  const renderCase = ({ item }: { item: CaseItem }) => {
    const isSelected = selectedIds.has(item.id);
    return (
      <Pressable
        style={({ pressed }) => [
          styles.caseCard,
          { backgroundColor: isSelected ? theme.primaryLight : theme.card, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={() => {
          if (editMode) toggleSelect(item.id);
          else navigateToCase(item);
        }}
        onLongPress={() => { if (!editMode) enterEditMode(item.id); }}
        delayLongPress={350}
      >
        {editMode ? (
          <View style={[styles.checkbox, { borderColor: isSelected ? theme.primary : theme.textMuted, backgroundColor: isSelected ? theme.primary : "transparent" }]}>
            {isSelected ? <Feather name="check" size={13} color="#FFFFFF" /> : null}
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
            <View style={[styles.statusBadge, { backgroundColor: item.status === "completed" || item.status === "discharged" ? theme.successLight : theme.primaryLight }]}>
              <Text style={[styles.statusText, { color: item.status === "completed" || item.status === "discharged" ? theme.success : theme.primary }]}>
                {item.status === "completed" || item.status === "discharged" ? "Done" : "Active"}
              </Text>
            </View>
            <Pressable style={styles.deleteBtn} onPress={() => handleDeleteCase(item)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
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
  const onShift = !!shiftSession && !!activeShift;

  const listHeader = (
    <View>
      <View style={[styles.header, { backgroundColor: theme.card, paddingTop: insets.top + Spacing.md }]}>
        {editMode ? (
          <View style={styles.editModeBar}>
            <Pressable onPress={exitEditMode} style={styles.editAction}>
              <Text style={[styles.editActionText, { color: theme.primary }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.selectionCount, { color: theme.text }]}>
              {selectedIds.size === 0 ? "Select items" : `${selectedIds.size} selected`}
            </Text>
            <Pressable onPress={() => (allSelected ? setSelectedIds(new Set()) : selectAll(filteredCases))} style={styles.editAction}>
              <Text style={[styles.editActionText, { color: theme.primary }]}>
                {allSelected ? "Deselect All" : "Select All"}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.titleRow}>
            <View>
              <Text style={[styles.title, { color: theme.text }]}>
                {onShift ? "My Cases" : "All Cases"}
              </Text>
              {onShift ? (
                <Text style={[styles.shiftSubtitle, { color: theme.textSecondary }]}>
                  {activeShift.name} · {shiftSession.roleForShift === "consultant" ? "Consultant" : isHOD ? "HOD" : "Resident"}
                </Text>
              ) : null}
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm }}>
              <Pressable
                onPress={() => enterEditMode()}
                disabled={rawCases.length === 0}
                style={[styles.editBtn, { backgroundColor: theme.backgroundSecondary }]}
              >
                <Text style={[styles.editBtnText, { color: rawCases.length === 0 ? theme.textMuted : theme.primary }]}>Edit</Text>
              </Pressable>
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
                  style={[styles.filterBtn, { backgroundColor: filter === f ? theme.primary : theme.backgroundSecondary }]}
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

      {onShift && isConsultantOrHOD && shiftCases.length > 0 ? (
        <View style={{ paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg }}>
          <View style={styles.sectionHeaderRow}>
            <View style={[styles.sectionDot, { backgroundColor: theme.primary }]} />
            <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
              SHIFT CASES ({shiftCases.length})
            </Text>
          </View>
          {shiftCases.map((sc) => renderShiftCase(sc))}
          <View style={[styles.sectionDivider, { backgroundColor: theme.border }]} />
        </View>
      ) : null}

      {onShift ? (
        <View style={[styles.sectionHeaderRow, { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md }]}>
          <View style={[styles.sectionDot, { backgroundColor: theme.textMuted }]} />
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            MY CASES ({filteredCases.length})
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <FlatList
        data={filteredCases}
        renderItem={renderCase}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={listHeader}
        contentContainerStyle={[styles.list, editMode && styles.listEditMode]}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Feather name="folder" size={48} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              {onShift ? "No cases documented yet this shift" : "No cases found"}
            </Text>
          </View>
        }
      />

      {editMode ? (
        <View style={[styles.deleteBar, { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.md }]}>
          <Pressable
            onPress={handleDeleteSelected}
            disabled={selectedIds.size === 0 || bulkDeleting}
            style={[styles.deleteSelectedBtn, { backgroundColor: selectedIds.size > 0 ? "#EF4444" : theme.backgroundSecondary, opacity: selectedIds.size === 0 || bulkDeleting ? 0.5 : 1 }]}
          >
            {bulkDeleting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Feather name="trash-2" size={17} color={selectedIds.size > 0 ? "#FFFFFF" : theme.textMuted} />
                <Text style={[styles.deleteSelectedText, { color: selectedIds.size > 0 ? "#FFFFFF" : theme.textMuted }]}>
                  {selectedIds.size > 0 ? `Delete ${selectedIds.size} Case${selectedIds.size > 1 ? "s" : ""}` : "Select cases to delete"}
                </Text>
              </>
            )}
          </Pressable>
        </View>
      ) : null}

      <Modal visible={!!reviewModal} transparent animationType="slide" onRequestClose={() => setReviewModal(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
          <Pressable style={styles.modalOverlay} onPress={() => setReviewModal(null)}>
            <Pressable style={[styles.reviewSheet, { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.lg }]} onPress={() => {}}>
              {reviewModal ? (
                <>
                  <View style={styles.reviewHandle} />
                  <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.md }}>
                    <View style={[styles.shiftPriorityBig, { backgroundColor: getPriorityColor(reviewModal.triagePriority) }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.reviewPatient, { color: theme.text }]}>
                        {reviewModal.patientName || "Unknown patient"}
                      </Text>
                      {reviewModal.chiefComplaint ? (
                        <Text style={[styles.reviewComplaint, { color: theme.textSecondary }]}>
                          {reviewModal.chiefComplaint}
                        </Text>
                      ) : null}
                    </View>
                    {reviewModal.triagePriority ? (
                      <View style={[styles.pBadge, { backgroundColor: getPriorityColor(reviewModal.triagePriority) + "22" }]}>
                        <Text style={[styles.pText, { color: getPriorityColor(reviewModal.triagePriority) }]}>
                          P{reviewModal.triagePriority}
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={[styles.reviewMeta, { backgroundColor: theme.backgroundSecondary }]}>
                    {reviewModal.bedNumber ? (
                      <Text style={[styles.reviewMetaText, { color: theme.textSecondary }]}>Bed {reviewModal.bedNumber}</Text>
                    ) : null}
                    <Text style={[styles.reviewMetaText, { color: theme.textSecondary }]}>
                      Documented by {reviewModal.doctorName || reviewModal.doctorUserId || "Unknown"}
                    </Text>
                    {reviewModal.patientAge ? (
                      <Text style={[styles.reviewMetaText, { color: theme.textSecondary }]}>Age: {reviewModal.patientAge} yrs</Text>
                    ) : null}
                  </View>

                  {reviewModal.consultantNote ? (
                    <View style={[styles.existingNote, { backgroundColor: "#d1fae5" }]}>
                      <Text style={styles.existingNoteLabel}>Previous review note:</Text>
                      <Text style={styles.existingNoteText}>{reviewModal.consultantNote}</Text>
                    </View>
                  ) : null}

                  <Text style={[styles.reviewLabel, { color: theme.text }]}>Consultant Review Note</Text>
                  <TextInput
                    style={[styles.reviewInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
                    placeholder="Add your clinical review, recommendations, or escalation notes..."
                    placeholderTextColor={theme.textMuted}
                    value={reviewNote}
                    onChangeText={setReviewNote}
                    multiline
                    numberOfLines={4}
                    textAlignVertical="top"
                  />
                  <Pressable
                    style={[styles.reviewSubmit, { backgroundColor: reviewNote.trim() ? theme.primary : theme.backgroundSecondary, opacity: submittingReview ? 0.7 : 1 }]}
                    onPress={submitReview}
                    disabled={!reviewNote.trim() || submittingReview}
                  >
                    {submittingReview ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={[styles.reviewSubmitText, { color: reviewNote.trim() ? "#FFFFFF" : theme.textMuted }]}>
                        Save Review
                      </Text>
                    )}
                  </Pressable>
                </>
              ) : null}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>
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
  titleRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  title: { ...Typography.h2 },
  shiftSubtitle: { fontSize: 12, marginTop: 2 },
  editBtn: { paddingHorizontal: Spacing.md, paddingVertical: 6, borderRadius: BorderRadius.md },
  editBtnText: { fontSize: 14, fontWeight: "600" },
  editModeBar: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 2 },
  editAction: { paddingVertical: 4 },
  editActionText: { fontSize: 14, fontWeight: "600" },
  selectionCount: { ...Typography.bodyMedium, textAlign: "center" },
  searchContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: Spacing.md, height: 44, borderRadius: BorderRadius.md, gap: Spacing.sm },
  searchInput: { flex: 1, ...Typography.body },
  filterRow: { flexDirection: "row", gap: Spacing.sm },
  filterBtn: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: BorderRadius.full },
  filterText: { ...Typography.label },

  sectionHeaderRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.sm },
  sectionDot: { width: 6, height: 6, borderRadius: 3 },
  sectionLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8 },
  sectionDivider: { height: 1, marginVertical: Spacing.lg },

  shiftCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    overflow: "hidden",
  },
  shiftPriorityBar: { width: 4, height: "100%", borderRadius: 2, position: "absolute", left: 0, top: 0, bottom: 0 },
  shiftPriorityBig: { width: 6, height: 40, borderRadius: 3 },
  bedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  bedText: { fontSize: 11, fontWeight: "600" },
  pBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  pText: { fontSize: 11, fontWeight: "700" },
  shiftPatientName: { fontSize: 15, fontWeight: "700", marginTop: 4 },
  shiftComplaint: { fontSize: 12, marginTop: 2, fontStyle: "italic" },
  shiftDoctor: { fontSize: 12 },
  rolePill: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  roleText: { fontSize: 10, fontWeight: "700" },
  reviewedBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  reviewedText: { fontSize: 10, fontWeight: "700", color: "#065f46" },
  handoverBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 },
  handoverText: { fontSize: 10, fontWeight: "700", color: "#92400e" },

  list: { padding: Spacing.lg, paddingBottom: 120, paddingTop: 0 },
  listEditMode: { paddingBottom: 140 },
  caseCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  checkbox: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, alignItems: "center", justifyContent: "center", flexShrink: 0 },
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
  deleteBar: { position: "absolute", bottom: 0, left: 0, right: 0, paddingHorizontal: Spacing.lg, paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: "rgba(0,0,0,0.07)" },
  deleteSelectedBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: Spacing.sm, paddingVertical: Spacing.md, borderRadius: BorderRadius.md },
  deleteSelectedText: { fontSize: 15, fontWeight: "600" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  reviewSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.md },
  reviewHandle: { width: 36, height: 4, backgroundColor: "#d1d5db", borderRadius: 2, alignSelf: "center", marginBottom: Spacing.sm },
  reviewPatient: { fontSize: 17, fontWeight: "700" },
  reviewComplaint: { fontSize: 13, marginTop: 2 },
  reviewMeta: { borderRadius: BorderRadius.md, padding: Spacing.md, gap: 4 },
  reviewMetaText: { fontSize: 13 },
  existingNote: { borderRadius: BorderRadius.md, padding: Spacing.md },
  existingNoteLabel: { fontSize: 11, fontWeight: "700", color: "#065f46", marginBottom: 4 },
  existingNoteText: { fontSize: 13, color: "#065f46" },
  reviewLabel: { fontSize: 14, fontWeight: "600" },
  reviewInput: { borderWidth: 1, borderRadius: BorderRadius.md, padding: Spacing.md, fontSize: 14, minHeight: 100 },
  reviewSubmit: { borderRadius: BorderRadius.md, paddingVertical: Spacing.md, alignItems: "center" },
  reviewSubmitText: { fontSize: 15, fontWeight: "700" },
});
