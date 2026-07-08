import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { ClinicalTimeline, type CaseAddendum } from "@/components/CaseChat";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useDepartment } from "@/context/DepartmentContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Nav = NativeStackNavigationProp<RootStackParamList>;

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PRIORITY_COLORS: Record<number, string> = {
  1: "#ef4444", 2: "#f97316", 3: "#eab308", 4: "#22c55e", 5: "#3b82f6",
};
const SHIFT_COLORS: Record<string, string> = {
  Morning: "#f59e0b", Evening: "#6366f1", Night: "#1e293b",
};
const ROLE_COLORS: Record<string, { bg: string; text: string }> = {
  consultant: { bg: "#dbeafe", text: "#1d4ed8" },
  resident: { bg: "#f3f4f6", text: "#374151" },
  hod: { bg: "#fef3c7", text: "#92400e" },
};

function getShiftColor(name: string, primary: string): string {
  return SHIFT_COLORS[name] || primary;
}

function formatRole(role: string) {
  return role === "hod" ? "HOD" : role.charAt(0).toUpperCase() + role.slice(1);
}

function getSessionDuration(checkedInAt: string): string {
  const mins = Math.floor((Date.now() - new Date(checkedInAt).getTime()) / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h ${mins % 60}m`;
}

function formatCaseTime(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  return `${d.getDate()} ${d.toLocaleString("en-IN", { month: "short" })} · ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function AdminDashboardScreen() {
  const { theme } = useTheme();
  const { token } = useAuth();
  const { department, shifts } = useDepartment();
  const navigation = useNavigation<Nav>();
  const headerHeight = useHeaderHeight();

  // ── Data state ──
  const [members, setMembers] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [allShiftCases, setAllShiftCases] = useState<any[]>([]);
  const [todayRota, setTodayRota] = useState<{ shifts: any[]; assignments: any[]; members: any[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── UI state ──
  const [forcingOut, setForcingOut] = useState<number | null>(null);
  const [assignTarget, setAssignTarget] = useState<{ userId: string; name: string; role: string } | null>(null);
  const [assigningShiftId, setAssigningShiftId] = useState<number | null>(null);
  const [expandedSession, setExpandedSession] = useState<number | null>(null);
  const [timelineModal, setTimelineModal] = useState<{ caseOverlay: any; addenda: CaseAddendum[] } | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const isFocusedRef = useRef(false);

  // ── Load ──
  const loadAdmin = async (silent = false) => {
    if (!department || !token) { setLoading(false); return; }
    if (!silent) setLoading(true);
    const todayStr = formatDate(new Date());
    try {
      const [adminRes, casesRes, rotaRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/department/${department.id}/admin`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${getApiUrl()}/api/department/${department.id}/all-shift-cases`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${getApiUrl()}/api/department/${department.id}/rota?startDate=${todayStr}&endDate=${todayStr}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (adminRes.ok) {
        const data = await adminRes.json();
        setMembers(data.members || []);
        setActiveSessions(data.activeSessions || []);
      }
      if (casesRes.ok) {
        const data = await casesRes.json();
        setAllShiftCases(data.cases || []);
      }
      if (rotaRes.ok) {
        const data = await rotaRes.json();
        setTodayRota({ shifts: data.shifts || [], assignments: data.assignments || [], members: data.members || [] });
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => {
    isFocusedRef.current = true;
    loadAdmin();
    const interval = setInterval(() => { if (isFocusedRef.current) loadAdmin(true); }, 30000);
    return () => { isFocusedRef.current = false; clearInterval(interval); };
  }, [department?.id]));

  // ── Actions ──
  const handleForceLogout = (session: any) => {
    const name = getMemberName(session.userId);
    Alert.alert("End Shift Session", `Remove ${name} from the active shift?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Session", style: "destructive", onPress: async () => {
          setForcingOut(session.id);
          try {
            const res = await fetch(`${getApiUrl()}/api/shifts/sessions/${session.id}/force-logout`, {
              method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) Alert.alert("Error", data.error || "Could not end session.");
          } catch { Alert.alert("Error", "Network error."); }
          setForcingOut(null);
          loadAdmin(true);
        },
      },
    ]);
  };

  const handleAssignMember = async (shiftId: number) => {
    if (!assignTarget || !token) return;
    setAssigningShiftId(shiftId);
    try {
      const res = await fetch(`${getApiUrl()}/api/shifts/${shiftId}/assign-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserId: assignTarget.userId, roleForShift: assignTarget.role }),
      });
      const data = await res.json();
      if (res.ok) { setAssignTarget(null); loadAdmin(true); Alert.alert("Assigned", `${assignTarget.name} has been checked in.`); }
      else Alert.alert("Error", data.error || "Could not assign member");
    } catch { Alert.alert("Error", "Network error"); }
    setAssigningShiftId(null);
  };

  // ── Derived ──
  const getMemberName = (userId: string): string => {
    const m = members.find((mem) => mem.userId === userId) || todayRota?.members.find((mem) => mem.userId === userId);
    return m?.name || m?.email?.split("@")[0] || userId;
  };

  // Group cases by doctorUserId
  const casesByDoctor = allShiftCases.reduce<Record<string, any[]>>((acc, c) => {
    const uid = c.doctorUserId || "unknown";
    if (!acc[uid]) acc[uid] = [];
    acc[uid].push(c);
    return acc;
  }, {});

  const shiftStats = shifts.map((shift) => {
    const sessions = activeSessions.filter((s) => s.shiftId === shift.id);
    return {
      shift,
      consultants: sessions.filter((s) => s.roleForShift === "consultant").length,
      residents: sessions.filter((s) => s.roleForShift === "resident").length,
    };
  });

  // Today's rota: who is scheduled vs who checked in
  const todayRotaShifts = (todayRota?.shifts || shifts).map((shift) => {
    const scheduled = (todayRota?.assignments || [])
      .filter((a) => a.shiftId === shift.id)
      .map((a) => {
        const member = todayRota?.members.find((m) => m.userId === a.memberUserId);
        const isCheckedIn = activeSessions.some((s) => s.userId === a.memberUserId);
        return { assignment: a, member, isCheckedIn };
      });
    return { shift, scheduled };
  });

  // Ad-hoc sessions: checked in but NOT on today's rota
  const rosteredUserIds = new Set((todayRota?.assignments || []).map((a) => a.memberUserId));
  const adHocSessions = activeSessions.filter((s) => !rosteredUserIds.has(s.userId));

  const toggleSession = (id: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSession((prev) => (prev === id ? null : id));
  };

  const handleOpenTimeline = async (caseOverlay: any) => {
    setTimelineModal({ caseOverlay, addenda: [] });
    setLoadingTimeline(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/cases/${caseOverlay.caseId}/addenda`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setTimelineModal({ caseOverlay, addenda: data });
        }
      }
    } catch {}
    setLoadingTimeline(false);
  };

  if (!department) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.backgroundDefault }}>
        <Text style={{ color: theme.textSecondary }}>No department found.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundDefault }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAdmin(); }} />}
      >

        {/* ── Header ── */}
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.deptName, { color: theme.text }]}>{department?.name || "Department"}</Text>
            <Text style={[styles.deptSub, { color: theme.textSecondary }]}>HOD Admin Dashboard</Text>
          </View>
          <Pressable
            style={({ pressed }) => [styles.headerBtn, { backgroundColor: theme.primaryLight, opacity: pressed ? 0.8 : 1 }]}
            onPress={() => navigation.navigate("ManageRoster")}
          >
            <Feather name="calendar" size={14} color={theme.primary} />
            <Text style={[styles.headerBtnText, { color: theme.primary }]}>Team & Rota</Text>
          </Pressable>
        </View>

        {/* ══════════════ TODAY'S ROTA ══════════════ */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>TODAY'S ROTA</Text>
        {loading && !todayRota ? (
          <ActivityIndicator color={theme.primary} style={{ marginBottom: Spacing.md }} />
        ) : todayRota && todayRota.assignments.length === 0 && todayRotaShifts.every((s) => s.scheduled.length === 0) ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.card, marginBottom: Spacing.md }]}>
            <Feather name="calendar" size={22} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No one rostered for today</Text>
            <Pressable onPress={() => navigation.navigate("ManageRoster")} style={[styles.planRotaBtn, { backgroundColor: theme.primaryLight }]}>
              <Text style={[styles.planRotaBtnText, { color: theme.primary }]}>Plan today's rota</Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.rotaCard, { backgroundColor: theme.card, marginBottom: Spacing.md }]}>
            {todayRotaShifts.map(({ shift, scheduled }, si) => {
              const shiftColor = getShiftColor(shift.name, theme.primary);
              return (
                <View
                  key={shift.id}
                  style={[styles.rotaShiftBlock, { borderBottomColor: theme.border, borderBottomWidth: si < todayRotaShifts.length - 1 ? 1 : 0 }]}
                >
                  {/* Shift header */}
                  <View style={styles.rotaShiftHeader}>
                    <View style={[styles.rotaShiftDot, { backgroundColor: shiftColor }]} />
                    <Text style={[styles.rotaShiftName, { color: theme.text }]}>{shift.name}</Text>
                    <Text style={[styles.rotaShiftTime, { color: theme.textMuted }]}>{shift.startTime}–{shift.endTime}</Text>
                    <View style={{ flex: 1 }} />
                    {scheduled.length > 0 && (
                      <View style={[styles.rotaCountBadge, { backgroundColor: shiftColor + "20" }]}>
                        <Text style={[styles.rotaCountText, { color: shiftColor }]}>
                          {scheduled.filter((x) => x.isCheckedIn).length}/{scheduled.length}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Doctor rows */}
                  {scheduled.length === 0 ? (
                    <View style={styles.rotaUnassigned}>
                      <Feather name="alert-triangle" size={12} color="#f59e0b" />
                      <Text style={[styles.rotaUnassignedText, { color: theme.textMuted }]}>No one rostered</Text>
                    </View>
                  ) : (
                    <View style={styles.rotaDoctorList}>
                      {scheduled.map(({ assignment, member, isCheckedIn }) => (
                        <View key={assignment.id} style={styles.rotaDoctorRow}>
                          <Feather
                            name={isCheckedIn ? "check-circle" : "clock"}
                            size={13}
                            color={isCheckedIn ? "#10b981" : "#f59e0b"}
                          />
                          <Text style={[styles.rotaDoctorName, { color: theme.text }]} numberOfLines={1}>
                            {member?.name || member?.email?.split("@")[0] || assignment.memberUserId}
                          </Text>
                          <Text style={[styles.rotaDoctorStatus, {
                            color: isCheckedIn ? "#10b981" : "#f59e0b",
                            backgroundColor: isCheckedIn ? "#d1fae5" : "#fef3c7",
                          }]}>
                            {isCheckedIn ? "In" : "Not in"}
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}

            {/* Ad-hoc coverage notice */}
            {adHocSessions.length > 0 && (
              <View style={[styles.adHocBanner, { backgroundColor: "#fef3c7", borderTopColor: theme.border }]}>
                <Feather name="info" size={12} color="#92400e" />
                <Text style={styles.adHocText}>
                  {adHocSessions.length} unscheduled check-in{adHocSessions.length > 1 ? "s" : ""} today (ad-hoc coverage)
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ══════════════ SHIFT OVERVIEW ══════════════ */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>SHIFT OVERVIEW</Text>
        <View style={[styles.shiftsGrid, { marginBottom: Spacing.md }]}>
          {shiftStats.map(({ shift, consultants, residents }) => {
            const color = getShiftColor(shift.name, theme.primary);
            return (
              <View key={shift.id} style={[styles.shiftCard, { backgroundColor: theme.card, borderLeftColor: color }]}>
                <Text style={[styles.shiftCardName, { color: theme.text }]}>{shift.name}</Text>
                <Text style={[styles.shiftCardTime, { color: theme.textSecondary }]}>{shift.startTime}–{shift.endTime}</Text>
                <View style={styles.slotRow}>
                  <View style={[styles.slotBubble, { backgroundColor: color + "20" }]}>
                    <Text style={[styles.slotCount, { color }]}>{consultants}</Text>
                    <Text style={[styles.slotLabel, { color: theme.textMuted }]}>Con.</Text>
                  </View>
                  <View style={[styles.slotBubble, { backgroundColor: color + "20" }]}>
                    <Text style={[styles.slotCount, { color }]}>{residents}</Text>
                    <Text style={[styles.slotLabel, { color: theme.textMuted }]}>Res.</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* ══════════════ LIVE CHECK-INS ══════════════ */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
          LIVE CHECK-INS ({activeSessions.length})
        </Text>
        {loading ? (
          <ActivityIndicator color={theme.primary} />
        ) : activeSessions.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.card, marginBottom: Spacing.md }]}>
            <Feather name="moon" size={28} color={theme.textMuted} />
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No doctors currently on shift</Text>
          </View>
        ) : (
          <View style={[styles.card, { backgroundColor: theme.card, marginBottom: Spacing.md }]}>
            {activeSessions.map((sess, idx) => {
              const shiftName = shifts.find((s) => s.id === sess.shiftId)?.name || "Unknown";
              const shiftColor = getShiftColor(shiftName, theme.primary);
              const isExpanded = expandedSession === sess.id;
              const doctorCases = casesByDoctor[sess.userId] || [];
              const isAdHoc = !rosteredUserIds.has(sess.userId);

              return (
                <View key={sess.id} style={{ borderBottomColor: theme.border, borderBottomWidth: idx < activeSessions.length - 1 ? 1 : 0 }}>
                  {/* Session row — tap to expand */}
                  <Pressable
                    style={({ pressed }) => [styles.sessionRow, { opacity: pressed ? 0.8 : 1 }]}
                    onPress={() => toggleSession(sess.id)}
                  >
                    <View style={[styles.sessionDot, { backgroundColor: shiftColor }]} />
                    <View style={{ flex: 1 }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <Text style={[styles.sessionName, { color: theme.text }]} numberOfLines={1}>
                          {getMemberName(sess.userId)}
                        </Text>
                        {isAdHoc && (
                          <View style={styles.adHocTag}>
                            <Text style={styles.adHocTagText}>Ad-hoc</Text>
                          </View>
                        )}
                      </View>
                      <Text style={[styles.sessionMeta, { color: theme.textSecondary }]}>
                        {formatRole(sess.roleForShift)} · {shiftName} · {getSessionDuration(sess.checkedInAt)}
                        {doctorCases.length > 0 ? `  ·  ${doctorCases.length} case${doctorCases.length > 1 ? "s" : ""}` : ""}
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      {doctorCases.length > 0 && (
                        <View style={[styles.casesCountBadge, { backgroundColor: theme.backgroundSecondary }]}>
                          <Feather name="clipboard" size={10} color={theme.textMuted} />
                          <Text style={[styles.casesCountText, { color: theme.textMuted }]}>{doctorCases.length}</Text>
                        </View>
                      )}
                      <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={14} color={theme.textMuted} />
                    </View>
                  </Pressable>

                  {/* Expanded: case list + actions */}
                  {isExpanded && (
                    <View style={[styles.expandedPanel, { backgroundColor: theme.backgroundSecondary }]}>
                      {/* Mini case list */}
                      {doctorCases.length > 0 ? (
                        <>
                          <Text style={[styles.expandedLabel, { color: theme.textMuted }]}>CASES TODAY</Text>
                          {doctorCases.map((c, ci) => {
                            const pColor = PRIORITY_COLORS[c.triagePriority] || "#9ca3af";
                            const miniHasAddenda = c.addendaCount && c.addendaCount > 0;
                            return (
                              <Pressable
                                key={c.id || ci}
                                style={({ pressed }) => [
                                  styles.miniCaseRow,
                                  { borderBottomColor: theme.border, borderBottomWidth: ci < doctorCases.length - 1 ? 1 : 0, opacity: pressed ? 0.8 : 1 },
                                ]}
                                onPress={() => handleOpenTimeline(c)}
                              >
                                <View style={[styles.miniPBar, { backgroundColor: pColor }]} />
                                <View style={{ flex: 1, paddingLeft: 8 }}>
                                  <Text style={[styles.miniCaseName, { color: theme.text }]} numberOfLines={1}>
                                    {c.patientName || "Unknown"}{c.bedNumber ? `  ·  Bed ${c.bedNumber}` : ""}
                                  </Text>
                                  <Text style={[styles.miniCaseMeta, { color: theme.textMuted }]} numberOfLines={1}>
                                    {c.chiefComplaint || "—"}
                                    {c.createdAt ? `  ·  ${formatCaseTime(c.createdAt)}` : ""}
                                  </Text>
                                </View>
                                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                                  {miniHasAddenda ? (
                                    <View style={{ flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: "#ede9fe", paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4 }}>
                                      <Feather name="layers" size={8} color="#7c3aed" />
                                      <Text style={{ fontSize: 9, fontWeight: "700", color: "#7c3aed" }}>{c.addendaCount}</Text>
                                    </View>
                                  ) : null}
                                  {c.triagePriority ? (
                                    <View style={[styles.miniPBadge, { backgroundColor: pColor + "22" }]}>
                                      <Text style={[styles.miniPText, { color: pColor }]}>P{c.triagePriority}</Text>
                                    </View>
                                  ) : null}
                                </View>
                              </Pressable>
                            );
                          })}
                        </>
                      ) : (
                        <Text style={[styles.noCasesText, { color: theme.textMuted }]}>No cases documented yet</Text>
                      )}

                      {/* End Shift button */}
                      <Pressable
                        style={({ pressed }) => [styles.endShiftBtn, { borderColor: theme.danger, opacity: pressed ? 0.7 : 1 }]}
                        onPress={() => handleForceLogout(sess)}
                        disabled={forcingOut === sess.id}
                      >
                        {forcingOut === sess.id
                          ? <ActivityIndicator size="small" color={theme.danger} />
                          : <><Feather name="log-out" size={13} color={theme.danger} /><Text style={[styles.endShiftText, { color: theme.danger }]}>End Shift</Text></>}
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* ══════════════ ALL DEPT CASES ══════════════ */}
        {allShiftCases.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
              ALL DEPARTMENT CASES ({allShiftCases.length})
            </Text>
            <View style={[styles.card, { backgroundColor: theme.card, marginBottom: Spacing.md }]}>
              {allShiftCases.map((c, idx) => {
                const color = PRIORITY_COLORS[c.triagePriority] || "#9ca3af";
                const roleStyle = ROLE_COLORS[c.roleForShift] || ROLE_COLORS.resident;
                const shiftColor = getShiftColor(c.shiftName, theme.primary);
                const hasAddenda = c.addendaCount && c.addendaCount > 0;
                return (
                  <Pressable
                    key={c.id || idx}
                    style={({ pressed }) => [
                      styles.caseRow,
                      { borderBottomColor: theme.border, borderBottomWidth: idx < allShiftCases.length - 1 ? 1 : 0, opacity: pressed ? 0.8 : 1 },
                    ]}
                    onPress={() => handleOpenTimeline(c)}
                  >
                    <View style={[styles.casePriorityBar, { backgroundColor: color }]} />
                    <View style={{ flex: 1, paddingLeft: Spacing.sm }}>
                      <View style={{ flexDirection: "row", gap: 5, flexWrap: "wrap", marginBottom: 2 }}>
                        {c.triagePriority ? (
                          <View style={[styles.pBadge, { backgroundColor: color + "22" }]}>
                            <Text style={[styles.pText, { color }]}>P{c.triagePriority}</Text>
                          </View>
                        ) : null}
                        {c.shiftName ? (
                          <View style={[styles.pBadge, { backgroundColor: shiftColor + "22" }]}>
                            <Text style={[styles.pText, { color: shiftColor }]}>{c.shiftName}</Text>
                          </View>
                        ) : null}
                        {c.roleForShift ? (
                          <View style={[styles.pBadge, { backgroundColor: roleStyle.bg }]}>
                            <Text style={[styles.pText, { color: roleStyle.text }]}>{formatRole(c.roleForShift)}</Text>
                          </View>
                        ) : null}
                        {c.consultantReviewedBy ? (
                          <View style={[styles.pBadge, { backgroundColor: "#d1fae5" }]}>
                            <Text style={[styles.pText, { color: "#065f46" }]}>Reviewed</Text>
                          </View>
                        ) : null}
                        {hasAddenda ? (
                          <View style={[styles.pBadge, { backgroundColor: "#ede9fe", flexDirection: "row", alignItems: "center", gap: 3 }]}>
                            <Feather name="layers" size={8} color="#7c3aed" />
                            <Text style={[styles.pText, { color: "#7c3aed" }]}>{c.addendaCount} update{c.addendaCount > 1 ? "s" : ""}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.caseName, { color: theme.text }]} numberOfLines={1}>
                        {c.patientName || "Unknown patient"}{c.bedNumber ? `  ·  Bed ${c.bedNumber}` : ""}
                      </Text>
                      <Text style={[styles.caseMeta, { color: theme.textSecondary }]} numberOfLines={1}>{c.chiefComplaint || "—"}</Text>
                      <Text style={[styles.caseDoctor, { color: theme.textMuted }]}>
                        {c.doctorName || getMemberName(c.doctorUserId) || "Unknown"}
                        {c.createdAt ? `  ·  ${formatCaseTime(c.createdAt)}` : ""}
                      </Text>
                    </View>
                    <Feather name="chevron-right" size={14} color={theme.textMuted} />
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {/* ══════════════ ACTIVE MEMBERS ══════════════ */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ACTIVE MEMBERS ({members.length})</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          {members.map((m, idx) => (
            <View key={m.id} style={[styles.memberRow, { borderBottomColor: theme.border, borderBottomWidth: idx < members.length - 1 ? 1 : 0 }]}>
              <View style={[styles.memberAvatar, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.memberAvatarText, { color: theme.primary }]}>
                  {(m.name || m.email || m.userId || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>
                  {m.name || m.email?.split("@")[0] || m.userId}
                </Text>
                <Text style={[styles.memberRole, { color: theme.textSecondary }]}>{formatRole(m.role)}</Text>
              </View>
              {activeSessions.some((s) => s.userId === m.userId) ? (
                <View style={[styles.onShiftBadge, { backgroundColor: "#d1fae5" }]}>
                  <View style={styles.onShiftDot} />
                  <Text style={styles.onShiftText}>On Shift</Text>
                </View>
              ) : (
                <Pressable
                  style={({ pressed }) => [styles.assignBtn, { backgroundColor: theme.primaryLight, opacity: pressed ? 0.7 : 1 }]}
                  onPress={() => setAssignTarget({ userId: m.userId, name: m.name || m.email?.split("@")[0] || "Member", role: m.role === "hod" ? "consultant" : m.role })}
                >
                  <Feather name="user-plus" size={12} color={theme.primary} />
                  <Text style={[styles.assignBtnText, { color: theme.primary }]}>Assign</Text>
                </Pressable>
              )}
            </View>
          ))}
        </View>

      </ScrollView>

      {/* ── Clinical Timeline modal ── */}
      <Modal visible={!!timelineModal} transparent animationType="slide" onRequestClose={() => setTimelineModal(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={() => setTimelineModal(null)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: theme.card, padding: 0, maxHeight: "85%" }]} onPress={() => {}}>
            {timelineModal ? (
              <>
                <View style={[styles.timelineModalHeader, { borderBottomColor: theme.border }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.timelineModalPatient, { color: theme.text }]} numberOfLines={1}>
                      {timelineModal.caseOverlay.patientName || "Unknown patient"}
                      {timelineModal.caseOverlay.bedNumber ? `  ·  Bed ${timelineModal.caseOverlay.bedNumber}` : ""}
                    </Text>
                    <Text style={[styles.timelineModalMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                      {timelineModal.caseOverlay.chiefComplaint || "—"}
                      {timelineModal.caseOverlay.doctorName ? `  ·  ${timelineModal.caseOverlay.doctorName}` : ""}
                    </Text>
                  </View>
                  <Pressable onPress={() => setTimelineModal(null)}>
                    <Feather name="x" size={18} color={theme.textMuted} />
                  </Pressable>
                </View>
                <ScrollView
                  style={{ flex: 1 }}
                  contentContainerStyle={{ padding: Spacing.md, paddingBottom: 32 }}
                  showsVerticalScrollIndicator={false}
                >
                  {loadingTimeline ? (
                    <View style={{ alignItems: "center", paddingVertical: Spacing.xl }}>
                      <ActivityIndicator size="large" color={theme.primary} />
                      <Text style={{ color: theme.textSecondary, marginTop: Spacing.sm, fontSize: 13 }}>Loading clinical timeline...</Text>
                    </View>
                  ) : timelineModal.addenda.length > 0 ? (
                    <ClinicalTimeline addenda={timelineModal.addenda} />
                  ) : (
                    <View style={{ alignItems: "center", paddingVertical: Spacing.xl }}>
                      <Feather name="clock" size={28} color={theme.textMuted} />
                      <Text style={{ color: theme.textSecondary, marginTop: Spacing.sm, fontSize: 14 }}>No clinical updates yet</Text>
                      <Text style={{ color: theme.textMuted, marginTop: 4, fontSize: 12, textAlign: "center" }}>
                        Updates added by doctors will appear here as the case progresses.
                      </Text>
                    </View>
                  )}
                </ScrollView>
              </>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Assign to shift modal ── */}
      <Modal visible={!!assignTarget} transparent animationType="fade" onRequestClose={() => setAssignTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Assign to Shift</Text>
            <Text style={[styles.modalSub, { color: theme.textSecondary }]}>
              Checking in {assignTarget?.name} as {assignTarget?.role === "consultant" ? "Consultant" : "Resident"}
            </Text>
            <Text style={[styles.modalPickLabel, { color: theme.textSecondary }]}>Select shift:</Text>
            {shifts.map((shift) => {
              const color = getShiftColor(shift.name, theme.primary);
              const isAssigning = assigningShiftId === shift.id;
              return (
                <Pressable
                  key={shift.id}
                  style={({ pressed }) => [styles.shiftPickRow, { backgroundColor: theme.backgroundSecondary, borderLeftColor: color, opacity: pressed ? 0.75 : 1 }]}
                  onPress={() => handleAssignMember(shift.id)}
                  disabled={!!assigningShiftId}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.shiftPickName, { color: theme.text }]}>{shift.name}</Text>
                    <Text style={[styles.shiftPickTime, { color: theme.textSecondary }]}>{shift.startTime}–{shift.endTime}</Text>
                  </View>
                  {isAssigning
                    ? <ActivityIndicator size="small" color={color} />
                    : <Feather name="arrow-right" size={18} color={color} />}
                </Pressable>
              );
            })}
            <Pressable
              style={({ pressed }) => [styles.modalCancelBtn, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
              onPress={() => setAssignTarget(null)}
            >
              <Text style={[styles.modalCancelText, { color: theme.textSecondary }]}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── StyleSheet ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: Spacing.lg },
  deptName: { fontSize: 20, fontWeight: "800" },
  deptSub: { fontSize: 14, marginTop: 2 },
  headerBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.md },
  headerBtnText: { fontSize: 13, fontWeight: "700" },
  sectionTitle: { fontSize: 11, fontWeight: "700", letterSpacing: 0.9, marginBottom: Spacing.sm },
  emptyBox: { borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14 },
  planRotaBtn: { marginTop: 4, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  planRotaBtnText: { fontSize: 13, fontWeight: "700" },

  // Today's Rota
  rotaCard: { borderRadius: BorderRadius.lg, overflow: "hidden" },
  rotaShiftBlock: { padding: Spacing.md },
  rotaShiftHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 6 },
  rotaShiftDot: { width: 8, height: 8, borderRadius: 4 },
  rotaShiftName: { fontSize: 13, fontWeight: "700" },
  rotaShiftTime: { fontSize: 11 },
  rotaCountBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  rotaCountText: { fontSize: 11, fontWeight: "700" },
  rotaDoctorList: { gap: 4, paddingLeft: 15 },
  rotaDoctorRow: { flexDirection: "row", alignItems: "center", gap: 7 },
  rotaDoctorName: { flex: 1, fontSize: 13, fontWeight: "500" },
  rotaDoctorStatus: { fontSize: 10, fontWeight: "700", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  rotaUnassigned: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 15 },
  rotaUnassignedText: { fontSize: 12 },
  adHocBanner: { flexDirection: "row", alignItems: "center", gap: 7, padding: Spacing.sm, borderTopWidth: 1 },
  adHocText: { fontSize: 11, color: "#92400e", flex: 1 },

  // Shift overview
  shiftsGrid: { flexDirection: "row", gap: Spacing.sm },
  shiftCard: { flex: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, borderLeftWidth: 4 },
  shiftCardName: { fontSize: 13, fontWeight: "700", marginBottom: 1 },
  shiftCardTime: { fontSize: 10, marginBottom: Spacing.sm },
  slotRow: { flexDirection: "row", gap: 5 },
  slotBubble: { flex: 1, borderRadius: 6, padding: 4, alignItems: "center" },
  slotCount: { fontSize: 17, fontWeight: "800" },
  slotLabel: { fontSize: 8, fontWeight: "700" },

  // Live check-ins
  card: { borderRadius: BorderRadius.lg, overflow: "hidden" },
  sessionRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, gap: 10 },
  sessionDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  sessionName: { fontSize: 14, fontWeight: "600" },
  sessionMeta: { fontSize: 12, marginTop: 1 },
  adHocTag: { backgroundColor: "#fef3c7", paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 },
  adHocTagText: { fontSize: 9, fontWeight: "700", color: "#92400e" },
  casesCountBadge: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  casesCountText: { fontSize: 10, fontWeight: "700" },
  expandedPanel: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, paddingTop: 4 },
  expandedLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.7, marginBottom: 6 },
  miniCaseRow: { flexDirection: "row", alignItems: "center", paddingVertical: 7, gap: 4 },
  miniPBar: { width: 3, borderRadius: 1.5, alignSelf: "stretch", minHeight: 32, flexShrink: 0 },
  miniCaseName: { fontSize: 13, fontWeight: "600" },
  miniCaseMeta: { fontSize: 11, marginTop: 1 },
  miniPBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, flexShrink: 0 },
  miniPText: { fontSize: 10, fontWeight: "700" },
  noCasesText: { fontSize: 12, paddingVertical: 8 },
  endShiftBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", marginTop: 10, borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  endShiftText: { fontSize: 12, fontWeight: "700" },

  // All dept cases
  caseRow: { flexDirection: "row", alignItems: "flex-start", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, gap: 8 },
  casePriorityBar: { width: 4, borderRadius: 2, alignSelf: "stretch", minHeight: 50 },
  caseName: { fontSize: 14, fontWeight: "600" },
  caseMeta: { fontSize: 12, marginTop: 1 },
  caseDoctor: { fontSize: 11, marginTop: 2 },
  pBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  pText: { fontSize: 10, fontWeight: "700" },

  // Members
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, gap: 10 },
  memberAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  memberAvatarText: { fontSize: 12, fontWeight: "700" },
  memberName: { fontSize: 14, fontWeight: "600" },
  memberRole: { fontSize: 12 },
  onShiftBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  onShiftDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10b981" },
  onShiftText: { fontSize: 12, fontWeight: "700", color: "#065f46" },
  assignBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  assignBtnText: { fontSize: 11, fontWeight: "700" },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", paddingHorizontal: Spacing.lg },
  modalSheet: { width: "100%", borderRadius: BorderRadius.lg, padding: Spacing.lg, gap: Spacing.sm },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 2 },
  timelineModalHeader: { flexDirection: "row", alignItems: "center", gap: Spacing.md, padding: Spacing.md, borderBottomWidth: 1 },
  timelineModalPatient: { fontSize: 15, fontWeight: "700" },
  timelineModalMeta: { fontSize: 12, marginTop: 2 },
  modalSub: { fontSize: 13, marginBottom: Spacing.sm },
  modalPickLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 },
  shiftPickRow: { flexDirection: "row", alignItems: "center", padding: Spacing.md, borderRadius: BorderRadius.md, borderLeftWidth: 4 },
  shiftPickName: { fontSize: 15, fontWeight: "700" },
  shiftPickTime: { fontSize: 12, marginTop: 2 },
  modalCancelBtn: { marginTop: Spacing.sm, padding: Spacing.md, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: "center" },
  modalCancelText: { fontSize: 14, fontWeight: "600" },
});
