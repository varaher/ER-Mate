import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { fetchFromApi } from "@/lib/api";
import { Spacing, BorderRadius } from "@/constants/theme";
import {
  getWeeklyStats,
  getAllTimeStats,
  getCaseTimeLog,
} from "@/hooks/useCaseTimer";

interface CaseItem {
  id: string;
  patient: { name: string; age: string; sex: string };
  presenting_complaint?: { text: string };
  triage_priority: number;
  status: string;
  created_at: string;
}

const AVG_PAPER = 18;
const AVG_DIGITAL = 4;

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
  bg,
}: {
  icon: string;
  label: string;
  value: string;
  sub?: string;
  color: string;
  bg: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={[styles.statCard, { backgroundColor: theme.card }]}>
      <View style={[styles.statIcon, { backgroundColor: bg }]}>
        <Feather name={icon as any} size={20} color={color} />
      </View>
      <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{label}</Text>
      {sub ? (
        <Text style={[styles.statSub, { color: color }]}>{sub}</Text>
      ) : null}
    </View>
  );
}

export default function StatsScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [weekly, setWeekly] = useState<{
    count: number;
    totalSavedMinutes: number;
    avgDurationMinutes: number;
    topComplaints: { complaint: string; count: number }[];
  } | null>(null);
  const [allTime, setAllTime] = useState<{
    totalCases: number;
    totalSavedMinutes: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { data: cases = [] } = useQuery<CaseItem[]>({
    queryKey: ["cases", user?.id],
    queryFn: () => fetchFromApi<CaseItem[]>("/cases"),
    enabled: !!user?.id,
  });

  const load = useCallback(async () => {
    const [w, a] = await Promise.all([getWeeklyStats(), getAllTimeStats()]);
    setWeekly(w);
    setAllTime(a);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);

  const casesThisWeek = cases.filter(
    (c) => new Date(c.created_at) >= weekStart
  );

  const apiCasesThisWeek = casesThisWeek.length;
  const trackedCount = weekly?.count ?? 0;
  const displayCount = Math.max(apiCasesThisWeek, trackedCount);

  const estimatedSaved =
    weekly && weekly.count > 0
      ? weekly.totalSavedMinutes
      : apiCasesThisWeek * (AVG_PAPER - AVG_DIGITAL);

  const topComplaintsFromAPI = (() => {
    const map: Record<string, number> = {};
    casesThisWeek.forEach((c) => {
      const txt = c.presenting_complaint?.text?.trim().toLowerCase().slice(0, 40);
      if (txt) map[txt] = (map[txt] || 0) + 1;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => ({
        complaint: k.charAt(0).toUpperCase() + k.slice(1),
        count: v,
      }));
  })();

  const topComplaints =
    topComplaintsFromAPI.length > 0
      ? topComplaintsFromAPI
      : weekly?.topComplaints ?? [];

  const allTimeCases = allTime?.totalCases ?? 0;
  const allTimeSaved = allTime?.totalSavedMinutes ?? 0;

  const getDayLabel = () => {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const today = new Date().getDay();
    const weekDayName = days[today];
    const weekNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${weekNames[today]} — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
  };

  if (loading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: headerHeight + Spacing.lg, paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
        }
      >
        <View style={[styles.weekBanner, { backgroundColor: theme.primary + "15", borderColor: theme.primary + "30" }]}>
          <Feather name="calendar" size={14} color={theme.primary} />
          <Text style={[styles.weekLabel, { color: theme.primary }]}>
            This week — {getDayLabel()}
          </Text>
        </View>

        <View style={styles.statsGrid}>
          <StatCard
            icon="file-text"
            label="Cases Documented"
            value={String(displayCount)}
            sub={displayCount >= 5 ? "Strong week" : undefined}
            color={theme.primary}
            bg={theme.primary + "15"}
          />
          <StatCard
            icon="clock"
            label="Time Saved"
            value={
              estimatedSaved >= 60
                ? `${Math.floor(estimatedSaved / 60)}h ${estimatedSaved % 60}m`
                : `${estimatedSaved}m`
            }
            sub="vs. paper"
            color="#10B981"
            bg="#10B98115"
          />
          <StatCard
            icon="zap"
            label="Avg. Per Case"
            value={
              weekly && weekly.avgDurationMinutes > 0
                ? `${weekly.avgDurationMinutes} min`
                : `~${AVG_DIGITAL} min`
            }
            sub={`Paper: ~${AVG_PAPER} min`}
            color="#8B5CF6"
            bg="#8B5CF615"
          />
          <StatCard
            icon="trending-up"
            label="All-Time Cases"
            value={String(Math.max(cases.length, allTimeCases))}
            sub={
              allTimeSaved > 0
                ? `${Math.round(allTimeSaved / 60)}h saved total`
                : undefined
            }
            color="#F59E0B"
            bg="#F59E0B15"
          />
        </View>

        {topComplaints.length > 0 ? (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <View style={styles.sectionHeader}>
              <Feather name="bar-chart-2" size={16} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>
                Top Presentations This Week
              </Text>
            </View>
            {topComplaints.map((item, i) => {
              const maxCount = topComplaints[0].count;
              const pct = (item.count / maxCount) * 100;
              const colors = [theme.primary, "#8B5CF6", "#10B981", "#F59E0B", "#EF4444"];
              const barColor = colors[i % colors.length];
              return (
                <View key={i} style={styles.complaintRow}>
                  <View style={styles.complaintLabelRow}>
                    <View style={[styles.rankBadge, { backgroundColor: barColor + "20" }]}>
                      <Text style={[styles.rankText, { color: barColor }]}>{i + 1}</Text>
                    </View>
                    <Text style={[styles.complaintText, { color: theme.text }]} numberOfLines={1}>
                      {item.complaint}
                    </Text>
                    <Text style={[styles.complaintCount, { color: theme.textSecondary }]}>
                      {item.count}x
                    </Text>
                  </View>
                  <View style={[styles.barTrack, { backgroundColor: theme.backgroundDefault }]}>
                    <View style={[styles.barFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeader}>
            <Feather name="info" size={16} color={theme.textSecondary} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>How Time Saved Is Calculated</Text>
          </View>
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            Average paper-based ER documentation takes ~18 minutes per case. ErMate reduces this to ~4 minutes through voice dictation and structured templates. Time saved is calculated per completed case.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
  weekBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  weekLabel: { fontSize: 13, fontWeight: "500" },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  statCard: {
    width: "47.5%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: 4,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  statValue: { fontSize: 24, fontWeight: "700" },
  statLabel: { fontSize: 12 },
  statSub: { fontSize: 11, fontWeight: "500", marginTop: 2 },
  section: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
  },
  sectionTitle: { fontSize: 15, fontWeight: "600" },
  complaintRow: { gap: 4 },
  complaintLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rankBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  rankText: { fontSize: 11, fontWeight: "700" },
  complaintText: { flex: 1, fontSize: 13 },
  complaintCount: { fontSize: 12, fontWeight: "500" },
  barTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  barFill: { height: 6, borderRadius: 3 },
  infoText: { fontSize: 13, lineHeight: 20 },
});
