import React, { useState } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Typography, BorderRadius } from "@/constants/theme";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface CollapsibleSectionProps {
  title: string;
  icon?: string;
  iconColor?: string;
  children: React.ReactNode;
  defaultExpanded?: boolean;
  badge?: string;
  badgeColor?: string;
}

export function CollapsibleSection({
  title,
  icon,
  iconColor,
  children,
  defaultExpanded = false,
  badge,
  badgeColor,
}: CollapsibleSectionProps) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(defaultExpanded);

  const toggleExpanded = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.card }]}>
      <Pressable
        onPress={toggleExpanded}
        style={({ pressed }) => [
          styles.header,
          { opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <View style={styles.headerLeft}>
          {icon ? (
            <View
              style={[
                styles.iconCircle,
                { backgroundColor: iconColor || theme.primary },
              ]}
            >
              <Text style={styles.iconText}>{icon}</Text>
            </View>
          ) : null}
          <Text style={[styles.title, { color: iconColor || theme.primary }]}>
            {title}
          </Text>
          {badge ? (
            <View
              style={[
                styles.badge,
                { backgroundColor: badgeColor || theme.textMuted },
              ]}
            >
              <Text style={[styles.badgeText, { color: theme.backgroundDefault }]}>
                {badge}
              </Text>
            </View>
          ) : null}
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={24}
          color={theme.textMuted}
        />
      </Pressable>
      {expanded ? <View style={styles.content}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: Spacing.md,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  iconText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },
  title: {
    ...Typography.h4,
    fontWeight: "600",
  },
  badge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.sm,
  },
  badgeText: {
    ...Typography.small,
    fontWeight: "600",
  },
  content: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
});
