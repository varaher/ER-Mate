import React, { useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
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
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "SimulationResult">>();
  const { caseId, elapsedTime, performedActions, actionTimestamps, selectedDifferential, hasCrashed } = route.params;
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

    const allActions = [...simCase.history, ...simCase.exam, ...simCase.investigate];
    const allStabilize = simCase.stabilize;

    const unnecessaryInvestigations = simCase.investigate
      .filter((a) => a.isUnnecessary && actionsSet.has(a.id));
    const unnecessaryStabilize = allStabilize
      .filter((a) => a.isUnnecessary && actionsSet.has(a.id));
    const harmfulActions = [
      ...simCase.investigate.filter((a) => a.harmIfDone && actionsSet.has(a.id)),
      ...allStabilize.filter((a) => a.harmIfDone && actionsSet.has(a.id)),
    ];

    const totalWastedTime = [
      ...unnecessaryInvestigations.map((a) => a.timeCost || 0),
      ...unnecessaryStabilize.map((a) => a.timeCost || 0),
    ].reduce((sum, t) => sum + t, 0);

    const relevantActions = [
      ...simCase.history,
      ...simCase.exam,
      ...simCase.investigate.filter((a) => !a.isUnnecessary),
    ];
    const relevantStabilize = allStabilize.filter((a) => !a.isUnnecessary);
    const totalRelevantActions = relevantActions.length + relevantStabilize.length;
    const doneRelevantActions = [
      ...relevantActions.filter((a) => actionsSet.has(a.id)),
      ...relevantStabilize.filter((a) => actionsSet.has(a.id)),
    ].length;

    const criticalWithTimestamps = simCase.criticalInterventions
      .filter((id) => actionsSet.has(id))
      .map((id) => ({
        id,
        timestamp: actionTimestamps?.[id] || 0,
        label: (() => {
          const fromAll = [...simCase.history, ...simCase.exam, ...simCase.investigate].find((a) => a.id === id);
          if (fromAll) return fromAll.label;
          const fromStab = simCase.stabilize.find((a) => a.id === id);
          if (fromStab) return fromStab.label;
          return id;
        })(),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    let score = 0;

    const criticalWeight = 35;
    if (simCase.criticalInterventions.length > 0) {
      score += (criticalDone.length / simCase.criticalInterventions.length) * criticalWeight;
    }

    const dxWeight = 15;
    if (diagnosisCorrect) score += dxWeight;

    const redFlagWeight = 15;
    if (redFlagActions.length > 0) {
      score += (redFlagsFound.length / redFlagActions.length) * redFlagWeight;
    }

    const thoroughnessWeight = 10;
    if (totalRelevantActions > 0) {
      score += Math.min((doneRelevantActions / totalRelevantActions), 1) * thoroughnessWeight;
    }

    const timeWeight = 10;
    const timeRatio = Math.max(0, 1 - (elapsedTime / simCase.timeLimit));
    score += timeRatio * timeWeight;

    const efficiencyWeight = 15;
    const totalUnnecessaryCount = unnecessaryInvestigations.length + unnecessaryStabilize.length;
    const maxDistractors = simCase.investigate.filter((a) => a.isUnnecessary).length + allStabilize.filter((a) => a.isUnnecessary).length;
    if (maxDistractors > 0) {
      const avoidedRatio = 1 - (totalUnnecessaryCount / maxDistractors);
      score += avoidedRatio * efficiencyWeight;
    } else {
      score += efficiencyWeight;
    }

    if (harmfulActions.length > 0) {
      score -= harmfulActions.length * 8;
    }

    if (hasCrashed) {
      score = Math.max(0, score * 0.4);
    }

    if (elapsedTime >= simCase.timeLimit && !hasCrashed) {
      score = Math.max(0, score * 0.7);
    }

    score = Math.round(Math.max(0, Math.min(100, score)));

    let grade: string;
    let gradeColor: string;
    let gradeIcon: string;
    if (hasCrashed) {
      grade = "Patient Crashed";
      gradeColor = TriageColors.red;
      gradeIcon = "alert-octagon";
    } else if (elapsedTime >= simCase.timeLimit) {
      grade = score >= 60 ? "Time Expired - Partial Credit" : "Time Expired - Failed";
      gradeColor = score >= 60 ? TriageColors.orange : TriageColors.red;
      gradeIcon = "clock";
    } else if (score >= 90) {
      grade = "Excellent";
      gradeColor = TriageColors.green;
      gradeIcon = "award";
    } else if (score >= 75) {
      grade = "Good";
      gradeColor = TriageColors.blue;
      gradeIcon = "thumbs-up";
    } else if (score >= 60) {
      grade = "Needs Improvement";
      gradeColor = TriageColors.yellow;
      gradeIcon = "alert-circle";
    } else if (score >= 40) {
      grade = "Poor";
      gradeColor = TriageColors.orange;
      gradeIcon = "alert-triangle";
    } else {
      grade = "Critical Failure";
      gradeColor = TriageColors.red;
      gradeIcon = "x-octagon";
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

    const generateFeedback = (): string[] => {
      const feedback: string[] = [];

      if (hasCrashed) {
        feedback.push("The patient deteriorated because critical interventions were not performed in time. In a real ER, this outcome is preventable with rapid, protocol-driven action.");
      }

      if (elapsedTime >= simCase.timeLimit && !hasCrashed) {
        feedback.push("You ran out of time. In emergency medicine, delayed management directly impacts patient outcomes. Practice prioritizing critical actions first.");
      }

      if (criticalMissed.length > 0) {
        feedback.push(`You missed ${criticalMissed.length} critical intervention(s). These are the actions that directly determine patient survival. Review the protocol: ${simCase.protocol}.`);
      }

      if (unnecessaryInvestigations.length > 0) {
        const names = unnecessaryInvestigations.map((a) => a.label).join(", ");
        feedback.push(`You ordered unnecessary investigations: ${names}. This wasted approximately ${totalWastedTime} seconds that could have been used for life-saving interventions.`);
      }

      if (harmfulActions.length > 0) {
        feedback.push(`You performed ${harmfulActions.length} potentially harmful action(s). In a real scenario, these could have worsened the patient's condition or caused additional complications.`);
      }

      if (!diagnosisCorrect) {
        feedback.push(`Your working diagnosis was incorrect. The correct diagnosis is: ${simCase.correctDiagnosis}. Review the key differentiating features.`);
      }

      if (unnecessaryStabilize.length > 0 && harmfulActions.length === 0) {
        const names = unnecessaryStabilize.map((a) => a.label).join(", ");
        feedback.push(`You performed unnecessary treatments: ${names}. Focus on evidence-based, protocol-driven interventions.`);
      }

      if (score >= 90) {
        feedback.push("Outstanding performance. You demonstrated efficient, protocol-driven management with appropriate prioritization of critical interventions.");
      } else if (score >= 75 && harmfulActions.length === 0) {
        feedback.push("Good overall approach. Focus on speed and avoiding non-essential investigations to improve further.");
      }

      return feedback;
    };

    return {
      score,
      grade,
      gradeColor,
      gradeIcon,
      criticalDone,
      criticalMissed,
      criticalMissedLabels: getMissedCriticalLabels(),
      criticalWithTimestamps,
      redFlagsFound,
      redFlagsMissed,
      diagnosisCorrect,
      correctDiagnosis: simCase.correctDiagnosis,
      totalRelevantActions,
      doneRelevantActions,
      unnecessaryInvestigations,
      unnecessaryStabilize,
      harmfulActions,
      totalWastedTime,
      timeFormatted: `${Math.floor(elapsedTime / 60)}:${(elapsedTime % 60).toString().padStart(2, "0")}`,
      feedback: generateFeedback(),
      timeExpired: elapsedTime >= simCase.timeLimit,
    };
  }, [simCase, performedActions, selectedDifferential, hasCrashed, elapsedTime, actionTimestamps]);

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
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.scoreCard, { backgroundColor: hasCrashed ? TriageColors.red + "15" : results.timeExpired ? TriageColors.orange + "15" : theme.card }]}>
          {hasCrashed ? (
            <View style={styles.crashHeader}>
              <Feather name="alert-octagon" size={40} color={TriageColors.red} />
              <Text style={[styles.crashTitle, { color: TriageColors.red }]}>Patient Crashed</Text>
              <Text style={[styles.crashSub, { color: theme.textSecondary }]}>
                Critical interventions were missed, leading to patient deterioration
              </Text>
            </View>
          ) : results.timeExpired ? (
            <View style={styles.crashHeader}>
              <Feather name="clock" size={40} color={TriageColors.orange} />
              <Text style={[styles.crashTitle, { color: TriageColors.orange }]}>Time Expired</Text>
              <Text style={[styles.crashSub, { color: theme.textSecondary }]}>
                You ran out of time. In emergency medicine, every second counts.
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
                Relevant actions: {results.doneRelevantActions}/{results.totalRelevantActions}
              </Text>
              {results.totalWastedTime > 0 ? (
                <Text style={[styles.scoreDetail, { color: TriageColors.orange }]}>
                  Time wasted: ~{results.totalWastedTime}s on unnecessary actions
                </Text>
              ) : null}
            </View>
          </View>
        </View>

        {results.feedback.length > 0 ? (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <View style={styles.sectionHeader}>
              <Feather name="message-circle" size={18} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Clinical Feedback</Text>
            </View>
            {results.feedback.map((fb, idx) => (
              <View key={idx} style={[styles.feedbackItem, { borderLeftColor: idx === 0 ? results.gradeColor : theme.border }]}>
                <Text style={[styles.feedbackText, { color: theme.text }]}>{fb}</Text>
              </View>
            ))}
          </View>
        ) : null}

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
          <View style={styles.sectionHeader}>
            <Feather name="shield" size={18} color={TriageColors.red} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Critical Interventions</Text>
          </View>
          {simCase.criticalInterventions.map((id) => {
            const done = results.criticalDone.includes(id);
            const label = (() => {
              const fromAll = [...simCase.history, ...simCase.exam, ...simCase.investigate].find((a) => a.id === id);
              if (fromAll) return fromAll.label;
              const fromStab = simCase.stabilize.find((a) => a.id === id);
              if (fromStab) return fromStab.label;
              return id;
            })();
            const timestamp = actionTimestamps?.[id];

            return (
              <View key={id} style={styles.criticalItem}>
                <Feather
                  name={done ? "check-circle" : "x-circle"}
                  size={18}
                  color={done ? TriageColors.green : TriageColors.red}
                />
                <View style={styles.criticalItemContent}>
                  <Text style={[styles.criticalLabel, { color: done ? TriageColors.green : TriageColors.red }]}>
                    {label}
                  </Text>
                  {done && timestamp !== undefined ? (
                    <Text style={[styles.criticalTimestamp, { color: theme.textMuted }]}>
                      Done at {Math.floor(timestamp / 60)}:{(timestamp % 60).toString().padStart(2, "0")}
                    </Text>
                  ) : null}
                  {!done ? (
                    <Text style={[styles.criticalTimestamp, { color: TriageColors.red }]}>MISSED</Text>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {results.harmfulActions.length > 0 ? (
          <View style={[styles.section, { backgroundColor: TriageColors.red + "08" }]}>
            <View style={styles.sectionHeader}>
              <Feather name="alert-octagon" size={18} color={TriageColors.red} />
              <Text style={[styles.sectionTitle, { color: TriageColors.red }]}>Harmful Actions (-8 points each)</Text>
            </View>
            {results.harmfulActions.map((action, idx) => (
              <View key={idx} style={[styles.harmfulItem, { borderLeftColor: TriageColors.red }]}>
                <Text style={[styles.harmfulLabel, { color: TriageColors.red }]}>
                  {"label" in action ? action.label : ""}
                </Text>
                <Text style={[styles.harmfulDesc, { color: theme.text }]}>
                  {"harmIfDone" in action && action.harmIfDone ? action.harmIfDone : ""}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        {results.unnecessaryInvestigations.length > 0 || results.unnecessaryStabilize.length > 0 ? (
          <View style={[styles.section, { backgroundColor: TriageColors.orange + "08" }]}>
            <View style={styles.sectionHeader}>
              <Feather name="alert-triangle" size={18} color={TriageColors.orange} />
              <Text style={[styles.sectionTitle, { color: TriageColors.orange }]}>Unnecessary Actions (Wasted Resources)</Text>
            </View>
            {results.unnecessaryInvestigations.map((action) => (
              <View key={action.id} style={[styles.unnecessaryItem, { borderLeftColor: TriageColors.orange }]}>
                <View style={styles.unnecessaryHeader}>
                  <Feather name="clipboard" size={14} color={TriageColors.orange} />
                  <Text style={[styles.unnecessaryLabel, { color: TriageColors.orange }]}>{action.label}</Text>
                  {action.timeCost ? (
                    <Text style={[styles.unnecessaryTimeCost, { color: TriageColors.red }]}>+{action.timeCost}s wasted</Text>
                  ) : null}
                </View>
                {action.harmIfDone ? (
                  <Text style={[styles.unnecessaryDesc, { color: theme.textSecondary }]}>{action.harmIfDone}</Text>
                ) : null}
              </View>
            ))}
            {results.unnecessaryStabilize.filter((a) => !a.harmIfDone).map((action) => (
              <View key={action.id} style={[styles.unnecessaryItem, { borderLeftColor: TriageColors.orange }]}>
                <View style={styles.unnecessaryHeader}>
                  <Feather name="zap" size={14} color={TriageColors.orange} />
                  <Text style={[styles.unnecessaryLabel, { color: TriageColors.orange }]}>{action.label}</Text>
                  {action.timeCost ? (
                    <Text style={[styles.unnecessaryTimeCost, { color: TriageColors.red }]}>+{action.timeCost}s wasted</Text>
                  ) : null}
                </View>
              </View>
            ))}
            {results.totalWastedTime > 0 ? (
              <View style={[styles.wastedTimeBanner, { backgroundColor: TriageColors.orange + "15" }]}>
                <Feather name="clock" size={14} color={TriageColors.orange} />
                <Text style={[styles.wastedTimeText, { color: TriageColors.orange }]}>
                  Total time wasted on unnecessary actions: ~{results.totalWastedTime} seconds
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {results.criticalWithTimestamps.length > 0 ? (
          <View style={[styles.section, { backgroundColor: theme.card }]}>
            <View style={styles.sectionHeader}>
              <Feather name="trending-up" size={18} color={theme.primary} />
              <Text style={[styles.sectionTitle, { color: theme.text }]}>Action Timeline</Text>
            </View>
            <Text style={[styles.timelineSubtitle, { color: theme.textSecondary }]}>
              Order of critical interventions performed:
            </Text>
            {results.criticalWithTimestamps.map((item, idx) => (
              <View key={item.id} style={styles.timelineItem}>
                <View style={[styles.timelineDot, { backgroundColor: theme.primary }]}>
                  <Text style={styles.timelineDotText}>{idx + 1}</Text>
                </View>
                <View style={styles.timelineContent}>
                  <Text style={[styles.timelineLabel, { color: theme.text }]}>{item.label}</Text>
                  <Text style={[styles.timelineTime, { color: theme.textMuted }]}>
                    at {Math.floor(item.timestamp / 60)}:{(item.timestamp % 60).toString().padStart(2, "0")}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <View style={styles.sectionHeader}>
            <Feather name="flag" size={18} color={TriageColors.red} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Red Flags ({results.redFlagsFound.length}/{results.redFlagsFound.length + results.redFlagsMissed.length} identified)
            </Text>
          </View>
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
          <View style={styles.sectionHeader}>
            <Feather name="book-open" size={18} color={theme.primary} />
            <Text style={[styles.sectionTitle, { color: theme.primary }]}>Learning Points</Text>
          </View>
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.h4,
    flex: 1,
  },
  feedbackItem: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  feedbackText: {
    ...Typography.small,
    lineHeight: 20,
  },
  criticalItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  criticalItemContent: {
    flex: 1,
  },
  criticalLabel: { ...Typography.small, fontWeight: "600" },
  criticalTimestamp: { ...Typography.caption, marginTop: 2 },
  harmfulItem: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  harmfulLabel: { ...Typography.small, fontWeight: "700", marginBottom: 4 },
  harmfulDesc: { ...Typography.small, lineHeight: 20 },
  unnecessaryItem: {
    borderLeftWidth: 3,
    paddingLeft: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  unnecessaryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    flexWrap: "wrap",
  },
  unnecessaryLabel: { ...Typography.small, fontWeight: "600", flex: 1 },
  unnecessaryTimeCost: { ...Typography.caption, fontWeight: "700" },
  unnecessaryDesc: { ...Typography.caption, marginTop: 4, lineHeight: 18 },
  wastedTimeBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginTop: Spacing.sm,
  },
  wastedTimeText: { ...Typography.small, fontWeight: "600", flex: 1 },
  timelineSubtitle: { ...Typography.caption, marginBottom: Spacing.md },
  timelineItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  timelineDotText: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  timelineContent: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  timelineLabel: { ...Typography.small, fontWeight: "600", flex: 1 },
  timelineTime: { ...Typography.caption },
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
