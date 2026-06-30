import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useDepartment, Shift } from "@/context/DepartmentContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

interface ShiftWithCounts extends Shift {
  consultantsActive: number;
  residentsActive: number;
  totalActive: number;
}

export default function ShiftSelectScreen() {
  const { theme } = useTheme();
  const { user, token } = useAuth();
  const { department, membership, shifts, checkIn, dismissShiftSelect, showShiftSelect } = useDepartment();
  const insets = useSafeAreaInsets();
  const [countsMap, setCountsMap] = useState<Record<number, ShiftWithCounts>>({});
  const [loading, setLoading] = useState(false);
  const [checkingIn, setCheckingIn] = useState<number | null>(null);

  useEffect(() => {
    if (showShiftSelect && department) loadCounts();
  }, [showShiftSelect, department?.id]);

  const loadCounts = async () => {
    if (!department || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/shifts/department/${department.id}/counts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const map: Record<number, ShiftWithCounts> = {};
        (data.shifts || []).forEach((s: ShiftWithCounts) => { map[s.id] = s; });
        setCountsMap(map);
      }
    } catch {}
    setLoading(false);
  };

  const handleCheckIn = async (shift: Shift) => {
    const role = membership?.role || "resident";
    const counts = countsMap[shift.id];
    if (counts) {
      if (role === "consultant" && counts.consultantsActive >= shift.maxConsultants) {
        Alert.alert("Slot Full", `All consultant slots for ${shift.name} are taken. Please wait or choose another shift.`);
        return;
      }
      if (role === "resident" && counts.residentsActive >= shift.maxResidents) {
        Alert.alert("Slot Full", `All resident slots for ${shift.name} are taken. Please wait or choose another shift.`);
        return;
      }
    }
    setCheckingIn(shift.id);
    const result = await checkIn(shift.id, role);
    setCheckingIn(null);
    if (!result.success) Alert.alert("Error", result.error || "Could not check in");
  };

  const getRoleSlots = (shift: Shift, counts: ShiftWithCounts | undefined) => {
    const role = membership?.role || "resident";
    if (role === "consultant") {
      const active = counts?.consultantsActive ?? 0;
      const max = shift.maxConsultants;
      return { active, max, isFull: active >= max };
    }
    const active = counts?.residentsActive ?? 0;
    const max = shift.maxResidents;
    return { active, max, isFull: active >= max };
  };

  const SHIFT_COLORS: Record<string, string> = {
    Morning: "#f59e0b",
    Evening: "#6366f1",
    Night: "#0f172a",
  };

  // Returns true if current time falls within this shift's window
  const isShiftActiveNow = (shift: Shift): boolean => {
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const [sh, sm] = shift.startTime.split(":").map(Number);
    const [eh, em] = shift.endTime.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    if (startMins <= endMins) {
      // Normal shift (e.g. 07:00-15:00)
      return nowMins >= startMins && nowMins < endMins;
    } else {
      // Night shift crossing midnight (e.g. 22:00-06:00)
      return nowMins >= startMins || nowMins < endMins;
    }
  };

  if (!showShiftSelect) return null;

  return (
    <Modal visible={showShiftSelect} animationType="slide" presentationStyle="pageSheet">
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault, paddingTop: insets.top + Spacing.lg }]}>
        <View style={styles.header}>
          <View>
            <Text style={[styles.title, { color: theme.text }]}>Select Your Shift</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {department?.name} · {user?.name}
            </Text>
          </View>
          <Pressable
            onPress={dismissShiftSelect}
            style={({ pressed }) => [styles.skipBtn, { opacity: pressed ? 0.7 : 1 }]}
          >
            <Text style={[styles.skipText, { color: theme.textMuted }]}>Skip</Text>
          </Pressable>
        </View>

        <Text style={[styles.roleLabel, { color: theme.textSecondary }]}>
          Your role: <Text style={{ color: theme.primary, fontWeight: "700" }}>
            {membership?.role === "hod" ? "HOD" : membership?.role === "consultant" ? "Consultant" : "Resident"}
          </Text>
        </Text>

        {loading ? (
          <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
        ) : (
          <ScrollView contentContainerStyle={{ paddingHorizontal: Spacing.lg, paddingBottom: 40 }}>
            {shifts.map((shift) => {
              const counts = countsMap[shift.id];
              const { active, max, isFull } = getRoleSlots(shift, counts);
              const shiftColor = SHIFT_COLORS[shift.name] || theme.primary;
              const isCheckingThisIn = checkingIn === shift.id;

              const activeNow = isShiftActiveNow(shift);
              return (
                <Pressable
                  key={shift.id}
                  style={({ pressed }) => [
                    styles.shiftCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: activeNow ? shiftColor : isFull ? theme.border : shiftColor + "40",
                      borderWidth: activeNow ? 2 : 1.5,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                  onPress={() => !isFull && handleCheckIn(shift)}
                  disabled={isFull || !!checkingIn}
                >
                  <View style={[styles.shiftColorBar, { backgroundColor: shiftColor }]} />
                  <View style={styles.shiftContent}>
                    <View style={styles.shiftRow}>
                      <Text style={[styles.shiftName, { color: theme.text }]}>{shift.name} Shift</Text>
                      <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                        {activeNow ? (
                          <View style={[styles.activeNowBadge, { backgroundColor: "#d1fae5" }]}>
                            <View style={styles.activeNowDot} />
                            <Text style={[styles.activeNowText, { color: "#065f46" }]}>Active Now</Text>
                          </View>
                        ) : null}
                        {isFull ? (
                          <View style={[styles.fullBadge, { backgroundColor: theme.dangerLight }]}>
                            <Text style={[styles.fullText, { color: theme.danger }]}>Full</Text>
                          </View>
                        ) : (
                          <View style={[styles.availBadge, { backgroundColor: theme.primaryLight }]}>
                            <Text style={[styles.availText, { color: theme.primary }]}>Available</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Text style={[styles.shiftTime, { color: theme.textSecondary }]}>
                      {shift.startTime} – {shift.endTime}
                    </Text>
                    <View style={styles.slotsRow}>
                      <Feather name="user-check" size={14} color={theme.textMuted} />
                      <Text style={[styles.slotsText, { color: theme.textMuted }]}>
                        {counts?.consultantsActive ?? 0} / {shift.maxConsultants} consultants
                      </Text>
                      <Text style={[styles.slotsDot, { color: theme.textMuted }]}>·</Text>
                      <Feather name="users" size={14} color={theme.textMuted} />
                      <Text style={[styles.slotsText, { color: theme.textMuted }]}>
                        {counts?.residentsActive ?? 0} / {shift.maxResidents} residents
                      </Text>
                    </View>
                    <View style={styles.slotBar}>
                      <View
                        style={[
                          styles.slotFill,
                          { backgroundColor: isFull ? theme.danger : shiftColor, width: `${Math.min((active / Math.max(max, 1)) * 100, 100)}%` },
                        ]}
                      />
                    </View>
                    {!isFull ? (
                      <Pressable
                        style={({ pressed }) => [
                          styles.checkInBtn,
                          { backgroundColor: shiftColor, opacity: pressed ? 0.85 : 1 },
                        ]}
                        onPress={() => handleCheckIn(shift)}
                        disabled={!!checkingIn}
                      >
                        {isCheckingThisIn ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <Feather name="log-in" size={16} color="#fff" />
                            <Text style={styles.checkInText}>Start {shift.name} Shift</Text>
                          </>
                        )}
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}

            <Pressable
              style={({ pressed }) => [styles.individualBtn, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
              onPress={dismissShiftSelect}
            >
              <Feather name="user" size={16} color={theme.textSecondary} />
              <Text style={[styles.individualText, { color: theme.textSecondary }]}>Continue in Individual Mode</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 14, marginTop: 2 },
  skipBtn: { paddingVertical: 6, paddingHorizontal: 12 },
  skipText: { fontSize: 14 },
  roleLabel: { fontSize: 14, paddingHorizontal: Spacing.lg, marginBottom: Spacing.lg },
  shiftCard: { borderRadius: BorderRadius.lg, borderWidth: 1.5, marginBottom: Spacing.md, overflow: "hidden", flexDirection: "row" },
  shiftColorBar: { width: 6 },
  shiftContent: { flex: 1, padding: Spacing.md },
  shiftRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  shiftName: { fontSize: 18, fontWeight: "700" },
  fullBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  fullText: { fontSize: 12, fontWeight: "700" },
  availBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  availText: { fontSize: 12, fontWeight: "700" },
  shiftTime: { fontSize: 14, marginBottom: 8 },
  slotsRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 6, flexWrap: "wrap" },
  slotsText: { fontSize: 12 },
  slotsDot: { fontSize: 12, marginHorizontal: 2 },
  slotBar: { height: 4, borderRadius: 2, backgroundColor: "#e5e7eb", marginBottom: 12 },
  slotFill: { height: 4, borderRadius: 2 },
  checkInBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 10, borderRadius: BorderRadius.md },
  checkInText: { color: "#fff", fontSize: 14, fontWeight: "700" },
  individualBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: BorderRadius.lg, borderWidth: 1, marginTop: Spacing.sm },
  individualText: { fontSize: 14 },
  activeNowBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  activeNowDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#10b981" },
  activeNowText: { fontSize: 11, fontWeight: "700" },
});
