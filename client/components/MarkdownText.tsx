import React from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Feather } from "@expo/vector-icons";

export interface MarkdownColors {
  text: string;
  textSecondary: string;
  primary: string;
  cardElevated: string;
  borderLight: string;
}

function formatInline(text: string, colors: MarkdownColors): React.ReactNode {
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
        <Text key={keyIdx++} style={{ fontWeight: "700", color: colors.text }}>
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
            backgroundColor: colors.cardElevated,
            color: colors.primary,
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

export function renderMarkdown(text: string, colors: MarkdownColors): React.ReactNode[] {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (trimmed.startsWith("### ")) {
      elements.push(
        <Text key={idx} style={[styles.mdH3, { color: colors.text }]}>
          {formatInline(trimmed.slice(4), colors)}
        </Text>
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <Text key={idx} style={[styles.mdH2, { color: colors.text }]}>
          {formatInline(trimmed.slice(3), colors)}
        </Text>
      );
    } else if (trimmed.startsWith("# ")) {
      elements.push(
        <Text key={idx} style={[styles.mdH1, { color: colors.text }]}>
          {formatInline(trimmed.slice(2), colors)}
        </Text>
      );
    } else if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      elements.push(
        <View key={idx} style={styles.mdBullet}>
          <Text style={[styles.mdBulletDot, { color: colors.primary }]}>{"\u2022"}</Text>
          <Text style={[styles.mdText, { color: colors.textSecondary }]}>
            {formatInline(trimmed.slice(2), colors)}
          </Text>
        </View>
      );
    } else if (/^\d+\.\s/.test(trimmed)) {
      const match = trimmed.match(/^(\d+)\.\s(.*)/);
      if (match) {
        elements.push(
          <View key={idx} style={styles.mdBullet}>
            <Text style={[styles.mdNumDot, { color: colors.primary }]}>{match[1]}.</Text>
            <Text style={[styles.mdText, { color: colors.textSecondary }]}>
              {formatInline(match[2], colors)}
            </Text>
          </View>
        );
      }
    } else if (trimmed.startsWith("**References") || trimmed.startsWith("References:")) {
      elements.push(
        <View key={idx} style={[styles.referencesHeader, { borderTopColor: colors.borderLight }]}>
          <Feather name="book-open" size={14} color={colors.primary} />
          <Text style={[styles.mdH3, { color: colors.primary, marginBottom: 0 }]}>References</Text>
        </View>
      );
    } else if (trimmed === "---" || trimmed === "***") {
      elements.push(<View key={idx} style={[styles.mdDivider, { backgroundColor: colors.borderLight }]} />);
    } else if (trimmed.length > 0) {
      elements.push(
        <Text key={idx} style={[styles.mdText, { color: colors.textSecondary }]}>
          {formatInline(trimmed, colors)}
        </Text>
      );
    } else {
      elements.push(<View key={idx} style={{ height: 6 }} />);
    }
  });

  return elements;
}

export default function MarkdownText({ text, colors }: { text: string; colors: MarkdownColors }) {
  return <View>{renderMarkdown(text, colors)}</View>;
}

const styles = StyleSheet.create({
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
});
