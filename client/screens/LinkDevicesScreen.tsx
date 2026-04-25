import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";

export default function LinkDevicesScreen() {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const [loading, setLoading] = useState(false);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [expiresIn, setExpiresIn] = useState(300);

  useEffect(() => {
    if (expiresIn > 0 && linkCode) {
      const timer = setInterval(() => {
        setExpiresIn((prev) => {
          if (prev <= 1) {
            setLinkCode(null);
            setLinkUrl(null);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [expiresIn, linkCode]);

  const generateLinkCode = async () => {
    if (!user || !token) {
      Alert.alert("Not Signed In", "Please sign in first to generate a link code.");
      return;
    }

    setLoading(true);
    try {
      const baseUrl = getApiUrl();
      const response = await fetch(`${baseUrl}/api/auth/generate-link-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          userEmail: user.email,
          userName: user.name,
          token,
        }),
      });

      const result = await response.json();

      if (result.success && result.data) {
        setLinkCode(result.data.code);
        setLinkUrl(result.data.url);
        setExpiresIn(result.data.expires_in || 300);
      } else {
        throw new Error(result.error || "Failed to generate link code");
      }
    } catch (err: any) {
      Alert.alert(
        "Link Generation Failed",
        err.message || "Unable to generate link code. Please try again.",
        [{ text: "OK" }]
      );
      setLinkCode(null);
      setLinkUrl(null);
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (linkCode) {
      await Clipboard.setStringAsync(linkCode);
      Alert.alert("Copied!", "Link code copied to clipboard.");
    }
  };

  const copyLinkUrl = async () => {
    if (linkUrl) {
      await Clipboard.setStringAsync(linkUrl);
      Alert.alert("Copied!", "Link URL copied to clipboard. Open it in your browser.");
    }
  };

  const openInBrowser = async () => {
    if (linkUrl) {
      if (Platform.OS === "web") {
        window.open(linkUrl, "_blank");
      } else {
        await Linking.openURL(linkUrl);
      }
    }
  };

  const formatExpiry = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + 12, paddingBottom: insets.bottom + 40 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.infoCard, { backgroundColor: theme.primaryLight }]}>
          <Feather name="monitor" size={32} color={theme.primary} />
          <Text style={[styles.infoTitle, { color: theme.primary }]}>Link to Web</Text>
          <Text style={[styles.infoText, { color: theme.text }]}>
            Access ErMate from your computer browser. Your cases sync automatically across all devices.
          </Text>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Generate Link</Text>

          {!linkCode ? (
            <Pressable
              style={({ pressed }) => [
                styles.generateBtn,
                { backgroundColor: theme.primary, opacity: pressed || loading ? 0.8 : 1 },
              ]}
              onPress={generateLinkCode}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Feather name="link" size={20} color="#fff" />
                  <Text style={styles.generateBtnText}>Generate Link Code</Text>
                </>
              )}
            </Pressable>
          ) : (
            <View style={styles.linkCodeContainer}>
              <Pressable onPress={copyCode} style={[styles.codeBox, { backgroundColor: theme.backgroundDefault }]}>
                <Text style={[styles.codeText, { color: theme.primary }]}>{linkCode}</Text>
                <Text style={[styles.expiryText, { color: expiresIn < 60 ? TriageColors.red : theme.textSecondary }]}>
                  Expires in {formatExpiry(expiresIn)}
                </Text>
                <Text style={[styles.tapToCopy, { color: theme.textMuted }]}>Tap to copy code</Text>
              </Pressable>

              <View style={styles.linkActions}>
                <Pressable
                  style={[styles.linkActionBtn, { backgroundColor: theme.primaryLight }]}
                  onPress={copyLinkUrl}
                >
                  <Feather name="copy" size={18} color={theme.primary} />
                  <Text style={[styles.linkActionText, { color: theme.primary }]}>Copy Link</Text>
                </Pressable>
                <Pressable
                  style={[styles.linkActionBtn, { backgroundColor: theme.successLight || theme.primaryLight }]}
                  onPress={openInBrowser}
                >
                  <Feather name="external-link" size={18} color={theme.success || theme.primary} />
                  <Text style={[styles.linkActionText, { color: theme.success || theme.primary }]}>Open Web</Text>
                </Pressable>
              </View>

              <Pressable
                style={[styles.refreshBtn, { borderColor: theme.primary }]}
                onPress={generateLinkCode}
              >
                <Feather name="refresh-cw" size={16} color={theme.primary} />
                <Text style={[styles.refreshText, { color: theme.primary }]}>Generate New Code</Text>
              </Pressable>
            </View>
          )}

          <View style={styles.instructions}>
            <Text style={[styles.instructionTitle, { color: theme.text }]}>How to link:</Text>
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.stepNumberText, { color: theme.primary }]}>1</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.textSecondary }]}>
                On your computer, open{" "}
                <Text style={{ color: theme.primary, fontWeight: "600" }}>er-mate.replit.app/web</Text>
              </Text>
            </View>
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.stepNumberText, { color: theme.primary }]}>2</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.textSecondary }]}>
                Tap the button above to generate your link code
              </Text>
            </View>
            <View style={styles.step}>
              <View style={[styles.stepNumber, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.stepNumberText, { color: theme.primary }]}>3</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.textSecondary }]}>
                Enter the 6-digit code on the web page, or tap "Open Web" to auto-connect
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  infoCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  infoTitle: { ...Typography.h3, marginTop: Spacing.sm },
  infoText: { ...Typography.body, textAlign: "center", marginTop: Spacing.sm },
  section: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: { ...Typography.h4, marginBottom: Spacing.md },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  generateBtnText: { ...Typography.label, color: "#fff" },
  linkCodeContainer: { alignItems: "center" },
  codeBox: {
    alignItems: "center",
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing["3xl"],
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    width: "100%",
  },
  codeText: { fontSize: 32, fontWeight: "700", letterSpacing: 8 },
  expiryText: { ...Typography.small, marginTop: Spacing.sm },
  tapToCopy: { ...Typography.caption, marginTop: Spacing.xs },
  linkActions: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  linkActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  linkActionText: { ...Typography.label },
  refreshBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginTop: Spacing.sm,
  },
  refreshText: { ...Typography.label },
  instructions: { marginTop: Spacing.xl },
  instructionTitle: { ...Typography.label, marginBottom: Spacing.md },
  step: { flexDirection: "row", alignItems: "center", gap: Spacing.md, marginBottom: Spacing.sm },
  stepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  stepNumberText: { ...Typography.label },
  stepText: { ...Typography.body, flex: 1 },
});
