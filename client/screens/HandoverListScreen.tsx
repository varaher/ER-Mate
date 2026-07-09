import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface HandoverSummary {
  id: string;
  status: string;
  created_at: string;
  updated_at: string;
  from_doctor_name: string | null;
  to_doctor_name: string | null;
  receiving_doctor: string | null;
  patient_count: number;
  critical_count: number;
  ready_to_finalize: boolean;
}

const STATUS_LABEL: Record<string, string> = {
  active: "In progress",
  completed: "Completed",
  shared: "Shared",
};

const STATUS_COLOR: Record<string, string> = {
  active: "#f59e0b",
  completed: "#10b981",
  shared: "#3b82f6",
};

function groupByDate(items: HandoverSummary[]): { title: string; data: HandoverSummary[] }[] {
  const groups: Record<string, HandoverSummary[]> = {};
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86400000);

  items.forEach((item) => {
    const d = new Date(item.created_at);
    d.setHours(0, 0, 0, 0);
    let key: string;
    if (d.getTime() === today.getTime()) key = "TODAY";
    else if (d.getTime() === yesterday.getTime()) key = "YESTERDAY";
    else {
      key = d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  return Object.entries(groups).map(([title, data]) => ({ title, data }));
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
}

export default function HandoverListScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const navigation = useNavigation<Nav>();
  const headerHeight = useHeaderHeight();

  const [handovers, setHandovers] = useState<HandoverSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const doctorName = (user as any)?.name || (user as any)?.fullName || user?.email || "Doctor";

  const loadHandovers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) { setLoading(false); return; }
      const res = await fetch(new URL("/api/handovers", getApiUrl()).toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setHandovers(data.handovers || []);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { loadHandovers(); }, []));

  const handleNewHandover = () => {
    navigation.navigate("HandoverChat", { handoverId: undefined });
  };

  const handleOpenHandover = (item: HandoverSummary) => {
    navigation.navigate("HandoverChat", { handoverId: item.id });
  };

  const grouped = groupByDate(handovers);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundDefault }}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: 100 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadHandovers(true); }} />}
    >
      <Pressable
        style={({ pressed }) => [styles.newBtn, { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 }]}
        onPress={handleNewHandover}
      >
        <Feather name="plus" size={18} color="#fff" />
        <Text style={styles.newBtnText}>New Handover</Text>
      </Pressable>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 48 }} />
      ) : handovers.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
          <Feather name="clipboard" size={36} color={theme.textMuted} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>No handovers yet</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Tap New Handover to build your first one. Speak or type your patients — ErMate structures it.
          </Text>
        </View>
      ) : (
        grouped.map((group) => (
          <View key={group.title} style={styles.group}>
            <Text style={[styles.groupTitle, { color: theme.textMuted }]}>{group.title}</Text>
            {group.data.map((item) => {
              const toDr = item.to_doctor_name || item.receiving_doctor || "";
              const fromDr = item.from_doctor_name || doctorName;
              const statusColor = STATUS_COLOR[item.status] || "#6b7280";
              const statusLabel = STATUS_LABEL[item.status] || item.status;
              return (
                <Pressable
                  key={item.id}
                  style={({ pressed }) => [styles.card, { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.88 : 1 }]}
                  onPress={() => handleOpenHandover(item)}
                >
                  <View style={styles.cardTop}>
                    <View style={styles.cardTitleRow}>
                      <Feather name="arrow-right" size={14} color={theme.textMuted} />
                      <Text style={[styles.cardFrom, { color: theme.text }]} numberOfLines={1}>
                        {fromDr}{toDr ? ` → ${toDr}` : ""}
                      </Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor + "20" }]}>
                      <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                      <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                    </View>
                  </View>

                  <Text style={[styles.cardTime, { color: theme.textMuted }]}>
                    {formatTime(item.created_at)} · {new Date(item.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                  </Text>

                  <View style={styles.cardCounts}>
                    <View style={styles.countRow}>
                      <Feather name="users" size={13} color={theme.textMuted} />
                      <Text style={[styles.countText, { color: theme.textSecondary }]}>
                        {item.patient_count || 0} patient{item.patient_count !== 1 ? "s" : ""}
                      </Text>
                    </View>
                    {(item.critical_count || 0) > 0 ? (
                      <View style={styles.countRow}>
                        <View style={[styles.criticalDot, { backgroundColor: TriageColors.red }]} />
                        <Text style={[styles.countText, { color: TriageColors.red, fontWeight: "700" }]}>
                          {item.critical_count} critical
                        </Text>
                      </View>
                    ) : null}
                  </View>

                  <View style={styles.cardChevron}>
                    <Feather name="chevron-right" size={16} color={theme.textMuted} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))
      )}

      <View style={[styles.manualSection, { borderTopColor: theme.border }]}>
        <Text style={[styles.manualLabel, { color: theme.textMuted }]}>Need to select cases manually?</Text>
        <Pressable
          style={({ pressed }) => [styles.manualBtn, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
          onPress={() => navigation.navigate("Handover")}
        >
          <Feather name="clipboard" size={15} color={theme.textSecondary} />
          <Text style={[styles.manualBtnText, { color: theme.textSecondary }]}>Handover Sheet (manual)</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.xl,
  },
  newBtnText: {
    color: "#fff",
    ...Typography.bodyMedium,
    fontWeight: "700",
  },
  emptyCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl + 4,
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.xl,
  },
  emptyTitle: {
    ...Typography.h3,
    marginTop: Spacing.sm,
  },
  emptyText: {
    ...Typography.small,
    textAlign: "center",
    lineHeight: 20,
  },
  group: {
    marginBottom: Spacing.lg,
  },
  groupTitle: {
    ...Typography.caption,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  card: {
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    padding: Spacing.md + 2,
    marginBottom: Spacing.sm,
    position: "relative",
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flex: 1,
    marginRight: Spacing.sm,
  },
  cardFrom: {
    ...Typography.bodyMedium,
    fontWeight: "700",
    flex: 1,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    ...Typography.caption,
    fontWeight: "700",
  },
  cardTime: {
    ...Typography.caption,
    marginBottom: Spacing.sm,
  },
  cardCounts: {
    flexDirection: "row",
    gap: Spacing.md,
    alignItems: "center",
  },
  countRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  countText: {
    ...Typography.caption,
  },
  criticalDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  cardChevron: {
    position: "absolute",
    right: Spacing.md,
    top: "50%",
  },
  manualSection: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    alignItems: "center",
    gap: Spacing.sm,
  },
  manualLabel: {
    ...Typography.caption,
  },
  manualBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  manualBtnText: {
    ...Typography.small,
    fontWeight: "600",
  },
});
