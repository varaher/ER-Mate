import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
} from "react-native";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import { useTriviaStreak } from "@/hooks/useTriviaStreak";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  CATEGORY_INFO,
  DIFFICULTY_INFO,
  TriviaCategory,
  TriviaDifficulty,
  getAllCategories,
  getFilteredQuestions,
} from "@/data/triviaQuestions";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function TriviaHomeScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { weeklyCount, reload } = useTriviaStreak();

  useFocusEffect(React.useCallback(() => { reload(); }, [reload]));

  const [selectedCategories, setSelectedCategories] = useState<TriviaCategory[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<TriviaDifficulty | "all">("all");
  const [questionCount, setQuestionCount] = useState(10);

  const allCategories = getAllCategories();

  const toggleCategory = (cat: TriviaCategory) => {
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  };

  const selectAllCategories = () => {
    if (selectedCategories.length === allCategories.length) {
      setSelectedCategories([]);
    } else {
      setSelectedCategories([...allCategories]);
    }
  };

  const startQuiz = () => {
    const cats = selectedCategories.length > 0 ? selectedCategories : allCategories;
    const questions = getFilteredQuestions(cats, selectedDifficulty, questionCount);
    if (questions.length === 0) {
      Alert.alert("No Questions", "No questions found for the selected filters. Try different options.");
      return;
    }
    navigation.navigate("TriviaQuiz", {
      categories: cats,
      difficulty: selectedDifficulty,
      questionCount: Math.min(questionCount, questions.length),
    });
  };

  const availableCount = getFilteredQuestions(
    selectedCategories.length > 0 ? selectedCategories : allCategories,
    selectedDifficulty,
    999
  ).length;

  const countOptions = [5, 10, 15, 20];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 12, paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.heroCard, { backgroundColor: theme.primary }]}>
          <Feather name="award" size={40} color="#FFFFFF" />
          <Text style={styles.heroTitle}>Trivia Time</Text>
          <Text style={styles.heroSubtitle}>
            Test your emergency medicine knowledge with case-based questions
          </Text>
          {weeklyCount > 0 ? (
            <View style={styles.streakBadge}>
              <Feather name="zap" size={13} color={theme.primary} />
              <Text style={[styles.streakText, { color: theme.primary }]}>
                {weeklyCount} {weeklyCount === 1 ? "quiz" : "quizzes"} completed this week
              </Text>
            </View>
          ) : null}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.text }]}>Select Categories</Text>
        <Pressable
          style={[styles.selectAllBtn, { borderColor: theme.border }]}
          onPress={selectAllCategories}
        >
          <Text style={[styles.selectAllText, { color: theme.primary }]}>
            {selectedCategories.length === allCategories.length ? "Deselect All" : "Select All"}
          </Text>
        </Pressable>

        <View style={styles.categoryGrid}>
          {allCategories.map((cat) => {
            const info = CATEGORY_INFO[cat];
            const isSelected = selectedCategories.includes(cat);
            return (
              <Pressable
                key={cat}
                style={[
                  styles.categoryChip,
                  {
                    backgroundColor: isSelected ? info.color : theme.card,
                    borderColor: isSelected ? info.color : theme.border,
                  },
                ]}
                onPress={() => toggleCategory(cat)}
              >
                <Feather
                  name={info.icon as any}
                  size={16}
                  color={isSelected ? "#FFFFFF" : info.color}
                />
                <Text
                  style={[
                    styles.categoryChipText,
                    { color: isSelected ? "#FFFFFF" : theme.text },
                  ]}
                >
                  {info.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.text, marginTop: Spacing.xl }]}>
          Difficulty Level
        </Text>
        <View style={styles.difficultyRow}>
          <Pressable
            style={[
              styles.difficultyChip,
              {
                backgroundColor: selectedDifficulty === "all" ? theme.primary : theme.card,
                borderColor: selectedDifficulty === "all" ? theme.primary : theme.border,
              },
            ]}
            onPress={() => setSelectedDifficulty("all")}
          >
            <Text
              style={[
                styles.difficultyText,
                { color: selectedDifficulty === "all" ? "#FFFFFF" : theme.text },
              ]}
            >
              All Levels
            </Text>
          </Pressable>
          {(Object.keys(DIFFICULTY_INFO) as TriviaDifficulty[]).map((diff) => {
            const info = DIFFICULTY_INFO[diff];
            const isSelected = selectedDifficulty === diff;
            return (
              <Pressable
                key={diff}
                style={[
                  styles.difficultyChip,
                  {
                    backgroundColor: isSelected ? info.color : theme.card,
                    borderColor: isSelected ? info.color : theme.border,
                  },
                ]}
                onPress={() => setSelectedDifficulty(diff)}
              >
                <Text
                  style={[
                    styles.difficultyText,
                    { color: isSelected ? "#FFFFFF" : theme.text },
                  ]}
                >
                  {info.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionLabel, { color: theme.text, marginTop: Spacing.xl }]}>
          Number of Questions
        </Text>
        <View style={styles.countRow}>
          {countOptions.map((count) => (
            <Pressable
              key={count}
              style={[
                styles.countChip,
                {
                  backgroundColor: questionCount === count ? theme.primary : theme.card,
                  borderColor: questionCount === count ? theme.primary : theme.border,
                },
              ]}
              onPress={() => setQuestionCount(count)}
            >
              <Text
                style={[
                  styles.countText,
                  { color: questionCount === count ? "#FFFFFF" : theme.text },
                ]}
              >
                {count}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[styles.infoCard, { backgroundColor: theme.card }]}>
          <Feather name="info" size={16} color={theme.textSecondary} />
          <Text style={[styles.infoText, { color: theme.textSecondary }]}>
            {availableCount} questions available for selected filters
          </Text>
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <Pressable
          style={({ pressed }) => [
            styles.startButton,
            { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 },
          ]}
          onPress={startQuiz}
        >
          <Feather name="play" size={22} color="#FFFFFF" />
          <Text style={styles.startButtonText}>Start Quiz</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  heroCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#FFFFFF",
    marginTop: Spacing.sm,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    marginTop: Spacing.xs,
    lineHeight: 20,
  },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    marginTop: Spacing.md,
  },
  streakText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sectionLabel: {
    fontSize: 17,
    fontWeight: "700",
    marginBottom: Spacing.sm,
  },
  selectAllBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  selectAllText: { fontSize: 13, fontWeight: "600" },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    gap: Spacing.xs,
  },
  categoryChipText: { fontSize: 13, fontWeight: "600" },
  difficultyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  difficultyChip: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  difficultyText: { fontSize: 14, fontWeight: "600" },
  countRow: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  countChip: {
    width: 52,
    height: 44,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  countText: { fontSize: 16, fontWeight: "700" },
  infoCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  infoText: { fontSize: 13, flex: 1 },
  bottomBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  startButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
  },
  startButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
