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
import { useHeaderHeight } from "@react-navigation/elements";
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
  credits_balance?: number;
  total_credits_purchased?: number;
  total_credits_used?: number;
}

const CREDIT_PACKS = [
  { credits: 50, price: 499, popular: false },
  { credits: 100, price: 899, popular: true },
  { credits: 300, price: 2499, popular: false },
];

export default function UpgradeScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
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
      const statusUrl = new URL(`/api/subscription/status?userId=${encodeURIComponent(user.id)}&userEmail=${encodeURIComponent(user.email || "")}`, baseUrl).href;
      const res = await fetch(statusUrl);
      const text = await res.text();
      let data: any;
      try {
        data = JSON.parse(text);
      } catch {
        console.warn("[UpgradeScreen] Subscription status returned non-JSON:", text.substring(0, 200));
        data = { plan: "free", casesUsed: 0, casesLimit: 10, casesRemaining: 10, priceInr: 799, freeCaseLimit: 10, status: "active", currentPeriodEnd: null, credits_balance: 0 };
      }
      setSubStatus(data);
    } catch (err) {
      console.error("Failed to fetch subscription status:", err);
    } finally {
      setLoading(false);
    }
  };

  const isPremium = subStatus?.plan === "premium";
  const creditsBalance = subStatus?.credits_balance ?? 0;
  const casesUsed = subStatus?.casesUsed ?? 0;
  const casesLimit = subStatus?.casesLimit ?? 10;
  const casesRemaining = isPremium ? null : Math.max(0, casesLimit - casesUsed);

  const handleUpgrade = () => {
    Alert.alert(
      "Start Free Trial",
      "Get your first month FREE - no charges for 30 days!\n\nPayment integration is being set up. For early access, please contact support@ermate.app to activate your free trial.",
      [{ text: "OK" }]
    );
  };

  const handleBuyCredits = (pack: typeof CREDIT_PACKS[0]) => {
    Alert.alert(
      "Buy AI Credits",
      `Purchase ${pack.credits} AI credits for Rs. ${pack.price}?\n\nPayment integration is being set up. Please contact support@ermate.app for credit purchases.`,
      [{ text: "Cancel" }, { text: "OK" }]
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
          { paddingTop: headerHeight + 12, paddingBottom: insets.bottom + Spacing["4xl"] },
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
          {isPremium ? "Your Base Plan" : "Upgrade to Base Plan"}
        </Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {isPremium
            ? "Unlimited EMR with AI-powered features"
            : "Get unlimited EMR and 20 AI credits every month"}
        </Text>

        {!isPremium ? (
          <View style={[styles.freeTrialBanner, { backgroundColor: "#ecfdf5", borderColor: TriageColors.green }]}>
            <View style={[styles.freeTrialIcon, { backgroundColor: TriageColors.green }]}>
              <Feather name="gift" size={18} color="#FFFFFF" />
            </View>
            <View style={styles.freeTrialText}>
              <Text style={[styles.freeTrialTitle, { color: "#065f46" }]}>First Month FREE</Text>
              <Text style={[styles.freeTrialDesc, { color: "#047857" }]}>
                Try the full Base Plan free for 30 days. No charge until your second month.
              </Text>
            </View>
          </View>
        ) : null}

        {isPremium ? (
          <View style={[styles.creditsCard, { backgroundColor: theme.card, borderColor: theme.primary }]}>
            <View style={styles.creditsHeader}>
              <Feather name="cpu" size={22} color={theme.primary} />
              <Text style={[styles.creditsTitle, { color: theme.text }]}>AI Credits</Text>
            </View>
            <Text style={[styles.creditsBalance, { color: theme.primary }]}>{creditsBalance}</Text>
            <Text style={[styles.creditsLabel, { color: theme.textSecondary }]}>Credits Remaining</Text>
            {creditsBalance > 0 && creditsBalance <= 10 ? (
              <View style={[styles.creditWarning, { backgroundColor: "#fef3c7" }]}>
                <Feather name="alert-triangle" size={14} color="#d97706" />
                <Text style={styles.creditWarningText}>Low credits - consider buying more</Text>
              </View>
            ) : null}
            {creditsBalance === 0 ? (
              <View style={[styles.creditWarning, { backgroundColor: "#fef2f2" }]}>
                <Feather name="alert-circle" size={14} color="#ef4444" />
                <Text style={[styles.creditWarningText, { color: "#ef4444" }]}>AI Credits exhausted</Text>
              </View>
            ) : null}
            <Text style={[styles.creditsNote, { color: theme.textMuted }]}>
              1 AI Action = 1 Credit  |  Credits never expire
            </Text>
            <Text style={[styles.creditsNote, { color: theme.textMuted }]}>
              +20 credits added every month with active subscription
            </Text>
          </View>
        ) : (
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
        )}

        {!isPremium ? (
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
            <View style={[styles.currentBadge, { backgroundColor: theme.backgroundDefault }]}>
              <Text style={[styles.currentBadgeText, { color: theme.textSecondary }]}>
                CURRENT PLAN
              </Text>
            </View>
          </View>
        ) : null}

        <View
          style={[
            styles.planCard,
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
          <Text style={[styles.planLabel, { color: theme.textSecondary }]}>BASE PLAN</Text>
          <View style={styles.priceRow}>
            {!isPremium ? (
              <>
                <Text style={[styles.priceStrikethrough, { color: theme.textMuted }]}>Rs. 799</Text>
                <Text style={[styles.priceAmount, { color: TriageColors.green }]}>FREE</Text>
                <Text style={[styles.pricePeriod, { color: theme.textSecondary }]}>for 1st month</Text>
              </>
            ) : (
              <>
                <Text style={[styles.priceAmount, { color: theme.primary }]}>Rs. 799</Text>
                <Text style={[styles.pricePeriod, { color: theme.textSecondary }]}>/month</Text>
              </>
            )}
          </View>
          {!isPremium ? (
            <Text style={[styles.priceAfterTrial, { color: theme.textSecondary }]}>
              Then Rs. 799/month. Cancel anytime.
            </Text>
          ) : null}
          <View style={styles.featuresList}>
            {[
              !isPremium ? "First month completely free" : null,
              "Unlimited manual EMR",
              "Case storage",
              "PDF/DOCX export",
              "20 AI credits every month",
              "Credits roll over (never expire)",
              "Voice input & Smart Dictation",
              "AI diagnosis & ABG scan",
              "Document scanning",
              "Pediatric drug calculator",
              "Priority support",
            ].filter(Boolean).map((feature, i) => (
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
          <>
            <Text style={[styles.sectionHeading, { color: theme.text }]}>Buy More AI Credits</Text>
            <Text style={[styles.sectionSubtext, { color: theme.textSecondary }]}>
              Credits are added instantly and never expire
            </Text>

            <View style={styles.packsContainer}>
              {CREDIT_PACKS.map((pack, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.packCard,
                    {
                      backgroundColor: theme.card,
                      borderColor: pack.popular ? theme.primary : theme.border,
                      borderWidth: pack.popular ? 2 : 1,
                      opacity: pressed ? 0.9 : 1,
                    },
                  ]}
                  onPress={() => handleBuyCredits(pack)}
                >
                  {pack.popular ? (
                    <View style={[styles.popularBadge, { backgroundColor: theme.primary }]}>
                      <Text style={styles.popularText}>BEST VALUE</Text>
                    </View>
                  ) : null}
                  <Text style={[styles.packCredits, { color: theme.text }]}>{pack.credits}</Text>
                  <Text style={[styles.packLabel, { color: theme.textSecondary }]}>Credits</Text>
                  <Text style={[styles.packPrice, { color: theme.primary }]}>Rs. {pack.price}</Text>
                  <Text style={[styles.packPer, { color: theme.textMuted }]}>
                    Rs. {(pack.price / pack.credits).toFixed(1)}/credit
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        <View style={[styles.creditInfoCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.creditInfoTitle, { color: theme.text }]}>How AI Credits Work</Text>
          <Text style={[styles.creditInfoSubtitle, { color: theme.primary }]}>Every AI action = 1 Credit. Simple.</Text>

          <Text style={[styles.creditSectionLabel, { color: theme.text }]}>Uses 1 Credit Each:</Text>
          {[
            "Smart Dictation (record & auto-fill)",
            "ABG AI Interpretation",
            "Provisional AI Diagnosis",
            "AI Differential Reasoning Panel",
            "Generate Discharge Summary (AI)",
            "Course in Hospital AI Generation",
            "Document OCR Scan",
          ].map((item, i) => (
            <View key={i} style={styles.creditInfoRow}>
              <Feather name="zap" size={14} color={theme.primary} />
              <Text style={[styles.creditInfoText, { color: theme.textSecondary }]}>{item}</Text>
            </View>
          ))}

          <View style={[styles.creditDivider, { backgroundColor: theme.border }]} />

          <Text style={[styles.creditSectionLabel, { color: theme.text }]}>Always Free (0 Credits):</Text>
          {[
            "Manual typing & editing",
            "Case save & storage",
            "View cases & dashboard",
            "Export to PDF / DOCX",
          ].map((item, i) => (
            <View key={i} style={styles.creditInfoRow}>
              <Feather name="check-circle" size={14} color={TriageColors.green} />
              <Text style={[styles.creditInfoText, { color: theme.textSecondary }]}>{item}</Text>
            </View>
          ))}

          <View style={[styles.creditDivider, { backgroundColor: theme.border }]} />

          <View style={styles.creditInfoRow}>
            <Feather name="refresh-cw" size={14} color={theme.primary} />
            <Text style={[styles.creditInfoText, { color: theme.textSecondary }]}>+20 credits added every month with active subscription</Text>
          </View>
          <View style={styles.creditInfoRow}>
            <Feather name="clock" size={14} color={theme.primary} />
            <Text style={[styles.creditInfoText, { color: theme.textSecondary }]}>Unused credits roll over forever - they never expire</Text>
          </View>
          <View style={styles.creditInfoRow}>
            <Feather name="shield" size={14} color={theme.primary} />
            <Text style={[styles.creditInfoText, { color: theme.textSecondary }]}>Credits usable only while subscription is active</Text>
          </View>
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
            <Feather name="gift" size={20} color="#FFFFFF" />
            <Text style={styles.upgradeBtnText}>Start Free Trial - Rs. 0 for 1st Month</Text>
          </Pressable>
        )}

        <Text style={[styles.terms, { color: theme.textMuted }]}>
          {isPremium
            ? "By subscribing, you agree to our Terms of Service and Privacy Policy. Cancel anytime. Credits remain stored if subscription is paused."
            : "First month is completely free. You will only be charged Rs. 799/month starting from the second month. Cancel anytime during the trial at no cost."}
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
  subtitle: { ...Typography.body, marginBottom: Spacing.md },
  freeTrialBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    marginBottom: Spacing.lg,
    gap: Spacing.md,
  },
  freeTrialIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  freeTrialText: { flex: 1 },
  freeTrialTitle: { fontSize: 16, fontWeight: "700" },
  freeTrialDesc: { ...Typography.small, marginTop: 2 },
  priceStrikethrough: {
    fontSize: 18,
    fontWeight: "500",
    textDecorationLine: "line-through",
    marginRight: Spacing.sm,
  },
  priceAfterTrial: { ...Typography.small, marginBottom: Spacing.md, marginTop: -Spacing.xs },
  creditsCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    marginBottom: Spacing.lg,
    alignItems: "center",
  },
  creditsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  creditsTitle: { ...Typography.bodyMedium, fontSize: 16 },
  creditsBalance: { fontSize: 48, fontWeight: "800" },
  creditsLabel: { ...Typography.small, marginBottom: Spacing.sm },
  creditWarning: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    paddingVertical: Spacing.xs,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
  },
  creditWarningText: { fontSize: 12, fontWeight: "600", color: "#d97706" },
  creditsNote: { ...Typography.caption, marginTop: Spacing.xs, textAlign: "center" },
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
  planLabel: { ...Typography.caption, fontWeight: "700", letterSpacing: 1, marginBottom: Spacing.xs },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginBottom: Spacing.md },
  priceAmount: { fontSize: 32, fontWeight: "700" },
  pricePeriod: { ...Typography.body, marginLeft: Spacing.xs },
  featuresList: { gap: Spacing.sm },
  featureRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  featureText: { ...Typography.small, flex: 1 },
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
  sectionHeading: { ...Typography.h3, marginTop: Spacing.lg, marginBottom: Spacing.xs },
  sectionSubtext: { ...Typography.small, marginBottom: Spacing.md },
  packsContainer: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  packCard: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  popularBadge: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingVertical: 2,
    alignItems: "center",
  },
  popularText: { color: "#FFFFFF", fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  packCredits: { fontSize: 28, fontWeight: "800", marginTop: Spacing.md },
  packLabel: { fontSize: 11, fontWeight: "600", marginBottom: Spacing.sm },
  packPrice: { fontSize: 16, fontWeight: "700" },
  packPer: { fontSize: 10, marginTop: 2 },
  creditInfoCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  creditInfoTitle: { ...Typography.bodyMedium, marginBottom: 0 },
  creditInfoSubtitle: { fontSize: 13, fontWeight: "700", marginBottom: Spacing.md },
  creditSectionLabel: { fontSize: 13, fontWeight: "700", marginBottom: Spacing.xs },
  creditDivider: { height: 1, marginVertical: Spacing.xs },
  creditInfoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
  },
  creditInfoText: { ...Typography.small, flex: 1 },
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
