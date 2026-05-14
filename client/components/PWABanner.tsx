import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { usePWA } from "@/hooks/usePWA";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Spacing, Typography } from "@/constants/theme";

export function PWABanner() {
  if (Platform.OS !== "web") return null;

  return <PWABannerInner />;
}

function PWABannerInner() {
  const { canInstall, updateAvailable, install, update, dismiss } = usePWA();
  const { theme } = useTheme();

  if (updateAvailable) {
    return (
      <View style={[styles.banner, { backgroundColor: theme.primary }]}>
        <Feather name="refresh-cw" size={15} color="#fff" />
        <Text style={styles.bannerText} numberOfLines={1}>
          New version available
        </Text>
        <Pressable
          onPress={update}
          style={({ pressed }) => [
            styles.actionBtn,
            { backgroundColor: "rgba(255,255,255,0.25)", opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Text style={styles.actionBtnText}>Update Now</Text>
        </Pressable>
      </View>
    );
  }

  if (canInstall) {
    return (
      <View style={[styles.banner, { backgroundColor: "#0f172a" }]}>
        <Feather name="download" size={15} color="#fff" />
        <Text style={styles.bannerText} numberOfLines={1}>
          Install ErMate on your device
        </Text>
        <View style={styles.actions}>
          <Pressable
            onPress={install}
            style={({ pressed }) => [
              styles.actionBtn,
              { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
            ]}
          >
            <Text style={styles.actionBtnText}>Install</Text>
          </Pressable>
          <Pressable
            onPress={dismiss}
            style={styles.dismissBtn}
            hitSlop={8}
          >
            <Feather name="x" size={15} color="rgba(255,255,255,0.6)" />
          </Pressable>
        </View>
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    gap: Spacing.sm,
  },
  bannerText: {
    ...Typography.small,
    color: "#fff",
    flex: 1,
    fontWeight: "500",
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  actionBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: BorderRadius.sm,
  },
  actionBtnText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  dismissBtn: {
    padding: 2,
  },
});
