import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, TriageColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const learnSections = [
  {
    id: "rounds",
    title: "Rounds",
    subtitle: "Debrief your real cases with AI across 6 clinical thinking lenses",
    icon: "rotate-cw" as const,
    color: "#1DB870",
    route: "Rounds" as const,
  },
  {
    id: "trivia",
    title: "Trivia Time",
    subtitle: "Case-based MCQs across all EM specialties with detailed explanations",
    icon: "award" as const,
    color: "#8b5cf6",
    route: "TriviaHome" as const,
  },
  {
    id: "simulation",
    title: "Simulation Lab",
    subtitle: "Practice emergency scenarios with real-time patient deterioration",
    icon: "monitor" as const,
    color: TriageColors.red,
    route: "SimulationList" as const,
  },
  {
    id: "em-reference",
    title: "EM Reference Library",
    subtitle: "AI-powered clinical knowledge with textbook and guideline references",
    icon: "book-open" as const,
    color: TriageColors.blue,
    route: "EMReference" as const,
  },
];

export default function LearnScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <View style={[styles.header, { paddingTop: insets.top + Spacing.md }]}>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Learn</Text>
        <Text style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
          Sharpen your emergency medicine skills
        </Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {learnSections.map((section) => (
          <Pressable
            key={section.id}
            style={({ pressed }) => [
              styles.sectionCard,
              { backgroundColor: theme.card, opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => navigation.navigate(section.route)}
          >
            <View style={[styles.sectionIcon, { backgroundColor: section.color }]}>
              <Feather name={section.icon} size={28} color="#FFFFFF" />
            </View>
            <View style={styles.sectionText}>
              <Text style={[styles.sectionTitle, { color: theme.text }]}>{section.title}</Text>
              <Text style={[styles.sectionSubtitle, { color: theme.textSecondary }]}>
                {section.subtitle}
              </Text>
            </View>
            <Feather name="chevron-right" size={22} color={theme.textMuted} />
          </Pressable>
        ))}

        <View style={[styles.comingSoon, { backgroundColor: theme.card }]}>
          <View style={[styles.comingSoonIcon, { backgroundColor: theme.cardElevated }]}>
            <Feather name="compass" size={24} color={theme.textMuted} />
          </View>
          <Text style={[styles.comingSoonTitle, { color: theme.textSecondary }]}>
            More modules coming soon
          </Text>
          <Text style={[styles.comingSoonSubtitle, { color: theme.textMuted }]}>
            Protocols, clinical pathways, and more
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: Spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  sectionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    gap: Spacing.md,
  },
  sectionIcon: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
  },
  sectionText: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  sectionSubtitle: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  comingSoon: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.sm,
  },
  comingSoonIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  comingSoonTitle: {
    fontSize: 15,
    fontWeight: "600",
  },
  comingSoonSubtitle: {
    fontSize: 13,
    marginTop: 4,
    textAlign: "center",
  },
});
