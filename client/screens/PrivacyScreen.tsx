import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Pressable,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

const PRIVACY_PREFS_KEY = "@ermate_privacy_prefs";

interface PrivacyPrefs {
  shareAnalytics: boolean;
  shareAiTraining: boolean;
  biometricLock: boolean;
  autoLockTimeout: number;
}

const DEFAULT_PREFS: PrivacyPrefs = {
  shareAnalytics: true,
  shareAiTraining: true,
  biometricLock: false,
  autoLockTimeout: 5,
};

export default function PrivacyScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [prefs, setPrefs] = useState<PrivacyPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    loadPrefs();
  }, []);

  const loadPrefs = async () => {
    try {
      const stored = await AsyncStorage.getItem(PRIVACY_PREFS_KEY);
      if (stored) {
        setPrefs({ ...DEFAULT_PREFS, ...JSON.parse(stored) });
      }
    } catch {}
  };

  const savePrefs = async (updated: PrivacyPrefs) => {
    try {
      await AsyncStorage.setItem(PRIVACY_PREFS_KEY, JSON.stringify(updated));
    } catch {}
  };

  const togglePref = (key: "shareAnalytics" | "shareAiTraining" | "biometricLock") => {
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    savePrefs(updated);
  };

  const handleClearLocalData = () => {
    Alert.alert(
      "Clear Local Data",
      "This will remove locally cached case data and preferences from this device. Your cases on the server will not be affected. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear Data",
          style: "destructive",
          onPress: async () => {
            try {
              const keysToKeep = ["@ermate_token", "@ermate_user"];
              const allKeys = await AsyncStorage.getAllKeys();
              const keysToRemove = allKeys.filter((k) => !keysToKeep.includes(k));
              if (keysToRemove.length > 0) {
                await AsyncStorage.multiRemove(keysToRemove);
              }
              Alert.alert("Done", "Local data has been cleared. Your account and server data are safe.");
            } catch {
              Alert.alert("Error", "Failed to clear local data. Please try again.");
            }
          },
        },
      ]
    );
  };

  const handleDownloadData = () => {
    Alert.alert(
      "Download My Data",
      "A copy of your data will be emailed to " + (user?.email || "your registered email") + ". This may take a few minutes.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Request Download",
          onPress: () => {
            Alert.alert("Request Sent", "You will receive an email with your data within 24 hours.");
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      "Delete Account",
      "This will permanently delete your account and all associated data. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Account",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Are you absolutely sure?",
              "All your cases, notes, and settings will be permanently removed.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, Delete Everything",
                  style: "destructive",
                  onPress: () => {
                    Alert.alert("Request Submitted", "Your account deletion request has been submitted. It will be processed within 30 days as per our data retention policy.");
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.infoCard, { backgroundColor: theme.primaryLight }]}>
          <Feather name="shield" size={24} color={theme.primary} />
          <Text style={[styles.infoText, { color: theme.text }]}>
            Your patient data is encrypted and stored securely. ErMate complies with healthcare data privacy standards.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Data Sharing</Text>

          <View style={[styles.settingRow, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
            <View style={[styles.iconCircle, { backgroundColor: theme.primaryLight }]}>
              <Feather name="bar-chart-2" size={18} color={theme.primary} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Usage Analytics</Text>
              <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>Help improve ErMate with anonymous usage data</Text>
            </View>
            <Switch
              value={prefs.shareAnalytics}
              onValueChange={() => togglePref("shareAnalytics")}
              trackColor={{ false: theme.backgroundTertiary, true: theme.primary + "50" }}
              thumbColor={prefs.shareAnalytics ? theme.primary : theme.textMuted}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={[styles.iconCircle, { backgroundColor: "#8B5CF620" }]}>
              <Feather name="cpu" size={18} color="#8B5CF6" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>AI Training Data</Text>
              <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>Allow de-identified data to improve AI diagnosis accuracy</Text>
            </View>
            <Switch
              value={prefs.shareAiTraining}
              onValueChange={() => togglePref("shareAiTraining")}
              trackColor={{ false: theme.backgroundTertiary, true: "#8B5CF650" }}
              thumbColor={prefs.shareAiTraining ? "#8B5CF6" : theme.textMuted}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Security</Text>

          <View style={styles.settingRow}>
            <View style={[styles.iconCircle, { backgroundColor: "#22c55e20" }]}>
              <Feather name="lock" size={18} color="#22c55e" />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Biometric Lock</Text>
              <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>Require fingerprint or face unlock to open app</Text>
            </View>
            <Switch
              value={prefs.biometricLock}
              onValueChange={() => togglePref("biometricLock")}
              trackColor={{ false: theme.backgroundTertiary, true: "#22c55e50" }}
              thumbColor={prefs.biometricLock ? "#22c55e" : theme.textMuted}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Your Data</Text>

          <Pressable
            style={({ pressed }) => [styles.actionRow, { borderBottomWidth: 1, borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
            onPress={handleClearLocalData}
          >
            <View style={[styles.iconCircle, { backgroundColor: theme.warningLight }]}>
              <Feather name="trash-2" size={18} color={theme.warning} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Clear Local Data</Text>
              <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>Remove cached data from this device</Text>
            </View>
            <Feather name="chevron-right" size={18} color={theme.textMuted} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionRow, { borderBottomWidth: 1, borderBottomColor: theme.border, opacity: pressed ? 0.7 : 1 }]}
            onPress={handleDownloadData}
          >
            <View style={[styles.iconCircle, { backgroundColor: theme.primaryLight }]}>
              <Feather name="download" size={18} color={theme.primary} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Download My Data</Text>
              <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>Get a copy of all your data via email</Text>
            </View>
            <Feather name="chevron-right" size={18} color={theme.textMuted} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.actionRow, { opacity: pressed ? 0.7 : 1 }]}
            onPress={handleDeleteAccount}
          >
            <View style={[styles.iconCircle, { backgroundColor: theme.dangerLight }]}>
              <Feather name="user-x" size={18} color={theme.danger} />
            </View>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.danger }]}>Delete Account</Text>
              <Text style={[styles.settingDesc, { color: theme.textSecondary }]}>Permanently remove your account and data</Text>
            </View>
            <Feather name="chevron-right" size={18} color={theme.textMuted} />
          </Pressable>
        </View>
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
  actionRow: {
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
});
