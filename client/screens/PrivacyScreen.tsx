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
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";

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

const POLICY_SECTIONS = [
  {
    icon: "info" as const,
    title: "1. Introduction",
    items: [
      "ErMate is a mobile-based Emergency Room Electronic Medical Records (EMR) application designed for licensed medical professionals.",
      "Developed by Varah Group.",
      "This Privacy Policy explains how we collect, use, store, and protect data within the application.",
      "By using ErMate, you agree to the practices described in this policy.",
    ],
  },
  {
    icon: "database" as const,
    title: "2. Information We Collect",
    items: [
      "Account Information: Name, email address, login credentials, and subscription status.",
      "Clinical Data Entered by Doctors: Patient name, age and gender, clinical history, examination findings, investigations, diagnosis, treatment details, and discharge summaries.",
      "Psychological assessment data (suicidal ideation, self-harm history, substance abuse screening) as entered by the treating physician.",
      "Voice recordings (temporarily processed for transcription, not stored permanently).",
      "Document scans (processed for OCR extraction, original images not retained on servers).",
      "All clinical information is entered by authorized healthcare professionals for clinical documentation purposes.",
    ],
  },
  {
    icon: "target" as const,
    title: "3. Purpose of Data Collection",
    items: [
      "Clinical documentation.",
      "Emergency room workflow management.",
      "Generating structured case sheets.",
      "Generating discharge summaries.",
      "AI-assisted clinical reasoning support.",
      "Educational simulation and learning modules.",
      "ErMate does not sell, rent, or share patient data with third parties for marketing purposes.",
    ],
  },
  {
    icon: "lock" as const,
    title: "4. Data Storage & Security",
    items: [
      "All data is transmitted using secure HTTPS encryption.",
      "Clinical data is stored on secure backend servers.",
      "Access is restricted to authenticated users.",
      "Session-based authentication ensures only logged-in doctors can access case data.",
      "Reasonable technical safeguards are implemented to prevent unauthorized access.",
      "Local device caching is used for offline access and can be cleared at any time from this screen.",
    ],
  },
  {
    icon: "cpu" as const,
    title: "5. AI Processing",
    items: [
      "Certain features (such as AI diagnosis, smart dictation, and reference chat) process clinical text using third-party AI services.",
      "Only necessary clinical information is processed.",
      "AI services are used solely to generate clinical assistance outputs.",
      "ErMate does not allow third-party AI providers to independently store or use patient data for unrelated purposes.",
      "Doctors are advised to avoid entering unnecessary personally identifiable information when using AI-powered features.",
      "AI-generated suggestions are for clinical decision support only and do not replace physician judgment.",
    ],
  },
  {
    icon: "server" as const,
    title: "6. Data Retention",
    items: [
      "Clinical data remains stored while the user's subscription is active.",
      "Data is removed if the user deletes specific cases.",
      "Data is removed if the user deletes their account.",
      "Data is removed upon a formal deletion request.",
      "Automated retention limits may be implemented in the future in compliance with applicable regulations.",
    ],
  },
  {
    icon: "user-check" as const,
    title: "7. User Responsibility",
    items: [
      "ErMate is a documentation tool used by licensed healthcare professionals.",
      "Doctors using the app are responsible for obtaining appropriate patient consent.",
      "Doctors must comply with local hospital data policies.",
      "Doctors must ensure device-level security (screen lock, password protection).",
    ],
  },
  {
    icon: "globe" as const,
    title: "8. Compliance with Indian Law",
    items: [
      "ErMate operates in accordance with the Digital Personal Data Protection Act (DPDPA), 2023 (India).",
      "Follows applicable medical record-keeping guidelines from regulatory authorities.",
    ],
  },
  {
    icon: "trash-2" as const,
    title: "9. Data Deletion Requests",
    items: [
      "Users may request account deletion or data deletion at any time.",
      "Requests can be submitted through the app (see 'Your Data' section below).",
      "You may also contact us via email for deletion requests.",
      "Deletion requests will be processed within 30 days.",
    ],
  },
  {
    icon: "refresh-cw" as const,
    title: "10. Changes to This Policy",
    items: [
      "We may update this Privacy Policy periodically.",
      "Users will be notified of significant changes through app updates.",
    ],
  },
  {
    icon: "mail" as const,
    title: "11. Contact Information",
    items: [
      "For privacy-related concerns, contact Varah Group.",
      "Email: varahgrp@gmail.com",
      "Website: www.varahgrp.com",
    ],
  },
];

export default function PrivacyScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [prefs, setPrefs] = useState<PrivacyPrefs>(DEFAULT_PREFS);
  const [expandedPolicy, setExpandedPolicy] = useState<number | null>(null);

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

  const PolicySection = ({ section, index }: { section: typeof POLICY_SECTIONS[0]; index: number }) => {
    const isExpanded = expandedPolicy === index;
    return (
      <View style={[styles.policySection, { backgroundColor: theme.card }]}>
        <Pressable
          style={styles.policySectionHeader}
          onPress={() => setExpandedPolicy(isExpanded ? null : index)}
        >
          <View style={[styles.policyIconCircle, { backgroundColor: theme.primaryLight }]}>
            <Feather name={section.icon} size={16} color={theme.primary} />
          </View>
          <Text style={[styles.policySectionTitle, { color: theme.text }]}>{section.title}</Text>
          <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={theme.textMuted} />
        </Pressable>
        {isExpanded && (
          <View style={styles.policyItems}>
            {section.items.map((item, idx) => (
              <View key={idx} style={styles.policyItem}>
                <View style={[styles.bulletDot, { backgroundColor: theme.primary }]} />
                <Text style={[styles.policyItemText, { color: theme.textSecondary }]}>{item}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.headerCard, { backgroundColor: theme.primaryLight }]}>
          <View style={[styles.headerIconCircle, { backgroundColor: theme.primary + "20" }]}>
            <Feather name="shield" size={28} color={theme.primary} />
          </View>
          <Text style={[styles.headerTitle, { color: theme.text }]}>Privacy Policy</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            ErMate by Varah Group takes patient data privacy seriously. All clinical information is handled with the highest standards of security and confidentiality.
          </Text>
          <View style={[styles.lastUpdated, { backgroundColor: theme.backgroundDefault + "80" }]}>
            <Feather name="clock" size={12} color={theme.textMuted} />
            <Text style={[styles.lastUpdatedText, { color: theme.textMuted }]}>Version 1.0</Text>
          </View>
        </View>

        <Text style={[styles.sectionHeader, { color: theme.text }]}>Privacy Policy</Text>
        {POLICY_SECTIONS.map((section, index) => (
          <PolicySection key={index} section={section} index={index} />
        ))}

        <Text style={[styles.sectionHeader, { color: theme.text }]}>Data Sharing Preferences</Text>
        <View style={[styles.section, { backgroundColor: theme.card }]}>
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

        <Text style={[styles.sectionHeader, { color: theme.text }]}>Security</Text>
        <View style={[styles.section, { backgroundColor: theme.card }]}>
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

        <Text style={[styles.sectionHeader, { color: theme.text }]}>Your Data</Text>
        <View style={[styles.section, { backgroundColor: theme.card }]}>
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

        <View style={styles.footer}>
          <Feather name="mail" size={14} color={theme.textMuted} />
          <Text style={[styles.footerText, { color: theme.textMuted }]}>
            For privacy-related concerns, contact Varah Group at varahgrp@gmail.com | www.varahgrp.com
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  headerCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    alignItems: "center",
  },
  headerIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: Spacing.xs,
    textAlign: "center",
  },
  headerSubtitle: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  lastUpdated: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.md,
  },
  lastUpdatedText: {
    fontSize: 11,
    fontWeight: "500",
  },
  sectionHeader: {
    ...Typography.h4,
    marginBottom: Spacing.sm,
    marginTop: Spacing.sm,
  },
  policySection: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  policySectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  policyIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  policySectionTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  policyItems: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  policyItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 6,
  },
  policyItemText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
  },
  section: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.lg,
  },
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
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.xl,
  },
  footerText: {
    fontSize: 12,
  },
});
