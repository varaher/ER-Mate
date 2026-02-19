import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  BackHandler,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, TriageColors } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface TopicCategory {
  title: string;
  icon: string;
  topics: string[];
}

type TopicsMap = Record<string, TopicCategory>;

const CATEGORY_COLORS: Record<string, string> = {
  core_knowledge: TriageColors.blue,
  symptomatology: TriageColors.orange,
  basic_physiology: TriageColors.red,
  procedures: TriageColors.green,
  skills: "#8b5cf6",
};

export default function EMReferenceScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  const [view, setView] = useState<"topics" | "chat">("topics");
  const [topics, setTopics] = useState<TopicsMap | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string | undefined>();
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, "helpful" | "not_helpful">>({});
  const [feedbackSending, setFeedbackSending] = useState<string | null>(null);

  useEffect(() => {
    if (view !== "chat") return;

    const unsubscribe = navigation.addListener("beforeRemove", (e) => {
      e.preventDefault();
      setMessages([]);
      setActiveTopic(undefined);
      setView("topics");
      setFeedbackGiven({});
    });

    return unsubscribe;
  }, [view, navigation]);

  useEffect(() => {
    if (view !== "chat") return;

    const onBack = () => {
      setMessages([]);
      setActiveTopic(undefined);
      setView("topics");
      setFeedbackGiven({});
      return true;
    };

    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, [view]);

  useEffect(() => {
    fetchTopics();
  }, []);

  const fetchTopics = async () => {
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/em-reference/topics", baseUrl);
      const res = await fetch(url, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setTopics(data);
      }
    } catch (e) {
      console.error("Failed to fetch topics:", e);
    }
  };

  const sendMessage = useCallback(
    async (text: string, topic?: string) => {
      if (!text.trim() || loading) return;

      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: text.trim(),
      };

      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInputText("");
      setLoading(true);
      setView("chat");

      try {
        const baseUrl = getApiUrl();
        const url = new URL("/api/em-reference/chat", baseUrl);
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            messages: newMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            topic: topic || activeTopic,
          }),
        });

        const data = await res.json();
        const assistantMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: data.response || "Unable to generate response.",
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (e) {
        const errorMsg: Message = {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Connection error. Please try again.",
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setLoading(false);
        setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
      }
    },
    [messages, loading, activeTopic]
  );

  const handleTopicPress = (topic: string) => {
    setActiveTopic(topic);
    sendMessage(`Tell me about ${topic} in emergency medicine.`, topic);
  };

  const submitFeedback = useCallback(
    async (msgId: string, type: "helpful" | "not_helpful") => {
      if (feedbackGiven[msgId] || feedbackSending) return;
      setFeedbackSending(msgId);

      const assistantMsg = messages.find((m) => m.id === msgId);
      const msgIndex = messages.findIndex((m) => m.id === msgId);
      const userMsg = msgIndex > 0 ? messages[msgIndex - 1] : null;

      try {
        const baseUrl = getApiUrl();
        const url = new URL("/api/em-reference/feedback", baseUrl);
        await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            messageId: msgId,
            query: userMsg?.content || "",
            response: assistantMsg?.content || "",
            topic: activeTopic || null,
            feedbackType: type,
          }),
        });
        setFeedbackGiven((prev) => ({ ...prev, [msgId]: type }));
      } catch (e) {
        console.error("Feedback error:", e);
      } finally {
        setFeedbackSending(null);
      }
    },
    [messages, activeTopic, feedbackGiven, feedbackSending]
  );

  const startNewChat = () => {
    setMessages([]);
    setActiveTopic(undefined);
    setView("topics");
    setExpandedCategory(null);
    setFeedbackGiven({});
  };

  const renderMarkdown = (text: string) => {
    const lines = text.split("\n");
    const elements: React.ReactNode[] = [];

    lines.forEach((line, idx) => {
      const trimmed = line.trim();

      if (trimmed.startsWith("### ")) {
        elements.push(
          <Text
            key={idx}
            style={[styles.mdH3, { color: theme.text }]}
          >
            {formatInline(trimmed.slice(4), theme)}
          </Text>
        );
      } else if (trimmed.startsWith("## ")) {
        elements.push(
          <Text
            key={idx}
            style={[styles.mdH2, { color: theme.text }]}
          >
            {formatInline(trimmed.slice(3), theme)}
          </Text>
        );
      } else if (trimmed.startsWith("# ")) {
        elements.push(
          <Text
            key={idx}
            style={[styles.mdH1, { color: theme.text }]}
          >
            {formatInline(trimmed.slice(2), theme)}
          </Text>
        );
      } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
        elements.push(
          <View key={idx} style={styles.mdBullet}>
            <Text style={[styles.mdBulletDot, { color: theme.primary }]}>
              {"\u2022"}
            </Text>
            <Text style={[styles.mdText, { color: theme.textSecondary }]}>
              {formatInline(trimmed.slice(2), theme)}
            </Text>
          </View>
        );
      } else if (/^\d+\.\s/.test(trimmed)) {
        const match = trimmed.match(/^(\d+)\.\s(.*)/);
        if (match) {
          elements.push(
            <View key={idx} style={styles.mdBullet}>
              <Text style={[styles.mdNumDot, { color: theme.primary }]}>
                {match[1]}.
              </Text>
              <Text style={[styles.mdText, { color: theme.textSecondary }]}>
                {formatInline(match[2], theme)}
              </Text>
            </View>
          );
        }
      } else if (trimmed.startsWith("**References") || trimmed.startsWith("References:")) {
        elements.push(
          <View key={idx} style={[styles.referencesHeader, { borderTopColor: theme.borderLight }]}>
            <Feather name="book-open" size={14} color={theme.primary} />
            <Text style={[styles.mdH3, { color: theme.primary, marginBottom: 0 }]}>
              References
            </Text>
          </View>
        );
      } else if (trimmed === "---" || trimmed === "***") {
        elements.push(
          <View key={idx} style={[styles.mdDivider, { backgroundColor: theme.borderLight }]} />
        );
      } else if (trimmed.length > 0) {
        elements.push(
          <Text key={idx} style={[styles.mdText, { color: theme.textSecondary }]}>
            {formatInline(trimmed, theme)}
          </Text>
        );
      } else {
        elements.push(<View key={idx} style={{ height: 6 }} />);
      }
    });

    return elements;
  };

  if (view === "topics") {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
        <View style={[styles.searchBar, { backgroundColor: theme.card }]}>
          <Feather name="search" size={18} color={theme.textMuted} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { color: theme.text }]}
            placeholder="Ask any EM question..."
            placeholderTextColor={theme.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => sendMessage(inputText)}
            returnKeyType="send"
          />
          {inputText.length > 0 ? (
            <Pressable onPress={() => sendMessage(inputText)}>
              <Feather name="arrow-up-circle" size={24} color={theme.primary} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          style={styles.topicsList}
          contentContainerStyle={[styles.topicsContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
          <Text style={[styles.topicsTitle, { color: theme.textSecondary }]}>
            Browse Topics
          </Text>

          {topics ? (
            Object.entries(topics).map(([key, category]) => (
              <View key={key}>
                <Pressable
                  style={({ pressed }) => [
                    styles.categoryHeader,
                    {
                      backgroundColor: theme.card,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                  onPress={() =>
                    setExpandedCategory(expandedCategory === key ? null : key)
                  }
                >
                  <View
                    style={[
                      styles.categoryIcon,
                      { backgroundColor: CATEGORY_COLORS[key] || theme.primary },
                    ]}
                  >
                    <Feather
                      name={category.icon as any}
                      size={18}
                      color="#FFFFFF"
                    />
                  </View>
                  <Text style={[styles.categoryTitle, { color: theme.text }]}>
                    {category.title}
                  </Text>
                  <View style={styles.categoryMeta}>
                    <Text style={[styles.categoryCount, { color: theme.textMuted }]}>
                      {category.topics.length}
                    </Text>
                    <Feather
                      name={expandedCategory === key ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={theme.textMuted}
                    />
                  </View>
                </Pressable>

                {expandedCategory === key ? (
                  <View style={[styles.topicGrid, { backgroundColor: theme.card }]}>
                    {category.topics.map((topic) => (
                      <Pressable
                        key={topic}
                        style={({ pressed }) => [
                          styles.topicChip,
                          {
                            backgroundColor: theme.cardElevated,
                            opacity: pressed ? 0.7 : 1,
                          },
                        ]}
                        onPress={() => handleTopicPress(topic)}
                      >
                        <Text
                          style={[styles.topicChipText, { color: theme.text }]}
                          numberOfLines={2}
                        >
                          {topic}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            ))
          ) : (
            <ActivityIndicator
              size="small"
              color={theme.primary}
              style={{ marginTop: Spacing.xl }}
            />
          )}

          <View style={[styles.quickStart, { backgroundColor: theme.card }]}>
            <Feather name="zap" size={16} color={TriageColors.yellow} />
            <Text style={[styles.quickStartText, { color: theme.textSecondary }]}>
              Tip: Ask any EM question directly using the search bar above
            </Text>
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: theme.backgroundDefault }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 100 : 0}
    >
      {activeTopic ? (
        <View style={[styles.topicBanner, { backgroundColor: theme.card }]}>
          <Feather name="book-open" size={14} color={theme.primary} />
          <Text
            style={[styles.topicBannerText, { color: theme.primary }]}
            numberOfLines={1}
          >
            {activeTopic}
          </Text>
          <Pressable onPress={startNewChat} hitSlop={8}>
            <Feather name="x" size={16} color={theme.textMuted} />
          </Pressable>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.chatArea}
        contentContainerStyle={[styles.chatContent, { paddingBottom: Spacing.md }]}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
      >
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.msgRow,
              msg.role === "user" ? styles.msgRowUser : styles.msgRowAssistant,
            ]}
          >
            {msg.role === "assistant" ? (
              <View style={[styles.aiAvatar, { backgroundColor: theme.primary }]}>
                <Feather name="book" size={14} color="#FFFFFF" />
              </View>
            ) : null}
            <View style={msg.role === "assistant" ? styles.aiBubbleWrap : undefined}>
              <View
                style={[
                  styles.msgBubble,
                  msg.role === "user"
                    ? [styles.userBubble, { backgroundColor: theme.primary }]
                    : [styles.aiBubble, { backgroundColor: theme.card }],
                ]}
              >
                {msg.role === "user" ? (
                  <Text style={[styles.userText, { color: "#FFFFFF" }]}>
                    {msg.content}
                  </Text>
                ) : (
                  <View>{renderMarkdown(msg.content)}</View>
                )}
              </View>
              {msg.role === "assistant" ? (
                <View style={styles.feedbackRow}>
                  {feedbackGiven[msg.id] ? (
                    <View style={styles.feedbackDone}>
                      <Feather
                        name={feedbackGiven[msg.id] === "helpful" ? "thumbs-up" : "thumbs-down"}
                        size={13}
                        color={feedbackGiven[msg.id] === "helpful" ? TriageColors.green : TriageColors.orange}
                      />
                      <Text style={[styles.feedbackDoneText, {
                        color: feedbackGiven[msg.id] === "helpful" ? TriageColors.green : TriageColors.orange,
                      }]}>
                        {feedbackGiven[msg.id] === "helpful" ? "Helpful" : "Not helpful"} - Thanks!
                      </Text>
                    </View>
                  ) : (
                    <>
                      <Text style={[styles.feedbackLabel, { color: theme.textMuted }]}>
                        Was this helpful?
                      </Text>
                      <Pressable
                        onPress={() => submitFeedback(msg.id, "helpful")}
                        disabled={feedbackSending === msg.id}
                        style={({ pressed }) => [
                          styles.feedbackBtn,
                          { backgroundColor: pressed ? theme.card : "transparent" },
                        ]}
                        hitSlop={6}
                      >
                        <Feather name="thumbs-up" size={14} color={theme.textMuted} />
                      </Pressable>
                      <Pressable
                        onPress={() => submitFeedback(msg.id, "not_helpful")}
                        disabled={feedbackSending === msg.id}
                        style={({ pressed }) => [
                          styles.feedbackBtn,
                          { backgroundColor: pressed ? theme.card : "transparent" },
                        ]}
                        hitSlop={6}
                      >
                        <Feather name="thumbs-down" size={14} color={theme.textMuted} />
                      </Pressable>
                    </>
                  )}
                </View>
              ) : null}
            </View>
          </View>
        ))}

        {loading ? (
          <View style={styles.msgRow}>
            <View style={[styles.aiAvatar, { backgroundColor: theme.primary }]}>
              <Feather name="book" size={14} color="#FFFFFF" />
            </View>
            <View style={[styles.loadingBubble, { backgroundColor: theme.card }]}>
              <ActivityIndicator size="small" color={theme.primary} />
              <Text style={[styles.loadingText, { color: theme.textMuted }]}>
                Searching references...
              </Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View
        style={[
          styles.inputBar,
          {
            backgroundColor: theme.backgroundDefault,
            paddingBottom: insets.bottom > 0 ? insets.bottom : Spacing.sm,
          },
        ]}
      >
        <Pressable onPress={startNewChat} style={styles.newChatBtn} hitSlop={8}>
          <Feather name="plus-circle" size={24} color={theme.textMuted} />
        </Pressable>
        <View style={[styles.inputWrapper, { backgroundColor: theme.card }]}>
          <TextInput
            style={[styles.chatInput, { color: theme.text }]}
            placeholder="Ask a follow-up..."
            placeholderTextColor={theme.textMuted}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => sendMessage(inputText)}
            returnKeyType="send"
            multiline
          />
          <Pressable
            onPress={() => sendMessage(inputText)}
            disabled={!inputText.trim() || loading}
            style={{ opacity: inputText.trim() && !loading ? 1 : 0.4 }}
          >
            <Feather name="send" size={20} color={theme.primary} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function formatInline(text: string, theme: any): React.ReactNode {
  const parts: React.ReactNode[] = [];
  const regex = /\*\*(.+?)\*\*|`(.+?)`/g;
  let lastIndex = 0;
  let match;
  let keyIdx = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[1]) {
      parts.push(
        <Text key={keyIdx++} style={{ fontWeight: "700", color: theme.text }}>
          {match[1]}
        </Text>
      );
    } else if (match[2]) {
      parts.push(
        <Text
          key={keyIdx++}
          style={{
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
            fontSize: 13,
            backgroundColor: theme.cardElevated,
            color: theme.primary,
          }}
        >
          {match[2]}
        </Text>
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 44,
    borderRadius: BorderRadius.xl,
    gap: Spacing.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: 44,
  },
  topicsList: {
    flex: 1,
  },
  topicsContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  topicsTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.md,
  },
  categoryIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
  },
  categoryMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  categoryCount: {
    fontSize: 13,
  },
  topicGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    borderBottomLeftRadius: BorderRadius.lg,
    borderBottomRightRadius: BorderRadius.lg,
    marginTop: -Spacing.sm,
  },
  topicChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
  },
  topicChipText: {
    fontSize: 13,
    fontWeight: "500",
  },
  quickStart: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  quickStartText: {
    flex: 1,
    fontSize: 13,
  },
  topicBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
  },
  topicBannerText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
  },
  chatArea: {
    flex: 1,
  },
  chatContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  msgRow: {
    flexDirection: "row",
    marginBottom: Spacing.md,
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  msgRowUser: {
    justifyContent: "flex-end",
  },
  msgRowAssistant: {
    justifyContent: "flex-start",
  },
  aiAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 2,
  },
  msgBubble: {
    maxWidth: "85%",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    borderBottomLeftRadius: 4,
  },
  userText: {
    fontSize: 15,
    lineHeight: 21,
  },
  loadingBubble: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: 13,
  },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.sm,
  },
  newChatBtn: {
    paddingBottom: Spacing.sm,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
    minHeight: 40,
    maxHeight: 120,
  },
  chatInput: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
  },
  mdH1: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
    marginTop: 4,
  },
  mdH2: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
    marginTop: 4,
  },
  mdH3: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 4,
    marginTop: 2,
  },
  mdText: {
    fontSize: 14,
    lineHeight: 20,
    flex: 1,
  },
  mdBullet: {
    flexDirection: "row",
    gap: 6,
    marginBottom: 2,
    paddingLeft: 2,
  },
  mdBulletDot: {
    fontSize: 14,
    lineHeight: 20,
    width: 12,
  },
  mdNumDot: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    width: 20,
  },
  mdDivider: {
    height: 1,
    marginVertical: 8,
  },
  referencesHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    marginBottom: 4,
  },
  aiBubbleWrap: {
    maxWidth: "85%",
    flex: 1,
  },
  feedbackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6,
    paddingLeft: 2,
  },
  feedbackLabel: {
    fontSize: 12,
    marginRight: 2,
  },
  feedbackBtn: {
    padding: 4,
    borderRadius: 12,
  },
  feedbackDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  feedbackDoneText: {
    fontSize: 12,
    fontWeight: "500",
  },
});
