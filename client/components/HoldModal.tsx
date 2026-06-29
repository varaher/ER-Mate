import React from "react";
import { View, Text, StyleSheet, Pressable, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { type TabCompletionMap, TAB_LABELS, TAB_DISPLAY } from "@/lib/tabCompletion";

interface HoldModalProps {
  visible: boolean;
  patientName: string;
  tabCompletion: TabCompletionMap | null;
  onCancel: () => void;
  onConfirm: () => void;
  actionLabel?: string;
}

export function HoldModal({
  visible,
  patientName,
  tabCompletion,
  onCancel,
  onConfirm,
  actionLabel = "Hold & switch case",
}: HoldModalProps) {
  const { theme, isDark } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onCancel} />
        <View style={[styles.sheet, { backgroundColor: theme.card }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <Text style={[styles.title, { color: theme.text }]}>Hold current case?</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            <Text style={{ color: theme.text, fontWeight: "700" }}>{patientName}</Text>
            {" "}will be saved as-is. Return anytime from the case tray at the bottom.
          </Text>

          {tabCompletion && (
            <View style={[styles.tabList, { backgroundColor: isDark ? "#1e293b" : "#f7f8fa", borderColor: theme.border }]}>
              <Text style={[styles.tabListHeader, { color: theme.textMuted }]}>SAVED SO FAR</Text>
              {TAB_LABELS.map((tab) => {
                const p = tabCompletion[tab];
                const barColor = p >= 75 ? "#10b981" : p >= 30 ? "#f59e0b" : p > 0 ? "#f97316" : "transparent";
                return (
                  <View key={tab} style={styles.tabRow}>
                    <Text style={[styles.tabName, { color: p > 0 ? theme.text : theme.textMuted }]}>
                      {TAB_DISPLAY[tab]}
                    </Text>
                    <View style={[styles.barBg, { backgroundColor: isDark ? "#334155" : "rgba(0,0,0,0.06)" }]}>
                      {p > 0 && (
                        <View style={[styles.barFill, { width: `${p}%` as any, backgroundColor: barColor }]} />
                      )}
                    </View>
                    <Text style={[styles.pctLabel, { color: p >= 75 ? "#10b981" : p > 0 ? "#f59e0b" : theme.textMuted }]}>
                      {p}%
                    </Text>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.btns}>
            <Pressable
              onPress={onCancel}
              style={({ pressed }) => [
                styles.cancelBtn,
                { backgroundColor: isDark ? "#1e293b" : "#f1f5f9", borderColor: theme.border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Stay here</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.confirmBtn,
                { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <Feather name="pause-circle" size={16} color="#fff" />
              <Text style={styles.confirmText}>{actionLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 99,
    alignSelf: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 6,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  tabList: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 20,
  },
  tabListHeader: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 7,
  },
  tabName: {
    fontSize: 12,
    width: 76,
    flexShrink: 0,
  },
  barBg: {
    flex: 1,
    height: 5,
    borderRadius: 99,
    overflow: "hidden",
  },
  barFill: {
    height: "100%",
    borderRadius: 99,
  },
  pctLabel: {
    fontSize: 10,
    fontWeight: "700",
    minWidth: 30,
    textAlign: "right",
  },
  btns: {
    flexDirection: "row",
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: {
    fontSize: 14,
    fontWeight: "600",
  },
  confirmBtn: {
    flex: 2,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
});
