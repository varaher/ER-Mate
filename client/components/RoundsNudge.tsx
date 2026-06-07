import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";

interface QuickLens {
  id: string;
  icon: keyof typeof Feather.glyphMap;
  label: string;
  color: string;
  colorBg: string;
}

const QUICK_LENSES: QuickLens[] = [
  {
    id: "disease_snapshot",
    icon: "info",
    label: "Disease\nSnapshot",
    color: "#0EA5E9",
    colorBg: "rgba(14,165,233,0.18)",
  },
  {
    id: "first_principles",
    icon: "zap",
    label: "First\nPrinciples",
    color: "#3B82F6",
    colorBg: "rgba(59,130,246,0.18)",
  },
  {
    id: "rare_but_real",
    icon: "alert-circle",
    label: "Rare\nbut Real",
    color: "#EF4444",
    colorBg: "rgba(239,68,68,0.18)",
  },
];

interface Props {
  visible: boolean;
  savedMins: number;
  complaint: string;
  diagnosis: string;
  age: number;
  gender: string;
  onLensPress: (lensId: string) => void;
  onDismiss: () => void;
}

export function RoundsNudge({
  visible,
  savedMins,
  complaint,
  diagnosis,
  age,
  gender,
  onLensPress,
  onDismiss,
}: Props) {
  const slideAnim = useRef(new Animated.Value(180)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 55,
          friction: 9,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 180,
          duration: 180,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, opacityAnim]);

  if (!visible) return null;

  const patientLabel =
    age && gender
      ? `${age}${gender.charAt(0).toUpperCase()} · `
      : age
      ? `${age} · `
      : "";
  const displayComplaint = complaint || "Case";

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
          opacity: opacityAnim,
        },
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.card}>
        <View style={styles.topRow}>
          <View style={styles.timeBadge}>
            <Text style={styles.timeMins}>{savedMins}</Text>
            <Text style={styles.timeLabel}>MIN{"\n"}SAVED</Text>
          </View>

          <View style={styles.caseInfo}>
            <Text style={styles.savedLabel}>Case saved</Text>
            <Text style={styles.complaintText} numberOfLines={1}>
              {patientLabel}
              {displayComplaint}
            </Text>
            {diagnosis ? (
              <Text style={styles.diagnosisText} numberOfLines={1}>
                {diagnosis}
              </Text>
            ) : null}
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.dismissBtn,
              pressed && { opacity: 0.6 },
            ]}
            onPress={onDismiss}
          >
            <Feather name="x" size={15} color="rgba(255,255,255,0.4)" />
          </Pressable>
        </View>

        <View style={styles.divider} />

        <View style={styles.questionRow}>
          <Text style={styles.questionText}>
            Quick debrief on this{" "}
            <Text style={styles.questionHighlight}>
              {displayComplaint.toLowerCase()}
            </Text>{" "}
            case?
          </Text>
        </View>

        <View style={styles.lensRow}>
          {QUICK_LENSES.map((lens) => (
            <Pressable
              key={lens.id}
              style={({ pressed }) => [
                styles.lensBtn,
                {
                  backgroundColor: pressed
                    ? lens.colorBg
                    : "rgba(255,255,255,0.07)",
                  borderColor: pressed
                    ? lens.color + "44"
                    : "rgba(255,255,255,0.09)",
                },
              ]}
              onPress={() => onLensPress(lens.id)}
            >
              <Feather name={lens.icon} size={17} color={lens.color} />
              <Text style={styles.lensBtnLabel}>{lens.label}</Text>
            </Pressable>
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.laterBtn,
            pressed && { opacity: 0.5 },
          ]}
          onPress={onDismiss}
        >
          <Text style={styles.laterText}>
            Maybe later — open Rounds anytime
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 84,
    left: 12,
    right: 12,
    zIndex: 200,
  },
  card: {
    backgroundColor: "#0D1117",
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.38,
    shadowRadius: 28,
    elevation: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 14,
    gap: 10,
  },
  timeBadge: {
    backgroundColor: "rgba(29,184,112,0.14)",
    borderWidth: 1,
    borderColor: "rgba(29,184,112,0.25)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: "center",
    flexShrink: 0,
  },
  timeMins: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1DB870",
    lineHeight: 20,
  },
  timeLabel: {
    fontSize: 8,
    fontWeight: "600",
    color: "rgba(29,184,112,0.6)",
    letterSpacing: 0.5,
    textAlign: "center",
    marginTop: 2,
  },
  caseInfo: {
    flex: 1,
    minWidth: 0,
  },
  savedLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.35)",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 3,
  },
  complaintText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 2,
  },
  diagnosisText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.4)",
  },
  dismissBtn: {
    width: 28,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginHorizontal: 16,
  },
  questionRow: {
    paddingHorizontal: 16,
    paddingTop: 11,
    paddingBottom: 6,
  },
  questionText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.55)",
    lineHeight: 19,
  },
  questionHighlight: {
    color: "#1DB870",
    fontWeight: "600",
  },
  lensRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 8,
    gap: 8,
  },
  lensBtn: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
  },
  lensBtnLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.55)",
    textAlign: "center",
    lineHeight: 13,
  },
  laterBtn: {
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.05)",
    paddingVertical: 11,
    alignItems: "center",
  },
  laterText: {
    fontSize: 12,
    color: "rgba(255,255,255,0.2)",
  },
});
