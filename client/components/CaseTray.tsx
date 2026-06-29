import React, { useEffect, useState, useCallback } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useTheme } from "@/hooks/useTheme";
import { getAllDrafts, type DraftCase } from "@/lib/draftManager";
import { calcTabCompletion, overallCompletion } from "@/lib/tabCompletion";

const PRIORITY_COLORS = ["#EF4444", "#F97316", "#EAB308", "#22C55E", "#3B82F6", "#9CA3AF"];

interface CaseTrayProps {
  currentCaseId: string;
  onSwitchCase: (draft: DraftCase) => void;
  onNewCase: () => void;
  refreshKey?: number;
}

export function CaseTray({ currentCaseId, onSwitchCase, onNewCase, refreshKey }: CaseTrayProps) {
  const { theme, isDark } = useTheme();
  const [drafts, setDrafts] = useState<DraftCase[]>([]);

  const loadDrafts = useCallback(async () => {
    const all = await getAllDrafts();
    setDrafts(all.filter((d) => !!d.backendCaseId));
  }, []);

  useEffect(() => {
    loadDrafts();
  }, [refreshKey, currentCaseId]);

  if (drafts.length < 2) return null;

  return (
    <View style={[styles.tray, { backgroundColor: isDark ? "#0f172a" : "#ECEEF1", borderTopColor: theme.border }]}>
      <Text style={[styles.label, { color: theme.textMuted }]}>OPEN CASES — TAP TO SWITCH</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {drafts.map((draft) => {
          const isActive = draft.backendCaseId === currentCaseId;
          const patientName =
            draft.triageData?.patient?.name ||
            draft.caseSheetData?.patient?.name ||
            "Patient";
          const complaint =
            draft.triageData?.presenting_complaint?.text ||
            draft.caseSheetData?.presenting_complaint?.text ||
            "";
          const priority = draft.triageData?.triage_priority ?? draft.caseSheetData?.triage_priority ?? 5;
          const dotColor = PRIORITY_COLORS[Math.min((priority as number) - 1, 5)] || PRIORITY_COLORS[5];
          const tabs = draft.caseSheetData ? calcTabCompletion(draft.caseSheetData) : null;
          const completion = tabs ? overallCompletion(tabs) : 0;
          const progressColor = completion >= 75 ? "#10b981" : completion >= 30 ? "#f59e0b" : "#9ca3af";

          return (
            <Pressable
              key={draft.draftId}
              onPress={() => { if (!isActive) onSwitchCase(draft); }}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: isActive ? theme.card : isDark ? "#1e293b" : "rgba(255,255,255,0.75)",
                  borderColor: isActive ? theme.primary : theme.border,
                  borderWidth: isActive ? 2 : 1,
                  opacity: pressed && !isActive ? 0.75 : 1,
                },
              ]}
            >
              {!isActive && (
                <View style={styles.heldBadge}>
                  <Text style={styles.heldText}>HELD</Text>
                </View>
              )}
              <View style={styles.cardRow}>
                <View style={[styles.dot, { backgroundColor: dotColor }]} />
                <Text style={[styles.cardName, { color: theme.text }]} numberOfLines={1}>
                  {patientName}
                </Text>
              </View>
              {!!complaint && (
                <Text style={[styles.cardComplaint, { color: theme.textMuted }]} numberOfLines={1}>
                  {complaint}
                </Text>
              )}
              {completion > 0 ? (
                <View style={styles.barRow}>
                  <View style={[styles.barBg, { backgroundColor: isDark ? "#334155" : "rgba(0,0,0,0.07)" }]}>
                    <View style={[styles.barFill, { width: `${completion}%` as any, backgroundColor: progressColor }]} />
                  </View>
                  <Text style={[styles.pctText, { color: theme.textMuted }]}>{completion}%</Text>
                </View>
              ) : (
                <Text style={[styles.newLabel, { color: theme.textMuted }]}>Just started</Text>
              )}
            </Pressable>
          );
        })}

        <Pressable
          onPress={onNewCase}
          style={({ pressed }) => [styles.newBtn, { borderColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={[styles.newCircle, { backgroundColor: theme.primary }]}>
            <Feather name="plus" size={14} color="#FFF" />
          </View>
          <Text style={[styles.newBtnText, { color: theme.textMuted }]}>New</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    borderTopWidth: 1,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 12,
    flexShrink: 0,
  },
  label: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  scroll: {
    gap: 8,
    paddingRight: 4,
  },
  card: {
    width: 118,
    borderRadius: 10,
    padding: 9,
    position: "relative",
  },
  heldBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#f59e0b",
    borderRadius: 99,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  heldText: {
    fontSize: 7,
    fontWeight: "800",
    color: "white",
    letterSpacing: 0.3,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 3,
    paddingRight: 28,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 99,
    flexShrink: 0,
  },
  cardName: {
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
  },
  cardComplaint: {
    fontSize: 9,
    marginBottom: 6,
  },
  barRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  barBg: {
    flex: 1,
    height: 4,
    borderRadius: 99,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 99,
  },
  pctText: {
    fontSize: 8,
    fontWeight: "700",
    minWidth: 24,
    textAlign: "right",
  },
  newLabel: {
    fontSize: 9,
    marginTop: 4,
  },
  newBtn: {
    width: 52,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
  },
  newCircle: {
    width: 24,
    height: 24,
    borderRadius: 99,
    alignItems: "center",
    justifyContent: "center",
  },
  newBtnText: {
    fontSize: 8,
    fontWeight: "700",
  },
});
