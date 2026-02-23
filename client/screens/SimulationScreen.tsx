import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Animated,
  Platform,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RouteProp } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import { getCaseById, Vitals, SimAction, StabilizeAction } from "@/data/simulationCases";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type TabType = "history" | "exam" | "investigate" | "stabilize" | "differential";

const TAB_CONFIG: { key: TabType; label: string; icon: string }[] = [
  { key: "history", label: "History", icon: "message-circle" },
  { key: "exam", label: "Exam", icon: "search" },
  { key: "investigate", label: "Labs", icon: "clipboard" },
  { key: "stabilize", label: "Stabilize", icon: "shield" },
  { key: "differential", label: "Dx", icon: "target" },
];

const SIM_TUTORIAL_KEY = "ermate_sim_tutorial_seen";

const TUTORIAL_STEPS = [
  {
    title: "Welcome to ER Simulation",
    description: "You're about to manage a real emergency case. A patient arrives and you must diagnose and treat them under time pressure - just like a real ER shift.",
    icon: "activity" as const,
  },
  {
    title: "5 Tabs - Your Workflow",
    description: "Work through the tabs like a real ER shift:\n\nHistory - Ask the patient/bystanders\nExam - Perform physical examination\nLabs - Order investigations (results take time)\nStabilize - Give treatments & interventions\nDx - Select your final diagnosis",
    icon: "layout" as const,
  },
  {
    title: "Understanding Colors",
    description: "Tap any action to perform it. After tapping:\n\nGreen check = Good action, useful finding\nRed flag badge = Critical red flag identified\nOrange warning = Unnecessary action that wastes time\nRed alert = Harmful action, could hurt the patient\n\nNot every option is the right choice - some are traps!",
    icon: "eye" as const,
  },
  {
    title: "Live Vital Signs",
    description: "The dark bar at the top shows real-time vitals that change based on your actions.\n\nGreen = Normal range\nOrange = Abnormal, needs attention\nRed + Blinking = Critical, act NOW!\n\nIf you don't act fast enough, the patient deteriorates.",
    icon: "heart" as const,
  },
  {
    title: "Time is Ticking",
    description: "Each case has a time limit shown in the timer. Some wrong investigations waste extra time (+Xs badge). If time runs out or the patient crashes, the simulation ends automatically.\n\nPrioritize critical interventions first!",
    icon: "clock" as const,
  },
];

function SimTutorialOverlay({ visible, onDismiss }: { visible: boolean; onDismiss: () => void }) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0);

  if (!visible) return null;

  const currentStep = TUTORIAL_STEPS[step];
  const isLast = step === TUTORIAL_STEPS.length - 1;

  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={tutStyles.overlay}>
        <View style={[tutStyles.card, { backgroundColor: theme.card, marginTop: insets.top + 60 }]}>
          <View style={[tutStyles.iconCircle, { backgroundColor: theme.primaryLight }]}>
            <Feather name={currentStep.icon} size={28} color={theme.primary} />
          </View>
          <Text style={[tutStyles.title, { color: theme.text }]}>{currentStep.title}</Text>
          <Text style={[tutStyles.description, { color: theme.textSecondary }]}>{currentStep.description}</Text>

          <View style={tutStyles.dots}>
            {TUTORIAL_STEPS.map((_, i) => (
              <View
                key={i}
                style={[
                  tutStyles.dot,
                  { backgroundColor: i === step ? theme.primary : theme.border },
                ]}
              />
            ))}
          </View>

          <View style={tutStyles.buttonRow}>
            {step > 0 ? (
              <Pressable
                style={[tutStyles.backBtn, { borderColor: theme.border }]}
                onPress={() => setStep(step - 1)}
              >
                <Text style={[tutStyles.backBtnText, { color: theme.textSecondary }]}>Back</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[tutStyles.backBtn, { borderColor: theme.border }]}
                onPress={onDismiss}
              >
                <Text style={[tutStyles.backBtnText, { color: theme.textSecondary }]}>Skip</Text>
              </Pressable>
            )}
            <Pressable
              style={[tutStyles.nextBtn, { backgroundColor: theme.primary }]}
              onPress={() => {
                if (isLast) {
                  onDismiss();
                } else {
                  setStep(step + 1);
                }
              }}
            >
              <Text style={tutStyles.nextBtnText}>{isLast ? "Start Simulation" : "Next"}</Text>
              <Feather name={isLast ? "play" : "chevron-right"} size={16} color="#fff" />
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const tutStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-start",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
  },
  card: {
    width: "100%",
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: Spacing.md,
    textAlign: "center",
  },
  description: {
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginBottom: Spacing.lg,
  },
  dots: {
    flexDirection: "row",
    gap: 6,
    marginBottom: Spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  buttonRow: {
    flexDirection: "row",
    gap: Spacing.md,
    width: "100%",
  },
  backBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    alignItems: "center",
  },
  backBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },
  nextBtn: {
    flex: 2,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
  },
  nextBtnText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
});

function AnimatedVital({ label, value, displayValue, type, getColor }: {
  label: string;
  value: number;
  displayValue: string;
  type: string;
  getColor: (type: string, value: number) => string;
}) {
  const color = getColor(type, value);
  const isCritical = color === TriageColors.red;
  const isWarning = color === TriageColors.orange;
  const blinkAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isCritical) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(blinkAnim, { toValue: 0.2, duration: 400, useNativeDriver: true }),
          Animated.timing(blinkAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
        ])
      ).start();
    } else {
      blinkAnim.stopAnimation();
      blinkAnim.setValue(1);
    }
  }, [isCritical]);

  return (
    <View style={vitalStyles.container}>
      <Text style={vitalStyles.label}>{label}</Text>
      <Animated.View style={[
        vitalStyles.valueContainer,
        {
          backgroundColor: isCritical ? TriageColors.red + "25" : isWarning ? TriageColors.orange + "15" : "transparent",
          borderColor: isCritical ? TriageColors.red + "60" : isWarning ? TriageColors.orange + "40" : "transparent",
          opacity: isCritical ? blinkAnim : 1,
        },
      ]}>
        <Animated.Text style={[vitalStyles.value, { color }]}>
          {displayValue}
        </Animated.Text>
      </Animated.View>
    </View>
  );
}

const vitalStyles = StyleSheet.create({
  container: {
    alignItems: "center",
    flex: 1,
  },
  label: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "500",
    textTransform: "uppercase",
    marginBottom: 2,
  },
  valueContainer: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    minWidth: 38,
    alignItems: "center",
  },
  value: {
    fontSize: 15,
    fontWeight: "800",
    fontVariant: ["tabular-nums"],
  },
});

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
  const [actionTimestamps, setActionTimestamps] = useState<Record<string, number>>({});
  const [revealedFindings, setRevealedFindings] = useState<Record<string, string>>({});
  const [pendingInvestigations, setPendingInvestigations] = useState<Record<string, number>>({});
  const [selectedDifferential, setSelectedDifferential] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [hasCrashed, setHasCrashed] = useState(false);
  const [deteriorationMessages, setDeteriorationMessages] = useState<string[]>([]);
  const [showMessage, setShowMessage] = useState<string | null>(null);
  const [timeExpired, setTimeExpired] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);
  const [tutorialChecked, setTutorialChecked] = useState(false);
  const triggeredRulesRef = useRef<Set<number>>(new Set());
  const alertAnim = useRef(new Animated.Value(0)).current;
  const hasNavigatedRef = useRef(false);

  useEffect(() => {
    checkTutorial();
  }, []);

  const checkTutorial = async () => {
    try {
      const seen = await AsyncStorage.getItem(SIM_TUTORIAL_KEY);
      if (!seen) {
        setShowTutorial(true);
      } else {
        setIsRunning(true);
      }
    } catch {
      setIsRunning(true);
    }
    setTutorialChecked(true);
  };

  const dismissTutorial = async () => {
    setShowTutorial(false);
    setIsRunning(true);
    try {
      await AsyncStorage.setItem(SIM_TUTORIAL_KEY, "true");
    } catch {}
  };

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      setElapsedTime((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [isRunning]);

  useEffect(() => {
    if (!simCase || !isRunning || hasCrashed || hasNavigatedRef.current) return;

    if (elapsedTime >= simCase.timeLimit) {
      setTimeExpired(true);
      setIsRunning(false);
      setShowMessage("TIME'S UP! The clock has run out. Review your performance.");

      if (Platform.OS !== "web") {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      }

      Animated.sequence([
        Animated.timing(alertAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(alertAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(alertAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.timing(alertAnim, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ]).start();

      hasNavigatedRef.current = true;
      setTimeout(() => {
        navigation.navigate("SimulationResult", {
          caseId,
          elapsedTime: simCase.timeLimit,
          performedActions: Array.from(performedActions),
          actionTimestamps,
          selectedDifferential,
          hasCrashed: false,
        });
      }, 3000);
      return;
    }

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
          hasNavigatedRef.current = true;
          setTimeout(() => {
            navigation.navigate("SimulationResult", {
              caseId,
              elapsedTime,
              performedActions: Array.from(performedActions),
              actionTimestamps,
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

  const performAction = (actionId: string, finding?: string, timeCost?: number) => {
    if (performedActions.has(actionId) || hasCrashed || timeExpired) return;

    const newActions = new Set(performedActions);
    newActions.add(actionId);
    setPerformedActions(newActions);
    setActionTimestamps((prev) => ({ ...prev, [actionId]: elapsedTime }));

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (finding !== undefined) {
      setRevealedFindings((prev) => ({ ...prev, [actionId]: finding }));
    }

    if (timeCost && timeCost > 0) {
      setElapsedTime((prev) => prev + timeCost);
    }
  };

  const performInvestigation = (action: SimAction) => {
    if (performedActions.has(action.id) || hasCrashed || timeExpired) return;

    const newActions = new Set(performedActions);
    newActions.add(action.id);
    setPerformedActions(newActions);
    setActionTimestamps((prev) => ({ ...prev, [action.id]: elapsedTime }));

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (action.timeCost && action.timeCost > 0) {
      setElapsedTime((prev) => prev + action.timeCost);
    }

    if (action.timeToResult && action.timeToResult > 3) {
      setPendingInvestigations((prev) => ({
        ...prev,
        [action.id]: elapsedTime + (action.timeCost || 0) + action.timeToResult,
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
    if (performedActions.has(action.id) || hasCrashed || timeExpired) return;

    const newActions = new Set(performedActions);
    newActions.add(action.id);
    setPerformedActions(newActions);
    setActionTimestamps((prev) => ({ ...prev, [action.id]: elapsedTime }));

    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    setRevealedFindings((prev) => ({ ...prev, [action.id]: action.effect }));

    if (action.timeCost && action.timeCost > 0) {
      setElapsedTime((prev) => prev + action.timeCost);
    }

    if (action.vitalChanges) {
      setCurrentVitals((prev) => ({ ...prev, ...action.vitalChanges }));
    }
  };

  const selectDifferential = (id: string) => {
    if (hasCrashed || timeExpired) return;
    setSelectedDifferential(id);
    if (Platform.OS !== "web") {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  };

  const finishSimulation = () => {
    if (hasNavigatedRef.current) return;
    const navigateToResults = () => {
      hasNavigatedRef.current = true;
      setIsRunning(false);
      navigation.navigate("SimulationResult", {
        caseId,
        elapsedTime,
        performedActions: Array.from(performedActions),
        actionTimestamps,
        selectedDifferential,
        hasCrashed: false,
      });
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm("End simulation and see your results?");
      if (confirmed) {
        navigateToResults();
      }
    } else {
      Alert.alert(
        "End Simulation",
        "End simulation and see your results?",
        [
          { text: "Continue", style: "cancel" },
          { text: "End & Review", style: "destructive", onPress: navigateToResults },
        ]
      );
    }
  };

  const getRemainingTime = () => {
    const remaining = Math.max(0, simCase.timeLimit - elapsedTime);
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
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

  const getActionStatusInfo = (isDone: boolean, isRedFlag?: boolean, isHarmful?: boolean, isUnnecessary?: boolean, isPending?: boolean) => {
    if (!isDone) return null;
    if (isPending) return { label: "Pending", color: "#f59e0b", icon: "loader" as const };
    if (isHarmful) return { label: "Harmful", color: TriageColors.red, icon: "alert-octagon" as const };
    if (isUnnecessary) return { label: "Unnecessary", color: TriageColors.orange, icon: "alert-triangle" as const };
    if (isRedFlag) return { label: "Red Flag", color: TriageColors.red, icon: "flag" as const };
    return { label: "Done", color: TriageColors.green, icon: "check-circle" as const };
  };

  const renderActionItem = (action: SimAction) => {
    const isDone = performedActions.has(action.id);
    const finding = revealedFindings[action.id];
    const isHarmful = isDone && !!action.harmIfDone;
    const isUnnecessary = isDone && !!action.isUnnecessary && !action.harmIfDone;
    const status = getActionStatusInfo(isDone, action.isRedFlag, isHarmful, isUnnecessary);

    return (
      <Pressable
        key={action.id}
        style={[
          styles.actionItem,
          {
            backgroundColor: !isDone ? theme.card
              : isHarmful ? TriageColors.red + "10"
              : isUnnecessary ? TriageColors.orange + "10"
              : action.isRedFlag ? TriageColors.red + "08"
              : theme.backgroundDefault,
            borderColor: !isDone ? theme.border
              : isHarmful ? TriageColors.red + "40"
              : isUnnecessary ? TriageColors.orange + "40"
              : action.isRedFlag ? TriageColors.red + "30"
              : TriageColors.green + "40",
          },
        ]}
        onPress={() => performAction(action.id, action.finding, action.timeCost)}
        disabled={isDone || hasCrashed || timeExpired}
      >
        <View style={styles.actionHeader}>
          <Feather
            name={isDone ? (status?.icon || "check-circle") : "circle"}
            size={18}
            color={isDone ? (status?.color || TriageColors.green) : theme.textMuted}
          />
          <Text style={[styles.actionLabel, { color: isDone ? theme.text : theme.primary }]}>
            {action.label}
          </Text>
          {status ? (
            <View style={[styles.statusBadge, { backgroundColor: status.color + "18" }]}>
              <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
            </View>
          ) : null}
          {action.timeCost ? (
            <View style={[styles.timeCostBadge, { backgroundColor: TriageColors.orange + "20" }]}>
              <Feather name="clock" size={9} color={TriageColors.orange} />
              <Text style={[styles.timeCostText, { color: TriageColors.orange }]}>+{action.timeCost}s</Text>
            </View>
          ) : null}
        </View>
        {finding ? (
          <Text style={[styles.findingText, { color: theme.textSecondary }]}>{finding}</Text>
        ) : null}
        {isHarmful ? (
          <View style={[styles.harmBanner, { backgroundColor: TriageColors.red + "10" }]}>
            <Feather name="alert-octagon" size={12} color={TriageColors.red} />
            <Text style={[styles.harmText, { color: TriageColors.red }]}>{action.harmIfDone}</Text>
          </View>
        ) : null}
        {isUnnecessary && !isHarmful ? (
          <View style={[styles.harmBanner, { backgroundColor: TriageColors.orange + "10" }]}>
            <Feather name="alert-triangle" size={12} color={TriageColors.orange} />
            <Text style={[styles.harmText, { color: TriageColors.orange }]}>This was unnecessary and wasted valuable time.</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const renderInvestigationItem = (action: SimAction) => {
    const isDone = performedActions.has(action.id);
    const finding = revealedFindings[action.id];
    const isPending = pendingInvestigations[action.id] !== undefined;
    const isHarmful = isDone && !!action.harmIfDone && !isPending;
    const isUnnecessary = isDone && !!action.isUnnecessary && !action.harmIfDone && !isPending;
    const status = getActionStatusInfo(isDone, action.isRedFlag, isHarmful, isUnnecessary, isPending);

    return (
      <Pressable
        key={action.id}
        style={[
          styles.actionItem,
          {
            backgroundColor: !isDone ? theme.card
              : isHarmful ? TriageColors.red + "10"
              : isUnnecessary ? TriageColors.orange + "10"
              : isPending ? theme.warningLight || "#fff7ed"
              : action.isRedFlag ? TriageColors.red + "08"
              : theme.backgroundDefault,
            borderColor: !isDone ? theme.border
              : isHarmful ? TriageColors.red + "40"
              : isUnnecessary ? TriageColors.orange + "40"
              : isPending ? "#f59e0b40"
              : action.isRedFlag ? TriageColors.red + "30"
              : TriageColors.green + "40",
          },
        ]}
        onPress={() => performInvestigation(action)}
        disabled={isDone || hasCrashed || timeExpired}
      >
        <View style={styles.actionHeader}>
          <Feather
            name={isDone ? (status?.icon || "check-circle") : "circle"}
            size={18}
            color={isDone ? (status?.color || TriageColors.green) : theme.textMuted}
          />
          <Text style={[styles.actionLabel, { color: isDone ? theme.text : theme.primary }]}>
            {action.label}
          </Text>
          {action.timeToResult && !isDone ? (
            <Text style={[styles.timeToResult, { color: theme.textMuted }]}>
              ~{action.timeToResult}s
            </Text>
          ) : null}
          {status ? (
            <View style={[styles.statusBadge, { backgroundColor: status.color + "18" }]}>
              <Text style={[styles.statusBadgeText, { color: status.color }]}>{status.label}</Text>
            </View>
          ) : null}
          {action.timeCost ? (
            <View style={[styles.timeCostBadge, { backgroundColor: TriageColors.orange + "20" }]}>
              <Feather name="clock" size={9} color={TriageColors.orange} />
              <Text style={[styles.timeCostText, { color: TriageColors.orange }]}>+{action.timeCost}s</Text>
            </View>
          ) : null}
        </View>
        {finding ? (
          <Text style={[styles.findingText, { color: isPending ? "#f59e0b" : theme.textSecondary }]}>{finding}</Text>
        ) : null}
        {isHarmful ? (
          <View style={[styles.harmBanner, { backgroundColor: TriageColors.red + "10" }]}>
            <Feather name="alert-octagon" size={12} color={TriageColors.red} />
            <Text style={[styles.harmText, { color: TriageColors.red }]}>{action.harmIfDone}</Text>
          </View>
        ) : null}
        {isUnnecessary && !isHarmful ? (
          <View style={[styles.harmBanner, { backgroundColor: TriageColors.orange + "10" }]}>
            <Feather name="alert-triangle" size={12} color={TriageColors.orange} />
            <Text style={[styles.harmText, { color: TriageColors.orange }]}>Unnecessary investigation - wasted time and resources.</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const renderStabilizeItem = (action: StabilizeAction) => {
    const isDone = performedActions.has(action.id);
    const finding = revealedFindings[action.id];
    const isHarmful = isDone && !!action.harmIfDone;
    const isUnnecessary = isDone && !!action.isUnnecessary && !action.harmIfDone;
    const statusLabel = isHarmful ? "HARMFUL" : isUnnecessary ? "Unnecessary" : isDone && action.isCritical ? "Critical - Done" : isDone ? "Done" : null;
    const statusColor = isHarmful ? TriageColors.red : isUnnecessary ? TriageColors.orange : isDone ? TriageColors.green : theme.textMuted;

    return (
      <Pressable
        key={action.id}
        style={[
          styles.actionItem,
          {
            backgroundColor: !isDone ? theme.card
              : isHarmful ? TriageColors.red + "12"
              : isUnnecessary ? TriageColors.orange + "10"
              : action.isCritical ? TriageColors.green + "10"
              : theme.backgroundDefault,
            borderColor: !isDone ? theme.border
              : isHarmful ? TriageColors.red + "40"
              : isUnnecessary ? TriageColors.orange + "40"
              : action.isCritical ? TriageColors.green + "40"
              : theme.border,
          },
        ]}
        onPress={() => performStabilize(action)}
        disabled={isDone || hasCrashed || timeExpired}
      >
        <View style={styles.actionHeader}>
          <Feather
            name={isDone ? (isHarmful ? "alert-octagon" : "check-circle") : "zap"}
            size={18}
            color={isDone ? statusColor : action.isCritical ? TriageColors.red : theme.primary}
          />
          <Text
            style={[
              styles.actionLabel,
              {
                color: isDone ? (isHarmful ? TriageColors.red : theme.text) : action.isCritical ? TriageColors.red : theme.primary,
                fontWeight: action.isCritical ? "700" : "600",
              },
            ]}
          >
            {action.label}
          </Text>
          {action.isCritical && !isDone ? (
            <View style={[styles.statusBadge, { backgroundColor: TriageColors.red + "18" }]}>
              <Text style={[styles.statusBadgeText, { color: TriageColors.red }]}>Critical</Text>
            </View>
          ) : null}
          {statusLabel && isDone ? (
            <View style={[styles.statusBadge, { backgroundColor: statusColor + "18" }]}>
              <Text style={[styles.statusBadgeText, { color: statusColor }]}>{statusLabel}</Text>
            </View>
          ) : null}
          {action.timeCost ? (
            <View style={[styles.timeCostBadge, { backgroundColor: TriageColors.orange + "20" }]}>
              <Feather name="clock" size={9} color={TriageColors.orange} />
              <Text style={[styles.timeCostText, { color: TriageColors.orange }]}>+{action.timeCost}s</Text>
            </View>
          ) : null}
        </View>
        {finding ? (
          <Text style={[styles.findingText, { color: isHarmful ? TriageColors.red : TriageColors.green }]}>{finding}</Text>
        ) : null}
        {isHarmful ? (
          <View style={[styles.harmBanner, { backgroundColor: TriageColors.red + "12" }]}>
            <Feather name="alert-octagon" size={12} color={TriageColors.red} />
            <Text style={[styles.harmText, { color: TriageColors.red }]}>{action.harmIfDone}</Text>
          </View>
        ) : null}
        {isUnnecessary && !isHarmful ? (
          <View style={[styles.harmBanner, { backgroundColor: TriageColors.orange + "10" }]}>
            <Feather name="alert-triangle" size={12} color={TriageColors.orange} />
            <Text style={[styles.harmText, { color: TriageColors.orange }]}>Unnecessary treatment - not indicated for this case.</Text>
          </View>
        ) : null}
      </Pressable>
    );
  };

  const timeRatio = elapsedTime / simCase.timeLimit;
  const timerColor = timeRatio > 0.8 ? TriageColors.red : timeRatio > 0.5 ? TriageColors.orange : TriageColors.green;
  const progressWidth = `${Math.min(100, timeRatio * 100)}%`;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <SimTutorialOverlay visible={showTutorial} onDismiss={dismissTutorial} />

      <Animated.View
        style={[
          styles.alertOverlay,
          { opacity: alertAnim, backgroundColor: TriageColors.red + "15" },
        ]}
        pointerEvents="none"
      />

      <View style={[styles.vitalsBar, { backgroundColor: "#111827" }]}>
        <View style={styles.patientInfoRow}>
          <Text style={styles.patientName} numberOfLines={1}>
            {simCase.patientInfo.name}, {simCase.patientInfo.age}{simCase.patientInfo.gender === "Male" ? "M" : "F"}
          </Text>
          <Pressable
            onPress={() => setShowTutorial(true)}
            style={styles.helpBtn}
          >
            <Feather name="help-circle" size={16} color="#94a3b8" />
          </Pressable>
          <View style={[styles.timerBadge, { backgroundColor: timerColor + "30" }]}>
            <Feather name="clock" size={12} color={timerColor} />
            <Text style={[styles.timerText, { color: timerColor }]}>{getRemainingTime()}</Text>
          </View>
        </View>

        <View style={styles.timerProgressBarContainer}>
          <View style={[styles.timerProgressBar, { width: progressWidth as any, backgroundColor: timerColor }]} />
        </View>

        <View style={styles.vitalsRow}>
          <AnimatedVital label="HR" value={currentVitals.hr} displayValue={`${currentVitals.hr}`} type="hr" getColor={getVitalColor} />
          <AnimatedVital label="BP" value={currentVitals.sbp} displayValue={`${currentVitals.sbp}/${currentVitals.dbp}`} type="sbp" getColor={getVitalColor} />
          <AnimatedVital label="SpO2" value={currentVitals.spo2} displayValue={`${currentVitals.spo2}%`} type="spo2" getColor={getVitalColor} />
          <AnimatedVital label="RR" value={currentVitals.rr} displayValue={`${currentVitals.rr}`} type="rr" getColor={getVitalColor} />
          <AnimatedVital label="T" value={currentVitals.temp} displayValue={currentVitals.temp.toFixed(1)} type="temp" getColor={getVitalColor} />
          <AnimatedVital label="GCS" value={currentVitals.gcs} displayValue={`${currentVitals.gcs}`} type="gcs" getColor={getVitalColor} />
        </View>
      </View>

      {showMessage ? (
        <Pressable
          style={[styles.messageBar, {
            backgroundColor: hasCrashed ? TriageColors.red : timeExpired ? "#dc2626" : TriageColors.orange + "20",
            borderColor: hasCrashed ? TriageColors.red : timeExpired ? "#dc2626" : TriageColors.orange,
          }]}
          onPress={() => !hasCrashed && !timeExpired && setShowMessage(null)}
        >
          <Feather name={hasCrashed ? "alert-octagon" : timeExpired ? "clock" : "alert-triangle"} size={18} color={hasCrashed || timeExpired ? "#fff" : TriageColors.orange} />
          <Text style={[styles.messageText, { color: hasCrashed || timeExpired ? "#fff" : TriageColors.orange }]} numberOfLines={3}>
            {showMessage}
          </Text>
          {!hasCrashed && !timeExpired ? <Feather name="x" size={16} color={TriageColors.orange} /> : null}
        </Pressable>
      ) : null}

      <View style={[styles.presentationCard, { backgroundColor: theme.card }]}>
        <Text style={[styles.presentationText, { color: theme.textSecondary }]}>
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
        {activeTab === "history" ? (
          <View>
            <View style={[styles.tabHint, { backgroundColor: theme.primaryLight }]}>
              <Feather name="info" size={13} color={theme.primary} />
              <Text style={[styles.tabHintText, { color: theme.primary }]}>
                Tap to ask the patient or bystanders. Information reveals after each question.
              </Text>
            </View>
            {simCase.history.map((a) => renderActionItem(a))}
          </View>
        ) : null}
        {activeTab === "exam" ? (
          <View>
            <View style={[styles.tabHint, { backgroundColor: theme.primaryLight }]}>
              <Feather name="info" size={13} color={theme.primary} />
              <Text style={[styles.tabHintText, { color: theme.primary }]}>
                Tap to perform each examination. Findings appear after you examine.
              </Text>
            </View>
            {simCase.exam.map((a) => renderActionItem(a))}
          </View>
        ) : null}
        {activeTab === "investigate" ? (
          <View>
            <View style={[styles.tabHint, { backgroundColor: theme.primaryLight }]}>
              <Feather name="info" size={13} color={theme.primary} />
              <Text style={[styles.tabHintText, { color: theme.primary }]}>
                Order investigations. Results take time. Not all tests are necessary - choose wisely.
              </Text>
            </View>
            {simCase.investigate.map((a) => renderInvestigationItem(a))}
          </View>
        ) : null}
        {activeTab === "stabilize" ? (
          <View>
            <View style={[styles.tabHint, { backgroundColor: theme.primaryLight }]}>
              <Feather name="info" size={13} color={theme.primary} />
              <Text style={[styles.tabHintText, { color: theme.primary }]}>
                Give treatments and interventions. Critical actions are marked. Some options may be harmful!
              </Text>
            </View>
            {simCase.stabilize.map((a) => renderStabilizeItem(a))}
          </View>
        ) : null}
        {activeTab === "differential" ? (
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
                disabled={hasCrashed || timeExpired}
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
        ) : null}
      </ScrollView>

      {!hasCrashed && !timeExpired ? (
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
    gap: Spacing.sm,
  },
  patientName: {
    color: "#e2e8f0",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  helpBtn: {
    padding: 4,
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
  timerProgressBarContainer: {
    height: 3,
    backgroundColor: "#1e293b",
    borderRadius: 2,
    marginBottom: Spacing.xs,
    overflow: "hidden",
  },
  timerProgressBar: {
    height: 3,
    borderRadius: 2,
  },
  vitalsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 2,
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
  tabHint: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  tabHintText: {
    fontSize: 12,
    fontWeight: "500",
    flex: 1,
    lineHeight: 17,
  },
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
    flexWrap: "wrap",
  },
  actionLabel: {
    ...Typography.small,
    fontWeight: "600",
    flex: 1,
  },
  timeToResult: {
    ...Typography.caption,
  },
  statusBadge: {
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderRadius: BorderRadius.full,
  },
  statusBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  timeCostBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingVertical: 2,
    paddingHorizontal: 5,
    borderRadius: BorderRadius.full,
  },
  timeCostText: {
    fontSize: 9,
    fontWeight: "700",
  },
  harmBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    marginTop: Spacing.sm,
    paddingLeft: 26,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
  },
  harmText: {
    fontSize: 11,
    fontWeight: "600",
    flex: 1,
    lineHeight: 16,
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
