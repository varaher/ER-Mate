import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Animated,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import { getCaseById, Vitals, SimAction, StabilizeAction, DeteriorationRule } from "@/data/simulationCases";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type TabType = "history" | "exam" | "investigate" | "stabilize" | "differential";

const TAB_CONFIG: { key: TabType; label: string; icon: string }[] = [
  { key: "history", label: "History", icon: "message-circle" },
  { key: "exam", label: "Exam", icon: "search" },
  { key: "investigate", label: "Labs", icon: "clipboard" },
  { key: "stabilize", label: "Stabilize", icon: "shield" },
  { key: "differential", label: "Dx", icon: "target" },
];

export default function SimulationScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "Simulation">>();
  const { caseId } = route.params;
  const simCase = getCaseById(caseId);

  const [activeTab, setActiveTab] = useState<TabType>("history");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [currentVitals, setCurrentVitals] = useState<Vitals>(simCase?.initialVitals || { hr: 80, sbp: 120, dbp: 80, rr: 16, spo2: 98, temp: 37, gcs: 15 });
  const [performedActions, setPerformedActions] = useState<Set<string>>(new Set());
  const [revealedFindings, setRevealedFindings] = useState<Record<string, string>>({});
  const [pendingInvestigations, setPendingInvestigations] = useState<Record<string, number>>({});
  const [selectedDifferential, setSelectedDifferential] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(true);
  const [hasCrashed, setHasCrashed] = useState(false);
  const [deteriorationMessages, setDeteriorationMessages] = useState<string[]>([]);
  const [showMessage, setShowMessage] = useState<string | null>(null);
  const triggeredRulesRef = useRef<Set<number>>(new Set());
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const alertAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.15, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    if (!simCase || !isRunning || hasCrashed) return;

    for (const rule of simCase.deteriorationRules) {
      if (triggeredRulesRef.current.has(rule.triggerTime)) continue;
      if (elapsedTime >= rule.triggerTime && !performedActions.has(rule.unlessActionDone)) {
        triggeredRulesRef.current.add(rule.triggerTime);

        setCurrentVitals((prev) => ({
          ...prev,
          ...rule.vitalChanges,
        }));

        setDeteriorationMessages((prev) => [...prev, rule.message]);
        setShowMessage(rule.message);

        if (Platform.OS !== "web") {
          Haptics.notificationAsync(
            rule.isCrash ? Haptics.NotificationFeedbackType.Error : Haptics.NotificationFeedbackType.Warning
          );
        }

        Animated.sequence([
          Animated.timing(alertAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(alertAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(alertAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.timing(alertAnim, { toValue: 0, duration: 3000, useNativeDriver: true }),
        ]).start();

        if (rule.isCrash) {
          setHasCrashed(true);
          setIsRunning(false);
          setTimeout(() => {
            navigation.navigate("SimulationResult", {
              caseId,
              elapsedTime,
              performedActions: Array.from(performedActions),
              selectedDifferential,
              hasCrashed: true,
            });
          }, 4000);
        }
      }
    }
  }, [elapsedTime]);

  useEffect(() => {
    if (!isRunning) return;
    const checkPending = setInterval(() => {
      setPendingInvestigations((prev) => {
        const updated = { ...prev };
        let changed = false;
        for (const [id, endTime] of Object.entries(updated)) {
          if (elapsedTime >= endTime) {
            const investigation = simCase?.investigate.find((i) => i.id === id);
            if (investigation) {
              setRevealedFindings((rf) => ({ ...rf, [id]: investigation.finding }));
            }
            delete updated[id];
            changed = true;
          }
        }
        return changed ? updated : prev;
      });
    }, 1000);
    return () => clearInterval(checkPending);
  }, [isRunning, elapsedTime]);

  if (!simCase) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <Text style={[styles.errorText, { color: theme.danger }]}>Case not found</Text>
      </View>
    );
  }

  const performAction = (actionId: string, finding?: string) => {
    if (performedActions.has(actionId) || hasCrashed) return;

    const newActions = new Set(performedActions);
    newActions.add(actionId);
    setPerformedActions(newActions);

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (finding !== undefined) {
      setRevealedFindings((prev) => ({ ...prev, [actionId]: finding }));
    }
  };

  const performInvestigation = (action: SimAction) => {
    if (performedActions.has(action.id) || hasCrashed) return;

    const newActions = new Set(performedActions);
    newActions.add(action.id);
    setPerformedActions(newActions);

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (action.timeToResult && action.timeToResult > 3) {
      setPendingInvestigations((prev) => ({
        ...prev,
        [action.id]: elapsedTime + action.timeToResult,
      }));
      setRevealedFindings((prev) => ({
        ...prev,
        [action.id]: `Ordered. Results expected in ~${action.timeToResult} seconds...`,
      }));
    } else {
      setRevealedFindings((prev) => ({ ...prev, [action.id]: action.finding }));
    }
  };

  const performStabilize = (action: StabilizeAction) => {
    if (performedActions.has(action.id) || hasCrashed) return;

    const newActions = new Set(performedActions);
    newActions.add(action.id);
    setPerformedActions(newActions);

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setRevealedFindings((prev) => ({ ...prev, [action.id]: action.effect }));

    if (action.vitalChanges) {
      setCurrentVitals((prev) => ({ ...prev, ...action.vitalChanges }));
    }
  };

  const selectDifferential = (id: string) => {
    setSelectedDifferential(id);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const finishSimulation = () => {
    const navigateToResults = () => {
      setIsRunning(false);
      navigation.navigate("SimulationResult", {
        caseId,
        elapsedTime,
        performedActions: Array.from(performedActions),
        selectedDifferential,
        hasCrashed: false,
      });
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm("Are you sure you want to end this simulation? You'll see your results.");
      if (confirmed) {
        navigateToResults();
      }
    } else {
      Alert.alert(
        "End Simulation",
        "Are you sure you want to end this simulation? You'll see your results.",
        [
          { text: "Continue", style: "cancel" },
          {
            text: "End & Review",
            style: "destructive",
            onPress: navigateToResults,
          },
        ]
      );
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const getVitalColor = (type: string, value: number) => {
    switch (type) {
      case "hr":
        if (value < 50 || value > 150) return TriageColors.red;
        if (value < 60 || value > 120) return TriageColors.orange;
        return TriageColors.green;
      case "sbp":
        if (value < 70 || value > 200) return TriageColors.red;
        if (value < 90 || value > 180) return TriageColors.orange;
        return TriageColors.green;
      case "spo2":
        if (value < 75) return TriageColors.red;
        if (value < 90) return TriageColors.orange;
        return TriageColors.green;
      case "rr":
        if (value < 6 || value > 35) return TriageColors.red;
        if (value < 10 || value > 28) return TriageColors.orange;
        return TriageColors.green;
      case "gcs":
        if (value <= 8) return TriageColors.red;
        if (value <= 12) return TriageColors.orange;
        return TriageColors.green;
      case "temp":
        if (value > 40 || value < 35) return TriageColors.red;
        if (value > 38.5 || value < 36) return TriageColors.orange;
        return TriageColors.green;
      default:
        return TriageColors.green;
    }
  };

  const renderActionItem = (action: SimAction, category: "history" | "exam") => {
    const isDone = performedActions.has(action.id);
    const finding = revealedFindings[action.id];
    return (
      <Pressable
        key={action.id}
        style={[
          styles.actionItem,
          {
            backgroundColor: isDone ? (action.isRedFlag ? TriageColors.red + "10" : theme.backgroundDefault) : theme.card,
            borderColor: isDone && action.isRedFlag ? TriageColors.red + "40" : theme.border,
          },
        ]}
        onPress={() => performAction(action.id, action.finding)}
        disabled={isDone}
      >
        <View style={styles.actionHeader}>
          <Feather
            name={isDone ? "check-circle" : "circle"}
            size={18}
            color={isDone ? (action.isRedFlag ? TriageColors.red : TriageColors.green) : theme.textMuted}
          />
          <Text style={[styles.actionLabel, { color: isDone ? theme.text : theme.primary }]}>
            {action.label}
          </Text>
          {action.isRedFlag && isDone ? (
            <View style={[styles.redFlagBadge, { backgroundColor: TriageColors.red + "20" }]}>
              <Feather name="flag" size={10} color={TriageColors.red} />
              <Text style={[styles.redFlagText, { color: TriageColors.red }]}>Red Flag</Text>
            </View>
          ) : null}
        </View>
        {finding ? (
          <Text style={[styles.findingText, { color: theme.textSecondary }]}>{finding}</Text>
        ) : null}
      </Pressable>
    );
  };

  const renderInvestigationItem = (action: SimAction) => {
    const isDone = performedActions.has(action.id);
    const finding = revealedFindings[action.id];
    const isPending = pendingInvestigations[action.id] !== undefined;
    return (
      <Pressable
        key={action.id}
        style={[
          styles.actionItem,
          {
            backgroundColor: isDone ? (action.isRedFlag ? TriageColors.red + "10" : theme.backgroundDefault) : theme.card,
            borderColor: isDone && action.isRedFlag ? TriageColors.red + "40" : theme.border,
          },
        ]}
        onPress={() => performInvestigation(action)}
        disabled={isDone}
      >
        <View style={styles.actionHeader}>
          <Feather
            name={isDone ? (isPending ? "loader" : "check-circle") : "circle"}
            size={18}
            color={isDone ? (isPending ? theme.warning : action.isRedFlag ? TriageColors.red : TriageColors.green) : theme.textMuted}
          />
          <Text style={[styles.actionLabel, { color: isDone ? theme.text : theme.primary }]}>
            {action.label}
          </Text>
          {action.timeToResult ? (
            <Text style={[styles.timeToResult, { color: theme.textMuted }]}>
              ~{action.timeToResult}s
            </Text>
          ) : null}
          {action.isRedFlag && isDone && !isPending ? (
            <View style={[styles.redFlagBadge, { backgroundColor: TriageColors.red + "20" }]}>
              <Feather name="flag" size={10} color={TriageColors.red} />
              <Text style={[styles.redFlagText, { color: TriageColors.red }]}>Red Flag</Text>
            </View>
          ) : null}
        </View>
        {finding ? (
          <Text style={[styles.findingText, { color: isPending ? theme.warning : theme.textSecondary }]}>{finding}</Text>
        ) : null}
      </Pressable>
    );
  };

  const renderStabilizeItem = (action: StabilizeAction) => {
    const isDone = performedActions.has(action.id);
    const finding = revealedFindings[action.id];
    return (
      <Pressable
        key={action.id}
        style={[
          styles.actionItem,
          {
            backgroundColor: isDone ? (action.isCritical ? TriageColors.green + "10" : theme.backgroundDefault) : theme.card,
            borderColor: isDone && action.isCritical ? TriageColors.green + "40" : theme.border,
          },
        ]}
        onPress={() => performStabilize(action)}
        disabled={isDone}
      >
        <View style={styles.actionHeader}>
          <Feather
            name={isDone ? "check-circle" : "zap"}
            size={18}
            color={isDone ? TriageColors.green : action.isCritical ? TriageColors.red : theme.primary}
          />
          <Text
            style={[
              styles.actionLabel,
              {
                color: isDone ? theme.text : action.isCritical ? TriageColors.red : theme.primary,
                fontWeight: action.isCritical ? "700" : "600",
              },
            ]}
          >
            {action.label}
          </Text>
          {action.isCritical && !isDone ? (
            <View style={[styles.criticalBadge, { backgroundColor: TriageColors.red + "20" }]}>
              <Text style={[styles.criticalText, { color: TriageColors.red }]}>Critical</Text>
            </View>
          ) : null}
        </View>
        {finding ? (
          <Text style={[styles.findingText, { color: TriageColors.green }]}>{finding}</Text>
        ) : null}
      </Pressable>
    );
  };

  const timeRatio = elapsedTime / simCase.timeLimit;
  const timerColor = timeRatio > 0.8 ? TriageColors.red : timeRatio > 0.5 ? TriageColors.orange : TriageColors.green;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <Animated.View
        style={[
          styles.alertOverlay,
          {
            opacity: alertAnim,
            backgroundColor: TriageColors.red + "15",
          },
        ]}
        pointerEvents="none"
      />

      <View style={[styles.vitalsBar, { backgroundColor: "#111827" }]}>
        <View style={styles.patientInfoRow}>
          <Text style={styles.patientName} numberOfLines={1}>
            {simCase.patientInfo.name}, {simCase.patientInfo.age}{simCase.patientInfo.gender === "Male" ? "M" : "F"}
          </Text>
          <View style={[styles.timerBadge, { backgroundColor: timerColor + "30" }]}>
            <Feather name="clock" size={12} color={timerColor} />
            <Text style={[styles.timerText, { color: timerColor }]}>{formatTime(elapsedTime)}</Text>
          </View>
        </View>

        <View style={styles.vitalsRow}>
          <View style={styles.vitalItem}>
            <Text style={styles.vitalLabel}>HR</Text>
            <Animated.Text
              style={[
                styles.vitalValue,
                { color: getVitalColor("hr", currentVitals.hr), transform: [{ scale: pulseAnim }] },
              ]}
            >
              {currentVitals.hr}
            </Animated.Text>
          </View>
          <View style={styles.vitalItem}>
            <Text style={styles.vitalLabel}>BP</Text>
            <Text style={[styles.vitalValue, { color: getVitalColor("sbp", currentVitals.sbp) }]}>
              {currentVitals.sbp}/{currentVitals.dbp}
            </Text>
          </View>
          <View style={styles.vitalItem}>
            <Text style={styles.vitalLabel}>SpO2</Text>
            <Text style={[styles.vitalValue, { color: getVitalColor("spo2", currentVitals.spo2) }]}>
              {currentVitals.spo2}%
            </Text>
          </View>
          <View style={styles.vitalItem}>
            <Text style={styles.vitalLabel}>RR</Text>
            <Text style={[styles.vitalValue, { color: getVitalColor("rr", currentVitals.rr) }]}>
              {currentVitals.rr}
            </Text>
          </View>
          <View style={styles.vitalItem}>
            <Text style={styles.vitalLabel}>T</Text>
            <Text style={[styles.vitalValue, { color: getVitalColor("temp", currentVitals.temp) }]}>
              {currentVitals.temp.toFixed(1)}
            </Text>
          </View>
          <View style={styles.vitalItem}>
            <Text style={styles.vitalLabel}>GCS</Text>
            <Text style={[styles.vitalValue, { color: getVitalColor("gcs", currentVitals.gcs) }]}>
              {currentVitals.gcs}
            </Text>
          </View>
        </View>
      </View>

      {showMessage ? (
        <Pressable
          style={[styles.messageBar, {
            backgroundColor: hasCrashed ? TriageColors.red : TriageColors.orange + "20",
            borderColor: hasCrashed ? TriageColors.red : TriageColors.orange,
          }]}
          onPress={() => setShowMessage(null)}
        >
          <Feather name={hasCrashed ? "alert-octagon" : "alert-triangle"} size={18} color={hasCrashed ? "#fff" : TriageColors.orange} />
          <Text style={[styles.messageText, { color: hasCrashed ? "#fff" : TriageColors.orange }]} numberOfLines={3}>
            {showMessage}
          </Text>
          <Feather name="x" size={16} color={hasCrashed ? "#fff" : TriageColors.orange} />
        </Pressable>
      ) : null}

      <View style={[styles.presentationCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.presentationText, { color: theme.textSecondary }]} numberOfLines={3}>
          {simCase.arrivalDescription}
        </Text>
      </View>

      <View style={styles.tabRow}>
        {TAB_CONFIG.map((tab) => (
          <Pressable
            key={tab.key}
            style={[
              styles.tabItem,
              {
                backgroundColor: activeTab === tab.key ? theme.primary : "transparent",
                borderColor: activeTab === tab.key ? theme.primary : theme.border,
              },
            ]}
            onPress={() => setActiveTab(tab.key)}
          >
            <Feather
              name={tab.icon as any}
              size={14}
              color={activeTab === tab.key ? "#fff" : theme.textSecondary}
            />
            <Text
              style={[
                styles.tabLabel,
                { color: activeTab === tab.key ? "#fff" : theme.textSecondary },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        style={styles.actionsList}
        contentContainerStyle={{ paddingHorizontal: Spacing.md, paddingBottom: insets.bottom + 80 }}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === "history" && simCase.history.map((a) => renderActionItem(a, "history"))}
        {activeTab === "exam" && simCase.exam.map((a) => renderActionItem(a, "exam"))}
        {activeTab === "investigate" && simCase.investigate.map((a) => renderInvestigationItem(a))}
        {activeTab === "stabilize" && simCase.stabilize.map((a) => renderStabilizeItem(a))}
        {activeTab === "differential" && (
          <View>
            <Text style={[styles.diffHeader, { color: theme.text }]}>Select your working diagnosis:</Text>
            {simCase.differentials.map((d) => (
              <Pressable
                key={d.id}
                style={[
                  styles.diffItem,
                  {
                    backgroundColor: selectedDifferential === d.id ? theme.primaryLight : theme.card,
                    borderColor: selectedDifferential === d.id ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => selectDifferential(d.id)}
              >
                <Feather
                  name={selectedDifferential === d.id ? "check-circle" : "circle"}
                  size={20}
                  color={selectedDifferential === d.id ? theme.primary : theme.textMuted}
                />
                <Text
                  style={[
                    styles.diffLabel,
                    {
                      color: selectedDifferential === d.id ? theme.primary : theme.text,
                      fontWeight: selectedDifferential === d.id ? "600" : "400",
                    },
                  ]}
                >
                  {d.label}
                </Text>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      {!hasCrashed ? (
        <View style={[styles.bottomBar, { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.sm }]}>
          <Pressable
            style={({ pressed }) => [
              styles.endButton,
              { backgroundColor: TriageColors.red, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={finishSimulation}
          >
            <Feather name="check-square" size={18} color="#fff" />
            <Text style={styles.endButtonText}>End & Review</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  alertOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  vitalsBar: {
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  patientInfoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  patientName: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  timerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
  },
  timerText: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  vitalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  vitalItem: {
    alignItems: "center",
  },
  vitalLabel: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "500",
    textTransform: "uppercase",
  },
  vitalValue: {
    fontSize: 16,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
  messageBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
  },
  messageText: {
    ...Typography.small,
    flex: 1,
    fontWeight: "600",
  },
  presentationCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  presentationText: { ...Typography.small, lineHeight: 20 },
  tabRow: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
  },
  tabItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: "600",
  },
  actionsList: { flex: 1 },
  actionItem: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  actionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  actionLabel: {
    ...Typography.small,
    fontWeight: "600",
    flex: 1,
  },
  timeToResult: {
    ...Typography.caption,
  },
  redFlagBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.full,
  },
  redFlagText: {
    fontSize: 9,
    fontWeight: "700",
  },
  criticalBadge: {
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: BorderRadius.full,
  },
  criticalText: {
    fontSize: 9,
    fontWeight: "700",
  },
  findingText: {
    ...Typography.small,
    marginTop: Spacing.sm,
    paddingLeft: 26,
    lineHeight: 20,
  },
  diffHeader: {
    ...Typography.h4,
    marginBottom: Spacing.md,
  },
  diffItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
  },
  diffLabel: {
    ...Typography.body,
    flex: 1,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#e2e8f0",
  },
  endButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  endButtonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "700",
  },
  errorText: {
    ...Typography.h4,
    textAlign: "center",
    marginTop: 100,
  },
});
