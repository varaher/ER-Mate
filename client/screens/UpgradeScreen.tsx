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
  Linking,
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
type PlanId = "free" | "base" | "pro";
type ActiveTab = "individual" | "team";

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

interface FeatureItem {
  text: string;
  ok: boolean;
  bold?: boolean;
  credit?: boolean;
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
  tag?: string | null;
  tagColor?: string | null;
  description: string;
  accent: string;
  accentBg: string;
  isDark: boolean;
  ctaDisabled: boolean;
  icon: keyof typeof Feather.glyphMap;
  features: FeatureItem[];
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: "₹0", monthlyRaw: 0,
    annualPrice: "₹0", annualRaw: 0, annualEquiv: "₹0", annualSavings: "₹0",
    tag: null, tagColor: null,
    description: "Try ErMate with your first 10 cases. No card needed.",
    accent: "#9CA3AF", accentBg: "rgba(156,163,175,0.08)",
    isDark: false, ctaDisabled: true,
    icon: "clipboard",
    features: [
      { text: "10 cases total", ok: true },
      { text: "Smart Dictation", ok: true },
      { text: "AI Discharge Summary", ok: true },
      { text: "PDF / WhatsApp export", ok: true },
      { text: "Trivia & EM Reference", ok: true },
      { text: "Unlimited cases", ok: false },
      { text: "Rounds & Clinical Memory", ok: false },
    ],
  },
  {
    id: "base",
    name: "Base",
    monthlyPrice: "₹799", monthlyRaw: 799,
    annualPrice: "₹7,990", annualRaw: 7990, annualEquiv: "₹666", annualSavings: "₹1,598",
    tag: "MOST POPULAR", tagColor: "#1DB870",
    description: "Unlimited documentation. Dictation and discharge always free.",
    accent: "#1DB870", accentBg: "rgba(30,184,112,0.08)",
    isDark: false, ctaDisabled: false,
    icon: "zap",
    features: [
      { text: "Unlimited case documentation", ok: true },
      { text: "Smart Dictation — always free", ok: true, bold: true },
      { text: "AI Discharge Summary — always free", ok: true, bold: true },
      { text: "PDF / WhatsApp export", ok: true },
      { text: "Clinical Decision Support (15/mo)", ok: true, credit: true },
      { text: "Document Scanning (10/mo)", ok: true, credit: true },
      { text: "Rounds — 10 free debriefs", ok: true },
      { text: "Unlimited Rounds & Memory", ok: false },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: "₹1,199", monthlyRaw: 1199,
    annualPrice: "₹11,990", annualRaw: 11990, annualEquiv: "₹999", annualSavings: "₹2,398",
    tag: "FOR GROWTH", tagColor: "#818CF8",
    description: "Everything in Base plus unlimited Rounds and Clinical Memory.",
    accent: "#818CF8", accentBg: "rgba(129,140,248,0.10)",
    isDark: true, ctaDisabled: false,
    icon: "layers",
    features: [
      { text: "Everything in Base", ok: true },
      { text: "Rounds — unlimited debriefs", ok: true, bold: true },
      { text: "All 7 thinking lenses", ok: true, bold: true },
      { text: "Clinical Memory — full career", ok: true, bold: true },
      { text: "Post-save learning nudge", ok: true },
      { text: "Unlimited Decision Support", ok: true },
      { text: "Unlimited Document Scanning", ok: true },
    ],
  },
];

const CREDIT_PACKS_DISPLAY = [
  { label: "50 Credits",  price: "₹499",   per: "₹10 / credit", popular: false },
  { label: "100 Credits", price: "₹899",   per: "₹9 / credit",  popular: true  },
  { label: "300 Credits", price: "₹2,499", per: "₹8.3 / credit",popular: false },
];

const TEAM_FEATURES = [
  { text: "Everything in Pro — for every doctor", bold: true },
  { text: "Shift management — Morning / Evening / Night", bold: true },
  { text: "Case handover between shifts", bold: false },
  { text: "Auto handover sheet — PDF + WhatsApp", bold: false },
  { text: "Consultant escalation module", bold: false },
  { text: "HOD admin dashboard — full access", bold: false },
  { text: "All active cases visible to HOD", bold: false },
  { text: "Department analytics & reports", bold: false },
  { text: "Custom hospital branding on exports", bold: false },
  { text: "Priority WhatsApp support", bold: false },
];

const EXAMPLE_BILLS = [
  { type: "Small clinic / nursing home", consultants: 2, residents: 6 },
  { type: "Mid-size ER", consultants: 8, residents: 28 },
  { type: "Large hospital dept", consultants: 15, residents: 50 },
];

const ALWAYS_FREE = [
  "Manual typing & editing",
  "Case save & storage",
  "View cases & dashboard",
  "Export to PDF / DOCX",
  "Browse EM Reference library",
  "Simulation cases & Trivia",
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
  const [activeTab, setActiveTab] = useState<ActiveTab>("individual");
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("base");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [selectedPack, setSelectedPack] = useState(1);
  const [teamConsultants, setTeamConsultants] = useState(2);
  const [teamResidents, setTeamResidents] = useState(6);

  const scaleAnims = useRef(PLANS.map(() => new Animated.Value(1))).current;

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
        data = { plan: "free", casesUsed: 0, casesLimit: 10, casesRemaining: 10, status: "active" };
      }
      setSubStatus(data);
      if (data.plan === "pro") setSelectedPlan("pro");
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
        Alert.alert("Something went wrong", "Please try again or contact support@ermate.app");
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

  const handleTeamContact = () => {
    const monthly = (teamConsultants * 599) + (teamResidents * 399);
    const annual = (teamConsultants * 5990) + (teamResidents * 3990);
    const bill = billingCycle === "annual"
      ? `₹${annual.toLocaleString("en-IN")}/year (₹${Math.round(annual / 12).toLocaleString("en-IN")}/month)`
      : `₹${monthly.toLocaleString("en-IN")}/month`;
    const subject = encodeURIComponent("ErMate Team Plan Setup");
    const body = encodeURIComponent(
      `Hi ErMate Team,\n\nI'd like to set up the Team Plan for our department.\n\nTeam size:\n- Consultants: ${teamConsultants}\n- Residents: ${teamResidents}\n- Total: ${teamConsultants + teamResidents} doctors\n\nBilling preference: ${billingCycle === "annual" ? "Annual" : "Monthly"}\nEstimated bill: ${bill}\n\nPlease get in touch to set up our account.\n\nThank you`
    );
    Linking.openURL(`mailto:support@ermate.app?subject=${subject}&body=${body}`);
  };

  if (loading) {
    return (
      <View style={[s.container, s.center, { backgroundColor: theme.backgroundDefault }]}>
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

  const teamMonthly = (teamConsultants * 599) + (teamResidents * 399);
  const teamAnnual = (teamConsultants * 5990) + (teamResidents * 3990);
  const teamDisplay = isAnnual ? Math.round(teamAnnual / 12) : teamMonthly;
  const teamSavings = (teamMonthly * 12) - teamAnnual;

  return (
    <View style={[s.container, { backgroundColor: isDarkMode ? "#0D1117" : "#F5F6F8" }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + 12,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 130,
        }}
        showsVerticalScrollIndicator={false}
      >
        {lockReason ? (
          <View style={[s.lockBanner, { backgroundColor: "#FEF2F2" }]}>
            <Feather name="lock" size={18} color="#EF4444" />
            <View style={{ flex: 1 }}>
              <Text style={[s.lockTitle, { color: "#EF4444" }]}>{lockReason}</Text>
              {lockMessage ? <Text style={[s.lockMsg, { color: theme.text }]}>{lockMessage}</Text> : null}
            </View>
          </View>
        ) : null}

        {/* Usage card */}
        <View style={[s.usageCard, { backgroundColor: isDarkMode ? "#161B22" : "#FFFFFF" }]}>
          <View style={s.usageRow}>
            <Text style={[s.usageLabel, { color: theme.textSecondary }]}>Your usage</Text>
            <Text style={[s.usageStatus, { color: limitReached ? "#EF4444" : "#1DB870" }]}>
              {limitReached ? "Limit reached" : `${casesLimit - casesUsed} remaining`}
            </Text>
          </View>
          <View style={s.barBg}>
            <View style={[s.barFill, { width: `${usagePct * 100}%` as any, backgroundColor: limitReached ? "#EF4444" : "#1DB870" }]} />
          </View>
          <Text style={[s.usageText, { color: theme.textMuted }]}>{casesUsed} of {casesLimit} free cases used</Text>
        </View>

        {/* Tab switcher */}
        <View style={[s.tabContainer, { backgroundColor: isDarkMode ? "#161B22" : "#FFFFFF" }]}>
          {([
            { id: "individual" as ActiveTab, label: "Individual" },
            { id: "team" as ActiveTab, label: "Team / Hospital" },
          ]).map(tab => (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[
                s.tab,
                activeTab === tab.id && { backgroundColor: isDarkMode ? "#FFFFFF" : "#0D1117" },
              ]}
            >
              <Feather
                name={tab.id === "individual" ? "user" : "users"}
                size={13}
                color={activeTab === tab.id ? (isDarkMode ? "#0D1117" : "#FFFFFF") : theme.textMuted}
                style={{ marginRight: 5 }}
              />
              <Text style={[
                s.tabText,
                { color: activeTab === tab.id ? (isDarkMode ? "#0D1117" : "#FFFFFF") : theme.textMuted },
                activeTab === tab.id && { fontWeight: "700" },
              ]}>{tab.label}</Text>
            </Pressable>
          ))}
        </View>

        {/* Billing toggle */}
        <View style={[s.billingToggle, { backgroundColor: isDarkMode ? "#161B22" : "#EEF0F2" }]}>
          {(["monthly", "annual"] as BillingCycle[]).map(cycle => (
            <Pressable
              key={cycle}
              onPress={() => setBillingCycle(cycle)}
              style={[
                s.billingTab,
                billingCycle === cycle && { backgroundColor: isDarkMode ? "#2D333B" : "#FFFFFF" },
              ]}
            >
              <Text style={[
                s.billingTabText,
                { color: billingCycle === cycle ? (isDarkMode ? "#FFFFFF" : "#0D1117") : theme.textMuted },
                billingCycle === cycle && { fontWeight: "700" },
              ]}>
                {cycle === "monthly" ? "Monthly" : "Annual"}
              </Text>
              {cycle === "annual" && (
                <View style={[s.saveBadge, {
                  backgroundColor: billingCycle === "annual" ? "rgba(30,184,112,0.15)" : "rgba(156,163,175,0.12)",
                }]}>
                  <Text style={[s.saveBadgeText, {
                    color: billingCycle === "annual" ? "#15924F" : theme.textMuted,
                  }]}>SAVE 17%</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {isAnnual ? (
          <View style={s.annualBanner}>
            <Feather name="gift" size={13} color="#15924F" />
            <Text style={s.annualBannerText}>Annual billing — save 2 months on every plan</Text>
          </View>
        ) : null}

        {/* ── INDIVIDUAL TAB ── */}
        {activeTab === "individual" && (
          <>
            {PLANS.map((plan, pi) => {
              const isSelected = selectedPlan === plan.id;
              return (
                <Animated.View key={plan.id} style={{ transform: [{ scale: scaleAnims[pi] }], marginBottom: 12 }}>
                  <Pressable
                    onPress={() => handlePlanSelect(plan.id, pi)}
                    style={[
                      s.planCard,
                      {
                        backgroundColor: plan.isDark ? "#0D1117" : (isDarkMode ? "#161B22" : "#FFFFFF"),
                        borderColor: isSelected ? plan.accent : plan.isDark ? "rgba(129,140,248,0.20)" : (isDarkMode ? "#2D333B" : "#F0F0F0"),
                        borderWidth: isSelected ? 2 : 1.5,
                        shadowColor: plan.accent,
                        shadowOpacity: isSelected ? 0.18 : 0,
                        shadowRadius: 16,
                        shadowOffset: { width: 0, height: 6 },
                        elevation: isSelected ? 6 : 1,
                      },
                    ]}
                  >
                    {plan.tag ? (
                      <View style={[s.tagRow, {
                        backgroundColor: plan.isDark ? "rgba(129,140,248,0.08)" : `${plan.accent}12`,
                        borderBottomColor: plan.isDark ? "rgba(129,140,248,0.10)" : `${plan.accent}18`,
                      }]}>
                        <Text style={[s.tagText, { color: plan.tagColor ?? plan.accent }]}>{plan.tag}</Text>
                        {isSelected && (
                          <View style={[s.selectedDot, { backgroundColor: plan.accent }]}>
                            <Feather name="check" size={10} color="#FFFFFF" />
                          </View>
                        )}
                      </View>
                    ) : null}

                    <View style={s.planBody}>
                      {/* Price header */}
                      <View style={s.priceHeader}>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.planNameLabel, { color: plan.isDark ? "rgba(255,255,255,0.35)" : theme.textMuted }]}>
                            {plan.name.toUpperCase()}
                          </Text>
                          {plan.id === "free" ? (
                            <Text style={[s.priceMain, { color: isDarkMode ? "#FFFFFF" : "#0D1117" }]}>₹0</Text>
                          ) : (
                            <>
                              {isAnnual ? (
                                <View style={s.priceRow}>
                                  <Text style={[s.priceMain, { color: plan.isDark ? "#FFFFFF" : "#0D1117" }]}>
                                    {plan.annualEquiv}
                                  </Text>
                                  <Text style={[s.pricePer, { color: plan.isDark ? "rgba(255,255,255,0.35)" : theme.textMuted }]}>/mo</Text>
                                </View>
                              ) : (
                                <View style={s.priceRow}>
                                  <Text style={[s.priceStrike, { color: plan.isDark ? "rgba(255,255,255,0.22)" : "#C4C9D4" }]}>
                                    {plan.monthlyPrice}
                                  </Text>
                                  <Text style={[s.priceFree, { color: plan.accent }]}>FREE</Text>
                                  <Text style={[s.pricePer, { color: plan.isDark ? "rgba(255,255,255,0.35)" : theme.textMuted }]}>
                                    1st month
                                  </Text>
                                </View>
                              )}
                              <Text style={[s.priceAfter, { color: plan.isDark ? "rgba(255,255,255,0.28)" : theme.textMuted }]}>
                                {isAnnual
                                  ? `${plan.annualPrice}/year · Save ${plan.annualSavings}`
                                  : `Then ${plan.monthlyPrice}/month · Cancel anytime`}
                              </Text>
                            </>
                          )}
                        </View>
                        <View style={[s.iconBox, { backgroundColor: plan.accentBg, borderColor: `${plan.accent}30` }]}>
                          <Feather name={plan.icon} size={20} color={plan.accent} />
                        </View>
                      </View>

                      <Text style={[s.planDesc, { color: plan.isDark ? "rgba(255,255,255,0.40)" : theme.textSecondary }]}>
                        {plan.description}
                      </Text>

                      <View style={[s.divider, { backgroundColor: plan.isDark ? "rgba(255,255,255,0.07)" : (isDarkMode ? "#2D333B" : "#F3F4F6") }]} />

                      {/* Features */}
                      {plan.features.map((item, ii) => (
                        <View key={ii} style={[s.featureRow, ii > 0 && { marginTop: 9 }]}>
                          {item.ok ? (
                            <View style={[s.iconCircle, { backgroundColor: item.credit ? `${plan.accent}15` : `${plan.accent}18` }]}>
                              <Feather name={item.credit ? "zap" : "check"} size={10} color={plan.accent} />
                            </View>
                          ) : (
                            <View style={[s.iconCircle, { backgroundColor: "rgba(0,0,0,0.04)" }]}>
                              <Feather name="x" size={10} color="#C4C9D4" />
                            </View>
                          )}
                          <Text style={[
                            s.featureText,
                            {
                              color: !item.ok
                                ? "#C4C9D4"
                                : plan.isDark
                                ? (item.bold ? "#FFFFFF" : "rgba(255,255,255,0.55)")
                                : (item.bold ? (isDarkMode ? "#FFFFFF" : "#0D1117") : theme.textSecondary),
                              fontWeight: item.bold ? "600" : "400",
                            },
                          ]}>
                            {item.text}
                          </Text>
                        </View>
                      ))}
                    </View>

                    {!plan.ctaDisabled && (
                      <Pressable
                        onPress={() => {
                          handlePlanSelect(plan.id, pi);
                          handleSubscribe(plan.id, billingCycle);
                        }}
                        style={[s.cardCTA, {
                          backgroundColor: plan.isDark ? "#6366F1" : "#1DB870",
                          shadowColor: plan.isDark ? "#6366F1" : "#1DB870",
                          shadowOpacity: 0.3, shadowRadius: 10,
                          shadowOffset: { width: 0, height: 4 },
                        }]}
                      >
                        <Feather name="gift" size={14} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={s.cardCTAText}>
                          Start {plan.name} — Free for 1st Month
                        </Text>
                      </Pressable>
                    )}
                  </Pressable>
                </Animated.View>
              );
            })}

            {/* AI Credit Packs */}
            <View style={[s.sectionCard, { backgroundColor: isDarkMode ? "#161B22" : "#FFFFFF", borderColor: isDarkMode ? "#2D333B" : "#F0F0F0" }]}>
              <Text style={[s.sectionTitle, { color: isDarkMode ? "#FFFFFF" : "#0D1117" }]}>AI Credit Packs</Text>
              <Text style={[s.sectionSub, { color: theme.textMuted }]}>Base plan only · Top up Clinical Intelligence · Never expire</Text>
              {CREDIT_PACKS_DISPLAY.map((pack, i) => (
                <Pressable
                  key={i}
                  onPress={() => setSelectedPack(i)}
                  style={[s.packRow, {
                    backgroundColor: selectedPack === i ? (isDarkMode ? "rgba(29,184,112,0.10)" : "#F0FDF6") : "transparent",
                    borderColor: selectedPack === i ? "#1DB870" : (isDarkMode ? "#2D333B" : "#F0F0F0"),
                  }]}
                >
                  <View style={s.packLeft}>
                    <View style={[s.radio, {
                      borderColor: selectedPack === i ? "#1DB870" : "#D1D5DB",
                      backgroundColor: selectedPack === i ? "#1DB870" : "transparent",
                    }]}>
                      {selectedPack === i && <View style={s.radioDot} />}
                    </View>
                    <View>
                      <Text style={[s.packLabel, { color: isDarkMode ? "#FFFFFF" : "#0D1117" }]}>{pack.label}</Text>
                      <Text style={[s.packPer, { color: theme.textMuted }]}>{pack.per}</Text>
                    </View>
                  </View>
                  <View style={s.packRight}>
                    {pack.popular && (
                      <View style={s.bestValueBadge}>
                        <Text style={s.bestValueText}>BEST VALUE</Text>
                      </View>
                    )}
                    <Text style={[s.packPrice, { color: isDarkMode ? "#FFFFFF" : "#0D1117" }]}>{pack.price}</Text>
                  </View>
                </Pressable>
              ))}
              <Pressable style={s.buyCreditsBtn} onPress={handleBuyCredits} disabled={ctaLoading}>
                {ctaLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="zap" size={14} color="#FFFFFF" />
                )}
                <Text style={s.buyCreditsBtnText}>Buy {CREDIT_PACKS_DISPLAY[selectedPack].label}</Text>
              </Pressable>
              <View style={[s.creditNote, { backgroundColor: isDarkMode ? "#0D1117" : "#F9FAFB" }]}>
                <Text style={[s.creditNoteText, { color: theme.textMuted }]}>
                  Smart Dictation and Discharge Summary are always free — credits only for Decision Support, Document Scanning, and EM Reference.
                </Text>
              </View>
            </View>

            {/* Always Free */}
            <View style={[s.sectionCard, { backgroundColor: isDarkMode ? "#161B22" : "#FFFFFF", borderColor: isDarkMode ? "#2D333B" : "#F0F0F0" }]}>
              <Text style={[s.sectionCaption, { color: theme.textMuted }]}>ALWAYS FREE · NO PLAN NEEDED</Text>
              {ALWAYS_FREE.map((f, i) => (
                <View key={i} style={[s.alwaysFreeRow, i > 0 && { marginTop: 10 }]}>
                  <Feather name="unlock" size={13} color="#C4C9D4" />
                  <Text style={[s.alwaysFreeText, { color: theme.textSecondary }]}>{f}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── TEAM TAB ── */}
        {activeTab === "team" && (
          <>
            {/* Team Plan Card */}
            <View style={s.teamCard}>
              <View style={s.teamTagRow}>
                <Text style={s.teamTagText}>TEAM PLAN · PER DOCTOR PRICING</Text>
                <Text style={s.teamTagRight}>No feature holdbacks</Text>
              </View>

              <View style={s.teamBody}>
                <View style={s.teamHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.teamPlanLabel}>TEAM PLAN</Text>
                    <View style={s.teamPriceRow}>
                      <Text style={s.teamPriceFrom}>from</Text>
                      <Text style={s.teamPrice}>₹399</Text>
                      <Text style={s.teamPricePer}>/doctor/month</Text>
                    </View>
                    <Text style={s.teamPriceSub}>Consultant ₹599 · Resident ₹399</Text>
                  </View>
                  <View style={s.teamIconBox}>
                    <Feather name="users" size={22} color="#1DB870" />
                  </View>
                </View>

                <View style={s.teamDivider} />

                {/* Bill Calculator */}
                <View style={s.calcBox}>
                  <Text style={s.calcLabel}>YOUR BILL CALCULATOR</Text>

                  {[
                    { label: "Consultants", rate: "₹599/month each", val: teamConsultants, set: setTeamConsultants },
                    { label: "Residents", rate: "₹399/month each", val: teamResidents, set: setTeamResidents },
                  ].map((row, i) => (
                    <View key={i} style={[s.calcRow, i > 0 && { marginTop: 12 }]}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.calcRowLabel}>{row.label}</Text>
                        <Text style={s.calcRowRate}>{row.rate}</Text>
                      </View>
                      <View style={s.stepper}>
                        <Pressable
                          onPress={() => row.set(Math.max(0, row.val - 1))}
                          style={s.stepBtn}
                        >
                          <Text style={s.stepBtnText}>−</Text>
                        </Pressable>
                        <Text style={s.stepVal}>{row.val}</Text>
                        <Pressable
                          onPress={() => row.set(row.val + 1)}
                          style={s.stepBtn}
                        >
                          <Text style={s.stepBtnText}>+</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}

                  <View style={s.calcDivider} />

                  <View style={s.calcTotal}>
                    <View>
                      <Text style={s.calcTotalLabel}>
                        {isAnnual ? "Effective monthly (annual)" : "Monthly total"}
                      </Text>
                      <View style={s.calcTotalRow}>
                        <Text style={s.calcTotalAmount}>
                          ₹{teamDisplay.toLocaleString("en-IN")}
                        </Text>
                        <Text style={s.calcTotalPer}>/month</Text>
                      </View>
                      {isAnnual && (
                        <Text style={s.calcAnnualNote}>
                          ₹{teamAnnual.toLocaleString("en-IN")} billed annually
                        </Text>
                      )}
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={s.calcDoctorsCount}>{teamConsultants + teamResidents} doctors total</Text>
                      {isAnnual && teamSavings > 0 && (
                        <Text style={s.calcSavings}>
                          Save ₹{teamSavings.toLocaleString("en-IN")}/yr
                        </Text>
                      )}
                    </View>
                  </View>
                </View>

                {/* Team Features */}
                <Text style={s.teamFeaturesLabel}>EVERYTHING INCLUDED — NO HOLDBACKS</Text>
                {TEAM_FEATURES.map((f, i) => (
                  <View key={i} style={[s.featureRow, i > 0 && { marginTop: 9 }]}>
                    <View style={[s.iconCircle, { backgroundColor: "rgba(30,184,112,0.15)" }]}>
                      <Feather name="check" size={10} color="#1DB870" />
                    </View>
                    <Text style={[s.featureText, {
                      color: f.bold ? "#FFFFFF" : "rgba(255,255,255,0.6)",
                      fontWeight: f.bold ? "600" : "400",
                    }]}>{f.text}</Text>
                  </View>
                ))}
              </View>

              <Pressable style={s.teamCTA} onPress={handleTeamContact}>
                <Feather name="mail" size={15} color="#FFFFFF" style={{ marginRight: 7 }} />
                <Text style={s.teamCTAText}>Contact us to set up your team</Text>
              </Pressable>
              <Text style={s.teamCTANote}>Minimum 4 doctors · Bill adjusts as you add or remove doctors</Text>
            </View>

            {/* Why no holdbacks */}
            <View style={[s.sectionCard, { backgroundColor: isDarkMode ? "#161B22" : "#FFFFFF", borderColor: isDarkMode ? "#2D333B" : "#F0F0F0", marginTop: 0 }]}>
              <Text style={[s.sectionTitle, { color: isDarkMode ? "#FFFFFF" : "#0D1117" }]}>Why Team plan has no feature holdbacks</Text>
              {[
                "Per-doctor pricing already scales with your department size",
                "A 50-doctor department pays 50× — no need to gate features",
                "Every doctor gets full Pro features including Rounds and Memory",
                "HOD gets the complete admin layer — analytics, reports, branding",
              ].map((pt, i) => (
                <View key={i} style={[s.whyRow, i > 0 && { marginTop: 8 }]}>
                  <Text style={s.whyArrow}>→</Text>
                  <Text style={[s.whyText, { color: theme.textSecondary }]}>{pt}</Text>
                </View>
              ))}
            </View>

            {/* Example bills */}
            <View style={[s.sectionCard, { backgroundColor: isDarkMode ? "#161B22" : "#FFFFFF", borderColor: isDarkMode ? "#2D333B" : "#F0F0F0", marginTop: 0 }]}>
              <Text style={s.sectionCaption}>EXAMPLE BILLS</Text>
              {EXAMPLE_BILLS.map((ex, i) => {
                const monthly = (ex.consultants * 599) + (ex.residents * 399);
                return (
                  <View key={i} style={[
                    s.exampleRow,
                    i < EXAMPLE_BILLS.length - 1 && { borderBottomWidth: 1, borderBottomColor: isDarkMode ? "#2D333B" : "#F5F5F5" },
                  ]}>
                    <View>
                      <Text style={[s.exampleType, { color: isDarkMode ? "#FFFFFF" : "#0D1117" }]}>{ex.type}</Text>
                      <Text style={[s.exampleDoctors, { color: theme.textMuted }]}>
                        {ex.consultants} consultants · {ex.residents} residents
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={s.exampleAmount}>₹{monthly.toLocaleString("en-IN")}</Text>
                      <Text style={[s.examplePer, { color: theme.textMuted }]}>per month</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[s.stickyBottom, {
        backgroundColor: isDarkMode ? "rgba(13,17,23,0.96)" : "rgba(245,246,248,0.96)",
        borderTopColor: isDarkMode ? "#2D333B" : "rgba(0,0,0,0.06)",
        paddingBottom: Math.max(insets.bottom, 16),
      }]}>
        {activeTab === "individual" ? (
          <>
            <Pressable
              style={({ pressed }) => [
                s.stickyCTA,
                {
                  backgroundColor: activePlan.ctaDisabled
                    ? (isDarkMode ? "#2D333B" : "#E5E7EB")
                    : activePlan.isDark ? "#6366F1" : "#1DB870",
                  opacity: (pressed && !activePlan.ctaDisabled) || ctaLoading ? 0.88 : 1,
                  shadowColor: activePlan.ctaDisabled ? "transparent" : activePlan.isDark ? "#6366F1" : "#1DB870",
                  shadowOpacity: activePlan.ctaDisabled ? 0 : 0.38,
                  shadowRadius: 16, shadowOffset: { width: 0, height: 6 },
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
              <Text style={[s.stickyCTAText, {
                color: activePlan.ctaDisabled ? (isDarkMode ? "#6B7280" : "#9CA3AF") : "#FFFFFF",
              }]}>
                {ctaLoading ? "Setting up..." : activePlan.ctaDisabled ? "Current Plan" : `Start ${activePlan.name} — Free for 1st Month`}
              </Text>
            </Pressable>
            {!activePlan.ctaDisabled && (
              <Text style={[s.stickySubtext, { color: theme.textMuted }]}>
                {isAnnual
                  ? `Free 30 days · Then ${activePlan.annualPrice}/year (${activePlan.annualEquiv}/mo) · Save ${activePlan.annualSavings}`
                  : `Free for 30 days · Then ${activePlan.monthlyPrice}/month · Cancel anytime`}
              </Text>
            )}
          </>
        ) : (
          <>
            <Pressable
              style={({ pressed }) => [
                s.stickyCTA,
                { backgroundColor: "#1DB870", opacity: pressed ? 0.88 : 1,
                  shadowColor: "#1DB870", shadowOpacity: 0.38, shadowRadius: 16,
                  shadowOffset: { width: 0, height: 6 }, elevation: 8 },
              ]}
              onPress={handleTeamContact}
            >
              <Feather name="users" size={16} color="#FFFFFF" style={{ marginRight: 8 }} />
              <Text style={[s.stickyCTAText, { color: "#FFFFFF" }]}>Set Up Your Team</Text>
            </Pressable>
            <Text style={[s.stickySubtext, { color: theme.textMuted }]}>
              Contact support@ermate.app · We'll set it up for you
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },

  lockBanner: {
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    padding: 14, borderRadius: 14, marginBottom: 14,
  },
  lockTitle: { fontSize: 14, fontWeight: "700" },
  lockMsg: { fontSize: 13, marginTop: 3 },

  usageCard: {
    borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  usageRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  usageLabel: { fontSize: 13 },
  usageStatus: { fontSize: 13, fontWeight: "700" },
  barBg: { height: 6, borderRadius: 3, backgroundColor: "#F3F4F6", marginBottom: 8 },
  barFill: { height: 6, borderRadius: 3 },
  usageText: { fontSize: 12 },

  tabContainer: {
    flexDirection: "row", borderRadius: 14, padding: 4,
    marginBottom: 12, gap: 3,
    borderWidth: 1.5, borderColor: "#F0F0F0",
  },
  tab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 10, paddingVertical: 10, paddingHorizontal: 8,
  },
  tabText: { fontSize: 13 },

  billingToggle: {
    flexDirection: "row", borderRadius: 14, padding: 4,
    marginBottom: 12, gap: 3,
  },
  billingTab: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 11, paddingVertical: 10, gap: 6,
  },
  billingTabText: { fontSize: 13 },
  saveBadge: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  saveBadgeText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.3 },

  annualBanner: {
    flexDirection: "row", alignItems: "center", gap: 7,
    backgroundColor: "rgba(30,184,112,0.08)",
    borderWidth: 1, borderColor: "rgba(30,184,112,0.2)",
    borderRadius: 12, padding: 10, marginBottom: 12,
  },
  annualBannerText: { fontSize: 12.5, color: "#15924F", fontWeight: "500", flex: 1 },

  planCard: {
    borderRadius: 20, overflow: "hidden",
  },
  tagRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 18, paddingVertical: 8,
    borderBottomWidth: 1,
  },
  tagText: { fontSize: 9, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" },
  selectedDot: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  planBody: { padding: 18 },
  priceHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 },
  planNameLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  priceMain: { fontSize: 28, fontWeight: "900", letterSpacing: -1, lineHeight: 32 },
  priceRow: { flexDirection: "row", alignItems: "baseline", gap: 5, flexWrap: "wrap" },
  priceStrike: { fontSize: 12, textDecorationLine: "line-through" },
  priceFree: { fontSize: 28, fontWeight: "900", letterSpacing: -1, lineHeight: 32 },
  pricePer: { fontSize: 12 },
  priceAfter: { fontSize: 11, marginTop: 3 },
  iconBox: {
    width: 38, height: 38, borderRadius: 11, borderWidth: 1.5,
    alignItems: "center", justifyContent: "center",
  },
  planDesc: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  divider: { height: 1, marginBottom: 14 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  iconCircle: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: "center", justifyContent: "center",
  },
  featureText: { fontSize: 12.5, flex: 1 },
  cardCTA: {
    margin: 18, marginTop: 14, borderRadius: 11, paddingVertical: 13,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
  },
  cardCTAText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },

  sectionCard: {
    borderRadius: 20, padding: 18, marginBottom: 12,
    borderWidth: 1.5,
  },
  sectionTitle: { fontSize: 15, fontWeight: "800", letterSpacing: -0.3, marginBottom: 3 },
  sectionSub: { fontSize: 12, marginBottom: 14 },
  sectionCaption: {
    fontSize: 10, fontWeight: "700", color: "#9CA3AF",
    letterSpacing: 1, textTransform: "uppercase", marginBottom: 12,
  },

  packRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1.5, borderRadius: 12, padding: 12, marginBottom: 8,
  },
  packLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  packRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  radio: {
    width: 17, height: 17, borderRadius: 8.5, borderWidth: 2,
    alignItems: "center", justifyContent: "center",
  },
  radioDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#FFFFFF" },
  packLabel: { fontSize: 13, fontWeight: "600" },
  packPer: { fontSize: 10, marginTop: 1 },
  packPrice: { fontSize: 14, fontWeight: "800" },
  bestValueBadge: {
    backgroundColor: "rgba(30,184,112,0.10)", borderRadius: 4,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  bestValueText: { fontSize: 8, fontWeight: "800", color: "#1DB870", textTransform: "uppercase" },
  buyCreditsBtn: {
    backgroundColor: "#1DB870", borderRadius: 11, paddingVertical: 13,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 7, marginTop: 4, marginBottom: 12,
  },
  buyCreditsBtnText: { color: "#FFFFFF", fontSize: 13, fontWeight: "700" },
  creditNote: { borderRadius: 10, padding: 10 },
  creditNoteText: { fontSize: 11, lineHeight: 17 },

  alwaysFreeRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  alwaysFreeText: { fontSize: 12.5 },

  // Team card
  teamCard: {
    backgroundColor: "#0D1117",
    borderWidth: 2, borderColor: "rgba(30,184,112,0.3)",
    borderRadius: 20, overflow: "hidden", marginBottom: 12,
    shadowColor: "#1DB870", shadowOpacity: 0.15, shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 }, elevation: 6,
  },
  teamTagRow: {
    backgroundColor: "rgba(30,184,112,0.12)", paddingHorizontal: 18, paddingVertical: 8,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  teamTagText: { fontSize: 9, fontWeight: "800", letterSpacing: 1.4, color: "#1DB870", textTransform: "uppercase" },
  teamTagRight: { fontSize: 9, fontWeight: "700", color: "rgba(30,184,112,0.6)", letterSpacing: 0.8 },
  teamBody: { padding: 18 },
  teamHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 },
  teamPlanLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2, color: "rgba(255,255,255,0.35)", marginBottom: 4, textTransform: "uppercase" },
  teamPriceRow: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  teamPriceFrom: { fontSize: 11, color: "rgba(255,255,255,0.3)" },
  teamPrice: { fontSize: 28, fontWeight: "900", color: "#1DB870", letterSpacing: -1, lineHeight: 32 },
  teamPricePer: { fontSize: 12, color: "rgba(255,255,255,0.35)" },
  teamPriceSub: { fontSize: 11, color: "rgba(255,255,255,0.3)", marginTop: 2 },
  teamIconBox: {
    width: 42, height: 42, borderRadius: 12,
    backgroundColor: "rgba(30,184,112,0.12)", borderWidth: 1.5,
    borderColor: "rgba(30,184,112,0.25)", alignItems: "center", justifyContent: "center",
  },
  teamDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 16 },

  calcBox: {
    backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 14,
    padding: 14, marginBottom: 16,
  },
  calcLabel: {
    fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.3)",
    letterSpacing: 1, textTransform: "uppercase", marginBottom: 12,
  },
  calcRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  calcRowLabel: { fontSize: 13, fontWeight: "600", color: "#FFFFFF" },
  calcRowRate: { fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 1 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepBtn: {
    width: 28, height: 28, borderRadius: 8,
    backgroundColor: "rgba(30,184,112,0.10)",
    borderWidth: 1.5, borderColor: "rgba(30,184,112,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  stepBtnText: { color: "#1DB870", fontSize: 16, fontWeight: "700", lineHeight: 20 },
  stepVal: { fontSize: 18, fontWeight: "800", color: "#FFFFFF", minWidth: 24, textAlign: "center" },
  calcDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: 14 },
  calcTotal: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between" },
  calcTotalLabel: { fontSize: 10, color: "rgba(255,255,255,0.3)", marginBottom: 2 },
  calcTotalRow: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  calcTotalAmount: { fontSize: 26, fontWeight: "900", color: "#1DB870", letterSpacing: -0.5 },
  calcTotalPer: { fontSize: 12, color: "rgba(255,255,255,0.3)" },
  calcAnnualNote: { fontSize: 10, color: "rgba(255,255,255,0.3)", marginTop: 2 },
  calcDoctorsCount: { fontSize: 10, color: "rgba(255,255,255,0.3)" },
  calcSavings: { fontSize: 10, color: "#1DB870", fontWeight: "600", marginTop: 2 },

  teamFeaturesLabel: {
    fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.3)",
    letterSpacing: 1, textTransform: "uppercase", marginBottom: 12,
  },
  teamCTA: {
    margin: 18, marginTop: 4, backgroundColor: "#1DB870",
    borderRadius: 11, paddingVertical: 14,
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    shadowColor: "#1DB870", shadowOpacity: 0.35, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  teamCTAText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
  teamCTANote: {
    textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.25)",
    marginBottom: 16, paddingHorizontal: 18,
  },

  whyRow: { flexDirection: "row", gap: 8 },
  whyArrow: { color: "#1DB870", fontSize: 13, flexShrink: 0 },
  whyText: { fontSize: 12.5, lineHeight: 20, flex: 1 },

  exampleRow: { paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  exampleType: { fontSize: 13, fontWeight: "600" },
  exampleDoctors: { fontSize: 11, marginTop: 2 },
  exampleAmount: { fontSize: 14, fontWeight: "800", color: "#1DB870" },
  examplePer: { fontSize: 10, marginTop: 2 },

  stickyBottom: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    paddingTop: 12, paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  stickyCTA: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    borderRadius: 14, paddingVertical: 15, marginBottom: 8,
  },
  stickyCTAText: { fontSize: 15, fontWeight: "700" },
  stickySubtext: { fontSize: 11, textAlign: "center", marginBottom: 4 },
});
