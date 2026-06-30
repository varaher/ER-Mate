import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useDepartment } from "@/context/DepartmentContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function AdminDashboardScreen() {
  const { theme } = useTheme();
  const { token } = useAuth();
  const { department, shifts } = useDepartment();
  const navigation = useNavigation<Nav>();
  const headerHeight = useHeaderHeight();

  const [members, setMembers] = useState<any[]>([]);
  const [activeSessions, setActiveSessions] = useState<any[]>([]);
  const [allShiftCases, setAllShiftCases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [forcingOut, setForcingOut] = useState<number | null>(null);

  const isFocusedRef = useRef(false);

  useFocusEffect(useCallback(() => {
    isFocusedRef.current = true;
    loadAdmin();
    const interval = setInterval(() => {
      if (isFocusedRef.current) loadAdmin(true);
    }, 30000);
    return () => {
      isFocusedRef.current = false;
      clearInterval(interval);
    };
  }, [department?.id]));

  const loadAdmin = async (silent = false) => {
    if (!department || !token) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const [adminRes, casesRes] = await Promise.all([
        fetch(`${getApiUrl()}/api/department/${department.id}/admin`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${getApiUrl()}/api/department/${department.id}/all-shift-cases`, { headers: { Authorization: `Bearer ${token}` } }),
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
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  const handleForceLogout = (session: any) => {
    Alert.alert("Force Logout", "End this doctor's shift session? They will be notified.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Force Logout", style: "destructive", onPress: async () => {
          setForcingOut(session.id);
          await fetch(`${getApiUrl()}/api/shifts/sessions/${session.id}/force-logout`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          });
          setForcingOut(null);
          loadAdmin(true);
        },
      },
    ]);
  };

  const SHIFT_COLORS: Record<string, string> = { Morning: "#f59e0b", Evening: "#6366f1", Night: "#1e293b" };

  const getShiftName = (shiftId: number) => shifts.find((s) => s.id === shiftId)?.name || "Unknown";

  const getSessionDuration = (checkedInAt: string) => {
    const mins = Math.floor((Date.now() - new Date(checkedInAt).getTime()) / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const getMemberName = (userId: string): string => {
    const m = members.find((mem) => mem.userId === userId);
    return m?.name || m?.email?.split("@")[0] || userId;
  };

  const formatRole = (role: string) =>
    role === "hod" ? "HOD" : role.charAt(0).toUpperCase() + role.slice(1);

  const shiftStats = shifts.map((shift) => {
    const sessions = activeSessions.filter((s) => s.shiftId === shift.id);
    const consultants = sessions.filter((s) => s.roleForShift === "consultant").length;
    const residents = sessions.filter((s) => s.roleForShift === "resident").length;
    return { shift, consultants, residents, total: sessions.length };
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundDefault }}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAdmin(); }} />}
    >
      <View style={styles.headerRow}>
        <View>
          <Text style={[styles.deptName, { color: theme.text }]}>{department?.name || "Department"}</Text>
          <Text style={[styles.deptSub, { color: theme.textSecondary }]}>HOD Admin Dashboard</Text>
        </View>
        <Pressable
          style={({ pressed }) => [styles.rosterBtn, { backgroundColor: theme.primaryLight, opacity: pressed ? 0.8 : 1 }]}
          onPress={() => navigation.navigate("ManageRoster")}
        >
          <Feather name="users" size={16} color={theme.primary} />
          <Text style={[styles.rosterBtnText, { color: theme.primary }]}>Manage Roster</Text>
        </Pressable>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>SHIFT OVERVIEW</Text>
      <View style={styles.shiftsGrid}>
        {shiftStats.map(({ shift, consultants, residents, total }) => {
          const color = SHIFT_COLORS[shift.name] || theme.primary;
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

      <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
        DOCTORS ON SHIFT ({activeSessions.length})
      </Text>
      {loading ? <ActivityIndicator color={theme.primary} /> : activeSessions.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: theme.card }]}>
          <Feather name="moon" size={28} color={theme.textMuted} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No doctors currently on shift</Text>
        </View>
      ) : (
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          {activeSessions.map((sess, idx) => {
            const shiftName = getShiftName(sess.shiftId);
            const shiftColor = SHIFT_COLORS[shiftName] || theme.primary;
            return (
              <View key={sess.id} style={[styles.sessionRow, { borderBottomColor: theme.border, borderBottomWidth: idx < activeSessions.length - 1 ? 1 : 0 }]}>
                <View style={[styles.sessionDot, { backgroundColor: shiftColor }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.sessionUserId, { color: theme.text }]} numberOfLines={1}>{getMemberName(sess.userId)}</Text>
                  <Text style={[styles.sessionMeta, { color: theme.textSecondary }]}>
                    {formatRole(sess.roleForShift)} · {shiftName} · {getSessionDuration(sess.checkedInAt)}
                  </Text>
                </View>
                <Pressable
                  style={({ pressed }) => [styles.forceBtn, { backgroundColor: theme.dangerLight, opacity: pressed ? 0.8 : 1 }]}
                  onPress={() => handleForceLogout(sess)}
                  disabled={forcingOut === sess.id}
                >
                  {forcingOut === sess.id ? (
                    <ActivityIndicator size="small" color={theme.danger} />
                  ) : (
                    <Text style={[styles.forceBtnText, { color: theme.danger }]}>Force Out</Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      )}

      {allShiftCases.length > 0 ? (
        <>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
            ACTIVE CASES ({allShiftCases.length})
          </Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            {allShiftCases.map((c, idx) => {
              const priorityColors: Record<number, string> = { 1: "#ef4444", 2: "#f97316", 3: "#eab308", 4: "#22c55e", 5: "#3b82f6" };
              const color = priorityColors[c.triagePriority] || "#9ca3af";
              return (
                <View key={c.id} style={[styles.caseRow, { borderBottomColor: theme.border, borderBottomWidth: idx < allShiftCases.length - 1 ? 1 : 0 }]}>
                  <View style={[styles.casePriorityBar, { backgroundColor: color }]} />
                  <View style={{ flex: 1, paddingLeft: Spacing.sm }}>
                    <Text style={[styles.caseName, { color: theme.text }]} numberOfLines={1}>
                      {c.patientName || "Unknown patient"}
                      {c.bedNumber ? <Text style={{ color: theme.textMuted }}> · Bed {c.bedNumber}</Text> : null}
                    </Text>
                    <Text style={[styles.caseMeta, { color: theme.textSecondary }]} numberOfLines={1}>
                      {c.chiefComplaint || "—"} · {c.shiftName || "Shift"} · {c.doctorName || c.doctorUserId || "Unknown"}
                    </Text>
                  </View>
                  {c.consultantReviewedBy ? (
                    <View style={[styles.reviewedBadge, { backgroundColor: "#d1fae5" }]}>
                      <Text style={styles.reviewedText}>Reviewed</Text>
                    </View>
                  ) : null}
                  {c.triagePriority ? (
                    <View style={[styles.pBadge, { backgroundColor: color + "22" }]}>
                      <Text style={[styles.pText, { color }]}>P{c.triagePriority}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        </>
      ) : null}

      <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.lg }]}>ACTIVE MEMBERS ({members.length})</Text>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        {members.map((m, idx) => (
          <View key={m.id} style={[styles.memberRow, { borderBottomColor: theme.border, borderBottomWidth: idx < members.length - 1 ? 1 : 0 }]}>
            <View style={[styles.memberAvatar, { backgroundColor: theme.primaryLight }]}>
              <Text style={[styles.memberAvatarText, { color: theme.primary }]}>{(m.name || m.email || m.userId || "?").charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>{m.name || m.email?.split("@")[0] || m.userId}</Text>
              <Text style={[styles.memberRole, { color: theme.textSecondary }]}>{formatRole(m.role)}</Text>
            </View>
            {activeSessions.some((s) => s.userId === m.userId) ? (
              <View style={[styles.onShiftBadge, { backgroundColor: "#d1fae5" }]}>
                <View style={styles.onShiftDot} />
                <Text style={styles.onShiftText}>On Shift</Text>
              </View>
            ) : (
              <Text style={[styles.offShiftText, { color: theme.textMuted }]}>Off</Text>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: Spacing.lg },
  deptName: { fontSize: 20, fontWeight: "800" },
  deptSub: { fontSize: 14, marginTop: 2 },
  rosterBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.md },
  rosterBtnText: { fontSize: 14, fontWeight: "600" },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: Spacing.sm },
  shiftsGrid: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.sm },
  shiftCard: { flex: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, borderLeftWidth: 4 },
  shiftCardName: { fontSize: 14, fontWeight: "700", marginBottom: 2 },
  shiftCardTime: { fontSize: 10, marginBottom: Spacing.sm },
  slotRow: { flexDirection: "row", gap: 6 },
  slotBubble: { flex: 1, borderRadius: 6, padding: 4, alignItems: "center" },
  slotCount: { fontSize: 18, fontWeight: "800" },
  slotLabel: { fontSize: 9, fontWeight: "600" },
  card: { borderRadius: BorderRadius.lg, overflow: "hidden", marginBottom: Spacing.sm },
  emptyBox: { borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: "center", gap: 8, marginBottom: Spacing.sm },
  emptyText: { fontSize: 14 },
  sessionRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, gap: 10 },
  sessionDot: { width: 8, height: 8, borderRadius: 4 },
  sessionUserId: { fontSize: 14, fontWeight: "600" },
  sessionMeta: { fontSize: 12, marginTop: 2 },
  forceBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 },
  forceBtnText: { fontSize: 12, fontWeight: "700" },
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, gap: 10 },
  memberAvatar: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  memberAvatarText: { fontSize: 12, fontWeight: "700" },
  memberName: { fontSize: 14, fontWeight: "600" },
  memberRole: { fontSize: 12 },
  onShiftBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  onShiftDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10b981" },
  onShiftText: { fontSize: 12, fontWeight: "700", color: "#065f46" },
  offShiftText: { fontSize: 12 },
  caseRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, gap: 8, overflow: "hidden" },
  casePriorityBar: { width: 4, height: 36, borderRadius: 2 },
  caseName: { fontSize: 14, fontWeight: "600" },
  caseMeta: { fontSize: 12, marginTop: 2 },
  reviewedBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  reviewedText: { fontSize: 10, fontWeight: "700", color: "#065f46" },
  pBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  pText: { fontSize: 11, fontWeight: "700" },
});
