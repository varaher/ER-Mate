import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Dimensions,
  FlatList,
  ViewToken,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface TutorialStep {
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  tips: string[];
}

const STEPS: TutorialStep[] = [
  {
    icon: "activity",
    iconColor: "#3B82F6",
    iconBg: "#DBEAFE",
    title: "Welcome to ErMate",
    description: "Your AI-powered Emergency Room EMR companion. Let's walk you through the key features.",
    tips: [
      "Designed for EM physicians and residents",
      "Works on your phone, tablet, or desktop",
      "ATLS-based for adults, PALS-based for pediatrics",
    ],
  },
  {
    icon: "user-plus",
    iconColor: "#10B981",
    iconBg: "#D1FAE5",
    title: "Start with Triage",
    description: "Tap 'New Patient' on the Dashboard to begin. Fill in patient details and triage category.",
    tips: [
      "Age determines protocol: 17+ = ATLS, 16 and below = PALS",
      "ESI triage levels with color-coded urgency",
      "Patient data auto-carries to the case sheet",
    ],
  },
  {
    icon: "zap",
    iconColor: "#6366F1",
    iconBg: "#E0E7FF",
    title: "Quick Case Sheet",
    description: "Skip triage and jump straight into the case sheet. Enter just the name, age, and sex to get started.",
    tips: [
      "Tap '+' on the Dashboard for quick options",
      "Edit vitals directly on the Patient tab",
      "Pediatric vitals show age-based normal ranges",
      "Abnormal values turn red automatically",
    ],
  },
  {
    icon: "file-text",
    iconColor: "#8B5CF6",
    iconBg: "#EDE9FE",
    title: "Complete the Case Sheet",
    description: "Navigate through tabs: Primary Survey, History, Exam, Investigations, Treatment, and Disposition.",
    tips: [
      "Swipe between tabs or use the tab bar",
      "Auto-saves as you type",
      "Psychological assessment is built into the History tab",
    ],
  },
  {
    icon: "mic",
    iconColor: "#EF4444",
    iconBg: "#FEE2E2",
    title: "Smart Dictation",
    description: "Tap the mic icon and speak naturally. AI transcribes your words and auto-fills 20+ case sheet fields instantly.",
    tips: [
      "Supports full history capture in one go",
      "Tap any field's mic icon to dictate just that field",
      "Review the transcript before applying — uses 1 AI credit",
    ],
  },
  {
    icon: "camera",
    iconColor: "#0EA5E9",
    iconBg: "#E0F2FE",
    title: "Scan Documents",
    description: "Photograph referral letters, lab reports, or prescriptions. AI reads them and populates your case sheet automatically.",
    tips: [
      "Tap the camera icon inside the case sheet",
      "Works with printed text, handwriting, and forms",
      "Uses 1 AI credit per scan",
    ],
  },
  {
    icon: "cpu",
    iconColor: "#F59E0B",
    iconBg: "#FEF3C7",
    title: "Clinical Decision Support",
    description: "Prompt your clinical reasoning with AI-ranked conditions to rule out, backed by PubMed citations and EM guidelines.",
    tips: [
      "Found in the Treatment tab",
      "Labels: CONSISTENT / POSSIBLE / LESS LIKELY",
      "Accept or exclude suggestions to help the AI learn — uses 1 credit",
    ],
  },
  {
    icon: "download",
    iconColor: "#06B6D4",
    iconBg: "#CFFAFE",
    title: "Export & Discharge",
    description: "Generate discharge summaries and export as PDF or DOCX — shareable instantly via WhatsApp or email.",
    tips: [
      "AI-generated discharge summaries use 1 credit",
      "PDF and DOCX export is always free",
      "Tap the share icon on any case from the Dashboard",
    ],
  },
  {
    icon: "bar-chart-2",
    iconColor: "#10B981",
    iconBg: "#D1FAE5",
    title: "Your Weekly Stats",
    description: "Track how many cases you've documented and see exactly how much time you've saved compared to paper notes.",
    tips: [
      "Tap 'My Weekly Stats' on the Dashboard",
      "Avg time saved: 14 minutes per case vs paper",
      "View top presenting complaints and all-time totals",
    ],
  },
  {
    icon: "monitor",
    iconColor: "#7C3AED",
    iconBg: "#EDE9FE",
    title: "Use ErMate on Your Computer",
    description: "Access all your cases from any browser on your desktop or laptop — just like WhatsApp Web.",
    tips: [
      "Option 1: Open the web app and scan the QR code with your phone to log in instantly",
      "Option 2: Go to Profile > Link to Web, get a 6-digit code, and enter it on the web",
      "Your session stays active independently after linking",
    ],
  },
  {
    icon: "book-open",
    iconColor: "#EC4899",
    iconBg: "#FCE7F3",
    title: "Learn & Practice",
    description: "Use the Learn tab for clinical simulations, EM reference chat, and trivia quizzes to stay sharp.",
    tips: [
      "Simulations present real ER scenarios — free to use",
      "EM Reference answers guideline questions with citations — uses 1 credit",
      "Build your weekly trivia streak for consistent practice",
    ],
  },
  {
    icon: "credit-card",
    iconColor: "#3B82F6",
    iconBg: "#DBEAFE",
    title: "AI Credits",
    description: "Your Base Plan includes 20 AI credits per month for Smart Dictation, CDS, document scanning, and more.",
    tips: [
      "Free plan: 10 cases total, no AI credits",
      "Base Plan: Unlimited EMR + 20 credits/month",
      "Credits roll over forever — they never expire",
    ],
  },
];

interface QuickStartScreenProps {
  onComplete: () => void;
}

export default function QuickStartScreen({ onComplete }: QuickStartScreenProps) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const handleNext = () => {
    if (currentIndex < STEPS.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
      setCurrentIndex(currentIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleSkip = () => {
    handleFinish();
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem("ermate_tutorial_completed", "true");
    onComplete();
  };

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index !== null) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const renderStep = ({ item }: { item: TutorialStep }) => (
    <View style={[styles.slide, { width: SCREEN_WIDTH }]}>
      <View style={[styles.iconContainer, { backgroundColor: isDark ? item.iconBg + "30" : item.iconBg }]}>
        <Feather name={item.icon} size={48} color={item.iconColor} />
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{item.title}</Text>
      <Text style={[styles.description, { color: theme.textSecondary }]}>{item.description}</Text>
      <View style={styles.tipsContainer}>
        {item.tips.map((tip, i) => (
          <View key={i} style={[styles.tipRow, { backgroundColor: isDark ? theme.card : theme.backgroundSecondary }]}>
            <Feather name="check" size={14} color={item.iconColor} />
            <Text style={[styles.tipText, { color: theme.text }]}>{tip}</Text>
          </View>
        ))}
      </View>
    </View>
  );

  const isLastStep = currentIndex === STEPS.length - 1;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault, paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <Pressable onPress={handleSkip} style={({ pressed }) => [styles.skipBtn, { opacity: pressed ? 0.6 : 1 }]}>
          <Text style={[styles.skipText, { color: theme.textSecondary }]}>Skip</Text>
        </Pressable>
        <Text style={[styles.counter, { color: theme.textMuted }]}>
          {currentIndex + 1} / {STEPS.length}
        </Text>
      </View>

      <FlatList
        ref={flatListRef}
        data={STEPS}
        renderItem={renderStep}
        keyExtractor={(_, i) => String(i)}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={false}
      />

      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <View style={styles.dots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: i === currentIndex ? theme.primary : theme.border,
                  width: i === currentIndex ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.nextBtn,
            { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleNext}
        >
          <Text style={styles.nextBtnText}>
            {isLastStep ? "Get Started" : "Next"}
          </Text>
          <Feather name={isLastStep ? "check" : "arrow-right"} size={18} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
  },
  skipBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md },
  skipText: { ...Typography.bodyMedium },
  counter: { ...Typography.small },
  slide: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing["3xl"],
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing["2xl"],
  },
  title: {
    ...Typography.h2,
    textAlign: "center",
    marginBottom: Spacing.md,
  },
  description: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing["2xl"],
    lineHeight: 22,
  },
  tipsContainer: { width: "100%", gap: Spacing.sm },
  tipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  tipText: { ...Typography.small, flex: 1 },
  footer: {
    paddingHorizontal: Spacing.xl,
    gap: Spacing.xl,
  },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.xs,
  },
  dot: {
    height: 8,
    borderRadius: 4,
  },
  nextBtn: {
    height: 52,
    borderRadius: BorderRadius.md,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.sm,
  },
  nextBtnText: {
    color: "#FFFFFF",
    ...Typography.h4,
  },
});
