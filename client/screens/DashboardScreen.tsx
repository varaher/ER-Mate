import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { fetchFromApi } from "@/lib/api";
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

const getStatusBadge = (status: string, priority: number) => {
  if (status === "completed" || status === "discharged") {
    return { text: "Discharged", color: TriageColors.green, bg: "#f0fdf4" };
  }
  if (priority === 1) {
    return { text: "CRITICAL", color: TriageColors.red, bg: "#fef2f2" };
  }
  if (priority === 2) {
    return { text: "Urgent", color: TriageColors.orange, bg: "#fff7ed" };
  }
  return { text: "In Progress", color: TriageColors.blue, bg: "#eff6ff" };
};

export default function DashboardScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  const { data: cases = [], isLoading: loading, error: queryError, refetch, isRefetching } = useQuery<CaseItem[]>({
    queryKey: ["cases"],
    queryFn: () => fetchFromApi<CaseItem[]>("/cases"),
    refetchOnMount: true,
  });

  const todayCases = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const filtered = cases.filter((c) => {
      const caseDate = new Date(c.created_at);
      caseDate.setHours(0, 0, 0, 0);
      return caseDate.getTime() === today.getTime();
    });

    filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return filtered;
  }, [cases]);

  const stats = useMemo(() => {
    const critical = todayCases.filter((c) => c.triage_priority === 1 || c.triage_priority === 2).length;
    const pending = todayCases.filter((c) => c.status !== "completed" && c.status !== "discharged").length;
    const discharged = todayCases.filter((c) => c.status === "completed" || c.status === "discharged").length;
    return { total: todayCases.length, critical, pending, discharged };
  }, [todayCases]);

  const error = queryError ? (queryError as Error).message : null;
  const refreshing = isRefetching;

  const onRefresh = async () => {
    await refetch();
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  };

  const calculateTimeInER = (createdAt: string) => {
    const start = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return {
      display: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`,
      exceeds4Hours: hours >= 4,
    };
  };

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={[styles.loadingText, { color: theme.textSecondary }]}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.header, { backgroundColor: theme.card, paddingTop: insets.top + Spacing.md }]}>
        <View style={styles.headerLeft}>
          <View style={[styles.logoContainer, { backgroundColor: theme.primaryLight }]}>
            <Feather name="activity" size={24} color={theme.primary} />
          </View>
          <View>
            <Text style={[styles.logoText, { color: theme.primary }]}>ErMate</Text>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>
              Welcome, {user?.name || "Doctor"}
            </Text>
          </View>
        </View>
        <Pressable
          style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}
          onPress={() => navigation.navigate("Upgrade", {})}
        >
          <Feather name="star" size={22} color={theme.warning} />
        </Pressable>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={{ paddingBottom: 120 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {error ? (
          <View style={[styles.errorBanner, { backgroundColor: theme.dangerLight }]}>
            <Feather name="alert-circle" size={20} color={theme.danger} />
            <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
            <Pressable onPress={loadData}>
              <Text style={[styles.retryText, { color: theme.primary }]}>Retry</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.newPatientBtn,
            { backgroundColor: theme.card, borderColor: theme.primary, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={() => navigation.navigate("Triage")}
        >
          <View style={[styles.newPatientIcon, { backgroundColor: theme.primary }]}>
            <Feather name="plus" size={24} color="#FFFFFF" />
          </View>
          <View style={styles.newPatientText}>
            <Text style={[styles.newPatientTitle, { color: theme.text }]}>New Patient</Text>
            <Text style={[styles.newPatientSubtitle, { color: theme.textSecondary }]}>
              Start triage assessment
            </Text>
          </View>
          <Feather name="chevron-right" size={24} color={theme.primary} />
        </Pressable>

        <View style={styles.statsRow}>
          {[
            { value: stats.total, label: "Today", color: theme.primary },
            { value: stats.critical, label: "Critical", color: TriageColors.red },
            { value: stats.pending, label: "Pending", color: TriageColors.orange },
            { value: stats.discharged, label: "Done", color: TriageColors.green },
          ].map((stat, i) => (
            <View key={i} style={[styles.statCard, { backgroundColor: theme.card, borderLeftColor: stat.color }]}>
              <Text style={[styles.statNumber, { color: stat.color }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: theme.textSecondary }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Today's Patients</Text>
            <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>{todayCases.length} cases</Text>
          </View>

          {todayCases.length === 0 ? (
            <View style={[styles.emptyState, { backgroundColor: theme.card }]}>
              <Feather name="users" size={48} color={theme.textMuted} />
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No patients today</Text>
              <Text style={[styles.emptySubtext, { color: theme.textMuted }]}>Tap "New Patient" to start</Text>
            </View>
          ) : (
            todayCases.map((caseItem) => {
              const time = calculateTimeInER(caseItem.created_at);
              const status = getStatusBadge(caseItem.status, caseItem.triage_priority);

              return (
                <Pressable
                  key={caseItem.id}
                  style={({ pressed }) => [
                    styles.caseCard,
                    { backgroundColor: theme.card, opacity: pressed ? 0.9 : 1 },
                    time.exceeds4Hours && status.text !== "Discharged" && styles.caseCardWarning,
                  ]}
                  onPress={() => {
                    const patientAge = parseFloat(caseItem.patient?.age) || 0;
                    const screenName = isPediatric(patientAge) ? "PediatricCaseSheet" : "CaseSheet";
                    navigation.navigate(screenName, { caseId: caseItem.id });
                  }}
                >
                  <View style={[styles.priorityBar, { backgroundColor: getPriorityColor(caseItem.triage_priority) }]} />
                  <View style={styles.caseContent}>
                    <View style={styles.caseTopRow}>
                      <View style={styles.caseInfo}>
                        <Text style={[styles.patientName, { color: theme.text }]}>
                          {caseItem.patient?.name || "Unknown"}
                        </Text>
                        <Text style={[styles.patientDetails, { color: theme.textSecondary }]}>
                          {caseItem.patient?.age || "?"} yrs | {caseItem.patient?.sex || "N/A"}
                        </Text>
                      </View>
                      <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                        <Text style={[styles.statusText, { color: status.color }]}>{status.text}</Text>
                      </View>
                    </View>

                    {caseItem.presenting_complaint?.text ? (
                      <Text style={[styles.complaint, { color: theme.textSecondary }]} numberOfLines={1}>
                        {caseItem.presenting_complaint.text}
                      </Text>
                    ) : null}

                    <View style={styles.caseBottomRow}>
                      <View style={styles.timeInfo}>
                        <Feather name="clock" size={14} color={theme.textMuted} />
                        <Text style={[styles.timeText, { color: theme.textMuted }]}>
                          {formatTime(caseItem.created_at)} | {time.display}
                        </Text>
                        {time.exceeds4Hours && status.text !== "Discharged" ? (
                          <View style={[styles.warningBadge, { backgroundColor: "#fef3c7" }]}>
                            <Text style={styles.warningText}>Over 4h</Text>
                          </View>
                        ) : null}
                      </View>
                      <View style={styles.caseActions}>
                        <Pressable
                          style={[styles.actionBtn, { backgroundColor: theme.primaryLight }]}
                          onPress={() => navigation.navigate("ViewCase", { caseId: caseItem.id })}
                        >
                          <Feather name="eye" size={16} color={theme.primary} />
                        </Pressable>
                        <Pressable
                          style={[styles.actionBtn, { backgroundColor: theme.successLight }]}
                          onPress={() => navigation.navigate("DischargeSummary", { caseId: caseItem.id })}
                        >
                          <Feather name="file-text" size={16} color={theme.success} />
                        </Pressable>
                      </View>
                    </View>
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, ...Typography.body },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  logoContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  logoText: { ...Typography.h3 },
  greeting: { ...Typography.caption },
  headerBtn: { padding: Spacing.sm },
  scrollView: { flex: 1 },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.sm,
    gap: Spacing.sm,
  },
  errorText: { flex: 1, ...Typography.small },
  retryText: { ...Typography.label },
  newPatientBtn: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 2,
    gap: Spacing.md,
  },
  newPatientIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
  },
  newPatientText: { flex: 1 },
  newPatientTitle: { ...Typography.h4 },
  newPatientSubtitle: { ...Typography.small },
  statsRow: {
    flexDirection: "row",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    gap: Spacing.sm,
  },
  statCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 4,
    alignItems: "center",
  },
  statNumber: { ...Typography.h2 },
  statLabel: { ...Typography.caption, marginTop: 2 },
  section: { marginTop: Spacing.xl, marginHorizontal: Spacing.lg },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  sectionTitle: { ...Typography.h4 },
  sectionCount: { ...Typography.small },
  emptyState: {
    alignItems: "center",
    paddingVertical: Spacing["4xl"],
    borderRadius: BorderRadius.md,
  },
  emptyText: { ...Typography.body, marginTop: Spacing.md },
  emptySubtext: { ...Typography.small, marginTop: Spacing.xs },
  caseCard: {
    flexDirection: "row",
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.05)",
  },
  caseCardWarning: { borderColor: TriageColors.yellow, borderWidth: 2 },
  priorityBar: { width: 6 },
  caseContent: { flex: 1, padding: Spacing.md },
  caseTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  caseInfo: { flex: 1 },
  patientName: { ...Typography.h4 },
  patientDetails: { ...Typography.small, marginTop: 2 },
  statusBadge: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusText: { ...Typography.caption, fontWeight: "700" },
  complaint: { ...Typography.small, marginTop: Spacing.sm, fontStyle: "italic" },
  caseBottomRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.sm,
  },
  timeInfo: { flexDirection: "row", alignItems: "center", gap: 4 },
  timeText: { ...Typography.caption },
  warningBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginLeft: 6 },
  warningText: { fontSize: 10, fontWeight: "600", color: "#d97706" },
  caseActions: { flexDirection: "row", gap: Spacing.sm },
  actionBtn: { padding: 6, borderRadius: BorderRadius.sm },
});
