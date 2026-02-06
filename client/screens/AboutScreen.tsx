import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

const APP_VERSION = "1.0.0";
const BUILD_NUMBER = "2026.02.06";

const TECH_STACK = [
  { label: "Frontend", value: "React Native + Expo SDK 54" },
  { label: "Backend", value: "Express.js + TypeScript" },
  { label: "Database", value: "PostgreSQL" },
  { label: "AI Engine", value: "OpenAI GPT-4o" },
  { label: "Voice", value: "Whisper AI" },
];

const OPEN_SOURCE_LIBS = [
  { name: "React Native", license: "MIT" },
  { name: "Expo", license: "MIT" },
  { name: "React Navigation", license: "MIT" },
  { name: "TanStack React Query", license: "MIT" },
  { name: "Drizzle ORM", license: "Apache-2.0" },
  { name: "PDFKit", license: "MIT" },
  { name: "React Native Reanimated", license: "MIT" },
];

export default function AboutScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const handleOpenLink = (url: string, label: string) => {
    Alert.alert(label, "This page will be available soon. Stay tuned!");
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, { backgroundColor: theme.primaryLight }]}>
          <View style={[styles.appIcon, { backgroundColor: theme.primary }]}>
            <Feather name="activity" size={40} color="#fff" />
          </View>
          <Text style={[styles.appName, { color: theme.primary }]}>ErMate</Text>
          <Text style={[styles.tagline, { color: theme.text }]}>
            Emergency Room EMR for Modern Physicians
          </Text>
          <View style={styles.versionRow}>
            <Text style={[styles.versionLabel, { color: theme.textSecondary }]}>
              Version {APP_VERSION}
            </Text>
            <View style={[styles.versionDot, { backgroundColor: theme.textMuted }]} />
            <Text style={[styles.versionLabel, { color: theme.textSecondary }]}>
              Build {BUILD_NUMBER}
            </Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>About</Text>
          <Text style={[styles.aboutText, { color: theme.textSecondary }]}>
            ErMate is a mobile-first Emergency Room Electronic Medical Records application designed for emergency medicine physicians and residents. It streamlines the complete patient workflow from triage through discharge with AI-powered features, voice dictation, and evidence-based clinical decision support.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Key Features</Text>
          {[
            { icon: "clipboard", text: "Complete ER workflow: Triage, Case Sheet, Disposition, Discharge" },
            { icon: "mic", text: "Voice dictation with AI clinical data extraction" },
            { icon: "cpu", text: "AI-powered differential diagnosis with literature references" },
            { icon: "alert-triangle", text: "Red flag detection with severity-based alerts" },
            { icon: "users", text: "Age-based protocols: ATLS (adults) and PALS (pediatrics)" },
            { icon: "file-text", text: "PDF and Word export for case sheets and discharge summaries" },
            { icon: "camera", text: "Document scanner for lab reports and referral notes" },
          ].map((feature, index) => (
            <View key={index} style={styles.featureRow}>
              <Feather name={feature.icon as any} size={16} color={theme.primary} />
              <Text style={[styles.featureText, { color: theme.text }]}>{feature.text}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Technology</Text>
          {TECH_STACK.map((item, index) => (
            <View
              key={item.label}
              style={[
                styles.techRow,
                index < TECH_STACK.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : null,
              ]}
            >
              <Text style={[styles.techLabel, { color: theme.textSecondary }]}>{item.label}</Text>
              <Text style={[styles.techValue, { color: theme.text }]}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Open Source Licenses</Text>
          <Text style={[styles.licenseNote, { color: theme.textSecondary }]}>
            ErMate is built with these amazing open source libraries
          </Text>
          {OPEN_SOURCE_LIBS.map((lib, index) => (
            <View
              key={lib.name}
              style={[
                styles.libRow,
                index < OPEN_SOURCE_LIBS.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : null,
              ]}
            >
              <Text style={[styles.libName, { color: theme.text }]}>{lib.name}</Text>
              <View style={[styles.licenseBadge, { backgroundColor: theme.backgroundDefault }]}>
                <Text style={[styles.licenseText, { color: theme.textSecondary }]}>{lib.license}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Legal</Text>
          {[
            { icon: "file-text", label: "Terms of Service" },
            { icon: "shield", label: "Privacy Policy" },
            { icon: "book", label: "HIPAA Compliance" },
          ].map((item, index) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [
                styles.legalRow,
                { opacity: pressed ? 0.7 : 1 },
                index < 2 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : null,
              ]}
              onPress={() => handleOpenLink("", item.label)}
            >
              <Feather name={item.icon as any} size={18} color={theme.textSecondary} />
              <Text style={[styles.legalLabel, { color: theme.text }]}>{item.label}</Text>
              <Feather name="external-link" size={16} color={theme.textMuted} />
            </Pressable>
          ))}
        </View>

        <Text style={[styles.copyright, { color: theme.textMuted }]}>
          Made with care for Emergency Medicine{"\n"}
          2024-2026 ErMate. All rights reserved.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg },
  heroCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  appIcon: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  appName: { ...Typography.h1, marginBottom: Spacing.xs },
  tagline: { ...Typography.body, textAlign: "center" },
  versionRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  versionLabel: { ...Typography.caption },
  versionDot: { width: 4, height: 4, borderRadius: 2 },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: { ...Typography.h4, marginBottom: Spacing.md },
  aboutText: { ...Typography.body, lineHeight: 24 },
  featureRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  featureText: { ...Typography.small, flex: 1, lineHeight: 20 },
  techRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  techLabel: { ...Typography.small },
  techValue: { ...Typography.bodyMedium },
  licenseNote: { ...Typography.small, marginBottom: Spacing.md },
  libRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
  libName: { ...Typography.body },
  licenseBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  licenseText: { ...Typography.caption },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  legalLabel: { ...Typography.body, flex: 1 },
  copyright: { ...Typography.caption, textAlign: "center", marginTop: Spacing.lg, lineHeight: 18 },
});
