import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  Linking,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type RouteProps = RouteProp<RootStackParamList, "Upgrade">;

const PLANS = [
  {
    id: "free",
    name: "Free",
    price: "0",
    period: "forever",
    features: [
      "5 cases per month",
      "Basic triage",
      "Manual data entry",
      "Standard support",
    ],
    color: TriageColors.gray,
    recommended: false,
  },
  {
    id: "basic",
    name: "Basic",
    price: "499",
    period: "month",
    features: [
      "50 cases per month",
      "Voice input",
      "AI data extraction",
      "Basic analytics",
      "Email support",
    ],
    color: TriageColors.blue,
    recommended: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "999",
    period: "month",
    features: [
      "Unlimited cases",
      "All Basic features",
      "AI diagnosis suggestions",
      "Red flag alerts",
      "Discharge summary AI",
      "Priority support",
    ],
    color: TriageColors.green,
    recommended: true,
  },
  {
    id: "hospital",
    name: "Hospital",
    price: "Custom",
    period: "",
    features: [
      "Everything in Pro",
      "Multi-user access",
      "Admin dashboard",
      "Custom integrations",
      "Dedicated support",
      "On-premise option",
    ],
    color: TriageColors.orange,
    recommended: false,
  },
];

export default function UpgradeScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const { lockReason, lockMessage } = route.params || {};
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);

  const handleSelectPlan = (planId: string) => {
    setSelectedPlan(planId);
  };

  const handleSubscribe = () => {
    if (!selectedPlan) {
      Alert.alert("Select a Plan", "Please select a subscription plan");
      return;
    }

    if (selectedPlan === "free") {
      navigation.goBack();
      return;
    }

    if (selectedPlan === "hospital") {
      Alert.alert("Contact Sales", "Our team will reach out to discuss custom pricing.", [
        { text: "OK" },
      ]);
      return;
    }

    Alert.alert(
      "Payment",
      "Payment integration coming soon! For now, please contact support@ermate.app",
      [{ text: "OK" }]
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.lg, paddingBottom: insets.bottom + Spacing["4xl"] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {lockReason && (
          <View style={[styles.lockBanner, { backgroundColor: theme.warningLight }]}>
            <Feather name="lock" size={20} color={theme.warning} />
            <View style={styles.lockText}>
              <Text style={[styles.lockTitle, { color: theme.warning }]}>{lockReason}</Text>
              {lockMessage && (
                <Text style={[styles.lockMessage, { color: theme.text }]}>{lockMessage}</Text>
              )}
            </View>
          </View>
        )}

        <Text style={[styles.heading, { color: theme.text }]}>Choose Your Plan</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Unlock powerful features to streamline your ER workflow
        </Text>

        {PLANS.map((plan) => (
          <Pressable
            key={plan.id}
            style={({ pressed }) => [
              styles.planCard,
              {
                backgroundColor: theme.card,
                borderColor: selectedPlan === plan.id ? plan.color : theme.border,
                borderWidth: selectedPlan === plan.id ? 2 : 1,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
            onPress={() => handleSelectPlan(plan.id)}
          >
            {plan.recommended && (
              <View style={[styles.recommendedBadge, { backgroundColor: plan.color }]}>
                <Text style={styles.recommendedText}>RECOMMENDED</Text>
              </View>
            )}

            <View style={styles.planHeader}>
              <View>
                <Text style={[styles.planName, { color: theme.text }]}>{plan.name}</Text>
                <View style={styles.priceRow}>
                  {plan.price !== "Custom" && (
                    <Text style={[styles.currency, { color: theme.textSecondary }]}>Rs.</Text>
                  )}
                  <Text style={[styles.price, { color: plan.color }]}>{plan.price}</Text>
                  {plan.period && (
                    <Text style={[styles.period, { color: theme.textSecondary }]}>/{plan.period}</Text>
                  )}
                </View>
              </View>
              <View
                style={[
                  styles.radioOuter,
                  { borderColor: selectedPlan === plan.id ? plan.color : theme.border },
                ]}
              >
                {selectedPlan === plan.id && (
                  <View style={[styles.radioInner, { backgroundColor: plan.color }]} />
                )}
              </View>
            </View>

            <View style={styles.featuresContainer}>
              {plan.features.map((feature, index) => (
                <View key={index} style={styles.featureRow}>
                  <Feather name="check" size={16} color={plan.color} />
                  <Text style={[styles.featureText, { color: theme.text }]}>{feature}</Text>
                </View>
              ))}
            </View>
          </Pressable>
        ))}

        <Pressable
          style={({ pressed }) => [
            styles.subscribeBtn,
            { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleSubscribe}
        >
          <Text style={styles.subscribeBtnText}>
            {selectedPlan === "free"
              ? "Continue with Free"
              : selectedPlan === "hospital"
              ? "Contact Sales"
              : "Subscribe Now"}
          </Text>
        </Pressable>

        <Text style={[styles.terms, { color: theme.textMuted }]}>
          By subscribing, you agree to our Terms of Service and Privacy Policy
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
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
  planCard: {
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    position: "relative",
    overflow: "hidden",
  },
  recommendedBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderBottomLeftRadius: BorderRadius.sm,
  },
  recommendedText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  planHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  planName: { ...Typography.h4 },
  priceRow: { flexDirection: "row", alignItems: "baseline", marginTop: Spacing.xs },
  currency: { ...Typography.body },
  price: { ...Typography.h1 },
  period: { ...Typography.small },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
  },
  radioInner: { width: 12, height: 12, borderRadius: BorderRadius.full },
  featuresContainer: { marginTop: Spacing.lg, gap: Spacing.sm },
  featureRow: { flexDirection: "row", alignItems: "center", gap: Spacing.sm },
  featureText: { ...Typography.small },
  subscribeBtn: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
    marginTop: Spacing.lg,
  },
  subscribeBtnText: { color: "#FFFFFF", ...Typography.h4 },
  terms: { ...Typography.caption, textAlign: "center", marginTop: Spacing.lg },
});
