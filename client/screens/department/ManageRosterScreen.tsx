import React, { useState, useCallback, useEffect } from "react";
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
  Dimensions,
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

// ── Constants ───────────────────────────────────────────────────────────────
const ROLE_DISPLAY: Record<string, string> = { hod: "HOD", consultant: "Consultant", resident: "Resident" };
const SHIFT_ROW_COLORS = ["#F59E0B", "#7C6AF6", "#374151", "#3b82f6", "#10b981"];
const MEMBER_ROLE_COLORS: Record<string, string> = { hod: "#7C6AF6", consultant: "#7C6AF6", resident: "#10b981" };
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const MONTH_FULL = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const SCREEN_W = Dimensions.get("window").width;
const H_PAD = Spacing.lg;
const LEFT_COL = 44;
const DAY_COL = Math.max(38, Math.floor((SCREEN_W - H_PAD * 2 - LEFT_COL) / 7));
const CELL_H = 62;

// Navigation limits (months)
const MONTHS_BACK = 2;
const MONTHS_FORWARD = 3;

// ── Date helpers ─────────────────────────────────────────────────────────────
function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function getMonthFirstDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

type DayInfo = {
  label: string;
  dateNum: number;
  month: string;
  dateStr: string;
  isToday: boolean;
  isPast: boolean;
  inMonth: boolean;
};

type WeekData = {
  weekLabel: string;
  days: DayInfo[];
};

function getWeeksOfMonth(monthDate: Date): WeekData[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const start = getMonday(firstDay);
  const weeks: WeekData[] = [];

  let current = new Date(start);
  while (current <= lastDayOfMonth) {
    const days: DayInfo[] = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(current);
      d.setDate(current.getDate() + i);
      return {
        label: DAY_LABELS[i],
        dateNum: d.getDate(),
        month: MONTH_LABELS[d.getMonth()],
        dateStr: formatDate(d),
        isToday: d.toDateString() === today.toDateString(),
        isPast: d < today,
        inMonth: d.getMonth() === month,
      };
    });
    weeks.push({
      weekLabel: `${days[0].dateNum} ${days[0].month} – ${days[6].dateNum} ${days[6].month}`,
      days,
    });
    current.setDate(current.getDate() + 7);
  }
  return weeks;
}

// ── Time picker modal ────────────────────────────────────────────────────────
function TimeStepModal({
  visible, value, title, onConfirm, onClose, theme,
}: {
  visible: boolean; value: string; title: string;
  onConfirm: (t: string) => void; onClose: () => void; theme: any;
}) {
  const [h, setH] = useState(0);
  const [m, setM] = useState(0);

  useEffect(() => {
    if (visible && value) {
      const parts = value.split(":").map(Number);
      setH(isNaN(parts[0]) ? 0 : parts[0]);
      setM(isNaN(parts[1]) ? 0 : parts[1]);
    }
  }, [visible, value]);

  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={tStyles.overlay}>
        <View style={[tStyles.sheet, { backgroundColor: theme.card }]}>
          <Text style={[tStyles.title, { color: theme.text }]}>{title}</Text>
          <View style={tStyles.row}>
            <View style={tStyles.wheel}>
              <Pressable onPress={() => setH((p) => (p + 1) % 24)} style={tStyles.arrow}>
                <Feather name="chevron-up" size={24} color={theme.primary} />
              </Pressable>
              <Text style={[tStyles.digit, { color: theme.text }]}>{pad(h)}</Text>
              <Pressable onPress={() => setH((p) => (p - 1 + 24) % 24)} style={tStyles.arrow}>
                <Feather name="chevron-down" size={24} color={theme.primary} />
              </Pressable>
            </View>
            <Text style={[tStyles.colon, { color: theme.text }]}>:</Text>
            <View style={tStyles.wheel}>
              <Pressable onPress={() => setM((p) => (p + 5) % 60)} style={tStyles.arrow}>
                <Feather name="chevron-up" size={24} color={theme.primary} />
              </Pressable>
              <Text style={[tStyles.digit, { color: theme.text }]}>{pad(m)}</Text>
              <Pressable onPress={() => setM((p) => (p - 5 + 60) % 60)} style={tStyles.arrow}>
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

// ── Grid cell ─────────────────────────────────────────────────────────────────
function RotaGridCell({
  assignments, rotaMembers, isToday, isPast, dimmed, onTap, theme,
}: {
  assignments: any[]; rotaMembers: any[]; isToday: boolean;
  isPast: boolean; dimmed?: boolean; onTap: () => void; theme: any;
}) {
  const assigned = assignments
    .map((a) => rotaMembers.find((m) => m.userId === a.memberUserId))
    .filter(Boolean);

  return (
    <Pressable
      onPress={onTap}
      style={({ pressed }) => ({
        width: DAY_COL - 4,
        height: CELL_H,
        backgroundColor: isToday ? "rgba(29,184,112,0.09)" : theme.card,
        borderWidth: 1.5,
        borderColor: isToday ? "rgba(29,184,112,0.32)" : theme.border,
        borderRadius: 10,
        margin: 2,
        alignItems: "center",
        justifyContent: "center",
        opacity: pressed ? 0.65 : (isPast || dimmed) ? 0.4 : 1,
      })}
    >
      {assigned.length === 0 ? (
        <View style={{
          width: 22, height: 22, borderRadius: 11,
          borderWidth: 1.5, borderColor: theme.border,
          alignItems: "center", justifyContent: "center",
        }}>
          <Feather name="plus" size={10} color={theme.textMuted} />
        </View>
      ) : (
        <View style={{ flexDirection: "row" }}>
          {assigned.slice(0, 2).map((mem, i) => (
            <View key={mem.userId} style={{
              width: 22, height: 22, borderRadius: 11,
              backgroundColor: MEMBER_ROLE_COLORS[mem.role] || "#10b981",
              alignItems: "center", justifyContent: "center",
              marginLeft: i > 0 ? -6 : 0,
              borderWidth: 1.5, borderColor: theme.card,
            }}>
              <Text style={{ color: "#fff", fontSize: 8, fontWeight: "800" }}>
                {(mem.name || mem.email || "?").charAt(0).toUpperCase()}
              </Text>
            </View>
          ))}
          {assigned.length > 2 && (
            <View style={{
              width: 22, height: 22, borderRadius: 11,
              backgroundColor: theme.backgroundSecondary,
              alignItems: "center", justifyContent: "center",
              marginLeft: -6, borderWidth: 1.5, borderColor: theme.card,
            }}>
              <Text style={{ color: theme.textMuted, fontSize: 8, fontWeight: "800" }}>+{assigned.length - 2}</Text>
            </View>
          )}
        </View>
      )}
    </Pressable>
  );
}

// ── Assign sheet (bottom modal) ──────────────────────────────────────────────
type GridSheet = {
  shiftId: number;
  dateStr: string;
  dayLabel: string;
  dateLabel: string;
} | null;

function AssignSheet({
  visible, gridSheet, rotaShifts, rotaAssignments, rotaMembers,
  theme, isHOD, onAssign, onRemove, onClose, assigningId, removingId,
}: {
  visible: boolean; gridSheet: GridSheet;
  rotaShifts: any[]; rotaAssignments: any[]; rotaMembers: any[];
  theme: any; isHOD: boolean;
  onAssign: (userId: string) => void; onRemove: (assignmentId: number) => void;
  onClose: () => void; assigningId: string | null; removingId: number | null;
}) {
  if (!gridSheet) return null;

  const shift = rotaShifts.find((s) => s.id === gridSheet.shiftId);
  const shiftIdx = rotaShifts.findIndex((s) => s.id === gridSheet.shiftId);
  const shiftColor = SHIFT_ROW_COLORS[shiftIdx % SHIFT_ROW_COLORS.length];

  const cellAssignments = rotaAssignments.filter(
    (a) => a.shiftId === gridSheet.shiftId && a.date === gridSheet.dateStr,
  );
  const assignedUserIds = new Set(cellAssignments.map((a) => a.memberUserId));
  const assignedMembers = cellAssignments.map((a) => ({
    assignment: a,
    member: rotaMembers.find((m) => m.userId === a.memberUserId),
  })).filter((x) => x.member);
  const availableMembers = rotaMembers.filter((m) => !assignedUserIds.has(m.userId) && m.role !== "hod");

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={asStyles.backdrop} onPress={onClose}>
        <Pressable style={[asStyles.sheet, { backgroundColor: theme.card }]} onPress={() => {}}>
          <View style={[asStyles.handle, { backgroundColor: theme.border }]} />

          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <View style={{ width: 9, height: 9, borderRadius: 4.5, backgroundColor: shiftColor }} />
            <Text style={[asStyles.sheetTitle, { color: theme.text }]}>
              {shift?.name || "Shift"} · {gridSheet.dayLabel}
            </Text>
          </View>
          <Text style={[asStyles.sheetSub, { color: theme.textMuted }]}>
            {shift?.startTime}–{shift?.endTime} · {gridSheet.dateLabel}
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 16 }}>
            {assignedMembers.length > 0 && (
              <View style={{ marginBottom: 18 }}>
                <Text style={[asStyles.sectionLabel, { color: theme.textMuted }]}>
                  ASSIGNED ({assignedMembers.length})
                </Text>
                {assignedMembers.map(({ assignment, member }) => (
                  <View key={assignment.id} style={[asStyles.memberRow, { backgroundColor: theme.backgroundSecondary }]}>
                    <View style={[asStyles.avatar, { backgroundColor: MEMBER_ROLE_COLORS[member.role] || "#10b981" }]}>
                      <Text style={asStyles.avatarText}>
                        {(member.name || member.email || "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[asStyles.memberName, { color: theme.text }]} numberOfLines={1}>
                        {member.name || member.email?.split("@")[0] || "Unknown"}
                      </Text>
                      <Text style={[asStyles.memberRole, { color: theme.textMuted }]}>
                        {ROLE_DISPLAY[member.role] || member.role}
                      </Text>
                    </View>
                    {isHOD && (
                      <Pressable
                        style={[asStyles.removeBtn, { backgroundColor: "#fee2e215" }]}
                        onPress={() => onRemove(assignment.id)}
                        disabled={removingId === assignment.id}
                      >
                        {removingId === assignment.id
                          ? <ActivityIndicator size="small" color="#ef4444" />
                          : <Feather name="x" size={15} color="#ef4444" />}
                      </Pressable>
                    )}
                  </View>
                ))}
              </View>
            )}

            {isHOD && (
              <>
                <Text style={[asStyles.sectionLabel, { color: theme.textMuted }]}>ADD TO THIS SHIFT</Text>
                {availableMembers.length === 0 ? (
                  <Text style={[asStyles.emptyNote, { color: theme.textMuted }]}>
                    All team members assigned to this slot
                  </Text>
                ) : availableMembers.map((member) => (
                  <Pressable
                    key={member.userId}
                    style={({ pressed }) => [asStyles.availRow, { backgroundColor: theme.backgroundDefault, borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => onAssign(member.userId)}
                    disabled={!!assigningId}
                  >
                    <View style={[asStyles.avatar, { backgroundColor: MEMBER_ROLE_COLORS[member.role] || "#10b981" }]}>
                      <Text style={asStyles.avatarText}>
                        {(member.name || member.email || "?").charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[asStyles.memberName, { color: theme.text }]} numberOfLines={1}>
                        {member.name || member.email?.split("@")[0] || "Unknown"}
                      </Text>
                      <Text style={[asStyles.memberRole, { color: theme.textMuted }]}>
                        {ROLE_DISPLAY[member.role] || member.role}
                      </Text>
                    </View>
                    {assigningId === member.userId
                      ? <ActivityIndicator size="small" color="#1DB870" />
                      : (
                        <View style={asStyles.assignBadge}>
                          <Text style={asStyles.assignBadgeText}>Assign</Text>
                        </View>
                      )}
                  </Pressable>
                ))}
              </>
            )}

            {!isHOD && assignedMembers.length === 0 && (
              <Text style={[asStyles.emptyNote, { color: theme.textMuted, textAlign: "center", paddingVertical: 12 }]}>
                No one assigned to this slot yet
              </Text>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const asStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 20, paddingBottom: 36, maxHeight: "80%" },
  handle: { width: 38, height: 4, borderRadius: 99, alignSelf: "center", marginBottom: 18 },
  sheetTitle: { fontSize: 16, fontWeight: "800" },
  sheetSub: { fontSize: 12, marginBottom: 18 },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, marginBottom: 10 },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, padding: 10, marginBottom: 8 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { color: "#fff", fontSize: 13, fontWeight: "800" },
  memberName: { fontSize: 13, fontWeight: "700" },
  memberRole: { fontSize: 11, marginTop: 1, textTransform: "capitalize" },
  removeBtn: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  availRow: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1.5, padding: 10, marginBottom: 8 },
  emptyNote: { fontSize: 12, textAlign: "center", paddingVertical: 12 },
  assignBadge: { backgroundColor: "rgba(29,184,112,0.12)", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5 },
  assignBadgeText: { color: "#15924F", fontSize: 11, fontWeight: "700" },
});

// ══════════════════════════════════════════════════════════════════════════
// MAIN SCREEN
// ══════════════════════════════════════════════════════════════════════════
export default function ManageRosterScreen() {
  const { theme } = useTheme();
  const { user, token } = useAuth();
  const { department, refresh: refreshDept } = useDepartment();
  const navigation = useNavigation<Nav>();
  const headerHeight = useHeaderHeight();

  // ── Roster state ──
  const [members, setMembers] = useState<any[]>([]);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [decliningId, setDecliningId] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  // ── Rota data ──
  const [rotaShifts, setRotaShifts] = useState<any[]>([]);
  const [rotaAssignments, setRotaAssignments] = useState<any[]>([]);
  const [rotaMembers, setRotaMembers] = useState<any[]>([]);
  const [rotaLoading, setRotaLoading] = useState(false);

  // ── Month navigation ──
  const [monthStart, setMonthStart] = useState<Date>(() => getMonthFirstDay(new Date()));
  const todayMonthFirst = getMonthFirstDay(new Date());
  const minMonth = new Date(todayMonthFirst.getFullYear(), todayMonthFirst.getMonth() - MONTHS_BACK, 1);
  const maxMonth = new Date(todayMonthFirst.getFullYear(), todayMonthFirst.getMonth() + MONTHS_FORWARD, 1);
  const canGoPrevMonth = monthStart > minMonth;
  const canGoNextMonth = monthStart < maxMonth;
  const isCurrentMonth =
    monthStart.getFullYear() === todayMonthFirst.getFullYear() &&
    monthStart.getMonth() === todayMonthFirst.getMonth();

  // ── Grid UI ──
  const [viewMode, setViewMode] = useState<"grid" | "my">("grid");
  const [gridSheet, setGridSheet] = useState<GridSheet>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [showShiftMgmt, setShowShiftMgmt] = useState(false);

  // ── Shift edit ──
  const [editShiftModal, setEditShiftModal] = useState(false);
  const [editingShift, setEditingShift] = useState<any | null>(null);
  const [editName, setEditName] = useState("");
  const [editStart, setEditStart] = useState("08:00");
  const [editEnd, setEditEnd] = useState("14:00");
  const [editMaxCon, setEditMaxCon] = useState("2");
  const [editMaxRes, setEditMaxRes] = useState("6");
  const [savingShift, setSavingShift] = useState(false);
  const [timeModal, setTimeModal] = useState(false);
  const [timeTarget, setTimeTarget] = useState<"start" | "end">("start");
  const [timeValue, setTimeValue] = useState("08:00");

  const isHOD =
    members.find((m) => m.userId === (user as any)?.id || m.email === (user as any)?.email)?.role === "hod" ||
    department?.hodUserId === (user as any)?.id;

  const myId = (user as any)?.id;

  // ── Computed month data ──
  const monthWeeks = getWeeksOfMonth(monthStart);
  const monthLabel = `${MONTH_FULL[monthStart.getMonth()]} ${monthStart.getFullYear()}`;
  const allMonthDays = monthWeeks.flatMap((w) => w.days.filter((d) => d.inMonth));

  const getCellAssignments = (shiftId: number, dateStr: string) =>
    rotaAssignments.filter((a) => a.shiftId === shiftId && a.date === dateStr);

  // ── Monthly stats ──
  const totalSlots = rotaShifts.length * allMonthDays.length;
  const filledSlots = rotaShifts.reduce(
    (acc, s) => acc + allMonthDays.filter((d) => getCellAssignments(s.id, d.dateStr).length > 0).length,
    0,
  );
  const openSlots = totalSlots - filledSlots;

  // ── My schedule helpers ──
  const myMonthAssignments = monthWeeks.flatMap((week) =>
    week.days.flatMap((day) =>
      rotaAssignments
        .filter((a) => a.memberUserId === myId && a.date === day.dateStr)
        .map((a) => ({ ...a, shift: rotaShifts.find((s) => s.id === a.shiftId), day }))
        .filter((x) => x.shift),
    ),
  );

  const openSlotsForClaiming = monthWeeks.flatMap((week) =>
    week.days
      .filter((day) => !day.isPast && day.inMonth)
      .flatMap((day) =>
        rotaShifts
          .filter((shift) => {
            const cell = getCellAssignments(shift.id, day.dateStr);
            return cell.length === 0 && !cell.some((a: any) => a.memberUserId === myId);
          })
          .map((shift) => ({ shift, day })),
      ),
  );

  // ── Load functions ──
  const loadRota = useCallback(async (ms?: Date) => {
    if (!department || !token) return;
    const m = ms ?? monthStart;
    const firstDay = getMonthFirstDay(m);
    const lastDay = new Date(firstDay.getFullYear(), firstDay.getMonth() + 1, 0);
    // Include days from previous week that appear in the first-week row
    const startMonday = getMonday(firstDay);
    const startDate = formatDate(startMonday);
    const endDate = formatDate(lastDay);
    setRotaLoading(true);
    try {
      const res = await fetch(
        `${getApiUrl()}/api/department/${department.id}/rota?startDate=${startDate}&endDate=${endDate}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (res.ok) {
        const data = await res.json();
        setRotaShifts(data.shifts || []);
        setRotaAssignments(data.assignments || []);
        setRotaMembers(data.members || []);
      }
    } catch {}
    setRotaLoading(false);
  }, [department?.id, token, monthStart]);

  const loadRoster = async (silent = false) => {
    if (!department || !token) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/department/${department.id}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setInviteLink(data.inviteLink || null);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(useCallback(() => {
    loadRoster();
    loadRota(monthStart);
  }, [department?.id]));

  // Re-fetch rota when monthStart changes
  useEffect(() => {
    if (department && token) loadRota(monthStart);
  }, [monthStart, department?.id]);

  // ── Navigation ──
  const goToPrevMonth = () => {
    if (!canGoPrevMonth) return;
    setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    if (!canGoNextMonth) return;
    setMonthStart(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1));
  };

  const goToCurrentMonth = () => {
    setMonthStart(getMonthFirstDay(new Date()));
  };

  // ── Invite link handlers ──
  const handleCopy = async () => {
    if (!inviteLink) return;
    await Clipboard.setStringAsync(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    if (!inviteLink) return;
    const msg = `Join our ER team on ErMate!\n\nTap the link, sign in, and fill in your name and role.\n\n${inviteLink}`;
    const url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
    Linking.canOpenURL(url).then((ok) => {
      if (ok) Linking.openURL(url);
      else Share.share({ message: msg, title: "Join ErMate Team" });
    });
  };

  const handleShare = () => {
    if (!inviteLink) return;
    Share.share({ message: `Join our ER team on ErMate!\n\n${inviteLink}`, title: "Join ErMate Team" });
  };

  const handleRegenerate = () => {
    Alert.alert("Generate New Link", "The old link will stop working.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Generate", onPress: async () => {
          if (!department || !token) return;
          setRegenerating(true);
          try {
            const res = await fetch(`${getApiUrl()}/api/department/${department.id}/regenerate-invite`, {
              method: "POST", headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json();
            if (res.ok) setInviteLink(data.inviteLink);
            else Alert.alert("Error", data.error || "Failed to regenerate");
          } catch { Alert.alert("Error", "Network error"); }
          setRegenerating(false);
        },
      },
    ]);
  };

  // ── Member management ──
  const handleApprove = async (member: any) => {
    if (!token) return;
    setApprovingId(member.id);
    try {
      const res = await fetch(`${getApiUrl()}/api/department/members/${member.id}/approve`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) { loadRoster(true); refreshDept(); }
      else Alert.alert("Error", data.error || "Failed to approve");
    } catch { Alert.alert("Error", "Network error"); }
    setApprovingId(null);
  };

  const handleDecline = (member: any) => {
    Alert.alert("Decline Request", `Decline ${member.name || "this doctor"}'s request?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline", style: "destructive", onPress: async () => {
          if (!token) return;
          setDecliningId(member.id);
          try {
            const res = await fetch(`${getApiUrl()}/api/department/members/${member.id}/decline`, {
              method: "POST", headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) loadRoster(true);
            else { const d = await res.json(); Alert.alert("Error", d.error || "Failed"); }
          } catch { Alert.alert("Error", "Network error"); }
          setDecliningId(null);
        },
      },
    ]);
  };

  const handleRemoveMember = (member: any) => {
    Alert.alert("Remove Member", `Remove ${member.name || member.userId} from the department?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          if (!department || !token) return;
          try {
            const res = await fetch(`${getApiUrl()}/api/department/${department.id}/members/${member.userId}`, {
              method: "DELETE", headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { Alert.alert("Error", data.error || "Failed to remove"); return; }
            setMembers((prev) => prev.filter((m) => m.userId !== member.userId));
            loadRoster(true); refreshDept();
          } catch { Alert.alert("Error", "Network error"); }
        },
      },
    ]);
  };

  // ── Grid handlers ──
  const handleGridAssign = async (memberUserId: string) => {
    if (!gridSheet || !department || !token) return;
    setAssigningId(memberUserId);
    const member = rotaMembers.find((m) => m.userId === memberUserId);
    try {
      const res = await fetch(`${getApiUrl()}/api/department/${department.id}/rota`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          shiftId: gridSheet.shiftId, memberUserId,
          roleForShift: member?.role, date: gridSheet.dateStr,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setRotaAssignments((prev) => [...prev, data.assignment]);
      else Alert.alert("Error", data.error || "Could not assign");
    } catch { Alert.alert("Error", "Network error"); }
    setAssigningId(null);
  };

  const handleGridRemove = async (assignmentId: number) => {
    if (!department || !token) return;
    setRemovingId(assignmentId);
    try {
      const res = await fetch(`${getApiUrl()}/api/department/${department.id}/rota/${assignmentId}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setRotaAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      else Alert.alert("Error", data.error || "Failed to remove");
    } catch { Alert.alert("Error", "Network error"); }
    setRemovingId(null);
  };

  const handleClaim = async (shiftId: number, dateStr: string) => {
    if (!department || !token || !myId) return;
    const member = rotaMembers.find((m) => m.userId === myId);
    try {
      const res = await fetch(`${getApiUrl()}/api/department/${department.id}/rota`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ shiftId, memberUserId: myId, roleForShift: member?.role, date: dateStr }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setRotaAssignments((prev) => [...prev, data.assignment]);
      else Alert.alert("Error", data.error || "Could not claim shift");
    } catch { Alert.alert("Error", "Network error"); }
  };

  const handleRelease = (assignmentId: number) => {
    Alert.alert("Release Shift", "Remove yourself from this shift?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Release", style: "destructive", onPress: async () => {
          if (!department || !token) return;
          try {
            const res = await fetch(`${getApiUrl()}/api/department/${department.id}/rota/${assignmentId}`, {
              method: "DELETE", headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok) setRotaAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
            else Alert.alert("Error", data.error || "Failed to release");
          } catch { Alert.alert("Error", "Network error"); }
        },
      },
    ]);
  };

  // ── Shift management ──
  const openEditShift = (shift: any) => {
    setEditingShift(shift); setEditName(shift.name);
    setEditStart(shift.startTime); setEditEnd(shift.endTime);
    setEditMaxCon(String(shift.maxConsultants ?? 2)); setEditMaxRes(String(shift.maxResidents ?? 6));
    setEditShiftModal(true);
  };

  const openAddShift = () => {
    setEditingShift(null); setEditName(`Shift ${rotaShifts.length + 1}`);
    setEditStart("08:00"); setEditEnd("16:00"); setEditMaxCon("2"); setEditMaxRes("6");
    setEditShiftModal(true);
  };

  const saveShift = async () => {
    if (!department || !token || !editName.trim()) return;
    setSavingShift(true);
    try {
      const url = editingShift
        ? `${getApiUrl()}/api/department/${department.id}/shifts/${editingShift.id}`
        : `${getApiUrl()}/api/department/${department.id}/shifts`;
      const res = await fetch(url, {
        method: editingShift ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editName.trim(), startTime: editStart, endTime: editEnd,
          maxConsultants: parseInt(editMaxCon) || 2, maxResidents: parseInt(editMaxRes) || 6,
        }),
      });
      const data = await res.json();
      if (res.ok) { setEditShiftModal(false); loadRota(monthStart); refreshDept(); }
      else Alert.alert("Error", data.error || "Failed to save shift");
    } catch { Alert.alert("Error", "Network error"); }
    setSavingShift(false);
  };

  const deleteShift = (shift: any) => {
    Alert.alert("Delete Shift", `Delete "${shift.name}"? All rota assignments for this shift will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete", style: "destructive", onPress: async () => {
          if (!department || !token) return;
          try {
            const res = await fetch(`${getApiUrl()}/api/department/${department.id}/shifts/${shift.id}`, {
              method: "DELETE", headers: { Authorization: `Bearer ${token}` },
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) { Alert.alert("Error", data.error || "Failed to delete"); return; }
            setRotaShifts((prev) => prev.filter((s) => s.id !== shift.id));
            setRotaAssignments((prev) => prev.filter((a) => a.shiftId !== shift.id));
            refreshDept();
          } catch { Alert.alert("Error", "Network error"); }
        },
      },
    ]);
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
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: H_PAD, paddingBottom: 80 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadRoster(); loadRota(monthStart); }}
          />
        }
      >

        {/* ── Invite Link ── */}
        {inviteLink ? (
          <>
            <Text style={[styles.sectionHeading, { color: theme.text }]}>Team Invite</Text>
            <View style={[styles.linkCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Text style={[styles.linkText, { color: theme.textMuted }]} numberOfLines={2} selectable>{inviteLink}</Text>
              <View style={styles.linkActions}>
                <Pressable
                  style={({ pressed }) => [styles.linkBtn, { backgroundColor: copied ? theme.primary : theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 }]}
                  onPress={handleCopy}
                >
                  <Feather name={copied ? "check" : "copy"} size={14} color={copied ? "#fff" : theme.text} />
                  <Text style={[styles.linkBtnText, { color: copied ? "#fff" : theme.text }]}>{copied ? "Copied!" : "Copy"}</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.linkBtn, { backgroundColor: "#25D366", opacity: pressed ? 0.8 : 1 }]}
                  onPress={handleWhatsApp}
                >
                  <Text style={[styles.linkBtnText, { color: "#fff" }]}>WhatsApp</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [styles.linkBtn, { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 }]}
                  onPress={handleShare}
                >
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

        {/* ══════════════════ MONTHLY ROTA ══════════════════ */}
        <View style={{ marginTop: inviteLink ? Spacing.xl : 0 }}>

          {/* Section heading + view toggle */}
          <View style={[styles.rotaHeader, { marginBottom: Spacing.sm }]}>
            <View>
              <Text style={[styles.sectionHeading, { color: theme.text }]}>Monthly Rota</Text>
              {rotaShifts.length > 0 && (
                <Text style={[styles.rotaSubtitle, { color: theme.textMuted }]}>
                  {openSlots > 0 ? `${openSlots} open slots this month` : "All slots filled"}
                </Text>
              )}
            </View>
            <View style={[styles.toggleRow, { backgroundColor: theme.backgroundSecondary }]}>
              <Pressable
                style={[styles.toggleBtn, viewMode === "grid" && { backgroundColor: theme.card }]}
                onPress={() => setViewMode("grid")}
              >
                <Text style={[styles.toggleBtnText, { color: viewMode === "grid" ? theme.primary : theme.textMuted }]}>
                  Grid
                </Text>
              </Pressable>
              <Pressable
                style={[styles.toggleBtn, viewMode === "my" && { backgroundColor: theme.card }]}
                onPress={() => setViewMode("my")}
              >
                <Text style={[styles.toggleBtnText, { color: viewMode === "my" ? theme.primary : theme.textMuted }]}>
                  My Shifts
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Month navigation */}
          <View style={[styles.monthNav, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Pressable
              onPress={goToPrevMonth}
              disabled={!canGoPrevMonth}
              style={({ pressed }) => [styles.monthNavBtn, { backgroundColor: theme.backgroundSecondary, opacity: !canGoPrevMonth ? 0.3 : pressed ? 0.7 : 1 }]}
            >
              <Feather name="chevron-left" size={18} color={theme.text} />
            </Pressable>

            <Pressable onPress={goToCurrentMonth} style={{ alignItems: "center", flex: 1 }}>
              <Text style={[styles.monthLabel, { color: theme.text }]}>{monthLabel}</Text>
              {!isCurrentMonth && (
                <View style={[styles.todayChip, { backgroundColor: theme.primaryLight }]}>
                  <Text style={[styles.todayChipText, { color: theme.primary }]}>Back to today</Text>
                </View>
              )}
            </Pressable>

            <Pressable
              onPress={goToNextMonth}
              disabled={!canGoNextMonth}
              style={({ pressed }) => [styles.monthNavBtn, { backgroundColor: theme.backgroundSecondary, opacity: !canGoNextMonth ? 0.3 : pressed ? 0.7 : 1 }]}
            >
              <Feather name="chevron-right" size={18} color={theme.text} />
            </Pressable>
          </View>

          {/* ═════════════ GRID VIEW ═════════════ */}
          {viewMode === "grid" && (
            <>
              {rotaLoading ? (
                <View style={[styles.gridEmpty, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <ActivityIndicator color={theme.primary} />
                </View>
              ) : rotaShifts.length === 0 ? (
                <View style={[styles.gridEmpty, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Feather name="calendar" size={30} color={theme.textMuted} />
                  <Text style={[styles.gridEmptyTitle, { color: theme.textSecondary }]}>No shifts configured</Text>
                  {isHOD && (
                    <Text style={[styles.gridEmptySub, { color: theme.textMuted }]}>
                      Use Shift Configuration below to add shifts
                    </Text>
                  )}
                </View>
              ) : (
                <>
                  {/* Shift colour legend */}
                  <View style={[styles.legend, { backgroundColor: theme.card, borderColor: theme.border }]}>
                    {rotaShifts.map((shift, sIdx) => (
                      <View key={shift.id} style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: SHIFT_ROW_COLORS[sIdx % SHIFT_ROW_COLORS.length] }]} />
                        <Text style={[styles.legendText, { color: theme.textMuted }]}>
                          {shift.name} {shift.startTime}–{shift.endTime}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Week blocks */}
                  {monthWeeks.map((week, wIdx) => (
                    <View key={wIdx} style={[styles.weekBlock, { backgroundColor: theme.card, borderColor: theme.border }]}>
                      {/* Week label */}
                      <View style={[styles.weekLabelRow, { borderBottomColor: theme.border }]}>
                        <Text style={[styles.weekNum, { color: theme.primary }]}>W{wIdx + 1}</Text>
                        <Text style={[styles.weekRange, { color: theme.textMuted }]}>{week.weekLabel}</Text>
                      </View>

                      {/* Day header */}
                      <View style={styles.gridRow}>
                        <View style={{ width: LEFT_COL }} />
                        {week.days.map((day) => (
                          <View key={day.dateStr} style={{ width: DAY_COL, alignItems: "center" }}>
                            <Text style={[
                              styles.dayLabel,
                              { color: day.isToday ? "#1DB870" : day.isPast ? theme.textMuted + "77" : !day.inMonth ? theme.textMuted + "44" : theme.textMuted },
                            ]}>
                              {day.label}
                            </Text>
                            <Text style={[
                              styles.dayDate,
                              {
                                color: day.isToday ? "#1DB870" : day.isPast ? theme.text + "55" : !day.inMonth ? theme.text + "33" : theme.text,
                                fontWeight: day.isToday ? "900" : "800",
                              },
                            ]}>
                              {day.dateNum}
                            </Text>
                          </View>
                        ))}
                      </View>

                      {/* Shift rows */}
                      {rotaShifts.map((shift, sIdx) => {
                        const shiftColor = SHIFT_ROW_COLORS[sIdx % SHIFT_ROW_COLORS.length];
                        return (
                          <View
                            key={shift.id}
                            style={[styles.gridRow, sIdx < rotaShifts.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border + "55" }]}
                          >
                            <View style={[styles.shiftLabelCol, { width: LEFT_COL }]}>
                              <View style={[styles.shiftDot, { backgroundColor: shiftColor }]} />
                              <Text style={[styles.shiftLabelText, { color: theme.textMuted }]} numberOfLines={2}>
                                {shift.name.length > 5 ? shift.name.slice(0, 3) : shift.name}
                              </Text>
                            </View>
                            {week.days.map((day) => (
                              <RotaGridCell
                                key={day.dateStr}
                                assignments={getCellAssignments(shift.id, day.dateStr)}
                                rotaMembers={rotaMembers}
                                isToday={day.isToday}
                                isPast={day.isPast}
                                dimmed={!day.inMonth}
                                onTap={() => setGridSheet({
                                  shiftId: shift.id,
                                  dateStr: day.dateStr,
                                  dayLabel: `${day.label} ${day.dateNum} ${day.month}`,
                                  dateLabel: `${day.dateNum} ${day.month}`,
                                })}
                                theme={theme}
                              />
                            ))}
                          </View>
                        );
                      })}
                    </View>
                  ))}
                </>
              )}
            </>
          )}

          {/* ═════════════ MY SHIFTS VIEW ═════════════ */}
          {viewMode === "my" && (
            <View style={{ marginTop: Spacing.sm }}>
              <Text style={[styles.myViewLabel, { color: theme.textMuted }]}>
                MY SHIFTS — {monthLabel.toUpperCase()} ({myMonthAssignments.length})
              </Text>
              {myMonthAssignments.length === 0 ? (
                <View style={[styles.myEmptyCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                  <Text style={[styles.myEmptyText, { color: theme.textMuted }]}>No shifts assigned this month</Text>
                  {openSlotsForClaiming.length > 0 && (
                    <Text style={[styles.myEmptySub, { color: theme.textMuted }]}>Claim an open slot below</Text>
                  )}
                </View>
              ) : myMonthAssignments.map((item) => (
                <View key={item.id} style={[styles.myShiftCard, { backgroundColor: theme.card, borderColor: "rgba(29,184,112,0.3)" }]}>
                  <View style={[styles.myShiftIcon, { backgroundColor: "rgba(29,184,112,0.1)" }]}>
                    <Feather name="check-circle" size={18} color="#1DB870" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.myShiftName, { color: theme.text }]}>
                      {item.shift.name} · {item.day.label} {item.day.dateNum} {item.day.month}
                    </Text>
                    <Text style={[styles.myShiftTime, { color: theme.textMuted }]}>
                      {item.shift.startTime}–{item.shift.endTime}
                    </Text>
                  </View>
                  <Pressable
                    style={({ pressed }) => [styles.releaseBtn, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
                    onPress={() => handleRelease(item.id)}
                  >
                    <Text style={[styles.releaseBtnText, { color: theme.textMuted }]}>Release</Text>
                  </Pressable>
                </View>
              ))}

              {openSlotsForClaiming.length > 0 && (
                <>
                  <Text style={[styles.myViewLabel, { color: theme.textMuted, marginTop: Spacing.lg }]}>
                    OPEN SLOTS — CLAIM ONE ({openSlotsForClaiming.length})
                  </Text>
                  {openSlotsForClaiming.slice(0, 12).map(({ shift, day }) => {
                    const sIdx = rotaShifts.findIndex((s) => s.id === shift.id);
                    const shiftColor = SHIFT_ROW_COLORS[sIdx % SHIFT_ROW_COLORS.length];
                    return (
                      <View key={`${day.dateStr}-${shift.id}`} style={[styles.openSlotCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
                        <View style={[styles.shiftDot, { backgroundColor: shiftColor, margin: 0, marginRight: 4 }]} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.myShiftName, { color: theme.text }]}>
                            {shift.name} · {day.label} {day.dateNum} {day.month}
                          </Text>
                          <Text style={[styles.myShiftTime, { color: theme.textMuted }]}>
                            {shift.startTime}–{shift.endTime}
                          </Text>
                        </View>
                        <Pressable
                          style={({ pressed }) => [styles.claimBtn, { opacity: pressed ? 0.8 : 1 }]}
                          onPress={() => handleClaim(shift.id, day.dateStr)}
                        >
                          <Text style={styles.claimBtnText}>Claim</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </>
              )}
            </View>
          )}
        </View>

        {/* ── Shift Configuration (HOD only, collapsible) ── */}
        {isHOD && (
          <View style={{ marginTop: Spacing.xl }}>
            <Text style={[styles.sectionHeading, { color: theme.text }]}>Shift Configuration</Text>
            <Pressable
              style={[styles.shiftMgmtHeader, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => setShowShiftMgmt((v) => !v)}
            >
              <Feather name="sliders" size={15} color={theme.primary} />
              <Text style={[styles.shiftMgmtTitle, { color: theme.text }]}>
                {rotaShifts.length > 0 ? `${rotaShifts.length} shift${rotaShifts.length > 1 ? "s" : ""} defined` : "No shifts yet"}
              </Text>
              <Feather name={showShiftMgmt ? "chevron-up" : "chevron-down"} size={16} color={theme.textMuted} />
            </Pressable>
            {showShiftMgmt && (
              <View style={[styles.shiftMgmtBody, { backgroundColor: theme.card, borderColor: theme.border }]}>
                {rotaShifts.map((shift, sIdx) => (
                  <View key={shift.id} style={[styles.shiftMgmtRow, { borderBottomColor: theme.border }]}>
                    <View style={[styles.shiftDot, { backgroundColor: SHIFT_ROW_COLORS[sIdx % SHIFT_ROW_COLORS.length], margin: 0 }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.shiftMgmtName, { color: theme.text }]}>{shift.name}</Text>
                      <Text style={[styles.shiftMgmtTime, { color: theme.textMuted }]}>
                        {shift.startTime}–{shift.endTime}
                      </Text>
                    </View>
                    <Pressable style={[styles.iconBtnSm, { backgroundColor: theme.primaryLight }]} onPress={() => openEditShift(shift)}>
                      <Feather name="edit-2" size={13} color={theme.primary} />
                    </Pressable>
                    <Pressable style={[styles.iconBtnSm, { backgroundColor: theme.dangerLight || "#fee2e2" }]} onPress={() => deleteShift(shift)}>
                      <Feather name="trash-2" size={13} color={theme.danger} />
                    </Pressable>
                  </View>
                ))}
                {rotaShifts.length < 5 && (
                  <Pressable style={[styles.addShiftBtn, { borderColor: theme.primary + "40" }]} onPress={openAddShift}>
                    <Feather name="plus" size={15} color={theme.primary} />
                    <Text style={[styles.addShiftText, { color: theme.primary }]}>Add Shift</Text>
                  </Pressable>
                )}
              </View>
            )}
          </View>
        )}

        {/* ── Pending Requests ── */}
        {!loading && pendingMembers.length > 0 && (
          <View style={{ marginTop: Spacing.xl }}>
            <Text style={[styles.sectionHeading, { color: theme.text }]}>
              Pending Requests
              <Text style={[styles.sectionCount, { color: theme.textMuted }]}> ({pendingMembers.length})</Text>
            </Text>
            <View style={[styles.card, { backgroundColor: theme.card, marginBottom: Spacing.lg }]}>
              {pendingMembers.map((m) => (
                <View key={m.id} style={[styles.memberRow, { borderBottomColor: theme.border }]}>
                  <View style={[styles.avatar, { backgroundColor: "#f59e0b20" }]}>
                    <Text style={[styles.avatarText, { color: "#f59e0b" }]}>
                      {(m.name || m.email || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>{m.name || m.email || "Unknown"}</Text>
                    <Text style={[styles.memberRoleTxt, { color: theme.textSecondary }]}>
                      {ROLE_DISPLAY[m.role] || m.role}{m.email ? ` · ${m.email}` : ""}
                    </Text>
                  </View>
                  <View style={styles.approvalBtns}>
                    <Pressable
                      style={[styles.declineBtn, { borderColor: theme.danger, opacity: decliningId === m.id || approvingId === m.id ? 0.6 : 1 }]}
                      onPress={() => handleDecline(m)}
                      disabled={approvingId === m.id || decliningId === m.id}
                    >
                      {decliningId === m.id ? <ActivityIndicator size="small" color={theme.danger} /> : <Feather name="x" size={16} color={theme.danger} />}
                    </Pressable>
                    <Pressable
                      style={[styles.approveBtn, { backgroundColor: theme.primary, opacity: approvingId === m.id || decliningId === m.id ? 0.6 : 1 }]}
                      onPress={() => handleApprove(m)}
                      disabled={approvingId === m.id || decliningId === m.id}
                    >
                      {approvingId === m.id
                        ? <ActivityIndicator size="small" color="#fff" />
                        : <><Feather name="check" size={14} color="#fff" /><Text style={styles.approveBtnText}>Approve</Text></>}
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ── Active Members ── */}
        {loading ? (
          <ActivityIndicator style={{ marginTop: 20 }} color={theme.primary} />
        ) : (hodMember || activeMembers.length > 0) ? (
          <View style={{ marginTop: pendingMembers.length > 0 ? 0 : Spacing.xl }}>
            <Text style={[styles.sectionHeading, { color: theme.text }]}>
              Active Members
              <Text style={[styles.sectionCount, { color: theme.textMuted }]}> ({activeMembers.length + (hodMember ? 1 : 0)})</Text>
            </Text>
            <View style={[styles.card, { backgroundColor: theme.card }]}>
              {hodMember && (
                <View style={[styles.memberRow, { borderBottomColor: theme.border }]}>
                  <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
                    <Text style={[styles.avatarText, { color: theme.primary }]}>
                      {(hodMember.name || hodMember.email || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>
                      {hodMember.name || hodMember.email?.split("@")[0] || hodMember.userId}
                    </Text>
                    <Text style={[styles.memberRoleTxt, { color: theme.textSecondary }]}>
                      HOD{hodMember.email ? ` · ${hodMember.email}` : ""}
                    </Text>
                  </View>
                </View>
              )}
              {activeMembers.map((m) => (
                <View key={m.id} style={[styles.memberRow, { borderBottomColor: theme.border }]}>
                  <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
                    <Text style={[styles.avatarText, { color: theme.primary }]}>
                      {(m.name || m.email || "?").charAt(0).toUpperCase()}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>
                      {m.name || m.email?.split("@")[0] || m.userId}
                    </Text>
                    <Text style={[styles.memberRoleTxt, { color: theme.textSecondary }]}>
                      {ROLE_DISPLAY[m.role] || m.role}{m.email ? ` · ${m.email}` : ""}
                    </Text>
                  </View>
                  {isHOD && (
                    <Pressable style={styles.removeMemberBtn} onPress={() => handleRemoveMember(m)}>
                      <Feather name="trash-2" size={16} color={theme.danger} />
                    </Pressable>
                  )}
                </View>
              ))}
            </View>
          </View>
        ) : pendingMembers.length === 0 ? (
          <View style={[styles.emptyBox, { backgroundColor: theme.card, borderColor: theme.border, marginTop: Spacing.xl }]}>
            <Feather name="users" size={32} color={theme.textMuted} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>No team members yet</Text>
            <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
              Share the invite link above with your team on WhatsApp.
            </Text>
          </View>
        ) : null}

      </ScrollView>

      {/* ── AssignSheet Modal ── */}
      <AssignSheet
        visible={!!gridSheet}
        gridSheet={gridSheet}
        rotaShifts={rotaShifts}
        rotaAssignments={rotaAssignments}
        rotaMembers={rotaMembers}
        theme={theme}
        isHOD={isHOD}
        onAssign={handleGridAssign}
        onRemove={handleGridRemove}
        onClose={() => setGridSheet(null)}
        assigningId={assigningId}
        removingId={removingId}
      />

      {/* ── Edit/Add Shift Modal ── */}
      <Modal visible={editShiftModal} transparent animationType="slide" onRequestClose={() => setEditShiftModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={[styles.modalHandle, { backgroundColor: theme.border }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>{editingShift ? "Edit Shift" : "Add Shift"}</Text>

            <Text style={[styles.fieldLabel, { color: theme.text }]}>Shift Name</Text>
            <TextInput
              style={[styles.textInput, { backgroundColor: theme.backgroundSecondary, color: theme.text, borderColor: theme.border }]}
              value={editName}
              onChangeText={setEditName}
              placeholder="e.g. Morning, Evening, Night..."
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
                {savingShift
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={{ color: "#fff", fontWeight: "700" }}>{editingShift ? "Save" : "Add Shift"}</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Time Picker ── */}
      <TimeStepModal
        visible={timeModal}
        value={timeValue}
        title={timeTarget === "start" ? "Start Time" : "End Time"}
        theme={theme}
        onClose={() => setTimeModal(false)}
        onConfirm={(t) => {
          setTimeModal(false);
          if (timeTarget === "start") setEditStart(t);
          else setEditEnd(t);
        }}
      />
    </View>
  );
}

// ── StyleSheet ────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  // Section headings — bold, blog-style
  sectionHeading: { fontSize: 20, fontWeight: "800", marginBottom: Spacing.sm, letterSpacing: -0.3 },
  sectionCount: { fontSize: 16, fontWeight: "500" },

  linkCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: 0 },
  linkText: { fontSize: 12, marginBottom: Spacing.sm },
  linkActions: { flexDirection: "row", gap: 8, marginBottom: Spacing.sm },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  linkBtnText: { fontSize: 12, fontWeight: "600" },
  regenRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  regenText: { fontSize: 11 },

  rotaHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  rotaSubtitle: { fontSize: 13, fontWeight: "500", marginTop: 2 },
  toggleRow: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 2 },
  toggleBtn: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8 },
  toggleBtnText: { fontSize: 12, fontWeight: "700" },

  // Month navigation
  monthNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderRadius: 14, borderWidth: 1, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm, marginBottom: Spacing.md },
  monthNavBtn: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  monthLabel: { fontSize: 17, fontWeight: "800", letterSpacing: -0.2 },
  todayChip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginTop: 3 },
  todayChipText: { fontSize: 10, fontWeight: "700" },

  // Week blocks within monthly grid
  weekBlock: { borderRadius: 14, borderWidth: 1, overflow: "hidden", marginBottom: Spacing.md },
  weekLabelRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1 },
  weekNum: { fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  weekRange: { fontSize: 11, fontWeight: "500" },

  gridEmpty: { borderRadius: 14, borderWidth: 1, padding: 32, alignItems: "center", gap: 8, marginBottom: Spacing.md },
  gridEmptyTitle: { fontSize: 15, fontWeight: "700" },
  gridEmptySub: { fontSize: 12, textAlign: "center" },
  gridRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, paddingVertical: 4 },
  dayLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5 },
  dayDate: { fontSize: 14, marginTop: 1 },
  shiftLabelCol: { alignItems: "center", justifyContent: "center", gap: 3, paddingVertical: 8 },
  shiftDot: { width: 7, height: 7, borderRadius: 3.5, margin: 2 },
  shiftLabelText: { fontSize: 8, fontWeight: "700", textAlign: "center" },

  legend: { flexDirection: "row", flexWrap: "wrap", gap: 10, padding: Spacing.md, borderRadius: 12, borderWidth: 1, marginBottom: Spacing.sm },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  legendDot: { width: 7, height: 7, borderRadius: 3.5 },
  legendText: { fontSize: 10, fontWeight: "500" },

  myViewLabel: { fontSize: 11, fontWeight: "800", letterSpacing: 0.8, marginBottom: Spacing.sm },
  myEmptyCard: { borderRadius: 12, borderWidth: 1.5, borderStyle: "dashed", padding: 20, alignItems: "center", marginBottom: Spacing.sm },
  myEmptyText: { fontSize: 13 },
  myEmptySub: { fontSize: 11, marginTop: 4 },
  myShiftCard: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 13, borderWidth: 2, padding: 12, marginBottom: 8 },
  myShiftIcon: { width: 38, height: 38, borderRadius: 10, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  myShiftName: { fontSize: 13, fontWeight: "700" },
  myShiftTime: { fontSize: 11, marginTop: 2 },
  releaseBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  releaseBtnText: { fontSize: 11, fontWeight: "600" },
  openSlotCard: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 13, borderWidth: 1.5, padding: 12, marginBottom: 8 },
  claimBtn: { backgroundColor: "#1DB870", borderRadius: 9, paddingHorizontal: 14, paddingVertical: 7 },
  claimBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },

  shiftMgmtHeader: { flexDirection: "row", alignItems: "center", gap: 10, borderRadius: 12, borderWidth: 1, padding: Spacing.md },
  shiftMgmtTitle: { flex: 1, fontSize: 14, fontWeight: "600" },
  shiftMgmtBody: { borderRadius: 12, borderWidth: 1, borderTopWidth: 0, borderTopLeftRadius: 0, borderTopRightRadius: 0, paddingVertical: Spacing.sm },
  shiftMgmtRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderBottomWidth: 1 },
  shiftMgmtName: { fontSize: 13, fontWeight: "700" },
  shiftMgmtTime: { fontSize: 11, marginTop: 1 },
  iconBtnSm: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  addShiftBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, margin: Spacing.md, borderRadius: 10, borderWidth: 1.5, borderStyle: "dashed", padding: Spacing.sm },
  addShiftText: { fontSize: 13, fontWeight: "600" },

  card: { borderRadius: BorderRadius.lg, overflow: "hidden", marginBottom: Spacing.sm },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderBottomWidth: 1 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontWeight: "800", color: "#fff" },
  memberName: { fontSize: 15, fontWeight: "700" },
  memberRoleTxt: { fontSize: 12, marginTop: 1 },
  removeMemberBtn: { padding: 8 },
  approvalBtns: { flexDirection: "row", gap: 8 },
  declineBtn: { width: 36, height: 36, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  approveBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  approveBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  emptyBox: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: 32, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700" },
  emptyText: { fontSize: 13, textAlign: "center" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: 24, paddingBottom: 36 },
  modalHandle: { width: 38, height: 4, borderRadius: 99, alignSelf: "center", marginBottom: 18 },
  modalTitle: { fontSize: 20, fontWeight: "800", marginBottom: Spacing.lg, letterSpacing: -0.3 },
  fieldLabel: { fontSize: 13, fontWeight: "700", marginBottom: 6 },
  textInput: { borderRadius: 12, borderWidth: 1, padding: Spacing.md, fontSize: 15, marginBottom: Spacing.md },
  timeRow: { flexDirection: "row", gap: 12, marginBottom: Spacing.md },
  timePill: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, borderWidth: 1, padding: Spacing.sm, paddingHorizontal: Spacing.md },
  timePillText: { fontSize: 15, fontWeight: "600" },
  stepperRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4 },
  stepBtn: { width: 36, height: 36, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  stepValue: { fontSize: 18, fontWeight: "700", minWidth: 32, textAlign: "center" },
  modalBtns: { flexDirection: "row", gap: 12, marginTop: Spacing.lg },
  modalCancelBtn: { flex: 1, padding: 14, borderRadius: 12, borderWidth: 1, alignItems: "center" },
  modalSaveBtn: { flex: 1, padding: 14, borderRadius: 12, alignItems: "center" },
});
