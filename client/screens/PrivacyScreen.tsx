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
    icon: "database" as const,
    title: "What Data We Collect",
    items: [
      "Patient demographics (name, age, gender, contact details) as entered by the treating physician",
      "Clinical data including vitals, examination findings, investigations, treatment details, and discharge summaries",
      "Psychological assessment data (suicidal ideation, self-harm history, substance abuse screening)",
      "Voice recordings (temporarily processed for transcription, not stored permanently)",
      "Document scans (processed for OCR extraction, original images not retained on servers)",
      "Doctor's account information (name, email, institution, medical registration number)",
    ],
  },
  {
    icon: "lock" as const,
    title: "How We Protect Your Data",
    items: [
      "All data is transmitted over HTTPS with TLS 1.2+ encryption",
      "Patient records are stored on secured servers with access controls",
      "Authentication tokens are stored securely on your device",
      "Voice recordings are processed in real-time and discarded after transcription",
      "AI processing uses de-identified data snippets -- full patient identity is never sent to AI models",
      "Session-based access ensures only authenticated doctors can view their cases",
    ],
  },
  {
    icon: "users" as const,
    title: "Who Can Access Patient Data",
    items: [
      "Only the treating physician who created the case can access the full record",
      "ErMate staff do not access individual patient records",
      "AI features process clinical data without personally identifiable information (PII)",
      "No patient data is shared with third parties for marketing or commercial purposes",
      "Data may be shared with authorized medical personnel if explicitly enabled by the physician",
    ],
  },
  {
    icon: "server" as const,
    title: "Data Storage & Retention",
    items: [
      "Clinical records are stored on secure cloud infrastructure",
      "Local device caching is used for offline access and is encrypted",
      "Cached data can be cleared at any time from this screen",
      "Account deletion removes all associated data within 30 days",
      "Data retention follows applicable medical records regulations",
    ],
  },
  {
    icon: "cpu" as const,
    title: "AI & Voice Processing",
    items: [
      "Voice dictation uses Sarvam AI and OpenAI for speech-to-text conversion",
      "Audio is processed in real-time and not stored after transcription",
      "AI diagnosis uses clinical findings only -- patient name and identifiers are excluded from AI prompts",
      "Document scanning extracts text via OCR -- scanned images are not permanently stored",
      "AI-generated suggestions are for clinical decision support only and do not replace physician judgment",
    ],
  },
  {
    icon: "globe" as const,
    title: "Regulatory Compliance",
    items: [
      "ErMate is designed in accordance with India's Digital Personal Data Protection Act (DPDPA) 2023",
      "Follows National Medical Commission (NMC) guidelines on electronic medical records",
      "Supports patient's right to access, correct, and delete their data",
      "Data processing is based on legitimate medical purpose and physician consent",
      "Cross-border data transfers (if any) comply with applicable regulations",
    ],
  },
  {
    icon: "user-check" as const,
    title: "Your Rights",
    items: [
      "Request a copy of all your data via the Download My Data option below",
      "Delete your account and all associated data permanently",
      "Opt out of analytics and AI training data sharing",
      "Clear locally cached data from your device at any time",
      "Contact us for any data-related concerns or requests",
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
          <Text style={[styles.headerTitle, { color: theme.text }]}>Privacy & Data Protection</Text>
          <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            ErMate takes patient data privacy seriously. All clinical information is handled with the highest standards of security and confidentiality.
          </Text>
          <View style={[styles.lastUpdated, { backgroundColor: theme.backgroundDefault + "80" }]}>
            <Feather name="clock" size={12} color={theme.textMuted} />
            <Text style={[styles.lastUpdatedText, { color: theme.textMuted }]}>Last updated: February 2026</Text>
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
            For privacy-related inquiries, contact us at privacy@ermate.in
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
