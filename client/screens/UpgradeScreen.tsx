import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

type RouteProps = RouteProp<RootStackParamList, "Upgrade">;
type BillingCycle = "monthly" | "annual";

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
}

type PlanId = "free" | "base" | "pro";

interface FeatureItem {
  text: string;
  ok: boolean;
  bold?: boolean;
  credit?: boolean;
}
interface FeatureSection {
  label?: string;
  labelColor?: string;
  items: FeatureItem[];
}
interface Plan {
  id: PlanId;
  name: string;
  monthlyPrice: string;
  monthlyRaw: number;
  annualPrice: string;
  annualRaw: number;
  annualEquiv: string;
  annualSavings: string;
  tag?: string;
  tagColor?: string;
  description: string;
  accent: string;
  accentBg: string;
  isDark: boolean;
  ctaDisabled: boolean;
  icon: keyof typeof Feather.glyphMap;
  sections: FeatureSection[];
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: "₹0",
    monthlyRaw: 0,
    annualPrice: "₹0",
    annualRaw: 0,
    annualEquiv: "₹0",
    annualSavings: "₹0",
    description: "Try ErMate with your first 10 cases.",
    accent: "#9CA3AF",
    accentBg: "rgba(156,163,175,0.10)",
    isDark: false,
    ctaDisabled: true,
    icon: "clipboard",
    sections: [
      {
        items: [
          { text: "10 cases total", ok: true },
          { text: "Smart Dictation", ok: true },
          { text: "AI Discharge Summary", ok: true },
          { text: "PDF / WhatsApp export", ok: true },
          { text: "Trivia & EM Reference", ok: true },
          { text: "Unlimited cases", ok: false },
          { text: "Clinical Decision Support", ok: false },
          { text: "Rounds & Case Debrief", ok: false },
        ],
      },
    ],
  },
  {
    id: "base",
    name: "Base",
    monthlyPrice: "₹799",
    monthlyRaw: 799,
    annualPrice: "₹7,990",
    annualRaw: 7990,
    annualEquiv: "₹666",
    annualSavings: "₹1,598",
    tag: "MOST POPULAR",
    tagColor: "#1DB870",
    description: "Unlimited documentation. No credit walls on core features.",
    accent: "#1DB870",
    accentBg: "rgba(30,184,112,0.10)",
    isDark: false,
    ctaDisabled: false,
    icon: "zap",
    sections: [
      {
        label: "Always included — no credits needed",
        labelColor: "#1DB870",
        items: [
          { text: "Unlimited case documentation", ok: true },
          { text: "Smart Dictation", ok: true, bold: true },
          { text: "AI Discharge Summary", ok: true, bold: true },
          { text: "PDF / WhatsApp export", ok: true },
          { text: "Trivia & EM Reference", ok: true },
          { text: "Paediatric drug calculator", ok: true },
          { text: "Priority support", ok: true },
        ],
      },
      {
        label: "Clinical Intelligence — uses AI credits",
        labelColor: "#9CA3AF",
        items: [
          { text: "Clinical Decision Support (15/month)", ok: true, credit: true },
          { text: "Document OCR Scanning (10/month)", ok: true, credit: true },
          { text: "ABG / VBG Interpretation", ok: true, credit: true },
        ],
      },
      {
        label: "Not included",
        labelColor: "#C4C9D4",
        items: [
          { text: "Rounds & Case Debrief", ok: false },
          { text: "All 7 Thinking Lenses", ok: false },
          { text: "Clinical Memory", ok: false },
        ],
      },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: "₹1,199",
    monthlyRaw: 1199,
    annualPrice: "₹11,990",
    annualRaw: 11990,
    annualEquiv: "₹999",
    annualSavings: "₹2,398",
    tag: "FOR GROWTH",
    tagColor: "#818CF8",
    description: "Everything in Base, plus clinical growth built into every shift.",
    accent: "#818CF8",
    accentBg: "rgba(129,140,248,0.12)",
    isDark: true,
    ctaDisabled: false,
    icon: "layers",
    sections: [
      {
        label: "Everything in Base, plus:",
        labelColor: "#818CF8",
        items: [
          { text: "Rounds — debrief after every case", ok: true, bold: true },
          { text: "Post-save Learning Nudge", ok: true, bold: true },
          { text: "Clinical Memory — full career history", ok: true, bold: true },
          { text: "All 7 thinking lenses", ok: true },
          { text: "Disease Snapshot for any diagnosis", ok: true },
          { text: "Unlimited Clinical Decision Support", ok: true },
          { text: "Unlimited Document Scanning", ok: true },
          { text: "Unlimited EM Reference queries", ok: true },
        ],
      },
    ],
  },
];

const CREDIT_PACKS = [
  { label: "50 Credits", price: "₹499", per: "₹10 / credit", popular: false },
  { label: "100 Credits", price: "₹899", per: "₹9 / credit", popular: true },
  { label: "300 Credits", price: "₹2,499", per: "₹8.3 / credit", popular: false },
];

const COMPARISON_ROWS = [
  { feature: "Cases", free: "10 total", base: "Unlimited", pro: "Unlimited" },
  { feature: "Smart Dictation", free: "Yes", base: "Always", pro: "Always" },
  { feature: "Discharge Summary", free: "Yes", base: "Always", pro: "Always" },
  { feature: "PDF / WhatsApp", free: "Yes", base: "Yes", pro: "Yes" },
  { feature: "Trivia & Learn", free: "Yes", base: "Yes", pro: "Yes" },
  { feature: "Decision Support", free: "—", base: "15/mo", pro: "Unlimited" },
  { feature: "Document Scan", free: "—", base: "10/mo", pro: "Unlimited" },
  { feature: "Rounds", free: "—", base: "—", pro: "Yes" },
  { feature: "Clinical Memory", free: "—", base: "—", pro: "Yes" },
  { feature: "All 7 Lenses", free: "—", base: "—", pro: "Yes" },
];

const ALWAYS_FREE = [
  "Manual typing & editing",
  "Case save & storage",
  "View cases & dashboard",
  "Export to PDF / DOCX",
  "Browse EM Reference library",
  "Simulation cases & Trivia",
];

const ROUNDS_POINTS = [
  "Every case becomes a learning session",
  "7 thinking lenses — First Principles to Full Debrief",
  "Clinical memory across your entire career",
  "Post-save nudge — learn in 2 min after every shift",
  "10 free debriefs to try before you pay",
];

export default function UpgradeScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { theme, isDark: isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user, token } = useAuth();

  const { lockReason, lockMessage } = route.params || {};
  const [subStatus, setSubStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [ctaLoading, setCtaLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("base");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPack, setSelectedPack] = useState(1);
  const [showComparison, setShowComparison] = useState(false);

  const scaleAnims = useRef(PLANS.map(() => new Animated.Value(1))).current;
  const toggleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchSubscriptionStatus();
  }, []);

  const fetchSubscriptionStatus = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const url = new URL(
        `/api/subscription/status?userId=${encodeURIComponent(user.id)}&userEmail=${encodeURIComponent(user.email || "")}`,
        getApiUrl()
      ).href;
      const res = await fetch(url);
      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch {
        data = { plan: "free", casesUsed: 0, casesLimit: 10, casesRemaining: 10, status: "active", credits_balance: 0 };
      }
      setSubStatus(data);
      if (data.plan === "pro") setSelectedPlan("pro");
      else if (data.plan === "premium" || data.plan === "base") setSelectedPlan("base");
      else setSelectedPlan("base");
    } catch { }
    finally { setLoading(false); }
  };

  const handlePlanSelect = (planId: PlanId, index: number) => {
    setSelectedPlan(planId);
    Animated.sequence([
      Animated.timing(scaleAnims[index], { toValue: 0.97, duration: 80, useNativeDriver: true }),
      Animated.spring(scaleAnims[index], { toValue: 1, useNativeDriver: true, tension: 200, friction: 10 }),
    ]).start();
  };

  const handleBillingToggle = (cycle: BillingCycle) => {
    setBillingCycle(cycle);
    Animated.timing(toggleAnim, {
      toValue: cycle === "annual" ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  };

  const handleSubscribe = async (plan: PlanId, cycle: BillingCycle) => {
    if (plan === "free") return;
    setCtaLoading(true);
    try {
      const url = new URL("/api/subscription/create-checkout", getApiUrl()).href;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ plan, billingCycle: cycle }),
      });
      const data = await res.json();

      if (data.url) {
        await WebBrowser.openBrowserAsync(data.url);
      } else {
        const planObj = PLANS.find(p => p.id === plan)!;
        const priceStr = cycle === "annual"
          ? `${planObj.annualPrice}/year (${planObj.annualEquiv}/mo)`
          : `${planObj.monthlyPrice}/month`;
        Alert.alert(
          "Start Free Trial",
          `Get your first month of ${planObj.name} completely FREE — no charges for 30 days!\n\nPayment integration is being set up. For early access, contact support@ermate.app to activate your ${cycle === "annual" ? "annual" : "monthly"} plan at ${priceStr}.`,
          [{ text: "OK" }]
        );
      }
    } catch {
      Alert.alert("Something went wrong", "Please try again or contact support@ermate.app");
    } finally {
      setCtaLoading(false);
    }
  };

  const handleBuyCredits = async () => {
    setCtaLoading(true);
    try {
      const url = new URL("/api/subscription/create-credit-order", getApiUrl()).href;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ packIndex: selectedPack }),
      });
      const data = await res.json();
      if (data.url) {
        await WebBrowser.openBrowserAsync(data.url);
      } else {
        Alert.alert("Something went wrong", "Please try again or contact support@ermate.app");
      }
    } catch {
      Alert.alert("Something went wrong", "Please try again or contact support@ermate.app");
    } finally {
      setCtaLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { backgroundColor: theme.backgroundDefault }]}>
        <ActivityIndicator size="large" color="#1DB870" />
      </View>
    );
  }

  const casesUsed = subStatus?.casesUsed ?? 0;
  const casesLimit = subStatus?.casesLimit ?? 10;
  const usagePct = Math.min(1, casesUsed / Math.max(1, casesLimit));
  const limitReached = casesUsed >= casesLimit;
  const activePlan = PLANS.find(p => p.id === selectedPlan)!;
  const isAnnual = billingCycle === "annual";

  const ctaLabel = activePlan.id === "free"
    ? "Current Plan"
    : `Start ${activePlan.name} — Free for 1st Month`;

  const stickySubtext = activePlan.id !== "free"
    ? isAnnual
      ? `Free for 30 days · Then ${activePlan.annualPrice}/year (${activePlan.annualEquiv}/mo) · Save ${activePlan.annualSavings}`
      : `Free for 30 days · Then ${activePlan.monthlyPrice}/month · Cancel anytime`
    : null;

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? "#0D1117" : "#F5F6F8" }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + 12,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 120,
        }}
        showsVerticalScrollIndicator={false}
      >
        {lockReason ? (
          <View style={[styles.lockBanner, { backgroundColor: "#FEF2F2" }]}>
            <Feather name="lock" size={18} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.lockTitle, { color: "#EF4444" }]}>{lockReason}</Text>
              {lockMessage ? <Text style={[styles.lockMsg, { color: theme.text }]}>{lockMessage}</Text> : null}
            </View>
          </View>
        ) : null}

        <View style={[styles.usageCard, { backgroundColor: isDarkMode ? "#161B22" : "#FFFFFF" }]}>
          <View style={styles.usageRow}>
            <Text style={[styles.usageLabel, { color: theme.textSecondary }]}>Your usage</Text>
            <Text style={[styles.usageStatus, { color: limitReached ? "#EF4444" : "#1DB870" }]}>
              {limitReached ? "Limit reached" : `${casesLimit - casesUsed} remaining`}
            </Text>
          </View>
          <View style={styles.barBg}>
            <View style={[styles.barFill, { width: `${usagePct * 100}%`, backgroundColor: limitReached ? "#EF4444" : "#1DB870" }]} />
          </View>
          <Text style={[styles.usageText, { color: theme.textMuted }]}>{casesUsed} of {casesLimit} free cases used</Text>
        </View>

        <View style={[styles.billingToggleContainer, { backgroundColor: isDarkMode ? "#161B22" : "#FFFFFF" }]}>
          <Pressable
            onPress={() => handleBillingToggle("monthly")}
            style={[
              styles.billingToggleTab,
              !isAnnual && { backgroundColor: isDarkMode ? "#2D333B" : "#F3F4F6" },
            ]}
          >
            <Text style={[
              styles.billingToggleText,
              { color: !isAnnual ? (isDarkMode ? "#FFFFFF" : "#0D1117") : theme.textMuted },
              !isAnnual && { fontWeight: "700" },
            ]}>
              Monthly
            </Text>
          </Pressable>
          <Pressable
            onPress={() => handleBillingToggle("annual")}
            style={[
              styles.billingToggleTab,
              isAnnual && { backgroundColor: "#1DB870" },
            ]}
          >
            <Text style={[
              styles.billingToggleText,
              { color: isAnnual ? "#FFFFFF" : theme.textMuted },
              isAnnual && { fontWeight: "700" },
            ]}>
              Annual
            </Text>
            <View style={[styles.saveBadge, { backgroundColor: isAnnual ? "rgba(255,255,255,0.25)" : "rgba(29,184,112,0.12)" }]}>
              <Text style={[styles.saveBadgeText, { color: isAnnual ? "#FFFFFF" : "#1DB870" }]}>
                2 months free
              </Text>
            </View>
          </Pressable>
        </View>

        <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Choose your plan</Text>

        {PLANS.map((plan, pi) => {
          const isSelected = selectedPlan === plan.id;
          return (
            <Animated.View key={plan.id} style={{ transform: [{ scale: scaleAnims[pi] }], marginBottom: 12 }}>
              <Pressable
                onPress={() => handlePlanSelect(plan.id, pi)}
                style={[
                  styles.planCard,
                  {
                    backgroundColor: plan.isDark ? "#0D1117" : (isDarkMode ? "#161B22" : "#FFFFFF"),
                    borderColor: isSelected ? plan.accent : plan.isDark ? "rgba(129,140,248,0.20)" : (isDarkMode ? "#2D333B" : "#F0F0F0"),
                    borderWidth: isSelected ? 2 : plan.isDark ? 1.5 : 1.5,
                    shadowColor: plan.accent,
                    shadowOpacity: isSelected ? 0.18 : 0,
                    shadowRadius: 16,
                    shadowOffset: { width: 0, height: 6 },
                    elevation: isSelected ? 6 : 1,
                  },
                ]}
              >
                {plan.tag ? (
                  <View style={[styles.tagRow, {
                    backgroundColor: plan.isDark ? "rgba(129,140,248,0.08)" : `${plan.accent}12`,
                    borderBottomColor: plan.isDark ? "rgba(129,140,248,0.10)" : `${plan.accent}18`,
                  }]}>
                    <Text style={[styles.tagText, { color: plan.tagColor ?? plan.accent }]}>{plan.tag}</Text>
                    {isSelected && (
                      <View style={[styles.selectedDot, { backgroundColor: plan.accent }]}>
                        <Feather name="check" size={10} color="#FFFFFF" />
                      </View>
                    )}
                  </View>
                ) : null}

                <View style={styles.planBody}>
                  <View style={styles.priceHeader}>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.planName, { color: plan.isDark ? "rgba(255,255,255,0.35)" : theme.textMuted }]}>
                        {plan.name.toUpperCase()}
                      </Text>
                      {plan.id === "free" ? (
                        <Text style={[styles.priceMain, { color: isDarkMode ? "#FFFFFF" : "#0D1117" }]}>₹0</Text>
                      ) : (
                        <>
                          <View style={styles.priceRow}>
                            <Text style={[styles.priceStrike, { color: plan.isDark ? "rgba(255,255,255,0.22)" : "#C4C9D4" }]}>
                              {isAnnual ? plan.annualPrice : plan.monthlyPrice}
                            </Text>
                            <Text style={[styles.priceFree, { color: plan.accent }]}>FREE</Text>
                            <Text style={[styles.priceSub, { color: plan.isDark ? "rgba(255,255,255,0.35)" : theme.textMuted }]}>
                              1st month
                            </Text>
                          </View>
                          {isAnnual ? (
                            <>
                              <Text style={[styles.priceAfter, { color: plan.isDark ? "rgba(255,255,255,0.28)" : theme.textMuted }]}>
                                Then {plan.annualEquiv}/mo · billed {plan.annualPrice}/year
                              </Text>
                              <View style={styles.savingsRow}>
                                <View style={[styles.savingsPill, { backgroundColor: `${plan.accent}18` }]}>
                                  <Feather name="tag" size={10} color={plan.accent} />
                                  <Text style={[styles.savingsText, { color: plan.accent }]}>
                                    Save {plan.annualSavings}/year
                                  </Text>
                                </View>
                              </View>
                            </>
                          ) : (
                            <Text style={[styles.priceAfter, { color: plan.isDark ? "rgba(255,255,255,0.28)" : theme.textMuted }]}>
                              Then {plan.monthlyPrice}/month · Cancel anytime
                            </Text>
                          )}
                        </>
                      )}
                    </View>
                    <View style={[styles.iconBox, { backgroundColor: plan.accentBg, borderColor: `${plan.accent}30` }]}>
                      <Feather name={plan.icon} size={20} color={plan.accent} />
                    </View>
                  </View>

                  <Text style={[styles.planDesc, { color: plan.isDark ? "rgba(255,255,255,0.40)" : theme.textSecondary }]}>
                    {plan.description}
                  </Text>

                  <View style={[styles.divider, { backgroundColor: plan.isDark ? "rgba(255,255,255,0.07)" : (isDarkMode ? "#2D333B" : "#F3F4F6") }]} />

                  {plan.sections.map((sec, si) => (
                    <View key={si} style={{ marginBottom: si < plan.sections.length - 1 ? 14 : 0 }}>
                      {sec.label ? (
                        <Text style={[styles.secLabel, { color: sec.labelColor ?? theme.textMuted }]}>
                          {sec.label.toUpperCase()}
                        </Text>
                      ) : null}
                      {sec.items.map((item, ii) => (
                        <View key={ii} style={styles.featureRow}>
                          {item.ok ? (
                            item.credit ? (
                              <View style={[styles.iconCircle, { backgroundColor: `${plan.accent}18` }]}>
                                <Feather name="zap" size={10} color={plan.accent} />
                              </View>
                            ) : (
                              <View style={[styles.iconCircle, { backgroundColor: `${plan.accent}18` }]}>
                                <Feather name="check" size={10} color={plan.accent} />
                              </View>
                            )
                          ) : (
                            <View style={[styles.iconCircle, { backgroundColor: "rgba(0,0,0,0.04)" }]}>
                              <Feather name="x" size={10} color="#C4C9D4" />
                            </View>
                          )}
                          <Text style={[
                            styles.featureText,
                            {
                              color: !item.ok
                                ? "#C4C9D4"
                                : plan.isDark
                                ? item.bold ? "#FFFFFF" : "rgba(255,255,255,0.55)"
                                : item.bold ? (isDarkMode ? "#FFFFFF" : "#0D1117") : theme.textSecondary,
                              fontWeight: item.bold ? "600" : "400",
                            },
                          ]}>
                            {item.text}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>

                <Pressable
                  onPress={() => {
                    if (!plan.ctaDisabled) {
                      handlePlanSelect(plan.id, pi);
                      handleSubscribe(plan.id, billingCycle);
                    }
                  }}
                  style={[styles.cardCTA, {
                    backgroundColor: plan.ctaDisabled
                      ? (isDarkMode ? "#2D333B" : "#F3F4F6")
                      : plan.isDark
                      ? "#6366F1"
                      : "#1DB870",
                    shadowColor: plan.ctaDisabled ? "transparent" : plan.isDark ? "#6366F1" : "#1DB870",
                    shadowOpacity: plan.ctaDisabled ? 0 : 0.3,
                    shadowRadius: 10,
                    shadowOffset: { width: 0, height: 4 },
                  }]}
                >
                  {!plan.ctaDisabled && (
                    <Feather name="gift" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                  )}
                  <Text style={[styles.cardCTAText, {
                    color: plan.ctaDisabled ? (isDarkMode ? "#6B7280" : "#9CA3AF") : "#FFFFFF",
                  }]}>
                    {plan.ctaDisabled
                      ? "Current Plan"
                      : `Start ${plan.name} — Free for 1st Month`}
                  </Text>
                </Pressable>
              </Pressable>
            </Animated.View>
          );
        })}

        <Pressable
          onPress={() => setShowComparison(v => !v)}
          style={styles.compareToggle}
        >
          <Text style={styles.compareToggleText}>
            {showComparison ? "Hide comparison" : "Compare all plans"}
          </Text>
          <Feather name={showComparison ? "chevron-up" : "chevron-down"} size={14} color="#1DB870" />
        </Pressable>

        {showComparison && (
          <View style={[styles.compareTable, { backgroundColor: isDarkMode ? "#161B22" : "#FFFFFF", borderColor: isDarkMode ? "#2D333B" : "#F0F0F0" }]}>
            <View style={[styles.tableHeader, { backgroundColor: isDarkMode ? "#0D1117" : "#F9FAFB", borderBottomColor: isDarkMode ? "#2D333B" : "#F0F0F0" }]}>
              {["Feature", "Free", "Base", "Pro"].map((h, i) => (
                <Text key={i} style={[
                  styles.tableHeaderCell,
                  { flex: i === 0 ? 1.6 : 1, textAlign: i === 0 ? "left" : "center" },
                  { color: i === 3 ? "#818CF8" : i === 2 ? "#1DB870" : theme.textMuted },
                ]}>{h}</Text>
              ))}
            </View>
            {COMPARISON_ROWS.map((row, i) => (
              <View key={i} style={[
                styles.tableRow,
                { backgroundColor: i % 2 === 0 ? "transparent" : (isDarkMode ? "rgba(255,255,255,0.02)" : "#FAFAFA") },
                i < COMPARISON_ROWS.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDarkMode ? "#2D333B" : "#F5F5F5" },
              ]}>
                <Text style={[styles.tableFeature, { flex: 1.6, color: theme.text }]}>{row.feature}</Text>
                <Text style={[styles.tableCell, { flex: 1, color: row.free === "—" ? "#C4C9D4" : theme.textSecondary }]}>{row.free}</Text>
                <Text style={[styles.tableCell, { flex: 1, color: row.base === "—" ? "#C4C9D4" : "#1DB870", fontWeight: row.base !== "—" ? "600" : "400" }]}>{row.base}</Text>
                <Text style={[styles.tableCell, { flex: 1, color: row.pro === "—" ? "#C4C9D4" : "#818CF8", fontWeight: row.pro !== "—" ? "700" : "400" }]}>{row.pro}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.roundsCallout, { borderColor: "rgba(129,140,248,0.22)" }]}>
          <View style={styles.roundsCalloutHeader}>
            <Feather name="layers" size={15} color="#818CF8" />
            <Text style={styles.roundsCalloutTitle}>What Rounds gives you</Text>
          </View>
          {ROUNDS_POINTS.map((pt, i) => (
            <View key={i} style={styles.roundsPoint}>
              <Text style={styles.roundsArrow}>→</Text>
              <Text style={styles.roundsPointText}>{pt}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.creditPackCard, { backgroundColor: isDarkMode ? "#161B22" : "#FFFFFF", borderColor: isDarkMode ? "#2D333B" : "#F0F0F0" }]}>
          <Text style={[styles.creditPackTitle, { color: isDarkMode ? "#FFFFFF" : "#0D1117" }]}>AI Credit Packs</Text>
          <Text style={[styles.creditPackSub, { color: theme.textMuted }]}>Base plan only · Top up Clinical Intelligence · Never expire</Text>
          {CREDIT_PACKS.map((pack, i) => (
            <Pressable
              key={i}
              onPress={() => setSelectedPack(i)}
              style={[styles.packRow, {
                backgroundColor: selectedPack === i ? (isDarkMode ? "rgba(29,184,112,0.10)" : "#F0FDF6") : "transparent",
                borderColor: selectedPack === i ? "#1DB870" : (isDarkMode ? "#2D333B" : "#F0F0F0"),
              }]}
            >
              <View style={styles.packLeft}>
                <View style={[styles.radio, {
                  borderColor: selectedPack === i ? "#1DB870" : "#D1D5DB",
                  backgroundColor: selectedPack === i ? "#1DB870" : "transparent",
                }]}>
                  {selectedPack === i && <View style={styles.radioDot} />}
                </View>
                <View>
                  <Text style={[styles.packLabel, { color: isDarkMode ? "#FFFFFF" : "#0D1117" }]}>{pack.label}</Text>
                  <Text style={[styles.packPer, { color: theme.textMuted }]}>{pack.per}</Text>
                </View>
              </View>
              <View style={styles.packRight}>
                {pack.popular && (
                  <View style={styles.bestValueBadge}>
                    <Text style={styles.bestValueText}>BEST VALUE</Text>
                  </View>
                )}
                <Text style={[styles.packPrice, { color: isDarkMode ? "#FFFFFF" : "#0D1117" }]}>{pack.price}</Text>
              </View>
            </Pressable>
          ))}
          <Pressable style={styles.buyCreditsBtn} onPress={handleBuyCredits}>
            <Feather name="zap" size={14} color="#FFFFFF" />
            <Text style={styles.buyCreditsBtnText}>Buy {CREDIT_PACKS[selectedPack].label}</Text>
          </Pressable>
          <View style={[styles.creditNote, { backgroundColor: isDarkMode ? "#0D1117" : "#F9FAFB" }]}>
            <Text style={[styles.creditNoteText, { color: theme.textMuted }]}>
              Credits power Clinical Decision Support, Document Scanning, ABG Interpretation, and EM Reference. Smart Dictation and Discharge Summary are always free on any paid plan.
            </Text>
          </View>
        </View>

        <View style={[styles.alwaysFreeCard, { backgroundColor: isDarkMode ? "#161B22" : "#FFFFFF", borderColor: isDarkMode ? "#2D333B" : "#F0F0F0" }]}>
          <Text style={[styles.alwaysFreeLabel, { color: theme.textMuted }]}>ALWAYS FREE · NO PLAN NEEDED</Text>
          {ALWAYS_FREE.map((f, i) => (
            <View key={i} style={[styles.alwaysFreeRow, i > 0 && { marginTop: 10 }]}>
              <Feather name="unlock" size={13} color="#C4C9D4" />
              <Text style={[styles.alwaysFreeText, { color: theme.textSecondary }]}>{f}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.stickyBottom, {
        backgroundColor: isDarkMode ? "rgba(13,17,23,0.96)" : "rgba(245,246,248,0.96)",
        borderTopColor: isDarkMode ? "#2D333B" : "rgba(0,0,0,0.06)",
        paddingBottom: Math.max(insets.bottom, 16),
      }]}>
        <Pressable
          style={({ pressed }) => [
            styles.stickyCTA,
            {
              backgroundColor: activePlan.ctaDisabled
                ? (isDarkMode ? "#2D333B" : "#E5E7EB")
                : activePlan.isDark
                ? "#6366F1"
                : "#1DB870",
              opacity: (pressed && !activePlan.ctaDisabled) || ctaLoading ? 0.88 : 1,
              shadowColor: activePlan.ctaDisabled ? "transparent" : activePlan.isDark ? "#6366F1" : "#1DB870",
              shadowOpacity: activePlan.ctaDisabled ? 0 : 0.38,
              shadowRadius: 16,
              shadowOffset: { width: 0, height: 6 },
              elevation: activePlan.ctaDisabled ? 0 : 8,
            },
          ]}
          onPress={() => handleSubscribe(selectedPlan, billingCycle)}
          disabled={activePlan.ctaDisabled || ctaLoading}
        >
          {ctaLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" style={{ marginRight: 8 }} />
          ) : !activePlan.ctaDisabled ? (
            <Feather name="gift" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
          ) : null}
          <Text style={[styles.stickyCTAText, {
            color: activePlan.ctaDisabled ? (isDarkMode ? "#6B7280" : "#9CA3AF") : "#FFFFFF",
          }]}>
            {ctaLoading ? "Setting up..." : ctaLabel}
          </Text>
        </Pressable>
        {stickySubtext ? (
          <Text style={[styles.stickySubtext, { color: theme.textMuted }]}>
            {stickySubtext}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },

  lockBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 14, borderRadius: 14, marginBottom: 14,
  },
  lockTitle: { fontSize: 14, fontWeight: "700" },
  lockMsg: { fontSize: 13, marginTop: 3 },

  usageCard: {
    borderRadius: 16, padding: 16, marginBottom: 14,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  usageRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  usageLabel: { fontSize: 13, fontWeight: "600" },
  usageStatus: { fontSize: 12, fontWeight: "700" },
  barBg: { height: 7, backgroundColor: "#F3F4F6", borderRadius: 99, overflow: "hidden", marginBottom: 7 },
  barFill: { height: "100%", borderRadius: 99 },
  usageText: { fontSize: 12 },

  billingToggleContainer: {
    flexDirection: "row", borderRadius: 14, padding: 4,
    marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  billingToggleTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, paddingVertical: 10, borderRadius: 10,
  },
  billingToggleText: { fontSize: 14 },
  saveBadge: {
    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3,
  },
  saveBadgeText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.2 },

  sectionLabel: {
    fontSize: 11, fontWeight: "700", letterSpacing: 1.2,
    textTransform: "uppercase", marginBottom: 12, marginTop: 4,
  },

  planCard: {
    borderRadius: 20, overflow: "hidden",
  },
  tagRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 8,
    borderBottomWidth: 1,
  },
  tagText: { fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  selectedDot: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  planBody: { padding: 18, paddingBottom: 4 },
  priceHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  planName: { fontSize: 11, fontWeight: "700", letterSpacing: 1.2, marginBottom: 5 },
  priceMain: { fontSize: 30, fontWeight: "900", letterSpacing: -1 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" },
  priceStrike: { fontSize: 13, fontWeight: "500", textDecorationLine: "line-through" },
  priceFree: { fontSize: 30, fontWeight: "900", letterSpacing: -1 },
  priceSub: { fontSize: 13 },
  priceAfter: { fontSize: 12, marginTop: 3 },
  savingsRow: { marginTop: 6 },
  savingsPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-start", borderRadius: 20, paddingHorizontal: 9, paddingVertical: 4,
  },
  savingsText: { fontSize: 11, fontWeight: "700" },
  iconBox: {
    width: 42, height: 42, borderRadius: 13,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, flexShrink: 0,
  },
  planDesc: { fontSize: 13, lineHeight: 20, marginBottom: 14 },
  divider: { height: 1, marginBottom: 14 },
  secLabel: {
    fontSize: 9, fontWeight: "800", letterSpacing: 0.9,
    textTransform: "uppercase", marginBottom: 10,
  },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  iconCircle: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center", flexShrink: 0,
  },
  featureText: { fontSize: 13, flex: 1, lineHeight: 18 },

  cardCTA: {
    margin: 14, marginTop: 10, borderRadius: 12, paddingVertical: 13,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
  },
  cardCTAText: { fontSize: 13, fontWeight: "700" },

  compareToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 8, marginBottom: 12,
  },
  compareToggleText: { fontSize: 13, fontWeight: "600", color: "#1DB870" },

  compareTable: {
    borderRadius: 20, overflow: "hidden", borderWidth: 1.5, marginBottom: 14,
  },
  tableHeader: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 12, paddingHorizontal: 14,
    borderBottomWidth: 1,
  },
  tableHeaderCell: { fontSize: 10, fontWeight: "700", letterSpacing: 0.8, textTransform: "uppercase" },
  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 10, paddingHorizontal: 14 },
  tableFeature: { fontSize: 12, fontWeight: "500" },
  tableCell: { fontSize: 11, textAlign: "center" },

  roundsCallout: {
    backgroundColor: "#0D1117", borderRadius: 20, padding: 20,
    borderWidth: 1, marginBottom: 14,
  },
  roundsCalloutHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  roundsCalloutTitle: { fontSize: 13, fontWeight: "700", color: "#818CF8" },
  roundsPoint: { flexDirection: "row", gap: 8, marginBottom: 8 },
  roundsArrow: { color: "#818CF8", fontWeight: "700", fontSize: 13, flexShrink: 0, marginTop: 1 },
  roundsPointText: { fontSize: 13, color: "rgba(255,255,255,0.50)", lineHeight: 20, flex: 1 },

  creditPackCard: {
    borderRadius: 20, padding: 18, borderWidth: 1.5, marginBottom: 14,
  },
  creditPackTitle: { fontSize: 15, fontWeight: "800", letterSpacing: -0.3, marginBottom: 3 },
  creditPackSub: { fontSize: 13, marginBottom: 14 },
  packRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 2, borderRadius: 13, padding: 13, marginBottom: 8,
  },
  packLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  radio: {
    width: 18, height: 18, borderRadius: 9, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  radioDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: "#FFFFFF" },
  packLabel: { fontSize: 14, fontWeight: "600" },
  packPer: { fontSize: 11, marginTop: 1 },
  packRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  bestValueBadge: {
    backgroundColor: "rgba(30,184,112,0.12)", borderRadius: 5, paddingHorizontal: 7, paddingVertical: 3,
  },
  bestValueText: { fontSize: 9, fontWeight: "800", color: "#1DB870", letterSpacing: 0.5 },
  packPrice: { fontSize: 15, fontWeight: "800" },
  buyCreditsBtn: {
    backgroundColor: "#1DB870", borderRadius: 12, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, marginBottom: 12, marginTop: 4,
  },
  buyCreditsBtnText: { fontSize: 14, fontWeight: "700", color: "#FFFFFF" },
  creditNote: { borderRadius: 10, padding: 12 },
  creditNoteText: { fontSize: 12, lineHeight: 18 },

  alwaysFreeCard: {
    borderRadius: 20, padding: 18, borderWidth: 1.5, marginBottom: 8,
  },
  alwaysFreeLabel: {
    fontSize: 10, fontWeight: "700", letterSpacing: 1.2,
    textTransform: "uppercase", marginBottom: 14,
  },
  alwaysFreeRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  alwaysFreeText: { fontSize: 13 },

  stickyBottom: {
    borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 12,
  },
  stickyCTA: {
    borderRadius: 14, paddingVertical: 15,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
  },
  stickyCTAText: { fontSize: 15, fontWeight: "700" },
  stickySubtext: { fontSize: 11, textAlign: "center", marginTop: 8 },
});
