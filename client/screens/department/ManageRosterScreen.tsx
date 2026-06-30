import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Linking,
  Share,
  Modal,
  TextInput,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useDepartment } from "@/context/DepartmentContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_COLORS: Record<string, string> = { active: "#10b981", pending: "#f59e0b", inactive: "#9ca3af" };
const ROLE_DISPLAY: Record<string, string> = { hod: "HOD", consultant: "Consultant", resident: "Resident" };
const SHIFT_COLORS = ["#f59e0b", "#6366f1", "#1e293b", "#0ea5e9", "#10b981"];

function TimeStepModal({
  visible,
  value,
  title,
  onConfirm,
  onClose,
  theme,
}: {
  visible: boolean;
  value: string;
  title: string;
  onConfirm: (t: string) => void;
  onClose: () => void;
  theme: any;
}) {
  const [h, setH] = useState(0);
  const [m, setM] = useState(0);

  React.useEffect(() => {
    if (visible && value) {
      const parts = value.split(":").map(Number);
      setH(isNaN(parts[0]) ? 0 : parts[0]);
      setM(isNaN(parts[1]) ? 0 : parts[1]);
    }
  }, [visible, value]);

  const pad = (n: number) => String(n).padStart(2, "0");
  const adjustH = (d: number) => setH((prev) => (prev + d + 24) % 24);
  const adjustM = (d: number) => setM((prev) => (prev + d + 60) % 60);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={tStyles.overlay}>
        <View style={[tStyles.sheet, { backgroundColor: theme.card }]}>
          <Text style={[tStyles.title, { color: theme.text }]}>{title}</Text>
          <View style={tStyles.row}>
            <View style={tStyles.wheel}>
              <Pressable onPress={() => adjustH(1)} style={tStyles.arrow}>
                <Feather name="chevron-up" size={24} color={theme.primary} />
              </Pressable>
              <Text style={[tStyles.digit, { color: theme.text }]}>{pad(h)}</Text>
              <Pressable onPress={() => adjustH(-1)} style={tStyles.arrow}>
                <Feather name="chevron-down" size={24} color={theme.primary} />
              </Pressable>
            </View>
            <Text style={[tStyles.colon, { color: theme.text }]}>:</Text>
            <View style={tStyles.wheel}>
              <Pressable onPress={() => adjustM(5)} style={tStyles.arrow}>
                <Feather name="chevron-up" size={24} color={theme.primary} />
              </Pressable>
              <Text style={[tStyles.digit, { color: theme.text }]}>{pad(m)}</Text>
              <Pressable onPress={() => adjustM(-5)} style={tStyles.arrow}>
                <Feather name="chevron-down" size={24} color={theme.primary} />
              </Pressable>
            </View>
          </View>
          <View style={tStyles.btns}>
            <Pressable style={[tStyles.cancel, { borderColor: theme.border }]} onPress={onClose}>
              <Text style={{ color: theme.textSecondary, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
            <Pressable style={[tStyles.confirm, { backgroundColor: theme.primary }]} onPress={() => onConfirm(`${pad(h)}:${pad(m)}`)}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Set</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const tStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 24 },
  sheet: { width: "100%", borderRadius: 20, padding: 24 },
  title: { fontSize: 17, fontWeight: "700", textAlign: "center", marginBottom: 20 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16, marginBottom: 24 },
  wheel: { alignItems: "center", gap: 4 },
  arrow: { padding: 8 },
  digit: { fontSize: 40, fontWeight: "700", minWidth: 60, textAlign: "center" },
  colon: { fontSize: 36, fontWeight: "700", marginBottom: 4 },
  btns: { flexDirection: "row", gap: 12 },
  cancel: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  confirm: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
});

export default function ManageRosterScreen() {
  const { theme } = useTheme();
  const { user, token } = useAuth();
  const { department, refresh: refreshDept } = useDepartment();
  const navigation = useNavigation<Nav>();
  const headerHeight = useHeaderHeight();

  const [members, setMembers] = useState<any[]>([]);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [decliningId, setDecliningId] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const [rotaShifts, setRotaShifts] = useState<any[]>([]);
  const [rotaAssignments, setRotaAssignments] = useState<any[]>([]);
  const [rotaMembers, setRotaMembers] = useState<any[]>([]);
  const [expandedShift, setExpandedShift] = useState<number | null>(null);

  const [editShiftModal, setEditShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editStart, setEditStart] = useState("08:00");
  const [editEnd, setEditEnd] = useState("14:00");
  const [editMaxCon, setEditMaxCon] = useState("2");
  const [editMaxRes, setEditMaxRes] = useState("6");
  const [savingShift, setSavingShift] = useState(false);

  const [timeModal, setTimeModal] = useState(false);
  const [timeTarget, setTimeTarget] = useState<"start"|"end"|"extra">("start");
  const [timeValue, setTimeValue] = useState("08:00");

  const [addShiftModal, setAddShiftModal] = useState(false);

  const [addMemberModal, setAddMemberModal] = useState<number | null>(null);
  const [addMemberExtra, setAddMemberExtra] = useState("");
  const [addMemberExtraOn, setAddMemberExtraOn] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [addingMember, setAddingMember] = useState(false);

  const [extraTimeModal, setExtraTimeModal] = useState<any | null>(null);
  const [extraTimeValue, setExtraTimeValue] = useState("");

  const isHOD = members.find((m) => m.userId === (user as any)?.id || m.email === (user as any)?.email)?.role === "hod"
    || department?.hodUserId === (user as any)?.id;

  useFocusEffect(useCallback(() => {
    loadRoster();
    loadRota();
  }, [department?.id]));

  const loadRoster = async (silent = false) => {
    if (!department || !token) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/department/${department.id}/members`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setInviteLink(data.inviteLink || null);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  const loadRota = async () => {
    if (!department || !token) return;
    try {
      const res = await fetch(`${getApiUrl()}/api/department/${department.id}/rota`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setRotaShifts(data.shifts || []);
        setRotaAssignments(data.assignments || []);
        setRotaMembers(data.members || []);
      }
    } catch {}
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    await Clipboard.setStringAsync(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    if (!inviteLink) return;
    const msg = `Join our ER team on ErMate!\n\nTap the link below, sign in with Google, and fill in your name and role. I'll approve you from my end.\n\n${inviteLink}`;
    const url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) Linking.openURL(url);
      else Share.share({ message: msg, title: "Join ErMate Team" });
    });
  };

  const handleShare = () => {
    if (!inviteLink) return;
    const msg = `Join our ER team on ErMate!\n\nTap the link below, sign in with Google, and fill in your name and role. I'll approve you from my end.\n\n${inviteLink}`;
    Share.share({ message: msg, title: "Join ErMate Team" });
  };

  const handleRegenerate = () => {
    Alert.alert("Generate New Link", "The old link will stop working.", [
      { text: "Cancel", style: "cancel" },
      { text: "Generate", onPress: async () => {
        if (!department || !token) return;
        setRegenerating(true);
        try {
          const res = await fetch(`${getApiUrl()}/api/department/${department.id}/regenerate-invite`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json();
          if (res.ok) setInviteLink(data.inviteLink);
          else Alert.alert("Error", data.error || "Failed to regenerate link");
        } catch { Alert.alert("Error", "Network error"); }
        setRegenerating(false);
      }},
    ]);
  };

  const handleApprove = async (member: any) => {
    if (!token) return;
    setApprovingId(member.id);
    try {
      const res = await fetch(`${getApiUrl()}/api/department/members/${member.id}/approve`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) { loadRoster(true); refreshDept(); }
      else Alert.alert("Error", data.error || "Failed to approve");
    } catch { Alert.alert("Error", "Network error"); }
    setApprovingId(null);
  };

  const handleDecline = (member: any) => {
    Alert.alert("Decline Request", `Decline ${member.name || "this doctor"}'s request?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Decline", style: "destructive", onPress: async () => {
        if (!token) return;
        setDecliningId(member.id);
        try {
          const res = await fetch(`${getApiUrl()}/api/department/members/${member.id}/decline`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
          if (res.ok) loadRoster(true);
          else { const d = await res.json(); Alert.alert("Error", d.error || "Failed to decline"); }
        } catch { Alert.alert("Error", "Network error"); }
        setDecliningId(null);
      }},
    ]);
  };

  const handleRemove = (member: any) => {
    Alert.alert("Remove Member", `Remove ${member.name || member.userId} from the department?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        if (!department || !token) return;
        try {
          const res = await fetch(`${getApiUrl()}/api/department/${department.id}/members/${member.userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) { Alert.alert("Error", data.error || "Failed to remove member"); return; }
          setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
          await loadRoster(true);
          refreshDept();
        } catch { Alert.alert("Error", "Network error. Please try again."); }
      }},
    ]);
  };

  const openEditShift = (shift: any) => {
    setEditingShift(shift);
    setEditName(shift.name);
    setEditStart(shift.startTime);
    setEditEnd(shift.endTime);
    setEditMaxCon(String(shift.maxConsultants ?? 2));
    setEditMaxRes(String(shift.maxResidents ?? 6));
    setEditShiftModal(true);
  };

  const openAddShift = () => {
    setEditingShift(null);
    setEditName(`Shift ${rotaShifts.length + 1}`);
    setEditStart("08:00");
    setEditEnd("16:00");
    setEditMaxCon("2");
    setEditMaxRes("6");
    setEditShiftModal(true);
  };

  const saveShift = async () => {
    if (!department || !token || !editName.trim()) return;
    setSavingShift(true);
    try {
      let res;
      if (editingShift) {
        res = await fetch(`${getApiUrl()}/api/department/${department.id}/shifts/${editingShift.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: editName.trim(), startTime: editStart, endTime: editEnd, maxConsultants: parseInt(editMaxCon) || 2, maxResidents: parseInt(editMaxRes) || 6 }),
        });
      } else {
        res = await fetch(`${getApiUrl()}/api/department/${department.id}/shifts`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: editName.trim(), startTime: editStart, endTime: editEnd, maxConsultants: parseInt(editMaxCon) || 2, maxResidents: parseInt(editMaxRes) || 6 }),
        });
      }
      const data = await res.json();
      if (res.ok) { setEditShiftModal(false); loadRota(); refreshDept(); }
      else Alert.alert("Error", data.error || "Failed to save shift");
    } catch { Alert.alert("Error", "Network error"); }
    setSavingShift(false);
  };

  const deleteShift = (shift: any) => {
    Alert.alert("Delete Shift", `Delete "${shift.name}"? All rota assignments for this shift will also be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        if (!department || !token) return;
        try {
          const res = await fetch(`${getApiUrl()}/api/department/${department.id}/shifts/${shift.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) { Alert.alert("Error", data.error || "Failed to delete shift"); return; }
          setRotaShifts((prev) => prev.filter((s) => s.id !== shift.id));
          setRotaAssignments((prev) => prev.filter((a) => a.shiftId !== shift.id));
          refreshDept();
        } catch { Alert.alert("Error", "Network error. Please try again."); }
      }},
    ]);
  };

  const handleAddRotaMember = async () => {
    if (!selectedMemberId || !addMemberModal || !department || !token) return;
    setAddingMember(true);
    const mem = rotaMembers.find((m) => m.userId === selectedMemberId);
    try {
      const res = await fetch(`${getApiUrl()}/api/department/${department.id}/rota`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shiftId: addMemberModal, memberUserId: selectedMemberId, roleForShift: mem?.role, customEndTime: addMemberExtraOn && addMemberExtra ? addMemberExtra : null }),
      });
      const data = await res.json();
      if (res.ok) { setAddMemberModal(null); setSelectedMemberId(null); setAddMemberExtra(""); setAddMemberExtraOn(false); loadRota(); }
      else Alert.alert("Error", data.error || "Could not assign member");
    } catch { Alert.alert("Error", "Network error"); }
    setAddingMember(false);
  };

  const handleRemoveRotaMember = (assignment: any) => {
    const name = getMemberName(assignment.memberUserId);
    Alert.alert("Remove from Rota", `Remove ${name} from this shift's schedule?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: async () => {
        if (!department || !token) return;
        try {
          const res = await fetch(`${getApiUrl()}/api/department/${department.id}/rota/${assignment.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
          const data = await res.json().catch(() => ({}));
          if (!res.ok) { Alert.alert("Error", data.error || "Failed to remove from rota"); return; }
          setRotaAssignments((prev) => prev.filter((a) => a.id !== assignment.id));
          loadRota();
        } catch { Alert.alert("Error", "Network error. Please try again."); }
      }},
    ]);
  };

  const saveExtraTime = async () => {
    if (!extraTimeModal || !department || !token) return;
    try {
      const res = await fetch(`${getApiUrl()}/api/department/${department.id}/rota/${extraTimeModal.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ customEndTime: extraTimeValue || null }),
      });
      if (res.ok) { setExtraTimeModal(null); loadRota(); }
      else { const d = await res.json(); Alert.alert("Error", d.error || "Failed to update"); }
    } catch { Alert.alert("Error", "Network error"); }
  };

  const getMemberName = (userId: string) => {
    const m = rotaMembers.find((mem) => mem.userId === userId);
    return m?.name || m?.email?.split("@")[0] || userId;
  };

  const getMemberRole = (userId: string) => {
    const m = rotaMembers.find((mem) => mem.userId === userId);
    return ROLE_DISPLAY[m?.role] || m?.role || "";
  };

  const activeMembers = members.filter((m) => m.status === "active" && m.role !== "hod");
  const hodMember = members.find((m) => m.role === "hod");
  const pendingMembers = members.filter((m) => m.status === "pending");

  if (!department) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundDefault }]}>
        <Text style={{ color: theme.textSecondary }}>No department found.</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.backgroundDefault }}>
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRoster(); loadRota(); }} />}
    >
      {/* Invite Link Card */}
      {inviteLink ? (
        <>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>TEAM INVITE LINK</Text>
          <View style={[styles.linkCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.linkText, { color: theme.text }]} numberOfLines={2} selectable>{inviteLink}</Text>
            <View style={styles.linkActions}>
              <Pressable style={({ pressed }) => [styles.linkBtn, { backgroundColor: copied ? theme.primary : theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 }]} onPress={handleCopy}>
                <Feather name={copied ? "check" : "copy"} size={14} color={copied ? "#fff" : theme.text} />
                <Text style={[styles.linkBtnText, { color: copied ? "#fff" : theme.text }]}>{copied ? "Copied!" : "Copy"}</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.linkBtn, { backgroundColor: "#25D366", opacity: pressed ? 0.8 : 1 }]} onPress={handleWhatsApp}>
                <Text style={[styles.linkBtnText, { color: "#fff" }]}>WhatsApp</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.linkBtn, { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 }]} onPress={handleShare}>
                <Feather name="share-2" size={14} color={theme.text} />
              </Pressable>
            </View>
            <Pressable onPress={handleRegenerate} disabled={regenerating} style={styles.regenRow}>
              {regenerating ? <ActivityIndicator size="small" color={theme.textMuted} /> : <Feather name="refresh-cw" size={12} color={theme.textMuted} />}
              <Text style={[styles.regenText, { color: theme.textMuted }]}>Regenerate link (invalidates old one)</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {/* Shift Schedule / Rota Section */}
      <View style={styles.sectionHeaderRow}>
        <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginBottom: 0 }]}>SHIFT SCHEDULE</Text>
        {isHOD && rotaShifts.length < 5 ? (
          <Pressable style={({ pressed }) => [styles.addShiftBtn, { backgroundColor: theme.primaryLight, opacity: pressed ? 0.7 : 1 }]} onPress={openAddShift}>
            <Feather name="plus" size={14} color={theme.primary} />
            <Text style={[styles.addShiftText, { color: theme.primary }]}>Add Shift</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={[styles.rotaNote, { color: theme.textMuted }]}>
        Roster = who is scheduled. Live check-ins are shown in the HOD Dashboard.
      </Text>

      {rotaShifts.length === 0 ? (
        <View style={[styles.emptyShift, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Feather name="calendar" size={28} color={theme.textMuted} />
          <Text style={[styles.emptyShiftText, { color: theme.textSecondary }]}>No shifts configured yet.</Text>
          {isHOD ? <Text style={[styles.emptyShiftSub, { color: theme.textMuted }]}>Tap "Add Shift" to create your first shift.</Text> : null}
        </View>
      ) : (
        rotaShifts.map((shift, sIdx) => {
          const color = SHIFT_COLORS[sIdx % SHIFT_COLORS.length];
          const shiftAssignments = rotaAssignments.filter((a) => a.shiftId === shift.id);
          const isExpanded = expandedShift === shift.id;
          return (
            <View key={shift.id} style={[styles.shiftCard, { backgroundColor: theme.card, borderLeftColor: color }]}>
              <Pressable style={styles.shiftHeader} onPress={() => setExpandedShift(isExpanded ? null : shift.id)}>
                <View style={[styles.shiftDot, { backgroundColor: color }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.shiftName, { color: theme.text }]}>{shift.name}</Text>
                  <Text style={[styles.shiftTime, { color: theme.textSecondary }]}>{shift.startTime} – {shift.endTime}  ·  {shiftAssignments.length} rostered</Text>
                </View>
                {isHOD ? (
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    <Pressable style={[styles.iconBtn, { backgroundColor: theme.primaryLight }]} onPress={() => openEditShift(shift)}>
                      <Feather name="edit-2" size={14} color={theme.primary} />
                    </Pressable>
                    <Pressable style={[styles.iconBtn, { backgroundColor: theme.dangerLight || "#fee2e2" }]} onPress={() => deleteShift(shift)}>
                      <Feather name="trash-2" size={14} color={theme.danger} />
                    </Pressable>
                  </View>
                ) : null}
                <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={theme.textMuted} style={{ marginLeft: 6 }} />
              </Pressable>

              {isExpanded ? (
                <View style={[styles.shiftBody, { borderTopColor: theme.border }]}>
                  <View style={styles.slotRow}>
                    <Text style={[styles.slotLabel, { color: theme.textMuted }]}>Max consultants: {shift.maxConsultants ?? 2}</Text>
                    <Text style={[styles.slotLabel, { color: theme.textMuted }]}>Max residents: {shift.maxResidents ?? 6}</Text>
                  </View>

                  {shiftAssignments.length === 0 ? (
                    <Text style={[styles.noMembersText, { color: theme.textMuted }]}>No members assigned to this shift's rota.</Text>
                  ) : (
                    shiftAssignments.map((assignment) => (
                      <View key={assignment.id} style={[styles.assignedRow, { borderBottomColor: theme.border }]}>
                        <View style={[styles.assignedAvatar, { backgroundColor: theme.primaryLight }]}>
                          <Text style={[styles.assignedAvatarText, { color: theme.primary }]}>
                            {getMemberName(assignment.memberUserId).charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.assignedName, { color: theme.text }]} numberOfLines={1}>{getMemberName(assignment.memberUserId)}</Text>
                          <Text style={[styles.assignedMeta, { color: theme.textSecondary }]}>
                            {getMemberRole(assignment.memberUserId)}
                            {assignment.customEndTime ? ` · Extra until ${assignment.customEndTime}` : ""}
                          </Text>
                        </View>
                        {isHOD ? (
                          <View style={{ flexDirection: "row", gap: 6 }}>
                            <Pressable
                              style={[styles.extraBtn, { backgroundColor: "#f0fdf4", borderColor: "#10b981" }]}
                              onPress={() => { setExtraTimeModal(assignment); setExtraTimeValue(assignment.customEndTime || ""); }}
                            >
                              <Feather name="clock" size={12} color="#10b981" />
                              <Text style={[styles.extraBtnText, { color: "#10b981" }]}>Extra</Text>
                            </Pressable>
                            <Pressable style={[styles.iconBtn, { backgroundColor: theme.dangerLight || "#fee2e2" }]} onPress={() => handleRemoveRotaMember(assignment)}>
                              <Feather name="x" size={14} color={theme.danger} />
                            </Pressable>
                          </View>
                        ) : null}
                      </View>
                    ))
                  )}

                  {isHOD ? (
                    <Pressable
                      style={({ pressed }) => [styles.assignMemberBtn, { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.7 : 1 }]}
                      onPress={() => { setAddMemberModal(shift.id); setSelectedMemberId(null); setAddMemberExtra(""); setAddMemberExtraOn(false); }}
                    >
                      <Feather name="user-plus" size={15} color={theme.primary} />
                      <Text style={[styles.assignMemberBtnText, { color: theme.primary }]}>Assign Member</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}
            </View>
          );
        })
      )}

      <View style={{ height: Spacing.lg }} />

      {loading ? <ActivityIndicator style={{ marginTop: 20 }} color={theme.primary} /> : (
        <>
          {/* Pending requests */}
          {pendingMembers.length > 0 ? (
            <>
              <View style={styles.pendingHeader}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginBottom: 0 }]}>PENDING REQUESTS ({pendingMembers.length})</Text>
                <View style={[styles.pendingBadge, { backgroundColor: "#f59e0b20" }]}>
                  <Feather name="clock" size={12} color="#f59e0b" />
                  <Text style={[styles.pendingBadgeText, { color: "#f59e0b" }]}>Awaiting approval</Text>
                </View>
              </View>
              <View style={[styles.card, { backgroundColor: theme.card, marginBottom: Spacing.lg }]}>
                {pendingMembers.map((m) => (
                  <View key={m.id} style={[styles.pendingRow, { borderBottomColor: theme.border }]}>
                    <View style={[styles.avatar, { backgroundColor: "#f59e0b20" }]}>
                      <Text style={[styles.avatarText, { color: "#f59e0b" }]}>{(m.name || m.email || "?").charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>{m.name || m.email || "Unknown"}</Text>
                      <Text style={[styles.memberRole, { color: theme.textSecondary }]}>{ROLE_DISPLAY[m.role] || m.role}{m.email ? ` · ${m.email}` : ""}</Text>
                    </View>
                    <View style={styles.approvalBtns}>
                      <Pressable
                        style={({ pressed }) => [styles.declineBtn, { borderColor: theme.danger, opacity: pressed || decliningId === m.id || approvingId === m.id ? 0.7 : 1 }]}
                        onPress={() => handleDecline(m)} disabled={approvingId === m.id || decliningId === m.id}
                      >
                        {decliningId === m.id ? <ActivityIndicator size="small" color={theme.danger} /> : <Feather name="x" size={16} color={theme.danger} />}
                      </Pressable>
                      <Pressable
                        style={({ pressed }) => [styles.approveBtn, { backgroundColor: theme.primary, opacity: pressed || approvingId === m.id || decliningId === m.id ? 0.7 : 1 }]}
                        onPress={() => handleApprove(m)} disabled={approvingId === m.id || decliningId === m.id}
                      >
                        {approvingId === m.id ? <ActivityIndicator size="small" color="#fff" /> : (
                          <><Feather name="check" size={14} color="#fff" /><Text style={styles.approveBtnText}>Approve</Text></>
                        )}
                      </Pressable>
                    </View>
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* Active members */}
          {(hodMember || activeMembers.length > 0) ? (
            <>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ACTIVE MEMBERS ({activeMembers.length + (hodMember ? 1 : 0)})</Text>
              <View style={[styles.card, { backgroundColor: theme.card }]}>
                {hodMember ? (
                  <View style={[styles.memberRow, { borderBottomColor: theme.border }]}>
                    <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
                      <Text style={[styles.avatarText, { color: theme.primary }]}>{(hodMember.name || hodMember.email || "?").charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>{hodMember.name || hodMember.email?.split("@")[0] || hodMember.userId}</Text>
                      <Text style={[styles.memberRole, { color: theme.textSecondary }]}>HOD{hodMember.email ? ` · ${hodMember.email}` : ""}</Text>
                    </View>
                  </View>
                ) : null}
                {activeMembers.map((m) => (
                  <View key={m.id} style={[styles.memberRow, { borderBottomColor: theme.border }]}>
                    <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
                      <Text style={[styles.avatarText, { color: theme.primary }]}>{(m.name || m.email || "?").charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>{m.name || m.email?.split("@")[0] || m.userId}</Text>
                      <Text style={[styles.memberRole, { color: theme.textSecondary }]}>{ROLE_DISPLAY[m.role] || m.role}{m.email ? ` · ${m.email}` : ""}</Text>
                    </View>
                    <Pressable style={styles.removeBtn} onPress={() => handleRemove(m)}>
                      <Feather name="trash-2" size={16} color={theme.danger} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </>
          ) : pendingMembers.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Feather name="users" size={32} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No team members yet</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>Share the invite link above with your team on WhatsApp.</Text>
            </View>
          ) : null}

          {activeMembers.length >= 2 && !(department as any).billingActive ? (
            <Pressable
              style={({ pressed }) => [styles.subscriptionCta, { backgroundColor: theme.primaryLight, borderColor: theme.primary + "40", opacity: pressed ? 0.85 : 1 }]}
              onPress={() => navigation.navigate("MySubscriptions")}
            >
              <Feather name="zap" size={20} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.ctaTitle, { color: theme.primary }]}>Activate Team Plan</Text>
                <Text style={[styles.ctaText, { color: theme.textSecondary }]}>You have {activeMembers.length + 1} active members. Unlock all team features.</Text>
              </View>
              <Feather name="chevron-right" size={18} color={theme.primary} />
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>

    {/* Edit / Add Shift Modal */}
    <Modal visible={editShiftModal} transparent animationType="slide" onRequestClose={() => setEditShiftModal(false)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: theme.text }]}>{editingShift ? "Edit Shift" : "Add Shift"}</Text>

          <Text style={[styles.fieldLabel, { color: theme.text }]}>Shift Name</Text>
          <TextInput
            style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
            value={editName}
            onChangeText={setEditName}
            placeholder="e.g. Morning, Evening, Night, Shift A..."
            placeholderTextColor={theme.textMuted}
          />

          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Start Time</Text>
              <Pressable
                style={[styles.timePill, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
                onPress={() => { setTimeTarget("start"); setTimeValue(editStart); setTimeModal(true); }}
              >
                <Feather name="clock" size={14} color={theme.primary} />
                <Text style={[styles.timePillText, { color: theme.text }]}>{editStart}</Text>
              </Pressable>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>End Time</Text>
              <Pressable
                style={[styles.timePill, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}
                onPress={() => { setTimeTarget("end"); setTimeValue(editEnd); setTimeModal(true); }}
              >
                <Feather name="clock" size={14} color={theme.primary} />
                <Text style={[styles.timePillText, { color: theme.text }]}>{editEnd}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.timeRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Max Consultants</Text>
              <View style={styles.stepperRow}>
                <Pressable style={[styles.stepBtn, { backgroundColor: theme.backgroundSecondary }]} onPress={() => setEditMaxCon((v) => String(Math.max(0, parseInt(v) - 1)))}>
                  <Feather name="minus" size={16} color={theme.text} />
                </Pressable>
                <Text style={[styles.stepValue, { color: theme.text }]}>{editMaxCon}</Text>
                <Pressable style={[styles.stepBtn, { backgroundColor: theme.backgroundSecondary }]} onPress={() => setEditMaxCon((v) => String(parseInt(v) + 1))}>
                  <Feather name="plus" size={16} color={theme.text} />
                </Pressable>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fieldLabel, { color: theme.text }]}>Max Residents</Text>
              <View style={styles.stepperRow}>
                <Pressable style={[styles.stepBtn, { backgroundColor: theme.backgroundSecondary }]} onPress={() => setEditMaxRes((v) => String(Math.max(0, parseInt(v) - 1)))}>
                  <Feather name="minus" size={16} color={theme.text} />
                </Pressable>
                <Text style={[styles.stepValue, { color: theme.text }]}>{editMaxRes}</Text>
                <Pressable style={[styles.stepBtn, { backgroundColor: theme.backgroundSecondary }]} onPress={() => setEditMaxRes((v) => String(parseInt(v) + 1))}>
                  <Feather name="plus" size={16} color={theme.text} />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.modalBtns}>
            <Pressable style={[styles.modalCancelBtn, { borderColor: theme.border }]} onPress={() => setEditShiftModal(false)}>
              <Text style={{ color: theme.textSecondary, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]} onPress={saveShift} disabled={savingShift}>
              {savingShift ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: "#fff", fontWeight: "700" }}>{editingShift ? "Save" : "Add Shift"}</Text>}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>

    {/* Assign Member Modal */}
    <Modal visible={!!addMemberModal} transparent animationType="slide" onRequestClose={() => setAddMemberModal(null)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: theme.text }]}>Assign to Rota</Text>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>Select a team member:</Text>
          <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={false}>
            {rotaMembers.filter((m) => m.role !== "hod").map((m) => {
              const alreadyAssigned = rotaAssignments.some((a) => a.shiftId === addMemberModal && a.memberUserId === m.userId);
              const isSelected = selectedMemberId === m.userId;
              return (
                <Pressable
                  key={m.userId}
                  style={[styles.memberPickRow, { backgroundColor: isSelected ? theme.primaryLight : theme.backgroundSecondary, opacity: alreadyAssigned ? 0.4 : 1 }]}
                  onPress={() => !alreadyAssigned && setSelectedMemberId(m.userId)}
                  disabled={alreadyAssigned}
                >
                  <View style={[styles.assignedAvatar, { backgroundColor: isSelected ? theme.primary + "30" : theme.card }]}>
                    <Text style={[styles.assignedAvatarText, { color: isSelected ? theme.primary : theme.text }]}>{(m.name || m.email || "?").charAt(0).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.assignedName, { color: theme.text }]} numberOfLines={1}>{m.name || m.email?.split("@")[0]}</Text>
                    <Text style={[styles.assignedMeta, { color: theme.textSecondary }]}>{ROLE_DISPLAY[m.role] || m.role}{alreadyAssigned ? " · Already assigned" : ""}</Text>
                  </View>
                  {isSelected ? <Feather name="check-circle" size={18} color={theme.primary} /> : null}
                </Pressable>
              );
            })}
          </ScrollView>

          <View style={[styles.extraTimeToggle, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="clock" size={15} color={addMemberExtraOn ? "#10b981" : theme.textMuted} />
            <Text style={[styles.extraTimeLabel, { color: theme.text }]}>Add extra time (extended end)</Text>
            <Pressable
              style={[styles.toggleBtn, { backgroundColor: addMemberExtraOn ? "#10b981" : theme.border }]}
              onPress={() => setAddMemberExtraOn((v) => !v)}
            >
              <View style={[styles.toggleThumb, { left: addMemberExtraOn ? 18 : 2 }]} />
            </Pressable>
          </View>
          {addMemberExtraOn ? (
            <Pressable
              style={[styles.timePill, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, marginTop: 8 }]}
              onPress={() => { setTimeTarget("extra"); setTimeValue(addMemberExtra || "16:00"); setTimeModal(true); }}
            >
              <Feather name="clock" size={14} color="#10b981" />
              <Text style={[styles.timePillText, { color: theme.text }]}>{addMemberExtra || "Tap to set end time"}</Text>
            </Pressable>
          ) : null}

          <View style={styles.modalBtns}>
            <Pressable style={[styles.modalCancelBtn, { borderColor: theme.border }]} onPress={() => setAddMemberModal(null)}>
              <Text style={{ color: theme.textSecondary, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
            <Pressable
              style={[styles.modalSaveBtn, { backgroundColor: selectedMemberId ? theme.primary : theme.backgroundSecondary }]}
              onPress={handleAddRotaMember}
              disabled={!selectedMemberId || addingMember}
            >
              {addingMember ? <ActivityIndicator size="small" color="#fff" /> : (
                <Text style={{ color: selectedMemberId ? "#fff" : theme.textMuted, fontWeight: "700" }}>Assign</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>

    {/* Extra Time Modal */}
    <Modal visible={!!extraTimeModal} transparent animationType="fade" onRequestClose={() => setExtraTimeModal(null)}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
          <View style={styles.modalHandle} />
          <Text style={[styles.modalTitle, { color: theme.text }]}>Extra Time</Text>
          <Text style={[styles.fieldLabel, { color: theme.textSecondary }]}>
            {extraTimeModal ? `${getMemberName(extraTimeModal.memberUserId)} — extended end time` : ""}
          </Text>
          <Pressable
            style={[styles.timePill, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border, marginTop: Spacing.sm }]}
            onPress={() => { setTimeTarget("extra"); setTimeValue(extraTimeValue || "16:00"); setTimeModal(true); }}
          >
            <Feather name="clock" size={14} color="#10b981" />
            <Text style={[styles.timePillText, { color: theme.text }]}>{extraTimeValue || "Tap to set end time"}</Text>
          </Pressable>
          {extraTimeValue ? (
            <Pressable onPress={() => setExtraTimeValue("")} style={styles.clearExtra}>
              <Feather name="x-circle" size={14} color={theme.danger} />
              <Text style={[styles.clearExtraText, { color: theme.danger }]}>Clear extra time</Text>
            </Pressable>
          ) : null}
          <View style={styles.modalBtns}>
            <Pressable style={[styles.modalCancelBtn, { borderColor: theme.border }]} onPress={() => setExtraTimeModal(null)}>
              <Text style={{ color: theme.textSecondary, fontWeight: "600" }}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.modalSaveBtn, { backgroundColor: theme.primary }]} onPress={saveExtraTime}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>Save</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>

    {/* Time Picker Modal */}
    <TimeStepModal
      visible={timeModal}
      value={timeValue}
      title={timeTarget === "start" ? "Start Time" : timeTarget === "end" ? "End Time" : "Extended End Time"}
      theme={theme}
      onClose={() => setTimeModal(false)}
      onConfirm={(t) => {
        setTimeModal(false);
        if (timeTarget === "start") setEditStart(t);
        else if (timeTarget === "end") setEditEnd(t);
        else {
          setAddMemberExtra(t);
          setExtraTimeValue(t);
        }
      }}
    />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: Spacing.sm },
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  addShiftBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  addShiftText: { fontSize: 13, fontWeight: "700" },
  card: { borderRadius: BorderRadius.lg, overflow: "hidden", marginBottom: Spacing.lg },
  linkCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.lg, gap: 10 },
  linkText: { fontSize: 12, fontFamily: "monospace", lineHeight: 18 },
  linkActions: { flexDirection: "row", gap: 8 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.sm },
  linkBtnText: { fontSize: 13, fontWeight: "600" },
  regenRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 4 },
  regenText: { fontSize: 12 },
  shiftCard: { borderRadius: BorderRadius.lg, overflow: "hidden", marginBottom: Spacing.sm, borderLeftWidth: 4 },
  shiftHeader: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, gap: 10 },
  shiftDot: { width: 10, height: 10, borderRadius: 5 },
  shiftName: { fontSize: 15, fontWeight: "700" },
  shiftTime: { fontSize: 12, marginTop: 2 },
  shiftBody: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, borderTopWidth: 1 },
  slotRow: { flexDirection: "row", gap: 16, paddingVertical: Spacing.sm },
  slotLabel: { fontSize: 12 },
  iconBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  noMembersText: { fontSize: 13, paddingVertical: Spacing.sm, fontStyle: "italic" },
  assignedRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderBottomWidth: 0.5, gap: 10 },
  assignedAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  assignedAvatarText: { fontSize: 12, fontWeight: "700" },
  assignedName: { fontSize: 14, fontWeight: "600" },
  assignedMeta: { fontSize: 11, marginTop: 1 },
  extraBtn: { flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 6, borderWidth: 1 },
  extraBtnText: { fontSize: 11, fontWeight: "700" },
  assignMemberBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 10, marginTop: Spacing.sm },
  assignMemberBtnText: { fontSize: 14, fontWeight: "600" },
  emptyShift: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.xl, alignItems: "center", gap: 8, marginBottom: Spacing.lg },
  emptyShiftText: { fontSize: 14, fontWeight: "600" },
  emptyShiftSub: { fontSize: 12 },
  pendingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  pendingBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pendingBadgeText: { fontSize: 11, fontWeight: "700" },
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderBottomWidth: 1, gap: 10 },
  pendingRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderBottomWidth: 1, gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontWeight: "700" },
  memberName: { fontSize: 14, fontWeight: "600" },
  memberRole: { fontSize: 12, marginTop: 2 },
  removeBtn: { padding: 8 },
  approvalBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  declineBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  approveBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  approveBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  emptyBox: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.xl, alignItems: "center", gap: Spacing.sm, marginTop: Spacing.lg },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 4 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  subscriptionCta: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginTop: Spacing.sm },
  ctaTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  ctaText: { fontSize: 13, lineHeight: 18 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.lg, paddingBottom: 36, gap: Spacing.sm },
  modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#d1d5db", alignSelf: "center", marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "800", marginBottom: 4 },
  fieldLabel: { fontSize: 13, fontWeight: "600", marginBottom: 4, marginTop: 4 },
  textInput: { borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  timeRow: { flexDirection: "row", gap: 12 },
  timePill: { flexDirection: "row", alignItems: "center", gap: 6, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10 },
  timePillText: { fontSize: 15, fontWeight: "600" },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  stepValue: { fontSize: 18, fontWeight: "700", minWidth: 24, textAlign: "center" },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: Spacing.sm },
  modalCancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  modalSaveBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
  memberPickRow: { flexDirection: "row", alignItems: "center", padding: Spacing.sm, borderRadius: 10, marginBottom: 6, gap: 10 },
  extraTimeToggle: { flexDirection: "row", alignItems: "center", gap: 8, padding: Spacing.sm, borderRadius: 10, marginTop: Spacing.sm },
  extraTimeLabel: { flex: 1, fontSize: 13, fontWeight: "600" },
  rotaNote: { fontSize: 11, marginBottom: Spacing.sm, fontStyle: "italic" },
  toggleBtn: { width: 42, height: 24, borderRadius: 12, position: "relative" },
  toggleThumb: { position: "absolute", top: 2, width: 20, height: 20, borderRadius: 10, backgroundColor: "#fff" },
  clearExtra: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", marginTop: 6 },
  clearExtraText: { fontSize: 12 },
});
