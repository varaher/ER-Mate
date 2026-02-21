import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  TRIVIA_QUESTIONS,
  CATEGORY_INFO,
  DIFFICULTY_INFO,
  TriviaQuestion,
} from "@/data/triviaQuestions";
import type { QuizAnswer } from "./TriviaQuizScreen";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = NativeStackScreenProps<RootStackParamList, "TriviaResult">["route"];

export default function TriviaResultScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const { questions: questionIds, answers, totalTime } = route.params;
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const questions = questionIds
    .map((id) => TRIVIA_QUESTIONS.find((q) => q.id === id))
    .filter(Boolean) as TriviaQuestion[];

  const correctCount = answers.filter((a) => a.isCorrect).length;
  const totalQuestions = questions.length;
  const percentage = Math.round((correctCount / totalQuestions) * 100);
  const totalPoints = answers.reduce((sum, a, i) => {
    const q = questions[i];
    if (!q) return sum;
    return sum + (a.isCorrect ? DIFFICULTY_INFO[q.difficulty].points : 0);
  }, 0);
  const maxPoints = questions.reduce((sum, q) => sum + DIFFICULTY_INFO[q.difficulty].points, 0);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const getGradeInfo = () => {
    if (percentage >= 90) return { grade: "A+", label: "Outstanding!", color: "#22c55e", icon: "award" };
    if (percentage >= 80) return { grade: "A", label: "Excellent!", color: "#22c55e", icon: "star" };
    if (percentage >= 70) return { grade: "B", label: "Good Job!", color: "#3b82f6", icon: "thumbs-up" };
    if (percentage >= 60) return { grade: "C", label: "Fair", color: "#eab308", icon: "trending-up" };
    if (percentage >= 50) return { grade: "D", label: "Needs Improvement", color: "#f97316", icon: "alert-circle" };
    return { grade: "F", label: "Keep Studying!", color: "#ef4444", icon: "book" };
  };

  const gradeInfo = getGradeInfo();

  const toggleExpand = (index: number) => {
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  const categoryStats = questions.reduce((acc, q, i) => {
    const cat = q.category;
    if (!acc[cat]) acc[cat] = { correct: 0, total: 0 };
    acc[cat].total++;
    if (answers[i]?.isCorrect) acc[cat].correct++;
    return acc;
  }, {} as Record<string, { correct: number; total: number }>);

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.scoreCard, { backgroundColor: gradeInfo.color }]}>
          <Feather name={gradeInfo.icon as any} size={48} color="#FFFFFF" />
          <Text style={styles.gradeText}>{gradeInfo.grade}</Text>
          <Text style={styles.gradeLabel}>{gradeInfo.label}</Text>

          <View style={styles.scoreRow}>
            <View style={styles.scoreItem}>
              <Text style={styles.scoreValue}>{correctCount}/{totalQuestions}</Text>
              <Text style={styles.scoreLabel}>Correct</Text>
            </View>
            <View style={[styles.scoreDivider, { backgroundColor: "rgba(255,255,255,0.3)" }]} />
            <View style={styles.scoreItem}>
              <Text style={styles.scoreValue}>{percentage}%</Text>
              <Text style={styles.scoreLabel}>Score</Text>
            </View>
            <View style={[styles.scoreDivider, { backgroundColor: "rgba(255,255,255,0.3)" }]} />
            <View style={styles.scoreItem}>
              <Text style={styles.scoreValue}>{totalPoints}/{maxPoints}</Text>
              <Text style={styles.scoreLabel}>Points</Text>
            </View>
            <View style={[styles.scoreDivider, { backgroundColor: "rgba(255,255,255,0.3)" }]} />
            <View style={styles.scoreItem}>
              <Text style={styles.scoreValue}>{formatTime(totalTime)}</Text>
              <Text style={styles.scoreLabel}>Time</Text>
            </View>
          </View>
        </View>

        {Object.keys(categoryStats).length > 1 ? (
          <View style={[styles.statsCard, { backgroundColor: theme.card }]}>
            <Text style={[styles.statsTitle, { color: theme.text }]}>Category Breakdown</Text>
            {Object.entries(categoryStats).map(([cat, stats]) => {
              const info = CATEGORY_INFO[cat as keyof typeof CATEGORY_INFO];
              const pct = Math.round((stats.correct / stats.total) * 100);
              return (
                <View key={cat} style={styles.statRow}>
                  <View style={styles.statLabel}>
                    <View style={[styles.statDot, { backgroundColor: info.color }]} />
                    <Text style={[styles.statName, { color: theme.text }]}>{info.label}</Text>
                  </View>
                  <View style={styles.statRight}>
                    <View style={[styles.miniBar, { backgroundColor: theme.backgroundDefault }]}>
                      <View
                        style={[styles.miniBarFill, { width: `${pct}%`, backgroundColor: info.color }]}
                      />
                    </View>
                    <Text style={[styles.statScore, { color: theme.textSecondary }]}>
                      {stats.correct}/{stats.total}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        ) : null}

        <Text style={[styles.reviewTitle, { color: theme.text }]}>Question Review</Text>

        {questions.map((question, index) => {
          const answer = answers[index];
          if (!answer) return null;
          const isExpanded = expandedIndex === index;
          const catInfo = CATEGORY_INFO[question.category];
          const diffInfo = DIFFICULTY_INFO[question.difficulty];

          return (
            <Pressable
              key={question.id}
              style={[styles.reviewCard, { backgroundColor: theme.card }]}
              onPress={() => toggleExpand(index)}
            >
              <View style={styles.reviewHeader}>
                <View
                  style={[
                    styles.resultBadge,
                    { backgroundColor: answer.isCorrect ? "#dcfce7" : "#fef2f2" },
                  ]}
                >
                  <Feather
                    name={answer.isCorrect ? "check" : "x"}
                    size={14}
                    color={answer.isCorrect ? "#22c55e" : "#ef4444"}
                  />
                </View>
                <View style={styles.reviewHeaderText}>
                  <Text
                    style={[styles.reviewQuestion, { color: theme.text }]}
                    numberOfLines={isExpanded ? undefined : 2}
                  >
                    Q{index + 1}. {question.question}
                  </Text>
                  <View style={styles.reviewMeta}>
                    <Text style={[styles.reviewMetaText, { color: catInfo.color }]}>
                      {catInfo.label}
                    </Text>
                    <Text style={[styles.reviewMetaDot, { color: theme.textMuted }]}>
                      {" "}
                    </Text>
                    <Text style={[styles.reviewMetaText, { color: diffInfo.color }]}>
                      {diffInfo.label}
                    </Text>
                  </View>
                </View>
                <Feather
                  name={isExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={theme.textMuted}
                />
              </View>

              {isExpanded ? (
                <View style={styles.reviewExpanded}>
                  {question.casePresentation !== "Quick clinical question:" ? (
                    <View style={[styles.reviewCase, { backgroundColor: theme.backgroundDefault }]}>
                      <Text style={[styles.reviewCaseLabel, { color: theme.primary }]}>Case:</Text>
                      <Text style={[styles.reviewCaseText, { color: theme.textSecondary }]}>
                        {question.casePresentation}
                      </Text>
                    </View>
                  ) : null}

                  {question.options.map((opt, optIdx) => {
                    const isCorrectOpt = optIdx === question.correctAnswer;
                    const isSelectedOpt = optIdx === answer.selectedOption;
                    let optBg = "transparent";
                    let optColor = theme.text;
                    if (isCorrectOpt) { optBg = "#dcfce710"; optColor = "#22c55e"; }
                    if (isSelectedOpt && !isCorrectOpt) { optBg = "#fef2f210"; optColor = "#ef4444"; }

                    return (
                      <View
                        key={optIdx}
                        style={[styles.reviewOption, { backgroundColor: optBg }]}
                      >
                        {isCorrectOpt ? (
                          <Feather name="check-circle" size={15} color="#22c55e" />
                        ) : isSelectedOpt ? (
                          <Feather name="x-circle" size={15} color="#ef4444" />
                        ) : (
                          <View style={[styles.reviewRadio, { borderColor: theme.border }]} />
                        )}
                        <Text style={[styles.reviewOptionText, { color: optColor }]}>
                          {String.fromCharCode(65 + optIdx)}. {opt}
                        </Text>
                      </View>
                    );
                  })}

                  <View style={[styles.reviewExplanation, { backgroundColor: theme.backgroundDefault }]}>
                    <Text style={[styles.reviewExpLabel, { color: theme.primary }]}>Explanation:</Text>
                    <Text style={[styles.reviewExpText, { color: theme.text }]}>
                      {question.explanation}
                    </Text>
                    <View style={styles.reviewRefRow}>
                      <Feather name="book-open" size={12} color={theme.textMuted} />
                      <Text style={[styles.reviewRefText, { color: theme.textMuted }]}>
                        {question.reference}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <View style={styles.bottomButtons}>
          <Pressable
            style={({ pressed }) => [
              styles.retryButton,
              { borderColor: theme.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={() => {
              navigation.replace("TriviaQuiz", route.params as any);
            }}
          >
            <Feather name="refresh-cw" size={18} color={theme.primary} />
            <Text style={[styles.retryText, { color: theme.primary }]}>Retry</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.homeButton,
              { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={() => navigation.goBack()}
          >
            <Feather name="home" size={18} color="#FFFFFF" />
            <Text style={styles.homeText}>Back to Learn</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  scoreCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  gradeText: {
    fontSize: 56,
    fontWeight: "900",
    color: "#FFFFFF",
    marginTop: Spacing.sm,
  },
  gradeLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "rgba(255,255,255,0.9)",
    marginBottom: Spacing.lg,
  },
  scoreRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    justifyContent: "space-around",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing.md,
  },
  scoreItem: { alignItems: "center" },
  scoreValue: { fontSize: 18, fontWeight: "800", color: "#FFFFFF" },
  scoreLabel: { fontSize: 11, color: "rgba(255,255,255,0.8)", marginTop: 2 },
  scoreDivider: { width: 1, height: 30 },
  statsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  statsTitle: { fontSize: 16, fontWeight: "700", marginBottom: Spacing.md },
  statRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.sm,
  },
  statLabel: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, flex: 1 },
  statDot: { width: 8, height: 8, borderRadius: 4 },
  statName: { fontSize: 13, fontWeight: "500" },
  statRight: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  miniBar: { width: 60, height: 6, borderRadius: 3, overflow: "hidden" },
  miniBarFill: { height: "100%", borderRadius: 3 },
  statScore: { fontSize: 12, fontWeight: "600", width: 30, textAlign: "right" },
  reviewTitle: { fontSize: 18, fontWeight: "700", marginBottom: Spacing.md },
  reviewCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  resultBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  reviewHeaderText: { flex: 1 },
  reviewQuestion: { fontSize: 14, fontWeight: "600", lineHeight: 19 },
  reviewMeta: { flexDirection: "row", marginTop: 2, alignItems: "center" },
  reviewMetaText: { fontSize: 11, fontWeight: "600" },
  reviewMetaDot: { fontSize: 11 },
  reviewExpanded: { marginTop: Spacing.md, gap: Spacing.sm },
  reviewCase: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  reviewCaseLabel: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  reviewCaseText: { fontSize: 13, lineHeight: 18 },
  reviewOption: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  reviewRadio: {
    width: 15,
    height: 15,
    borderRadius: 7.5,
    borderWidth: 1.5,
    marginTop: 2,
  },
  reviewOptionText: { fontSize: 13, lineHeight: 18, flex: 1 },
  reviewExplanation: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  reviewExpLabel: { fontSize: 12, fontWeight: "700", marginBottom: Spacing.xs },
  reviewExpText: { fontSize: 13, lineHeight: 19, marginBottom: Spacing.sm },
  reviewRefRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
  },
  reviewRefText: { fontSize: 11, lineHeight: 15, flex: 1, fontStyle: "italic" },
  bottomBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  bottomButtons: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  retryButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    gap: Spacing.xs,
  },
  retryText: { fontSize: 15, fontWeight: "700" },
  homeButton: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.xl,
    gap: Spacing.xs,
  },
  homeText: { fontSize: 15, fontWeight: "700", color: "#FFFFFF" },
});
