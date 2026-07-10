import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { getApiUrl } from "@/lib/queryClient";
import { Spacing, BorderRadius } from "@/constants/theme";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

// ─── Suggested questions ─────────────────────────────────────────────────────

const SUGGESTIONS = [
  "How does Smart Dictation work?",
  "What languages can I dictate in?",
  "How do I set up my team department?",
  "How does the handover chat work?",
  "What is included in every plan?",
  "How do I document a pediatric case?",
  "How does Clinical Decision Support work?",
  "How do I export a case as PDF?",
];

const OPENING_MESSAGE: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    "Hi! I'm ErMate Guide. Ask me anything about how to use the app — Smart Dictation, team setup, handovers, pediatric cases, plans, exports. You name it.\n\nOr tap one of the suggested questions below to get started.",
};

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function UserGuideScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState<ChatMessage[]>([OPENING_MESSAGE]);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 120);
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;

      setInputText("");
      setShowSuggestions(false);

      const userMsg: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: trimmed,
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setSending(true);
      scrollToBottom();

      try {
        const res = await fetch(
          new URL("/api/guide/chat", getApiUrl()).toString(),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: updatedMessages.map((m) => ({
                role: m.role,
                content: m.content,
              })),
            }),
          }
        );

        const data = await res.json();
        const reply = data.reply || data.error || "Something went wrong. Please try again.";

        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: reply,
          },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "assistant",
            content: "Network error. Please check your connection and try again.",
          },
        ]);
      } finally {
        setSending(false);
        scrollToBottom();
      }
    },
    [messages, sending, scrollToBottom]
  );

  const handleSend = () => sendMessage(inputText);
  const handleSuggestion = (q: string) => sendMessage(q);

  // ─── Render bubble ──────────────────────────────────────────────────────────

  const renderItem = ({ item }: { item: ChatMessage }) => {
    const isUser = item.role === "user";
    return (
      <View
        style={[
          s.bubbleRow,
          isUser ? s.bubbleRowUser : s.bubbleRowAssistant,
        ]}
      >
        {!isUser ? (
          <View style={[s.avatar, { backgroundColor: theme.primary + "18" }]}>
            <Feather name="book" size={14} color={theme.primary} />
          </View>
        ) : null}
        <View
          style={[
            s.bubble,
            isUser
              ? [s.bubbleUser, { backgroundColor: theme.primary }]
              : [s.bubbleAssistant, { backgroundColor: theme.card, borderColor: theme.border }],
          ]}
        >
          <Text
            style={[
              s.bubbleText,
              { color: isUser ? "#ffffff" : theme.text },
            ]}
          >
            {item.content}
          </Text>
        </View>
      </View>
    );
  };

  // ─── Typing indicator ───────────────────────────────────────────────────────

  const TypingIndicator = () => (
    <View style={[s.bubbleRow, s.bubbleRowAssistant]}>
      <View style={[s.avatar, { backgroundColor: theme.primary + "18" }]}>
        <Feather name="book" size={14} color={theme.primary} />
      </View>
      <View style={[s.bubble, s.bubbleAssistant, { backgroundColor: theme.card, borderColor: theme.border }]}>
        <ActivityIndicator size="small" color={theme.primary} />
      </View>
    </View>
  );

  // ─── Suggestions footer ─────────────────────────────────────────────────────

  const SuggestionsBlock = () => (
    <View style={s.suggestionsWrap}>
      <Text style={[s.suggestionsLabel, { color: theme.textMuted }]}>
        Suggested questions
      </Text>
      <View style={s.suggestions}>
        {SUGGESTIONS.map((q) => (
          <Pressable
            key={q}
            style={({ pressed }) => [
              s.suggestion,
              {
                backgroundColor: theme.card,
                borderColor: theme.primary + "40",
                opacity: pressed ? 0.7 : 1,
              },
            ]}
            onPress={() => handleSuggestion(q)}
          >
            <Text style={[s.suggestionText, { color: theme.primary }]}>{q}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <KeyboardAvoidingView
      style={[s.root, { backgroundColor: theme.backgroundDefault }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={insets.top + 56}
    >
      {/* Message list */}
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingTop: insets.top + 64,
          paddingBottom: 16,
          paddingHorizontal: Spacing.md,
          gap: 10,
        }}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={scrollToBottom}
        ListFooterComponent={
          <>
            {sending ? <TypingIndicator /> : null}
            {showSuggestions && !sending ? <SuggestionsBlock /> : null}
          </>
        }
      />

      {/* Input bar */}
      <View
        style={[
          s.inputBar,
          {
            backgroundColor: theme.card,
            borderTopColor: theme.border,
            paddingBottom: insets.bottom + 8,
          },
        ]}
      >
        <TextInput
          style={[
            s.input,
            {
              backgroundColor: theme.backgroundDefault,
              borderColor: theme.border,
              color: theme.text,
            },
          ]}
          placeholder="Ask anything about ErMate…"
          placeholderTextColor={theme.textMuted}
          value={inputText}
          onChangeText={setInputText}
          multiline
          maxLength={600}
          onSubmitEditing={handleSend}
          blurOnSubmit={false}
        />
        <Pressable
          style={({ pressed }) => [
            s.sendBtn,
            {
              backgroundColor:
                !inputText.trim() || sending
                  ? theme.primary + "50"
                  : theme.primary,
              opacity: pressed ? 0.8 : 1,
            },
          ]}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}
        >
          <Feather name="send" size={16} color="#ffffff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  bubbleRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    maxWidth: "90%",
  },
  bubbleRowUser: { alignSelf: "flex-end", flexDirection: "row-reverse" },
  bubbleRowAssistant: { alignSelf: "flex-start" },

  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },

  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    flexShrink: 1,
  },
  bubbleUser: { borderBottomRightRadius: 4 },
  bubbleAssistant: { borderWidth: 1, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 14, lineHeight: 21 },

  suggestionsWrap: { marginTop: 16 },
  suggestionsLabel: { fontSize: 11, fontWeight: "600", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 },
  suggestions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  suggestion: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  suggestionText: { fontSize: 13, fontWeight: "500" },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
    paddingHorizontal: Spacing.md,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 14,
    maxHeight: 100,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
});
