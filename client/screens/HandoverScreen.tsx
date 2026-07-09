import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as FileSystem from "expo-file-system/legacy";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useDepartment } from "@/context/DepartmentContext";
import { fetchCasesFromProxy, fetchFromApi } from "@/lib/api";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, TriageColors } from "@/constants/theme";

interface CaseSummary {
  id: string;
  patient: { name: string; age: string; sex: string };
  presenting_complaint?: { text: string };
  triage_priority: number;
  status: string;
  created_at: string;
}

interface HandoverEntry {
  caseId: string;
  selected: boolean;
  bed: string;
  pendingPlan: string;
}

const PRIORITY_COLORS: Record<number, string> = {
  1: TriageColors.red,
  2: TriageColors.orange,
  3: TriageColors.yellow,
  4: TriageColors.green,
  5: TriageColors.blue,
};

const PRIORITY_LABELS: Record<number, string> = {
  1: "P1 · Critical",
  2: "P2 · Urgent",
  3: "P3 · Semi-urgent",
  4: "P4 · Non-urgent",
  5: "P5 · Routine",
};

export default function HandoverScreen() {
  const { theme, isDark } = useTheme();
  const { user } = useAuth();
  const { department } = useDepartment();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [entries, setEntries] = useState<HandoverEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [receivingDoctor, setReceivingDoctor] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [printingCases, setPrintingCases] = useState<Set<string>>(new Set());
  const [handoverReadyCases, setHandoverReadyCases] = useState<Set<string>>(new Set());
  const [tooltipCaseId, setTooltipCaseId] = useState<string | null>(null);
  const tooltipTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    };
  }, []);

  const LIVE_REFRESH_MS = 30000;

  useFocusEffect(
    useCallback(() => {
      loadCases();
      const interval = setInterval(() => {
        loadCases({ silent: true });
      }, LIVE_REFRESH_MS);
      return () => clearInterval(interval);
    }, [showAll])
  );

  const fetchHandoverStatus = async (caseIds: string[]) => {
    if (caseIds.length === 0) return;
    try {
      const token = await AsyncStorage.getItem("token");
      const url = new URL(
        `/api/cases/handover-status?ids=${encodeURIComponent(caseIds.join(","))}`,
        getApiUrl()
      ).href;
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) {
        const data: { ready: string[] } = await res.json();
        setHandoverReadyCases(new Set(data.ready));
      }
    } catch {}
  };

  const loadCases = async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent ?? false;
    if (!silent) setLoading(true);
    try {
      const all = await fetchCasesFromProxy<CaseSummary[]>();
      let filtered: CaseSummary[] = all;

      if (!showAll) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        filtered = all.filter((c) => {
          const d = new Date(c.created_at);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === today.getTime();
        });
      }

      filtered.sort((a, b) => {
        if (a.triage_priority !== b.triage_priority) return a.triage_priority - b.triage_priority;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      setCases(filtered);
      setEntries((prevEntries) => {
        const prevByCase = new Map(prevEntries.map((e) => [e.caseId, e]));
        return filtered.map((c) => {
          const existing = prevByCase.get(c.id);
          return existing || { caseId: c.id, selected: false, bed: "", pendingPlan: "" };
        });
      });
      setLastUpdated(new Date());
      fetchHandoverStatus(filtered.map((c) => c.id));
    } catch {
      if (!silent) Alert.alert("Error", "Could not load cases. Please try again.");
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const toggleSelect = (index: number) => {
    setEntries((prev) =>
      prev.map((e, i) => (i === index ? { ...e, selected: !e.selected } : e))
    );
  };

  const updateBed = (index: number, bed: string) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, bed } : e)));
  };

  const updatePending = (index: number, pendingPlan: string) => {
    setEntries((prev) => prev.map((e, i) => (i === index ? { ...e, pendingPlan } : e)));
  };

  const selectAll = () => {
    setEntries((prev) => prev.map((e) => ({ ...e, selected: true })));
  };

  const deselectAll = () => {
    setEntries((prev) => prev.map((e) => ({ ...e, selected: false })));
  };

  const selectedCount = entries.filter((e) => e.selected).length;

  const generateHandover = async () => {
    if (selectedCount === 0) {
      Alert.alert("No cases selected", "Tick at least one case to include in the handover sheet.");
      return;
    }

    setGenerating(true);
    try {
      const selectedIndices = entries
        .map((e, i) => (e.selected ? i : -1))
        .filter((i) => i >= 0);

      const fullCases = await Promise.all(
        selectedIndices.map(async (i) => {
          try {
            const caseData = await fetchFromApi<any>(`/cases/${cases[i].id}`);
            return {
              caseData: caseData || cases[i],
              bed: entries[i].bed,
              pendingPlan: entries[i].pendingPlan,
            };
          } catch {
            return {
              caseData: cases[i],
              bed: entries[i].bed,
              pendingPlan: entries[i].pendingPlan,
            };
          }
        })
      );

      const now = new Date();
      const payload = {
        cases: fullCases,
        doctorName: (user as any)?.name || (user as any)?.fullName || user?.email || "Doctor",
        receivingDoctor: receivingDoctor.trim() || undefined,
        shiftDate: now.toLocaleDateString("en-IN", { day: "2-digit", month: "2-digit", year: "numeric" }),
        shiftTime: now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
        hospitalName: department?.hospitalName || undefined,
        departmentName: department?.name || undefined,
      };

      const url = new URL("/api/export/handover-pdf", getApiUrl()).href;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      if (Platform.OS === "web") {
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = `handover_${now.toISOString().slice(0, 10)}.pdf`;
        a.click();
        URL.revokeObjectURL(objectUrl);
      } else {
        const bytes = await res.arrayBuffer();
        const filename = `handover_${now.toISOString().slice(0, 10)}.pdf`;
        const fileUri = (FileSystem.documentDirectory || "") + filename;
        const base64 = Buffer.from(bytes).toString("base64");
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        navigation.navigate("PdfPreview", { fileUri, filename });
      }
    } catch (err: any) {
      Alert.alert("Export failed", err?.message || "Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  const printCasePdf = async (index: number) => {
    const c = cases[index];
    if (!c) return;

    setPrintingCases((prev) => new Set(prev).add(c.id));
    try {
      let fullCase: any = c;
      try {
        fullCase = await fetchFromApi<any>(`/cases/${c.id}`);
      } catch {}

      const rawMeds: any[] =
        fullCase?.treatment?.medications ||
        fullCase?.drugs_administered ||
        [];
      const medications = rawMeds
        .map((m: any) => m.name || m.drug || (typeof m === "string" ? m : null))
        .filter(Boolean)
        .join(", ") || undefined;

      const payload = {
        patientName: c.patient?.name,
        patientAge: c.patient?.age,
        patientSex: c.patient?.sex,
        arrivalTime: c.created_at,
        chiefComplaint: c.presenting_complaint?.text,
        medications,
        handingDoctor:
          (user as any)?.name ||
          (user as any)?.fullName ||
          user?.email ||
          "Doctor",
        receivingDoctor: receivingDoctor.trim() || undefined,
      };

      const token = await AsyncStorage.getItem("token");
      const url = new URL(`/api/cases/${c.id}/handover-pdf`, getApiUrl()).href;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      if (res.status === 400) {
        Alert.alert(
          "No handover note",
          "This case doesn't have a shift handover addendum yet. Open the case timeline and add one before printing."
        );
        return;
      }

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const safeName = (c.patient?.name || "patient").replace(/\s+/g, "_");
      const filename = `handover_${safeName}.pdf`;

      if (Platform.OS === "web") {
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(objectUrl);
      } else {
        const bytes = await res.arrayBuffer();
        const fileUri = (FileSystem.documentDirectory || "") + filename;
        const base64 = Buffer.from(bytes).toString("base64");
        await FileSystem.writeAsStringAsync(fileUri, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        navigation.navigate("PdfPreview", {
          fileUri,
          filename,
          patientName: c.patient?.name || undefined,
        });
      }
    } catch (err: any) {
      Alert.alert("Print failed", err?.message || "Please try again.");
    } finally {
      setPrintingCases((prev) => {
        const next = new Set(prev);
        next.delete(c.id);
        return next;
      });
    }
  };

  const priorityColor = (p: number) => PRIORITY_COLORS[p] || TriageColors.gray;

  const statusText = (s: string, p: number) => {
    if (s === "completed" || s === "discharged") return "Discharged";
    if (p === 1) return "Critical";
    if (p === 2) return "Urgent";
    return "In Progress";
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? "#0D1117" : "#F5F6F8" }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + 8,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 110,
        }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.infoCard, { backgroundColor: isDark ? "#161B22" : "#FFFFFF" }]}>
          <View style={styles.infoRow}>
            <Feather name="info" size={14} color={theme.primary} />
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              Select cases, add bed numbers and pending notes, then generate the PDF.
            </Text>
          </View>

          <View style={styles.liveRow}>
            <View style={styles.liveDot} />
            <Text style={[styles.liveText, { color: theme.textMuted }]}>
              Live · auto-refreshes every 30s
              {lastUpdated ? ` · updated ${lastUpdated.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}` : ""}
            </Text>
          </View>

          <View style={[styles.receivingRow, { borderTopColor: isDark ? "#2D333B" : "#F3F4F6" }]}>
            <Feather name="user" size={13} color={theme.textMuted} style={{ marginTop: 2 }} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Receiving Doctor</Text>
              <TextInput
                style={[styles.receivingInput, {
                  color: isDark ? "#FFFFFF" : "#0D1117",
                  backgroundColor: isDark ? "#0D1117" : "#F9FAFB",
                  borderColor: isDark ? "#2D333B" : "#E5E7EB",
                }]}
                placeholder="Dr. name of incoming doctor…"
                placeholderTextColor={theme.textMuted}
                value={receivingDoctor}
                onChangeText={setReceivingDoctor}
              />
            </View>
          </View>

          <View style={styles.filterRow}>
            <Pressable
              onPress={() => setShowAll((v) => !v)}
              style={[styles.filterChip, { borderColor: showAll ? theme.primary : (isDark ? "#2D333B" : "#E5E7EB") }]}
            >
              <Feather name={showAll ? "calendar" : "clock"} size={13} color={showAll ? theme.primary : theme.textMuted} />
              <Text style={[styles.filterChipText, { color: showAll ? theme.primary : theme.textMuted }]}>
                {showAll ? "All active cases" : "Today only"}
              </Text>
            </Pressable>
            {cases.length > 0 && (
              <Pressable
                onPress={selectedCount === cases.length ? deselectAll : selectAll}
                style={[styles.filterChip, { borderColor: isDark ? "#2D333B" : "#E5E7EB" }]}
              >
                <Feather name={selectedCount === cases.length ? "square" : "check-square"} size={13} color={theme.textMuted} />
                <Text style={[styles.filterChipText, { color: theme.textMuted }]}>
                  {selectedCount === cases.length ? "Deselect all" : "Select all"}
                </Text>
              </Pressable>
            )}
          </View>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={theme.primary} />
            <Text style={[styles.loadingText, { color: theme.textMuted }]}>Loading cases…</Text>
          </View>
        ) : cases.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: isDark ? "#161B22" : "#FFFFFF" }]}>
            <Feather name="users" size={40} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No cases found</Text>
            <Text style={[styles.emptySub, { color: theme.textMuted }]}>
              {showAll ? "No active cases." : "No cases today. Tap 'Today only' to switch to all active."}
            </Text>
          </View>
        ) : (
          cases.map((c, i) => {
            const entry = entries[i];
            const isSelected = entry?.selected ?? false;
            const pColor = priorityColor(c.triage_priority);

            return (
              <Pressable
                key={c.id}
                onPress={() => toggleSelect(i)}
                style={[
                  styles.caseCard,
                  {
                    backgroundColor: isDark ? "#161B22" : "#FFFFFF",
                    borderColor: isSelected ? theme.primary : (isDark ? "#2D333B" : "#F0F0F0"),
                    borderWidth: isSelected ? 2 : 1.5,
                  },
                ]}
              >
                <View style={[styles.priorityBar, { backgroundColor: pColor }]} />

                <View style={styles.caseBody}>
                  <View style={styles.caseTop}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.patientName, { color: isDark ? "#FFFFFF" : "#0D1117" }]}>
                        {c.patient?.name || "Unknown"}
                      </Text>
                      <Text style={[styles.patientMeta, { color: theme.textMuted }]}>
                        {[c.patient?.age ? `${c.patient.age}y` : null, c.patient?.sex].filter(Boolean).join(" · ")}
                        {c.presenting_complaint?.text ? ` · ${c.presenting_complaint.text}` : ""}
                      </Text>
                    </View>
                    <View style={styles.checkboxArea}>
                      <Pressable
                        onPress={() => {
                          if (handoverReadyCases.has(c.id)) {
                            printCasePdf(i);
                          } else {
                            if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
                            setTooltipCaseId(c.id);
                            tooltipTimerRef.current = setTimeout(() => setTooltipCaseId(null), 3000);
                          }
                        }}
                        style={styles.printIconBtn}
                        hitSlop={8}
                      >
                        {printingCases.has(c.id) ? (
                          <ActivityIndicator size="small" color={theme.primary} />
                        ) : (
                          <Feather
                            name="printer"
                            size={16}
                            color={handoverReadyCases.has(c.id) ? theme.primary : (isDark ? "#3D4451" : "#CBD5E1")}
                          />
                        )}
                      </Pressable>
                      <View style={[
                        styles.checkbox,
                        {
                          backgroundColor: isSelected ? theme.primary : "transparent",
                          borderColor: isSelected ? theme.primary : (isDark ? "#4B5563" : "#D1D5DB"),
                        },
                      ]}>
                        {isSelected && <Feather name="check" size={12} color="#FFFFFF" />}
                      </View>
                    </View>
                  </View>

                  <View style={styles.badgeRow}>
                    <View style={[styles.priorityBadge, { backgroundColor: `${pColor}18` }]}>
                      <Text style={[styles.priorityBadgeText, { color: pColor }]}>
                        {PRIORITY_LABELS[c.triage_priority] || `P${c.triage_priority}`}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, {
                      backgroundColor: (c.status === "completed" || c.status === "discharged")
                        ? "#F0FDF6" : isDark ? "#1A2332" : "#EFF6FF",
                    }]}>
                      <Text style={[styles.statusBadgeText, {
                        color: (c.status === "completed" || c.status === "discharged")
                          ? TriageColors.green : TriageColors.blue,
                      }]}>
                        {statusText(c.status, c.triage_priority)}
                      </Text>
                    </View>
                  </View>

                  {tooltipCaseId === c.id && (
                    <View style={[styles.noHandoverBanner, {
                      backgroundColor: isDark ? "#1E2530" : "#F1F5F9",
                      borderColor: isDark ? "#2D3748" : "#CBD5E1",
                    }]}>
                      <Feather name="info" size={12} color={theme.textMuted} style={{ marginTop: 1 }} />
                      <Text style={[styles.noHandoverBannerText, { color: theme.textMuted }]}>
                        No handover note yet. Open the case timeline and add one first.
                      </Text>
                    </View>
                  )}

                  {isSelected && (
                    <Pressable onPress={() => {}} style={styles.handoverInputs}>
                      <View style={[styles.inputRow, { borderTopColor: isDark ? "#2D333B" : "#F3F4F6" }]}>
                        <Feather name="home" size={13} color={theme.textMuted} style={{ marginTop: 10 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Bed Number</Text>
                          <TextInput
                            style={[styles.bedInput, {
                              color: isDark ? "#FFFFFF" : "#0D1117",
                              backgroundColor: isDark ? "#0D1117" : "#F9FAFB",
                              borderColor: isDark ? "#2D333B" : "#E5E7EB",
                            }]}
                            placeholder="e.g. Bed 10"
                            placeholderTextColor={theme.textMuted}
                            value={entry.bed}
                            onChangeText={(t) => updateBed(i, t)}
                          />
                        </View>
                      </View>
                      <View style={styles.inputRow}>
                        <Feather name="clipboard" size={13} color={theme.textMuted} style={{ marginTop: 10 }} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.inputLabel, { color: theme.textMuted }]}>Pending / Plan</Text>
                          <TextInput
                            style={[styles.planInput, {
                              color: isDark ? "#FFFFFF" : "#0D1117",
                              backgroundColor: isDark ? "#0D1117" : "#F9FAFB",
                              borderColor: isDark ? "#2D333B" : "#E5E7EB",
                            }]}
                            placeholder="Outstanding tasks, awaited results, follow-up plan…"
                            placeholderTextColor={theme.textMuted}
                            value={entry.pendingPlan}
                            onChangeText={(t) => updatePending(i, t)}
                            multiline
                            numberOfLines={3}
                            textAlignVertical="top"
                          />
                        </View>
                      </View>
                    </Pressable>
                  )}
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>

      <View style={[styles.stickyBottom, {
        backgroundColor: isDark ? "rgba(13,17,23,0.97)" : "rgba(245,246,248,0.97)",
        borderTopColor: isDark ? "#2D333B" : "rgba(0,0,0,0.07)",
        paddingBottom: Math.max(insets.bottom, 16),
      }]}>
        <Pressable
          style={({ pressed }) => [
            styles.generateBtn,
            {
              backgroundColor: selectedCount > 0 ? theme.primary : (isDark ? "#2D333B" : "#E5E7EB"),
              opacity: (pressed && selectedCount > 0) || generating ? 0.88 : 1,
              shadowColor: selectedCount > 0 ? theme.primary : "transparent",
              shadowOpacity: 0.35,
              shadowRadius: 14,
              shadowOffset: { width: 0, height: 5 },
              elevation: selectedCount > 0 ? 6 : 0,
            },
          ]}
          onPress={generateHandover}
          disabled={selectedCount === 0 || generating}
        >
          {generating ? (
            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
          ) : (
            <Feather
              name="download"
              size={17}
              color={selectedCount > 0 ? "#FFFFFF" : (isDark ? "#6B7280" : "#9CA3AF")}
              style={{ marginRight: 8 }}
            />
          )}
          <Text style={[styles.generateBtnText, {
            color: selectedCount > 0 ? "#FFFFFF" : (isDark ? "#6B7280" : "#9CA3AF"),
          }]}>
            {generating
              ? "Generating PDF…"
              : selectedCount > 0
              ? `Generate Handover Sheet (${selectedCount} case${selectedCount > 1 ? "s" : ""})`
              : "Select cases above"}
          </Text>
        </Pressable>
        <Text style={[styles.bottomNote, { color: theme.textMuted }]}>
          Landscape PDF · Includes all clinical data from case sheets
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  infoCard: {
    borderRadius: 14, padding: 14, marginBottom: 14,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  infoRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 12 },
  infoText: { fontSize: 13, lineHeight: 19, flex: 1 },
  liveRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#22C55E" },
  liveText: { fontSize: 11 },
  filterRow: { flexDirection: "row", gap: 8 },
  filterChip: {
    flexDirection: "row", alignItems: "center", gap: 5,
    borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  filterChipText: { fontSize: 12, fontWeight: "600" },

  loadingBox: { alignItems: "center", paddingVertical: 60, gap: 12 },
  loadingText: { fontSize: 14 },

  emptyBox: {
    borderRadius: 16, padding: 40, alignItems: "center", gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptySub: { fontSize: 13, textAlign: "center", lineHeight: 20 },

  caseCard: {
    borderRadius: 16, marginBottom: 10, overflow: "hidden",
    flexDirection: "row",
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  priorityBar: { width: 4, minHeight: 60 },
  caseBody: { flex: 1, padding: 14 },
  caseTop: { flexDirection: "row", alignItems: "flex-start", marginBottom: 8 },
  patientName: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  patientMeta: { fontSize: 12, lineHeight: 18 },
  checkboxArea: { paddingLeft: 8, flexDirection: "row", alignItems: "center", gap: 8 },
  printIconBtn: {
    width: 28, height: 28, borderRadius: 8,
    alignItems: "center", justifyContent: "center",
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  badgeRow: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  noHandoverBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 6,
    marginTop: 8, borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 10, paddingVertical: 7,
  },
  noHandoverBannerText: { flex: 1, fontSize: 12, lineHeight: 17 },
  priorityBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  priorityBadgeText: { fontSize: 11, fontWeight: "700" },
  statusBadge: { borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  statusBadgeText: { fontSize: 11, fontWeight: "600" },

  receivingRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    paddingTop: 10, borderTopWidth: 1, marginTop: 4, marginBottom: 4,
  },
  receivingInput: {
    borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    fontSize: 14, fontWeight: "500",
  },

  handoverInputs: { marginTop: 12 },
  inputRow: {
    flexDirection: "row", alignItems: "flex-start", gap: 8,
    paddingTop: 10, borderTopWidth: 1, marginTop: 4,
  },
  inputLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 4 },
  bedInput: {
    borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7,
    fontSize: 14, fontWeight: "500",
  },
  planInput: {
    borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 13, minHeight: 70, lineHeight: 20,
  },

  stickyBottom: {
    borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12,
  },
  generateBtn: {
    borderRadius: 14, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
  },
  generateBtnText: { fontSize: 15, fontWeight: "700" },
  bottomNote: { fontSize: 11, textAlign: "center", marginTop: 7 },
});
