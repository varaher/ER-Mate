import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import { getCaseById } from "@/data/simulationCases";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

export default function SimulationResultScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "SimulationResult">>();
  const { caseId, elapsedTime, performedActions, selectedDifferential, hasCrashed } = route.params;
  const simCase = getCaseById(caseId);

  const results = useMemo(() => {
    if (!simCase) return null;

    const actionsSet = new Set(performedActions);

    const criticalDone = simCase.criticalInterventions.filter((id) => actionsSet.has(id));
    const criticalMissed = simCase.criticalInterventions.filter((id) => !actionsSet.has(id));

    const redFlagActions = [
      ...simCase.history.filter((a) => a.isRedFlag),
      ...simCase.exam.filter((a) => a.isRedFlag),
      ...simCase.investigate.filter((a) => a.isRedFlag),
    ];
    const redFlagsFound = redFlagActions.filter((a) => actionsSet.has(a.id));
    const redFlagsMissed = redFlagActions.filter((a) => !actionsSet.has(a.id));

    const correctDx = simCase.differentials.find((d) => d.isCorrect);
    const diagnosisCorrect = selectedDifferential === correctDx?.id;

    const totalActions = simCase.history.length + simCase.exam.length + simCase.investigate.length + simCase.stabilize.length;
    const doneActions = performedActions.length;

    let score = 0;
    const maxScore = 100;

    const criticalWeight = 40;
    if (simCase.criticalInterventions.length > 0) {
      score += (criticalDone.length / simCase.criticalInterventions.length) * criticalWeight;
    }

    const dxWeight = 20;
    if (diagnosisCorrect) score += dxWeight;

    const redFlagWeight = 20;
    if (redFlagActions.length > 0) {
      score += (redFlagsFound.length / redFlagActions.length) * redFlagWeight;
    }

    const thoroughnessWeight = 10;
    score += Math.min((doneActions / totalActions), 1) * thoroughnessWeight;

    const timeWeight = 10;
    const timeRatio = Math.max(0, 1 - (elapsedTime / simCase.timeLimit));
    score += timeRatio * timeWeight;

    if (hasCrashed) {
      score = Math.max(0, score * 0.5);
    }

    score = Math.round(score);

    let grade: string;
    let gradeColor: string;
    if (hasCrashed) {
      grade = "Patient Crashed";
      gradeColor = TriageColors.red;
    } else if (score >= 90) {
      grade = "Excellent";
      gradeColor = TriageColors.green;
    } else if (score >= 75) {
      grade = "Good";
      gradeColor = TriageColors.blue;
    } else if (score >= 60) {
      grade = "Needs Improvement";
      gradeColor = TriageColors.yellow;
    } else if (score >= 40) {
      grade = "Poor";
      gradeColor = TriageColors.orange;
    } else {
      grade = "Critical Failure";
      gradeColor = TriageColors.red;
    }

    const getMissedCriticalLabels = () => {
      return criticalMissed.map((id) => {
        const fromHistory = simCase.history.find((a) => a.id === id);
        if (fromHistory) return fromHistory.label;
        const fromExam = simCase.exam.find((a) => a.id === id);
        if (fromExam) return fromExam.label;
        const fromInvest = simCase.investigate.find((a) => a.id === id);
        if (fromInvest) return fromInvest.label;
        const fromStab = simCase.stabilize.find((a) => a.id === id);
        if (fromStab) return fromStab.label;
        return id;
      });
    };

    return {
      score,
      grade,
      gradeColor,
      criticalDone,
      criticalMissed,
      criticalMissedLabels: getMissedCriticalLabels(),
      redFlagsFound,
      redFlagsMissed,
      diagnosisCorrect,
      correctDiagnosis: simCase.correctDiagnosis,
      totalActions,
      doneActions,
      timeFormatted: `${Math.floor(elapsedTime / 60)}:${(elapsedTime % 60).toString().padStart(2, "0")}`,
    };
  }, [simCase, performedActions, selectedDifferential, hasCrashed, elapsedTime]);

  useEffect(() => {
    if (!results || !simCase) return;
    saveProgress(results.score);
  }, [results]);

  const saveProgress = async (score: number) => {
    try {
      const saved = await AsyncStorage.getItem("sim_progress");
      const progress = saved ? JSON.parse(saved) : {};
      const existing = progress[caseId];
      progress[caseId] = {
        score,
        bestScore: existing ? Math.max(existing.bestScore, score) : score,
        lastAttempt: new Date().toISOString(),
      };
      await AsyncStorage.setItem("sim_progress", JSON.stringify(progress));
    } catch {}
  };

  if (!simCase || !results) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <Text style={[styles.errorText, { color: theme.danger }]}>Results not available</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: Spacing.lg, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.scoreCard, { backgroundColor: hasCrashed ? TriageColors.red + "15" : theme.card }]}>
          {hasCrashed ? (
            <View style={styles.crashHeader}>
              <Feather name="alert-octagon" size={40} color={TriageColors.red} />
              <Text style={[styles.crashTitle, { color: TriageColors.red }]}>Patient Crashed</Text>
              <Text style={[styles.crashSub, { color: theme.textSecondary }]}>
                Critical interventions were missed, leading to patient deterioration
              </Text>
            </View>
          ) : null}

          <View style={styles.scoreRow}>
            <View style={[styles.scoreCircle, { borderColor: results.gradeColor }]}>
              <Text style={[styles.scoreNumber, { color: results.gradeColor }]}>{results.score}</Text>
              <Text style={[styles.scorePercent, { color: results.gradeColor }]}>/ 100</Text>
            </View>
            <View style={styles.scoreInfo}>
              <Text style={[styles.gradeText, { color: results.gradeColor }]}>{results.grade}</Text>
              <Text style={[styles.scoreDetail, { color: theme.textSecondary }]}>
                Time: {results.timeFormatted} / {Math.floor(simCase.timeLimit / 60)}:00
              </Text>
              <Text style={[styles.scoreDetail, { color: theme.textSecondary }]}>
                Actions: {results.doneActions}/{results.totalActions}
              </Text>
            </View>
          </View>
        </View>

        <View style={[styles.diagnosisCard, { backgroundColor: results.diagnosisCorrect ? TriageColors.green + "15" : TriageColors.red + "15" }]}>
          <View style={styles.diagnosisHeader}>
            <Feather
              name={results.diagnosisCorrect ? "check-circle" : "x-circle"}
              size={22}
              color={results.diagnosisCorrect ? TriageColors.green : TriageColors.red}
            />
            <Text style={[styles.diagnosisTitle, { color: results.diagnosisCorrect ? TriageColors.green : TriageColors.red }]}>
              {results.diagnosisCorrect ? "Correct Diagnosis" : "Incorrect Diagnosis"}
            </Text>
          </View>
          <Text style={[styles.correctDx, { color: theme.text }]}>{results.correctDiagnosis}</Text>
          <Text style={[styles.protocolLabel, { color: theme.textSecondary }]}>{simCase.protocol}</Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Critical Interventions</Text>
          {simCase.criticalInterventions.map((id) => {
            const done = results.criticalDone.includes(id);
            const label = (() => {
              const fromAll = [...simCase.history, ...simCase.exam, ...simCase.investigate].find((a) => a.id === id);
              if (fromAll) return fromAll.label;
              const fromStab = simCase.stabilize.find((a) => a.id === id);
              if (fromStab) return fromStab.label;
              return id;
            })();

            return (
              <View key={id} style={styles.criticalItem}>
                <Feather
                  name={done ? "check-circle" : "x-circle"}
                  size={18}
                  color={done ? TriageColors.green : TriageColors.red}
                />
                <Text style={[styles.criticalLabel, { color: done ? TriageColors.green : TriageColors.red }]}>
                  {label}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Red Flags ({results.redFlagsFound.length}/{results.redFlagsFound.length + results.redFlagsMissed.length} identified)
          </Text>
          {simCase.redFlags.map((rf, idx) => {
            const found = results.redFlagsFound.length > idx;
            return (
              <View key={idx} style={styles.rfItem}>
                <Feather name="flag" size={14} color={found ? TriageColors.green : TriageColors.red} />
                <Text style={[styles.rfText, { color: theme.text }]}>{rf}</Text>
              </View>
            );
          })}
        </View>

        <View style={[styles.section, { backgroundColor: theme.primaryLight }]}>
          <Text style={[styles.sectionTitle, { color: theme.primary }]}>
            <Feather name="book-open" size={16} /> Learning Points
          </Text>
          {simCase.learningPoints.map((lp, idx) => (
            <View key={idx} style={styles.lpItem}>
              <Text style={[styles.lpBullet, { color: theme.primary }]}>{idx + 1}.</Text>
              <Text style={[styles.lpText, { color: theme.text }]}>{lp}</Text>
            </View>
          ))}
        </View>

        <View style={styles.buttonRow}>
          <Pressable
            style={({ pressed }) => [
              styles.retryBtn,
              { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => {
              navigation.pop();
              navigation.navigate("Simulation", { caseId });
            }}
          >
            <Feather name="rotate-ccw" size={18} color="#fff" />
            <Text style={styles.retryBtnText}>Retry Case</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.backBtn,
              { backgroundColor: theme.card, borderColor: theme.border, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => {
              navigation.pop();
              navigation.pop();
            }}
          >
            <Feather name="list" size={18} color={theme.text} />
            <Text style={[styles.backBtnText, { color: theme.text }]}>All Cases</Text>
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  scoreCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    marginBottom: Spacing.md,
  },
  crashHeader: {
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  crashTitle: {
    ...Typography.h2,
    marginTop: Spacing.sm,
  },
  crashSub: {
    ...Typography.small,
    textAlign: "center",
    marginTop: Spacing.xs,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xl,
  },
  scoreCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  scoreNumber: {
    fontSize: 36,
    fontWeight: "800",
  },
  scorePercent: {
    fontSize: 12,
    fontWeight: "500",
    marginTop: -4,
  },
  scoreInfo: { flex: 1 },
  gradeText: {
    ...Typography.h3,
    marginBottom: Spacing.xs,
  },
  scoreDetail: { ...Typography.small, marginTop: 2 },
  diagnosisCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  diagnosisHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  diagnosisTitle: { ...Typography.h4 },
  correctDx: { ...Typography.body, fontWeight: "600", marginBottom: 4 },
  protocolLabel: { ...Typography.caption },
  section: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
    marginBottom: Spacing.md,
  },
  criticalItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  criticalLabel: { ...Typography.small, flex: 1 },
  rfItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  rfText: { ...Typography.small, flex: 1 },
  lpItem: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  lpBullet: { ...Typography.label, width: 20 },
  lpText: { ...Typography.small, flex: 1, lineHeight: 20 },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  retryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  retryBtnText: {
    color: "#fff",
    ...Typography.label,
  },
  backBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  backBtnText: { ...Typography.label },
  errorText: {
    ...Typography.h4,
    textAlign: "center",
    marginTop: 100,
  },
});
