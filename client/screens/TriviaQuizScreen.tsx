import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Animated,
  Dimensions,
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import {
  TriviaQuestion,
  CATEGORY_INFO,
  DIFFICULTY_INFO,
  getFilteredQuestions,
} from "@/data/triviaQuestions";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = NativeStackScreenProps<RootStackParamList, "TriviaQuiz">["route"];

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export interface QuizAnswer {
  questionId: string;
  selectedOption: number;
  isCorrect: boolean;
  timeTaken: number;
}

export default function TriviaQuizScreen() {
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const { categories, difficulty, questionCount } = route.params;

  const [questions] = useState<TriviaQuestion[]>(() =>
    getFilteredQuestions(categories, difficulty, questionCount)
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [quizStartTime] = useState(Date.now());

  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex === questions.length - 1;
  const progress = (currentIndex + 1) / questions.length;

  const handleSelectOption = (optionIndex: number) => {
    if (showAnswer) return;
    setSelectedOption(optionIndex);
  };

  const handleConfirm = () => {
    if (selectedOption === null) return;
    setShowAnswer(true);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    const timeTaken = (Date.now() - questionStartTime) / 1000;
    const answer: QuizAnswer = {
      questionId: currentQuestion.id,
      selectedOption,
      isCorrect: selectedOption === currentQuestion.correctAnswer,
      timeTaken,
    };
    setAnswers((prev) => [...prev, answer]);
  };

  const handleNext = () => {
    if (isLastQuestion) {
      const totalTime = (Date.now() - quizStartTime) / 1000;
      const finalAnswers = [...answers];
      navigation.replace("TriviaResult", {
        questions: questions.map((q) => q.id),
        answers: finalAnswers,
        totalTime,
        categories,
        difficulty,
      });
      return;
    }

    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
    ]).start();

    setCurrentIndex((prev) => prev + 1);
    setSelectedOption(null);
    setShowAnswer(false);
    setQuestionStartTime(Date.now());
    scrollRef.current?.scrollTo({ y: 0, animated: false });
  };

  const getOptionStyle = (index: number) => {
    if (!showAnswer) {
      if (selectedOption === index) {
        return { backgroundColor: `${theme.primary}20`, borderColor: theme.primary };
      }
      return { backgroundColor: theme.card, borderColor: theme.border };
    }

    if (index === currentQuestion.correctAnswer) {
      return { backgroundColor: "#dcfce720", borderColor: "#22c55e" };
    }
    if (selectedOption === index && index !== currentQuestion.correctAnswer) {
      return { backgroundColor: "#fef2f220", borderColor: "#ef4444" };
    }
    return { backgroundColor: theme.card, borderColor: theme.border };
  };

  const getOptionIcon = (index: number): React.ReactNode => {
    if (!showAnswer) {
      if (selectedOption === index) {
        return <Feather name="check-circle" size={20} color={theme.primary} />;
      }
      return <View style={[styles.optionRadio, { borderColor: theme.border }]} />;
    }

    if (index === currentQuestion.correctAnswer) {
      return <Feather name="check-circle" size={20} color="#22c55e" />;
    }
    if (selectedOption === index) {
      return <Feather name="x-circle" size={20} color="#ef4444" />;
    }
    return <View style={[styles.optionRadio, { borderColor: theme.border }]} />;
  };

  if (!currentQuestion) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No questions available</Text>
      </View>
    );
  }

  const categoryInfo = CATEGORY_INFO[currentQuestion.category];
  const difficultyInfo = DIFFICULTY_INFO[currentQuestion.difficulty];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
        showsVerticalScrollIndicator={true}
        scrollIndicatorInsets={{ bottom: insets.bottom + 80 }}
      >
        <View style={[styles.progressBar, { backgroundColor: theme.card }]}>
          <View
            style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: theme.primary }]}
          />
        </View>

        <View style={styles.topRow}>
          <Text style={[styles.questionCounter, { color: theme.textSecondary }]}>
            {currentIndex + 1} / {questions.length}
          </Text>
          <View style={styles.badges}>
            <View style={[styles.badge, { backgroundColor: `${categoryInfo.color}20` }]}>
              <Text style={[styles.badgeText, { color: categoryInfo.color }]}>{categoryInfo.label}</Text>
            </View>
            <View style={[styles.badge, { backgroundColor: `${difficultyInfo.color}20` }]}>
              <Text style={[styles.badgeText, { color: difficultyInfo.color }]}>{difficultyInfo.label}</Text>
            </View>
          </View>
        </View>

        <Animated.View style={{ opacity: fadeAnim }}>
          {currentQuestion.casePresentation !== "Quick clinical question:" ? (
            <View style={[styles.caseCard, { backgroundColor: theme.card }]}>
              <View style={styles.caseHeader}>
                <Feather name="file-text" size={16} color={theme.primary} />
                <Text style={[styles.caseLabel, { color: theme.primary }]}>Clinical Case</Text>
              </View>
              <Text style={[styles.caseText, { color: theme.text }]}>
                {currentQuestion.casePresentation}
              </Text>
            </View>
          ) : null}

          <Text style={[styles.questionText, { color: theme.text }]}>
            {currentQuestion.question}
          </Text>

          <View style={styles.optionsContainer}>
            {currentQuestion.options.map((option, index) => (
              <Pressable
                key={index}
                style={[styles.optionCard, getOptionStyle(index)]}
                onPress={() => handleSelectOption(index)}
                disabled={showAnswer}
              >
                {getOptionIcon(index)}
                <Text
                  style={[
                    styles.optionText,
                    {
                      color: showAnswer && index === currentQuestion.correctAnswer
                        ? "#22c55e"
                        : showAnswer && selectedOption === index && index !== currentQuestion.correctAnswer
                        ? "#ef4444"
                        : theme.text,
                    },
                  ]}
                >
                  {String.fromCharCode(65 + index)}. {option}
                </Text>
              </Pressable>
            ))}
          </View>

          {showAnswer ? (
            <View style={[styles.explanationCard, { backgroundColor: theme.card }]}>
              <View style={styles.explanationHeader}>
                <Feather
                  name={selectedOption === currentQuestion.correctAnswer ? "check-circle" : "alert-circle"}
                  size={18}
                  color={selectedOption === currentQuestion.correctAnswer ? "#22c55e" : "#ef4444"}
                />
                <Text
                  style={[
                    styles.explanationLabel,
                    {
                      color: selectedOption === currentQuestion.correctAnswer ? "#22c55e" : "#ef4444",
                    },
                  ]}
                >
                  {selectedOption === currentQuestion.correctAnswer ? "Correct!" : "Incorrect"}
                </Text>
              </View>
              <Text style={[styles.explanationText, { color: theme.text }]}>
                {currentQuestion.explanation}
              </Text>
              <View style={[styles.referenceBox, { backgroundColor: theme.backgroundDefault }]}>
                <Feather name="book-open" size={14} color={theme.textMuted} />
                <Text style={[styles.referenceText, { color: theme.textMuted }]}>
                  {currentQuestion.reference}
                </Text>
              </View>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        {!showAnswer ? (
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              {
                backgroundColor: selectedOption !== null ? theme.primary : theme.card,
                opacity: pressed && selectedOption !== null ? 0.9 : 1,
              },
            ]}
            onPress={handleConfirm}
            disabled={selectedOption === null}
          >
            <Text
              style={[
                styles.actionButtonText,
                { color: selectedOption !== null ? "#FFFFFF" : theme.textMuted },
              ]}
            >
              Confirm Answer
            </Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              { backgroundColor: theme.primary, opacity: pressed ? 0.9 : 1 },
            ]}
            onPress={handleNext}
          >
            <Text style={styles.actionButtonText}>
              {isLastQuestion ? "View Results" : "Next Question"}
            </Text>
            <Feather name={isLastQuestion ? "award" : "arrow-right"} size={20} color="#FFFFFF" />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  progressBar: {
    height: 4,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 2,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  questionCounter: {
    fontSize: 14,
    fontWeight: "600",
  },
  badges: {
    flexDirection: "row",
    gap: Spacing.xs,
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.md,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  caseCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md,
  },
  caseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  caseLabel: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  caseText: {
    fontSize: 15,
    lineHeight: 22,
  },
  questionText: {
    fontSize: 17,
    fontWeight: "700",
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  optionsContainer: {
    gap: Spacing.sm,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    gap: Spacing.sm,
  },
  optionRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    marginTop: 1,
  },
  optionText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  explanationCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.xl,
    marginTop: Spacing.lg,
  },
  explanationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  explanationLabel: {
    fontSize: 16,
    fontWeight: "700",
  },
  explanationText: {
    fontSize: 14,
    lineHeight: 21,
    marginBottom: Spacing.md,
  },
  referenceBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.xs,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  referenceText: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
    fontStyle: "italic",
  },
  bottomBar: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.md + 2,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
  },
  actionButtonText: {
    fontSize: 17,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 100,
  },
});
