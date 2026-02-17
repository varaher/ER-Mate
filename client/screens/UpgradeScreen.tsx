import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

type RouteProps = RouteProp<RootStackParamList, "Upgrade">;

interface SubscriptionStatus {
  plan: string;
  status: string;
  casesUsed: number;
  casesLimit: number;
  casesRemaining: number | null;
  currentPeriodEnd: string | null;
  priceInr: number;
  freeCaseLimit: number;
}

export default function UpgradeScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const { lockReason, lockMessage } = route.params || {};
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const fetchSubscriptionStatus = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const baseUrl = getApiUrl();
      const res = await fetch(
        `${baseUrl}/api/subscription/status?userId=${encodeURIComponent(user.id)}&userEmail=${encodeURIComponent(user.email || "")}`
      );
      const data = await res.json();
      setSubStatus(data);
    } catch (err) {
      console.error("Failed to fetch subscription status:", err);
    } finally {
      setLoading(false);
    }
  };

  const isPremium = subStatus?.plan === "premium";
  const casesUsed = subStatus?.casesUsed ?? 0;
  const casesLimit = subStatus?.casesLimit ?? 10;
  const casesRemaining = isPremium ? null : Math.max(0, casesLimit - casesUsed);

  const handleUpgrade = () => {
    Alert.alert(
      "Upgrade to Premium",
      "Payment integration is being set up. For early access, please contact support@ermate.app to activate your premium plan.",
      [{ text: "OK" }]
    );
  };

  const handleManage = () => {
    Alert.alert(
      "Manage Subscription",
      "To manage or cancel your subscription, please contact support@ermate.app",
      [{ text: "OK" }]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.lg, paddingBottom: insets.bottom + Spacing["4xl"] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {lockReason ? (
          <View style={[styles.lockBanner, { backgroundColor: theme.warningLight }]}>
            <Feather name="lock" size={20} color={theme.warning} />
            <View style={styles.lockText}>
              <Text style={[styles.lockTitle, { color: theme.warning }]}>{lockReason}</Text>
              {lockMessage ? (
                <Text style={[styles.lockMessage, { color: theme.text }]}>{lockMessage}</Text>
              ) : null}
            </View>
          </View>
        ) : null}

        <Text style={[styles.heading, { color: theme.text }]}>
          {isPremium ? "Your Premium Plan" : "Upgrade to Premium"}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {isPremium
            ? "You have unlimited access to all features"
            : "Get unlimited cases and full access to all features"}
        </Text>

        {!isPremium ? (
          <View style={[styles.usageCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.usageHeader}>
              <Feather name="bar-chart-2" size={20} color={theme.primary} />
              <Text style={[styles.usageTitle, { color: theme.text }]}>Your Usage</Text>
            </View>
            <View style={styles.usageBarContainer}>
              <View style={[styles.usageBarBg, { backgroundColor: theme.border }]}>
                <View
                  style={[
                    styles.usageBarFill,
                    {
                      backgroundColor: casesRemaining === 0 ? TriageColors.red : theme.primary,
                      width: `${Math.min(100, (casesUsed / casesLimit) * 100)}%`,
                    },
                  ]}
                />
              </View>
            </View>
            <Text style={[styles.usageText, { color: theme.textSecondary }]}>
              {casesUsed} of {casesLimit} free cases used
              {casesRemaining !== null && casesRemaining > 0
                ? ` (${casesRemaining} remaining)`
                : ""}
            </Text>
            {casesRemaining === 0 ? (
              <Text style={[styles.usageWarning, { color: TriageColors.red }]}>
                You have reached your free case limit. Upgrade to continue.
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={[styles.planCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.planLabel, { color: theme.textSecondary }]}>FREE</Text>
          <View style={styles.priceRow}>
            <Text style={[styles.priceAmount, { color: theme.text }]}>Rs. 0</Text>
          </View>
          <View style={styles.featuresList}>
            {[
              `${casesLimit} cases total`,
              "All clinical features",
              "Voice input & AI diagnosis",
              "Document scanning",
              "Export to PDF/DOCX",
            ].map((feature, i) => (
              <View key={i} style={styles.featureRow}>
                <Feather name="check" size={16} color={TriageColors.green} />
                <Text style={[styles.featureText, { color: theme.text }]}>{feature}</Text>
              </View>
            ))}
          </View>
          {!isPremium ? (
            <View style={[styles.currentBadge, { backgroundColor: theme.backgroundDefault }]}>
              <Text style={[styles.currentBadgeText, { color: theme.textSecondary }]}>
                CURRENT PLAN
              </Text>
            </View>
          ) : null}
        </View>

        <View
          style={[
            styles.planCard,
            styles.premiumCard,
            {
              backgroundColor: theme.card,
              borderColor: isPremium ? TriageColors.green : theme.primary,
              borderWidth: 2,
            },
          ]}
        >
          <View style={[styles.recommendedBadge, { backgroundColor: theme.primary }]}>
            <Text style={styles.recommendedText}>
              {isPremium ? "ACTIVE" : "RECOMMENDED"}
            </Text>
          </View>
          <Text style={[styles.planLabel, { color: theme.textSecondary }]}>PREMIUM</Text>
          <View style={styles.priceRow}>
            <Text style={[styles.priceAmount, { color: theme.primary }]}>Rs. 559</Text>
            <Text style={[styles.pricePeriod, { color: theme.textSecondary }]}>/month</Text>
          </View>
          <View style={styles.featuresList}>
            {[
              "Unlimited cases",
              "All clinical features",
              "Voice input & AI diagnosis",
              "Document scanning",
              "Smart Dictation",
              "ABG scan & interpretation",
              "Pediatric drug calculator",
              "Export to PDF/DOCX",
              "Priority support",
            ].map((feature, i) => (
              <View key={i} style={styles.featureRow}>
                <Feather name="check" size={16} color={theme.primary} />
                <Text style={[styles.featureText, { color: theme.text }]}>{feature}</Text>
              </View>
            ))}
          </View>
          {isPremium ? (
            <View style={[styles.currentBadge, { backgroundColor: TriageColors.green + "20" }]}>
              <Text style={[styles.currentBadgeText, { color: TriageColors.green }]}>
                ACTIVE PLAN
              </Text>
            </View>
          ) : null}
        </View>

        {isPremium ? (
          <Pressable
            style={({ pressed }) => [
              styles.manageBtn,
              { backgroundColor: theme.border, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleManage}
          >
            <Text style={[styles.manageBtnText, { color: theme.text }]}>Manage Subscription</Text>
          </Pressable>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.upgradeBtn,
              { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
            ]}
            onPress={handleUpgrade}
          >
            <Feather name="zap" size={20} color="#FFFFFF" />
            <Text style={styles.upgradeBtnText}>Upgrade to Premium - Rs. 559/mo</Text>
          </Pressable>
        )}

        <Text style={[styles.terms, { color: theme.textMuted }]}>
          By subscribing, you agree to our Terms of Service and Privacy Policy.
          Cancel anytime.
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: Spacing.lg },
  lockBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  lockText: { flex: 1 },
  lockTitle: { ...Typography.bodyMedium },
  lockMessage: { ...Typography.small, marginTop: Spacing.xs },
  heading: { ...Typography.h2, marginBottom: Spacing.xs },
  subtitle: { ...Typography.body, marginBottom: Spacing.xl },
  usageCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
  },
  usageHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  usageTitle: { ...Typography.bodyMedium },
  usageBarContainer: { marginBottom: Spacing.sm },
  usageBarBg: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  usageBarFill: {
    height: "100%",
    borderRadius: 4,
  },
  usageText: { ...Typography.small },
  usageWarning: { ...Typography.small, marginTop: Spacing.xs, fontWeight: "600" },
  planCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    position: "relative",
    overflow: "hidden",
  },
  premiumCard: {},
  planLabel: { ...Typography.caption, fontWeight: "700", letterSpacing: 1, marginBottom: Spacing.xs },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginBottom: Spacing.md },
  priceAmount: { fontSize: 32, fontWeight: "700" },
  pricePeriod: { ...Typography.body, marginLeft: Spacing.xs },
  featuresList: { gap: Spacing.sm },
  featureRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  featureText: { ...Typography.small },
  recommendedBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderBottomLeftRadius: BorderRadius.sm,
  },
  recommendedText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  currentBadge: {
    marginTop: Spacing.md,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    alignSelf: "flex-start",
  },
  currentBadgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  upgradeBtn: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  upgradeBtnText: { color: "#FFFFFF", ...Typography.h4 },
  manageBtn: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  manageBtnText: { ...Typography.bodyMedium },
  terms: { ...Typography.caption, textAlign: "center", marginTop: Spacing.lg },
});
