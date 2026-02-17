import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import { simulationCases, SimulationCase } from "@/data/simulationCases";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";

const DIFFICULTY_LABELS: Record<number, string> = {
  1: "Beginner",
  2: "Easy",
  3: "Moderate",
  4: "Hard",
  5: "Expert",
};

const DIFFICULTY_COLORS: Record<number, string> = {
  1: TriageColors.green,
  2: TriageColors.blue,
  3: TriageColors.yellow,
  4: TriageColors.orange,
  5: TriageColors.red,
};

const SPECIALTY_ICONS: Record<string, string> = {
  Cardiology: "heart",
  Trauma: "alert-triangle",
  "Infectious Disease": "thermometer",
  "Allergy/Immunology": "alert-circle",
  Endocrinology: "droplet",
  "Obstetrics/Gynecology": "user",
  Neurology: "cpu",
  Pulmonology: "wind",
  "Infectious Disease / Neurology": "thermometer",
  "Pediatric Emergency": "users",
  "Cardiothoracic / Vascular": "heart",
};

type FilterType = "all" | "beginner" | "intermediate" | "advanced";

export default function SimulationListScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [filter, setFilter] = useState<FilterType>("all");
  const [completedCases, setCompletedCases] = useState<Record<string, { score: number; bestScore: number }>>({});

  useFocusEffect(
    useCallback(() => {
      loadProgress();
    }, [])
  );

  const loadProgress = async () => {
    try {
      const saved = await AsyncStorage.getItem("sim_progress");
      if (saved) setCompletedCases(JSON.parse(saved));
    } catch {}
  };

  const filteredCases = simulationCases.filter((c) => {
    if (filter === "all") return true;
    if (filter === "beginner") return c.difficulty <= 2;
    if (filter === "intermediate") return c.difficulty === 3;
    if (filter === "advanced") return c.difficulty >= 4;
    return true;
  });

  const completedCount = Object.keys(completedCases).length;

  const renderCaseCard = (simCase: SimulationCase) => {
    const progress = completedCases[simCase.id];
    const isCompleted = !!progress;
    const diffColor = DIFFICULTY_COLORS[simCase.difficulty];
    const iconName = SPECIALTY_ICONS[simCase.specialty] || "activity";

    return (
      <Pressable
        key={simCase.id}
        style={({ pressed }) => [
          styles.caseCard,
          { backgroundColor: theme.card, opacity: pressed ? 0.85 : 1 },
        ]}
        onPress={() => navigation.navigate("Simulation", { caseId: simCase.id })}
      >
        <View style={styles.caseCardHeader}>
          <View style={[styles.caseIcon, { backgroundColor: diffColor + "20" }]}>
            <Feather name={iconName as any} size={24} color={diffColor} />
          </View>
          <View style={styles.caseCardMeta}>
            <Text style={[styles.caseTitle, { color: theme.text }]} numberOfLines={1}>
              {simCase.title}
            </Text>
            <Text style={[styles.caseSpecialty, { color: theme.textSecondary }]} numberOfLines={1}>
              {simCase.specialty} {simCase.ageGroup === "pediatric" ? "(Pediatric)" : ""}
            </Text>
          </View>
          {isCompleted ? (
            <View style={[styles.completedBadge, { backgroundColor: TriageColors.green + "20" }]}>
              <Feather name="check-circle" size={16} color={TriageColors.green} />
              <Text style={[styles.scoreBadgeText, { color: TriageColors.green }]}>
                {progress.bestScore}%
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.caseComplaint, { color: theme.textMuted }]} numberOfLines={2}>
          {simCase.chiefComplaint}
        </Text>

        <View style={styles.caseCardFooter}>
          <View style={[styles.diffBadge, { backgroundColor: diffColor + "20" }]}>
            <Text style={[styles.diffBadgeText, { color: diffColor }]}>
              {DIFFICULTY_LABELS[simCase.difficulty]}
            </Text>
          </View>
          <View style={styles.caseStats}>
            <Feather name="clock" size={12} color={theme.textMuted} />
            <Text style={[styles.caseStatText, { color: theme.textMuted }]}>
              {Math.floor(simCase.timeLimit / 60)} min
            </Text>
          </View>
          <View style={styles.caseStats}>
            <Feather name="flag" size={12} color={theme.textMuted} />
            <Text style={[styles.caseStatText, { color: theme.textMuted }]}>
              {simCase.redFlags.length} red flags
            </Text>
          </View>
          <View style={[styles.protocolBadge, { backgroundColor: theme.primaryLight }]}>
            <Text style={[styles.protocolText, { color: theme.primary }]}>{simCase.protocol.split("/")[0].trim()}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Spacing.lg, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerCard, { backgroundColor: theme.card }]}>
          <View style={styles.headerRow}>
            <View style={[styles.headerIcon, { backgroundColor: TriageColors.red + "15" }]}>
              <Feather name="monitor" size={28} color={TriageColors.red} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={[styles.headerTitle, { color: theme.text }]}>ER Simulation Lab</Text>
              <Text style={[styles.headerSub, { color: theme.textSecondary }]}>
                Practice real emergency scenarios
              </Text>
            </View>
          </View>

          <View style={[styles.progressRow, { backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.progressInfo}>
              <Text style={[styles.progressLabel, { color: theme.textSecondary }]}>Completed</Text>
              <Text style={[styles.progressValue, { color: theme.text }]}>
                {completedCount}/{simulationCases.length}
              </Text>
            </View>
            <View style={[styles.progressBar, { backgroundColor: theme.backgroundTertiary }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: TriageColors.green,
                    width: `${(completedCount / simulationCases.length) * 100}%`,
                  },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={styles.filterRow}>
          {(["all", "beginner", "intermediate", "advanced"] as FilterType[]).map((f) => (
            <Pressable
              key={f}
              style={[
                styles.filterChip,
                {
                  backgroundColor: filter === f ? theme.primary : theme.card,
                },
              ]}
              onPress={() => setFilter(f)}
            >
              <Text
                style={[
                  styles.filterText,
                  { color: filter === f ? "#fff" : theme.textSecondary },
                ]}
              >
                {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
          {filteredCases.length} Case{filteredCases.length !== 1 ? "s" : ""} Available
        </Text>

        {filteredCases.map(renderCaseCard)}

        <View style={[styles.disclaimerCard, { backgroundColor: theme.warningLight }]}>
          <Feather name="info" size={16} color={theme.warning} />
          <Text style={[styles.disclaimerText, { color: theme.text }]}>
            These simulations are for educational purposes only. Clinical decisions should always be based on actual patient assessment and institutional protocols.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  headerCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  headerInfo: { flex: 1 },
  headerTitle: { ...Typography.h3 },
  headerSub: { ...Typography.small, marginTop: 2 },
  progressRow: {
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  progressInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  progressLabel: { ...Typography.small },
  progressValue: { ...Typography.label },
  progressBar: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  filterRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  filterChip: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  filterText: { ...Typography.label },
  sectionLabel: {
    ...Typography.small,
    marginBottom: Spacing.sm,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  caseCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  caseCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  caseIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  caseCardMeta: { flex: 1 },
  caseTitle: { ...Typography.h4 },
  caseSpecialty: { ...Typography.small, marginTop: 2 },
  completedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  scoreBadgeText: { ...Typography.label },
  caseComplaint: { ...Typography.small, marginBottom: Spacing.md },
  caseCardFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  diffBadge: {
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  diffBadgeText: { ...Typography.caption, fontWeight: "600" },
  caseStats: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  caseStatText: { ...Typography.caption },
  protocolBadge: {
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  protocolText: { ...Typography.caption, fontWeight: "600" },
  disclaimerCard: {
    flexDirection: "row",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.md,
  },
  disclaimerText: { ...Typography.caption, flex: 1 },
});
