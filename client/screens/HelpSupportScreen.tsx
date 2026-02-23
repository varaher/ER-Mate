import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  TextInput,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

const FEEDBACK_CATEGORIES = [
  { key: "bug", label: "Bug Report", icon: "alert-triangle" as const, color: "#EF4444" },
  { key: "feature", label: "Feature Request", icon: "star" as const, color: "#F59E0B" },
  { key: "improvement", label: "Improvement", icon: "trending-up" as const, color: "#3B82F6" },
  { key: "general", label: "General", icon: "message-circle" as const, color: "#10B981" },
];

const FAQ_ITEMS = [
  {
    question: "How do I start a new patient case?",
    answer: "Tap the blue + button in the center of the bottom tab bar or press 'New Patient' on the Dashboard. This will open the Triage screen where you enter patient demographics and vitals.",
  },
  {
    question: "How does voice dictation work?",
    answer: "Look for the microphone icon on supported fields. Tap to start recording your clinical notes. The AI will transcribe your speech and automatically extract relevant clinical data like chief complaints, vitals, and history.",
  },
  {
    question: "How do I export a case sheet or discharge summary?",
    answer: "From the Dashboard, find a completed/discharged case and tap the download icon. You can export as PDF or Word document. The export includes all case details including vitals, assessments, treatments, and disposition.",
  },
  {
    question: "What is the AI Diagnosis feature?",
    answer: "In the Treatment tab of a case sheet, you will find the AI Diagnosis panel. It analyzes the patient's clinical data and suggests differential diagnoses with confidence levels, citing medical literature references. You can provide feedback to help the AI improve.",
  },
  {
    question: "How are pediatric patients handled?",
    answer: "Patients aged 16 or younger are automatically routed to the Pediatric Case Sheet which uses PALS protocols, includes PAT (Pediatric Assessment Triangle), and has age-appropriate vital sign references.",
  },
  {
    question: "Is my patient data secure?",
    answer: "Yes. All patient data is encrypted in transit and at rest. Data is stored securely on our HIPAA-compliant servers. You can manage your privacy settings from Profile > Privacy.",
  },
];

export default function HelpSupportScreen() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackCategory, setFeedbackCategory] = useState("general");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedbackSending, setFeedbackSending] = useState(false);

  const handleEmailSupport = async () => {
    const subject = encodeURIComponent("ErMate Support Request");
    const body = encodeURIComponent(`\n\n---\nUser: ${user?.name || "N/A"}\nEmail: ${user?.email || "N/A"}\nPlatform: ${Platform.OS}\nApp Version: 1.0.0`);
    const mailtoUrl = `mailto:support@ermate.app?subject=${subject}&body=${body}`;
    try {
      const canOpen = await Linking.canOpenURL(mailtoUrl);
      if (canOpen) {
        await Linking.openURL(mailtoUrl);
      } else {
        Alert.alert("Email Not Available", "Please send an email to support@ermate.app from your email client.");
      }
    } catch {
      Alert.alert("Email Not Available", "Please send an email to support@ermate.app from your email client.");
    }
  };

  const handleSendFeedback = async () => {
    if (!feedbackText.trim()) {
      Alert.alert("Empty Feedback", "Please type your feedback or suggestion before sending.");
      return;
    }
    setFeedbackSending(true);
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/feedback", baseUrl).href;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user?.id || null,
          userEmail: user?.email || null,
          userName: user?.name || null,
          category: feedbackCategory,
          message: feedbackText.trim(),
          platform: Platform.OS,
          appVersion: "1.0.0",
        }),
      });
      if (!res.ok) throw new Error("Failed to send");
      setFeedbackSent(true);
      setFeedbackText("");
      setFeedbackCategory("general");
      Alert.alert("Thank You!", "Your feedback has been submitted. We appreciate your input in making ErMate better.");
      setTimeout(() => setFeedbackSent(false), 3000);
    } catch {
      Alert.alert("Error", "Could not send feedback. Please try again or email us directly.");
    } finally {
      setFeedbackSending(false);
    }
  };

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.contactCard, { backgroundColor: theme.primaryLight }]}>
          <Feather name="headphones" size={32} color={theme.primary} />
          <Text style={[styles.contactTitle, { color: theme.primary }]}>Need Help?</Text>
          <Text style={[styles.contactSubtitle, { color: theme.text }]}>
            We're here to help you get the most out of ErMate
          </Text>
          <View style={styles.contactActions}>
            <Pressable
              style={({ pressed }) => [styles.contactBtn, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}
              onPress={handleEmailSupport}
            >
              <Feather name="mail" size={18} color="#fff" />
              <Text style={styles.contactBtnText}>Email Support</Text>
            </Pressable>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Frequently Asked Questions</Text>
          {FAQ_ITEMS.map((item, index) => (
            <Pressable
              key={index}
              style={[
                styles.faqItem,
                index < FAQ_ITEMS.length - 1 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : null,
              ]}
              onPress={() => toggleFaq(index)}
            >
              <View style={styles.faqHeader}>
                <Text style={[styles.faqQuestion, { color: theme.text }]}>{item.question}</Text>
                <Feather
                  name={expandedFaq === index ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={theme.textMuted}
                />
              </View>
              {expandedFaq === index ? (
                <Text style={[styles.faqAnswer, { color: theme.textSecondary }]}>{item.answer}</Text>
              ) : null}
            </Pressable>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Send Feedback</Text>
          <Text style={[styles.feedbackSubtitle, { color: theme.textSecondary }]}>
            Help us improve ErMate with your suggestions
          </Text>
          <View style={styles.categoryRow}>
            {FEEDBACK_CATEGORIES.map((cat) => (
              <Pressable
                key={cat.key}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: feedbackCategory === cat.key ? cat.color + "20" : theme.backgroundDefault,
                    borderColor: feedbackCategory === cat.key ? cat.color : theme.border,
                  },
                ]}
                onPress={() => setFeedbackCategory(cat.key)}
              >
                <Feather name={cat.icon} size={14} color={feedbackCategory === cat.key ? cat.color : theme.textMuted} />
                <Text
                  style={[
                    styles.categoryLabel,
                    { color: feedbackCategory === cat.key ? cat.color : theme.textSecondary },
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            style={[
              styles.feedbackInput,
              {
                backgroundColor: theme.backgroundDefault,
                color: theme.text,
                borderColor: theme.border,
              },
            ]}
            placeholder="Type your feedback, bug report, or feature request..."
            placeholderTextColor={theme.textMuted}
            multiline
            numberOfLines={4}
            value={feedbackText}
            onChangeText={setFeedbackText}
            textAlignVertical="top"
          />
          <Pressable
            style={({ pressed }) => [
              styles.sendBtn,
              { backgroundColor: theme.primary, opacity: feedbackSending || pressed ? 0.6 : 1 },
            ]}
            onPress={handleSendFeedback}
            disabled={feedbackSending}
          >
            {feedbackSending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Feather name="send" size={16} color="#fff" />
            )}
            <Text style={styles.sendBtnText}>{feedbackSending ? "Sending..." : "Send Feedback"}</Text>
          </Pressable>
          {feedbackSent ? (
            <View style={[styles.sentBanner, { backgroundColor: "#10B98120" }]}>
              <Feather name="check-circle" size={16} color="#10B981" />
              <Text style={{ color: "#10B981", ...Typography.small }}>Feedback sent successfully</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Quick Links</Text>
          {[
            { icon: "book-open", label: "User Guide", url: "https://ermate.app/guide" },
            { icon: "video", label: "Video Tutorials", url: "https://ermate.app/tutorials" },
            { icon: "message-circle", label: "Community Forum", url: "https://ermate.app/community" },
            { icon: "file-text", label: "Release Notes", url: "https://ermate.app/changelog" },
          ].map((link, index) => (
            <Pressable
              key={link.label}
              style={({ pressed }) => [
                styles.linkRow,
                { opacity: pressed ? 0.7 : 1 },
                index < 3 ? { borderBottomWidth: 1, borderBottomColor: theme.border } : null,
              ]}
              onPress={() => {
                Alert.alert(link.label, "This resource will be available soon. Stay tuned!");
              }}
            >
              <View style={[styles.linkIcon, { backgroundColor: theme.primaryLight }]}>
                <Feather name={link.icon as any} size={18} color={theme.primary} />
              </View>
              <Text style={[styles.linkLabel, { color: theme.text }]}>{link.label}</Text>
              <Feather name="external-link" size={16} color={theme.textMuted} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  contactCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  contactTitle: { ...Typography.h3, marginTop: Spacing.sm },
  contactSubtitle: { ...Typography.body, textAlign: "center", marginTop: Spacing.xs },
  contactActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
  contactBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.md,
  },
  contactBtnText: { ...Typography.label, color: "#fff" },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: { ...Typography.h4, marginBottom: Spacing.md },
  faqItem: { paddingVertical: Spacing.md },
  faqHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: Spacing.sm,
  },
  faqQuestion: { ...Typography.bodyMedium, flex: 1 },
  faqAnswer: { ...Typography.small, marginTop: Spacing.sm, lineHeight: 20 },
  feedbackSubtitle: { ...Typography.small, marginBottom: Spacing.md },
  categoryRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  categoryLabel: { ...Typography.small },
  sentBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
  },
  feedbackInput: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    minHeight: 100,
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  sendBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  sendBtnText: { ...Typography.label, color: "#fff" },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  linkLabel: { ...Typography.body, flex: 1 },
});
