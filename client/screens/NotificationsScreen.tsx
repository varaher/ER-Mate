import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

const NOTIFICATION_PREFS_KEY = "@ermate_notification_prefs";

interface NotificationPrefs {
  criticalAlerts: boolean;
  caseUpdates: boolean;
  labResults: boolean;
  shiftReminders: boolean;
  aiInsights: boolean;
  systemUpdates: boolean;
  sound: boolean;
  vibration: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  criticalAlerts: true,
  caseUpdates: true,
  labResults: true,
  shiftReminders: false,
  aiInsights: true,
  systemUpdates: false,
  sound: true,
  vibration: true,
};

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    loadPrefs();
  }, []);

  const loadPrefs = async () => {
    try {
      const stored = await AsyncStorage.getItem(NOTIFICATION_PREFS_KEY);
      if (stored) {
        setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
      }
    } catch {}
  };

  const savePrefs = async (updated: NotificationPrefs) => {
    try {
      await AsyncStorage.setItem(NOTIFICATION_PREFS_KEY, JSON.stringify(updated));
    } catch {}
  };

  const toggle = (key: keyof NotificationPrefs) => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    savePrefs(updated);
  };

  const sections = [
    {
      title: "Alert Types",
      items: [
        {
          key: "criticalAlerts" as const,
          icon: "alert-triangle",
          label: "Critical Alerts",
          description: "Red flag warnings and critical patient updates",
          color: "#dc2626",
        },
        {
          key: "caseUpdates" as const,
          icon: "file-text",
          label: "Case Updates",
          description: "Status changes for your active cases",
          color: theme.primary,
        },
        {
          key: "labResults" as const,
          icon: "activity",
          label: "Lab Results",
          description: "Notifications when lab results are available",
          color: "#22c55e",
        },
        {
          key: "shiftReminders" as const,
          icon: "clock",
          label: "Shift Reminders",
          description: "Reminders before your scheduled shifts",
          color: "#f97316",
        },
        {
          key: "aiInsights" as const,
          icon: "cpu",
          label: "AI Insights",
          description: "AI-powered suggestions and diagnostic alerts",
          color: "#8B5CF6",
        },
        {
          key: "systemUpdates" as const,
          icon: "download",
          label: "System Updates",
          description: "App updates and new feature announcements",
          color: theme.textSecondary,
        },
      ],
    },
    {
      title: "Delivery",
      items: [
        {
          key: "sound" as const,
          icon: "volume-2",
          label: "Sound",
          description: "Play sound for notifications",
          color: theme.primary,
        },
        {
          key: "vibration" as const,
          icon: "smartphone",
          label: "Vibration",
          description: "Vibrate for notifications",
          color: theme.primary,
        },
      ],
    },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.infoCard, { backgroundColor: theme.primaryLight }]}>
          <Feather name="bell" size={24} color={theme.primary} />
          <Text style={[styles.infoText, { color: theme.text }]}>
            Configure which notifications you want to receive. Critical alerts are recommended to stay enabled.
          </Text>
        </View>

        {sections.map((section) => (
          <View key={section.title} style={[styles.section, { backgroundColor: theme.card }]}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
            {section.items.map((item, index) => (
              <View
                key={item.key}
                style={[
                  styles.settingRow,
                  index < section.items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : null,
                ]}
              >
                <View style={[styles.iconCircle, { backgroundColor: item.color + "15" }]}>
                  <Feather name={item.icon as any} size={18} color={item.color} />
                </View>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>{item.label}</Text>
                  <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>{item.description}</Text>
                </View>
                <Switch
                  value={prefs[item.key]}
                  onValueChange={() => toggle(item.key)}
                  trackColor={{ false: theme.backgroundTertiary, true: theme.primary + "50" }}
                  thumbColor={prefs[item.key] ? theme.primary : theme.textMuted}
                  ios_backgroundColor={theme.backgroundTertiary}
                />
              </View>
            ))}
          </View>
        ))}

        <Text style={[styles.footerNote, { color: theme.textMuted }]}>
          {Platform.OS === "web"
            ? "Push notifications are available when running in Expo Go on your mobile device."
            : "Notification delivery depends on your device settings and Do Not Disturb mode."}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  infoText: { ...Typography.small, flex: 1 },
  section: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
  sectionTitle: { ...Typography.h4, marginBottom: Spacing.md },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  settingInfo: { flex: 1 },
  settingLabel: { ...Typography.bodyMedium },
  settingDesc: { ...Typography.caption, marginTop: 2 },
  footerNote: { ...Typography.caption, textAlign: "center", marginTop: Spacing.md, paddingHorizontal: Spacing.lg },
});
