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
import * as WebBrowser from "expo-web-browser";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl } from "@/lib/query-client";

type RouteProps = RouteProp<RootStackParamList, "Upgrade">;
type BillingCycle = "monthly" | "annual";
type ActiveTab = "individual" | "team";
type TeamStep = "idle" | "confirm" | "paying" | "success";

const C = {
  green: "#1DB870",
  greenDark: "#15924F",
  greenLight: "rgba(29,184,112,0.09)",
  greenBorder: "rgba(29,184,112,0.2)",
  purple: "#7C6AF6",
  purpleLight: "rgba(124,106,246,0.09)",
  purpleBorder: "rgba(124,106,246,0.2)",
  ink: "#0B0F14",
  inkSoft: "#2E3440",
  muted: "#6B7280",
  faint: "#9CA3AF",
  border: "#E8EAED",
  surface: "#F7F8FA",
  white: "#FFFFFF",
  orange: "#F59E0B",
  red: "#EF4444",
  darkCard: "#071810",
  proHeader: "#071810",
};

interface SubStatus {
  plan: string;
  casesUsed: number;
  casesLimit: number;
  aiCredits?: number;
}

function FRow({ text, ok = true, bold = false, color = C.green, sub = "" }: {
  text: string; ok?: boolean; bold?: boolean; color?: string; sub?: string;
}) {
  return (
    <View style={s.frow}>
      {ok ? (
        <View style={[s.fcheckBg, { backgroundColor: color + "20" }]}>
          <Feather name="check" size={9} color={color} />
        </View>
      ) : (
        <View style={[s.fcheckBg, { backgroundColor: "rgba(0,0,0,0.04)" }]}>
          <Feather name="x" size={9} color="#D1D5DB" />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[s.frowText, {
          color: !ok ? "#C4C9D4" : bold ? C.inkSoft : C.muted,
          fontWeight: bold ? "700" : "400",
        }]}>{text}</Text>
        {!!sub && <Text style={[s.frowSub, { color: C.faint }]}>{sub}</Text>}
      </View>
    </View>
  );
}

function SecLabel({ text, color = C.faint }: { text: string; color?: string }) {
  return <Text style={[s.secLabel, { color }]}>{text}</Text>;
}

export default function UpgradeScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { isDark: isDarkMode } = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user, token } = useAuth();

  const { lockReason, lockMessage } = route.params || {};

  const [subStatus, setSubStatus] = useState<SubStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<ActiveTab>("individual");
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [teamConsultants, setTeamConsultants] = useState(2);
  const [teamResidents, setTeamResidents] = useState(6);
  const [proLoading, setProLoading] = useState(false);
  const [teamStep, setTeamStep] = useState<TeamStep>("idle");
  const [teamLoading, setTeamLoading] = useState(false);

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const url = new URL(`/api/subscription/status?userId=${encodeURIComponent(user.id)}&userEmail=${encodeURIComponent(user.email || "")}`, getApiUrl()).href;
      const res = await fetch(url);
      const data = await res.json();
      setSubStatus(data);
    } catch { }
    finally { setLoading(false); }
  };

  const isAnnual = billingCycle === "annual";
  const proMonthly = 1199;
  const proAnnual = 11990;
  const proAnnualEq = 999;
  const proSave = 2398;

  const teamMonthly = (teamConsultants * 599) + (teamResidents * 399);
  const teamAnnual = (teamConsultants * 5990) + (teamResidents * 3990);
  const teamDisplay = isAnnual ? teamAnnual : teamMonthly;
  const totalDrs = teamConsultants + teamResidents;

  const userPlan = subStatus?.plan ?? "free";
  const isTrialActive = userPlan === "trial";
  const isProActive = userPlan === "pro";

  const handleProCheckout = async () => {
    if (isProActive) return;
    setProLoading(true);
    try {
      const url = new URL("/api/subscription/create-checkout", getApiUrl()).href;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ plan: "pro", billingCycle }),
      });
      const data = await res.json();
      if (data.url) {
        await WebBrowser.openBrowserAsync(data.url);
      } else {
        Alert.alert("Something went wrong", data.error || "Please try again or contact support@ermate.app");
      }
    } catch {
      Alert.alert("Something went wrong", "Please try again or contact support@ermate.app");
    } finally {
      setProLoading(false);
    }
  };

  const handleTeamEnroll = () => {
    if (totalDrs < 4) {
      Alert.alert("Minimum 4 doctors required", "Please add at least 4 doctors to enroll in the Team plan.");
      return;
    }
    setTeamStep("confirm");
  };

  const handleTeamPay = async () => {
    setTeamLoading(true);
    setTeamStep("paying");
    try {
      const url = new URL("/api/subscription/team/checkout", getApiUrl()).href;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ consultants: teamConsultants, residents: teamResidents, billingCycle }),
      });
      const data = await res.json();
      if (data.url) {
        await WebBrowser.openBrowserAsync(data.url);
        setTeamStep("idle");
      } else {
        Alert.alert("Something went wrong", data.error || "Please contact support@ermate.app");
        setTeamStep("confirm");
      }
    } catch {
      Alert.alert("Something went wrong", "Please contact support@ermate.app");
      setTeamStep("confirm");
    } finally {
      setTeamLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={[s.container, s.center]}>
        <ActivityIndicator size="large" color={C.green} />
      </View>
    );
  }

  const bg = isDarkMode ? "#0D1117" : C.surface;

  return (
    <View style={[s.container, { backgroundColor: bg }]}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + 12,
          paddingHorizontal: 16,
          paddingBottom: insets.bottom + 130,
        }}
        showsVerticalScrollIndicator={false}
      >
        {lockReason ? (
          <View style={s.lockBanner}>
            <Feather name="lock" size={18} color={C.red} />
            <View style={{ flex: 1 }}>
              <Text style={[s.lockTitle, { color: C.red }]}>{lockReason}</Text>
              {!!lockMessage && <Text style={s.lockMsg}>{lockMessage}</Text>}
            </View>
          </View>
        ) : null}

        {/* Tab switcher */}
        <View style={[s.tabRow, { backgroundColor: C.white, borderColor: C.border }]}>
          {([
            { id: "individual" as ActiveTab, label: "Individual" },
            { id: "team" as ActiveTab, label: "Team / Hospital" },
          ]).map(t => (
            <Pressable
              key={t.id}
              style={[s.tabBtn, activeTab === t.id && { backgroundColor: C.ink }]}
              onPress={() => { setActiveTab(t.id); setTeamStep("idle"); }}
            >
              <Text style={[s.tabBtnText, { color: activeTab === t.id ? C.white : C.faint }]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Billing toggle */}
        <View style={[s.billingRow, { backgroundColor: "#ECEEF1" }]}>
          {(["monthly", "annual"] as BillingCycle[]).map(b => (
            <Pressable
              key={b}
              style={[s.billingBtn, billingCycle === b && { backgroundColor: C.white }]}
              onPress={() => setBillingCycle(b)}
            >
              <Text style={[s.billingBtnText, { color: billingCycle === b ? C.ink : C.faint }]}>
                {b === "monthly" ? "Monthly" : "Annual"}
              </Text>
              {b === "annual" && (
                <View style={[s.savePill, { backgroundColor: billingCycle === "annual" ? C.greenLight : "rgba(156,163,175,0.12)" }]}>
                  <Text style={[s.savePillText, { color: billingCycle === "annual" ? C.greenDark : C.faint }]}>2 MONTHS FREE</Text>
                </View>
              )}
            </Pressable>
          ))}
        </View>

        {isAnnual && (
          <View style={[s.annualBanner, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]}>
            <Feather name="gift" size={13} color={C.greenDark} />
            <Text style={[s.annualBannerText, { color: C.greenDark }]}>Annual plan — pay for 10 months, use for 12</Text>
          </View>
        )}

        {/* ── INDIVIDUAL TAB ── */}
        {activeTab === "individual" && (
          <>
            {/* Free card */}
            <View style={[s.card, { backgroundColor: C.white, borderColor: C.border, marginTop: 4 }]}>
              <View style={s.cardTopRow}>
                <View>
                  <Text style={s.planTag}>Free</Text>
                  <Text style={s.planPrice}>₹0</Text>
                </View>
                <View style={[s.activePill, { backgroundColor: C.greenLight }]}>
                  <View style={[s.pillDot, { backgroundColor: C.green }]} />
                  <Text style={[s.pillText, { color: C.greenDark }]}>Active</Text>
                </View>
              </View>
              <Text style={[s.planDesc, { color: C.faint }]}>
                10 cases to try ErMate. Includes 5 AI credits to experience Decision Support and Rounds before upgrading.
              </Text>
              <View style={[s.creditPreview, { backgroundColor: "#F0FDF6", borderColor: C.greenBorder }]}>
                <Text style={[s.creditPreviewTitle, { color: C.greenDark }]}>5 free AI credits included</Text>
                <View style={s.creditTrack}>
                  <View style={[s.creditFill, { width: 0, backgroundColor: C.green }]} />
                </View>
                <Text style={[s.creditPreviewSub, { color: C.muted }]}>Try Decision Support, Rounds, OCR — 1 credit each</Text>
              </View>
              {[
                { text: "10 cases (lifetime)", ok: true },
                { text: "Smart Dictation — always free", ok: true },
                { text: "AI Discharge Summary — always free", ok: true },
                { text: "ATLS adult + PALS paediatric", ok: true },
                { text: "PDF / WhatsApp export", ok: true },
                { text: "5 AI credits (one-time)", ok: true },
                { text: "Unlimited cases", ok: false },
                { text: "Unlimited AI features", ok: false },
                { text: "Rounds & Clinical Memory", ok: false },
              ].map((f, i) => <FRow key={i} {...f} color={C.muted} />)}
            </View>

            {/* Pro card */}
            <View style={[s.proCard, { borderColor: C.green }]}>
              {/* Green tag bar */}
              <View style={[s.proTagBar, { backgroundColor: C.green }]}>
                <Text style={s.proTagLeft}>Individual Pro · Recommended</Text>
                <Text style={s.proTagRight}>No credits · No limits</Text>
              </View>

              {/* Dark price header */}
              <View style={[s.proPriceHeader, { backgroundColor: C.proHeader }]}>
                <View style={s.proPriceRow}>
                  <View style={{ flex: 1 }}>
                    {isAnnual ? (
                      <View style={s.priceDisplay}>
                        <Text style={[s.priceMain, { color: C.green }]}>₹{proAnnualEq}</Text>
                        <Text style={[s.pricePer, { color: "rgba(255,255,255,0.35)" }]}>/mo</Text>
                      </View>
                    ) : (
                      <View style={s.priceDisplay}>
                        <Text style={[s.priceStrike, { color: "rgba(255,255,255,0.2)" }]}>₹{proMonthly}</Text>
                        <Text style={[s.priceFree, { color: C.green }]}>FREE</Text>
                        <Text style={[s.pricePer, { color: "rgba(255,255,255,0.35)" }]}>1st month</Text>
                      </View>
                    )}
                    <Text style={[s.priceSub, { color: "rgba(255,255,255,0.25)" }]}>
                      {isAnnual ? `₹${proAnnual.toLocaleString("en-IN")}/year · Cancel anytime` : `Then ₹${proMonthly}/month · Cancel anytime`}
                    </Text>
                  </View>
                  {isAnnual && (
                    <View style={[s.saveBadge, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]}>
                      <Text style={[s.saveBadgeLabel, { color: C.green }]}>Save</Text>
                      <Text style={[s.saveBadgeAmount, { color: C.green }]}>₹{proSave.toLocaleString("en-IN")}</Text>
                    </View>
                  )}
                </View>
                <View style={[s.identityBox, { backgroundColor: "rgba(29,184,112,0.1)", borderColor: "rgba(29,184,112,0.18)" }]}>
                  <Text style={[s.identityTitle, { color: C.green }]}>Your account. Your career. Not your hospital's.</Text>
                  <Text style={[s.identitySub, { color: "rgba(255,255,255,0.4)" }]}>
                    Cases, Rounds, and Clinical Memory stay with you at every hospital you ever work at.
                  </Text>
                </View>
              </View>

              <View style={{ padding: 16 }}>
                <SecLabel text="Documentation — unlimited, no credits" color={C.greenDark} />
                {[
                  { text: "Unlimited cases", bold: true },
                  { text: "Smart Dictation — always free, always unlimited", bold: true },
                  { text: "AI Discharge Summary — always free, always unlimited", bold: true },
                  { text: "ATLS adult + PALS paediatric frameworks" },
                  { text: "Paediatric drug calculator" },
                  { text: "Document OCR scanning" },
                  { text: "ABG / VBG AI interpretation" },
                  { text: "Clinical Decision Support — unlimited" },
                  { text: "EM Reference Library — AI chat, unlimited" },
                  { text: "PDF export + WhatsApp share" },
                ].map((f, i) => <FRow key={i} ok bold={!!f.bold} text={f.text} color={C.green} />)}

                <View style={[s.divider, { backgroundColor: "#F0F0F0" }]} />

                <SecLabel text="Rounds — clinical learning, unlimited" color={C.purple} />
                {[
                  { text: "Case debrief after every case — unlimited", bold: true },
                  {
                    text: "All 7 thinking lenses", bold: true,
                    sub: "First Principles · Devil's Advocate · Pathophysiology · Rare but Real · Guidelines · Disease Snapshot · Full Debrief"
                  },
                  { text: "Post-save nudge — 3 quick lenses after saving" },
                  { text: "Clinical Memory — your full career, private", bold: true },
                ].map((f, i) => <FRow key={i} ok bold={!!f.bold} text={f.text} sub={f.sub} color={C.purple} />)}

                <View style={[s.divider, { backgroundColor: "#F0F0F0" }]} />

                <SecLabel text="Ownership" color={C.green} />
                {[
                  { text: "Your data — not your hospital's", bold: true },
                  { text: "Rounds and Memory stay with you if you leave" },
                  { text: "No shift restrictions — document any time" },
                  { text: "HOD cannot see your Rounds or Memory" },
                ].map((f, i) => <FRow key={i} ok bold={!!f.bold} text={f.text} color={C.green} />)}

                <View style={[s.noCreditsNote, { backgroundColor: C.surface }]}>
                  <Text style={[s.noCreditsText, { color: C.faint }]}>No credits on Pro. No limits. No walls. One price — everything works.</Text>
                </View>

                <Pressable
                  style={({ pressed }) => [s.proCardCTA, {
                    backgroundColor: isProActive ? "transparent" : C.green,
                    borderWidth: isProActive ? 1 : 0,
                    borderColor: isProActive ? C.green : "transparent",
                    opacity: (pressed && !isProActive) || proLoading ? 0.85 : 1,
                  }]}
                  onPress={handleProCheckout}
                  disabled={isProActive || proLoading}
                >
                  {proLoading ? (
                    <ActivityIndicator size="small" color={C.white} />
                  ) : isProActive ? (
                    <>
                      <Feather name="check-circle" size={15} color={C.green} />
                      <Text style={[s.proCardCTAText, { color: C.green }]}>Current Plan</Text>
                    </>
                  ) : (
                    <>
                      <Feather name="gift" size={15} color={C.white} />
                      <Text style={[s.proCardCTAText, { color: C.white }]}>Start Pro — Free for 1st Month</Text>
                    </>
                  )}
                </Pressable>
                {!isProActive && (
                  <Text style={[s.proCardCTASub, { color: C.faint }]}>
                    30-day free trial · ₹{proMonthly}/month after · Secured by Razorpay
                  </Text>
                )}
              </View>
            </View>

            {/* No credits note */}
            <View style={[s.card, { backgroundColor: C.white, borderColor: C.border }]}>
              <Text style={[s.noCreditsCardTitle, { color: C.ink }]}>No AI credits on Pro?</Text>
              <Text style={[s.noCreditsCardBody, { color: C.muted }]}>
                Correct. On Pro, every AI feature just works — no counting, no topping up, no mid-shift surprises.
                Credits only exist on the Free plan as a one-time taste before you decide to upgrade.
              </Text>
            </View>
          </>
        )}

        {/* ── TEAM TAB ── */}
        {activeTab === "team" && (
          <>
            {teamStep === "success" ? (
              <View style={[s.successCard, { backgroundColor: "#F0FDF6", borderColor: C.green }]}>
                <Feather name="check-circle" size={36} color={C.green} style={{ marginBottom: 10 }} />
                <Text style={[s.successTitle, { color: C.greenDark }]}>Team plan activated!</Text>
                <Text style={[s.successSub, { color: C.muted }]}>
                  Go to your admin panel to add doctors by email. Each gets an invite and can join immediately.
                </Text>
                <Pressable
                  style={[s.successBtn, { backgroundColor: C.green }]}
                  onPress={() => { setTeamStep("idle"); (navigation as any).goBack(); }}
                >
                  <Text style={s.successBtnText}>Go to Dashboard</Text>
                </Pressable>
              </View>
            ) : teamStep === "confirm" ? (
              <View style={[s.confirmCard, { backgroundColor: C.white, borderColor: C.green }]}>
                <Text style={[s.confirmTitle, { color: C.ink }]}>Confirm your Team plan</Text>
                <Text style={[s.confirmSub, { color: C.muted }]}>Review your roster and billing before paying.</Text>
                {[
                  { label: "Consultants", value: `${teamConsultants} × ₹${isAnnual ? Math.round(5990 / 12) : 599} = ₹${teamConsultants * (isAnnual ? Math.round(5990 / 12) : 599)}/mo` },
                  { label: "Residents", value: `${teamResidents} × ₹${isAnnual ? Math.round(3990 / 12) : 399} = ₹${teamResidents * (isAnnual ? Math.round(3990 / 12) : 399)}/mo` },
                  { label: "Billing", value: isAnnual ? "Annual (2 months free, paid upfront)" : "Monthly" },
                  { label: "You pay now", value: `₹${teamDisplay.toLocaleString("en-IN")}`, bold: true, sub: isAnnual ? "Covers 12 months" : "First month" },
                ].map((row, i) => (
                  <View key={i} style={[s.confirmRow, { borderBottomColor: i < 3 ? C.surface : "transparent" }]}>
                    <Text style={[s.confirmRowLabel, { color: C.muted }]}>{row.label}</Text>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={[s.confirmRowValue, { color: row.bold ? C.greenDark : C.ink, fontWeight: row.bold ? "800" : "600" }]}>{row.value}</Text>
                      {!!row.sub && <Text style={[s.confirmRowSub, { color: C.faint }]}>{row.sub}</Text>}
                    </View>
                  </View>
                ))}
                <View style={s.confirmBtns}>
                  <Pressable style={[s.confirmCancel, { backgroundColor: C.surface, borderColor: C.border }]} onPress={() => setTeamStep("idle")}>
                    <Text style={[s.confirmCancelText, { color: C.muted }]}>Cancel</Text>
                  </Pressable>
                  <Pressable style={[s.confirmPay, { backgroundColor: C.green }]} onPress={handleTeamPay} disabled={teamLoading}>
                    {teamLoading ? <ActivityIndicator size="small" color={C.white} /> : (
                      <Text style={s.confirmPayText}>Pay ₹{teamDisplay.toLocaleString("en-IN")} Now</Text>
                    )}
                  </Pressable>
                </View>
                <Text style={[s.confirmNote, { color: C.faint }]}>Secured by Razorpay · UPI · Cards · Net Banking</Text>
              </View>
            ) : teamStep === "paying" ? (
              <View style={[s.payingCard, { backgroundColor: C.white, borderColor: C.border }]}>
                <ActivityIndicator size="large" color={C.green} style={{ marginBottom: 12 }} />
                <Text style={[s.payingTitle, { color: C.ink }]}>Opening Razorpay…</Text>
                <Text style={[s.payingSub, { color: C.faint }]}>Secure payment powered by Razorpay</Text>
              </View>
            ) : (
              <>
                {/* Team plan card */}
                <View style={[s.teamCard, { borderColor: C.greenBorder }]}>
                  <View style={[s.teamCardTag, { backgroundColor: "rgba(29,184,112,0.1)", borderBottomColor: "rgba(29,184,112,0.1)" }]}>
                    <Text style={[s.teamTagLeft, { color: C.green }]}>Team Plan · Dynamic pricing</Text>
                    <Text style={[s.teamTagRight, { color: "rgba(255,255,255,0.3)" }]}>No credit walls. Ever.</Text>
                  </View>
                  <View style={{ padding: 18, paddingBottom: 0 }}>
                    <View style={s.teamPriceRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[s.teamPriceFrom, { color: "rgba(255,255,255,0.3)" }]}>Team / Hospital</Text>
                        <View style={s.teamPriceDisplay}>
                          <Text style={[s.teamPriceFrom2, { color: "rgba(255,255,255,0.3)" }]}>from </Text>
                          <Text style={[s.teamPriceMain, { color: C.green }]}>₹399</Text>
                          <Text style={[s.teamPricePer, { color: "rgba(255,255,255,0.3)" }]}>/doctor/month</Text>
                        </View>
                        <Text style={[s.teamPriceSub, { color: "rgba(255,255,255,0.3)" }]}>Consultant ₹599 · Resident ₹399</Text>
                      </View>
                      <View style={[s.teamIcon, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]}>
                        <Feather name="users" size={18} color={C.green} />
                      </View>
                    </View>

                    <View style={[s.divider, { backgroundColor: "rgba(255,255,255,0.08)" }]} />

                    <SecLabel text="Your bill — select roster size" color="rgba(255,255,255,0.35)" />
                    <View style={[s.billCalc, { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 13 }]}>
                      {[
                        { label: "Consultants", rate: 599, val: teamConsultants, set: setTeamConsultants },
                        { label: "Residents", rate: 399, val: teamResidents, set: setTeamResidents },
                      ].map((row, i) => (
                        <View key={i} style={[s.billRow, i === 0 && { marginBottom: 12 }]}>
                          <View style={{ flex: 1 }}>
                            <Text style={[s.billRowLabel, { color: C.white }]}>{row.label}</Text>
                            <Text style={[s.billRowRate, { color: "rgba(255,255,255,0.3)" }]}>₹{row.rate}/month each</Text>
                          </View>
                          <View style={s.billStepper}>
                            <Pressable style={[s.stepperBtn, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]} onPress={() => row.set(Math.max(0, row.val - 1))}>
                              <Text style={[s.stepperBtnText, { color: C.green }]}>−</Text>
                            </Pressable>
                            <Text style={[s.stepperVal, { color: C.white }]}>{row.val}</Text>
                            <Pressable style={[s.stepperBtn, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]} onPress={() => row.set(row.val + 1)}>
                              <Text style={[s.stepperBtnText, { color: C.green }]}>+</Text>
                            </Pressable>
                          </View>
                        </View>
                      ))}
                      <View style={[s.divider, { backgroundColor: "rgba(255,255,255,0.08)" }]} />
                      <View style={s.totalRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.totalLabel, { color: "rgba(255,255,255,0.3)" }]}>{isAnnual ? "You pay today" : "You pay monthly"}</Text>
                          <View style={s.totalDisplay}>
                            <Text style={[s.totalAmount, { color: C.green }]}>₹{teamDisplay.toLocaleString("en-IN")}</Text>
                            <Text style={[s.totalPer, { color: "rgba(255,255,255,0.3)" }]}>{isAnnual ? "/year" : "/month"}</Text>
                          </View>
                          {isAnnual && (
                            <Text style={[s.totalSavings, { color: C.green }]}>
                              ₹{Math.round(teamAnnual / 12).toLocaleString("en-IN")}/mo effective · Save ₹{(teamMonthly * 12 - teamAnnual).toLocaleString("en-IN")}
                            </Text>
                          )}
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[s.totalDrs, { color: "rgba(255,255,255,0.3)" }]}>{totalDrs} doctors</Text>
                          {totalDrs > 0 && (
                            <Text style={[s.totalPerDoc, { color: "rgba(255,255,255,0.2)" }]}>₹{Math.round(teamMonthly / Math.max(1, totalDrs))}/doc/mo avg</Text>
                          )}
                        </View>
                      </View>
                      {totalDrs < 4 && (
                        <Text style={[s.minDrsWarn, { color: C.orange }]}>Minimum 4 doctors required</Text>
                      )}
                    </View>

                    <SecLabel text="Every doctor gets — Pro features included" color={C.green} />
                    {[
                      { text: "Everything in Individual Pro — for every doctor", bold: true },
                      { text: "Unlimited cases, Dictation, Discharge Summary" },
                      { text: "All AI — Decision Support, OCR, ABG, EM Reference" },
                      { text: "Rounds with all 7 lenses, unlimited", bold: true },
                      { text: "No credits. No limits. Ever.", bold: true },
                    ].map((f, i) => (
                      <View key={i} style={s.frow}>
                        <View style={[s.fcheckBg, { backgroundColor: C.green + "20" }]}>
                          <Feather name="check" size={9} color={C.green} />
                        </View>
                        <Text style={[s.frowText, {
                          color: f.bold ? C.white : "rgba(255,255,255,0.5)",
                          fontWeight: f.bold ? "700" : "400",
                          flex: 1,
                        }]}>{f.text}</Text>
                      </View>
                    ))}

                    <View style={[s.divider, { backgroundColor: "rgba(255,255,255,0.08)" }]} />
                    <SecLabel text="HOD gets — department layer" color="rgba(255,255,255,0.4)" />
                    {[
                      "Shift management — Morning, Evening, Night",
                      "Case handover with pending notes",
                      "Auto handover sheet — landscape PDF + WhatsApp",
                      "Consultant escalation system",
                      "Admin dashboard — all shifts, all cases, live",
                      "Force logout any doctor, any device",
                      "Department analytics + monthly reports",
                      "Custom hospital branding on all exports",
                    ].map((text, i) => (
                      <View key={i} style={s.frow}>
                        <View style={[s.fcheckBg, { backgroundColor: "rgba(29,184,112,0.15)" }]}>
                          <Feather name="check" size={9} color="rgba(29,184,112,0.5)" />
                        </View>
                        <Text style={[s.frowText, { color: "rgba(255,255,255,0.4)", flex: 1 }]}>{text}</Text>
                      </View>
                    ))}

                    <View style={[s.divider, { backgroundColor: "rgba(255,255,255,0.08)" }]} />
                    <View style={[s.memoryNote, { backgroundColor: "rgba(124,106,246,0.1)", borderColor: "rgba(124,106,246,0.2)" }]}>
                      <Text style={[s.memoryNoteTitle, { color: C.purple }]}>About Clinical Memory on Team plan</Text>
                      <Text style={[s.memoryNoteSub, { color: "rgba(255,255,255,0.4)" }]}>
                        Every doctor gets Rounds debriefs. But Clinical Memory (your private career record, visible only to you) requires Individual Pro separately.
                        Team-only = HOD can see Rounds activity.
                      </Text>
                    </View>
                  </View>

                  <View style={{ paddingHorizontal: 18, paddingBottom: 18, paddingTop: 0 }}>
                    <Pressable
                      style={({ pressed }) => [s.enrollBtn, {
                        backgroundColor: totalDrs < 4 ? "rgba(29,184,112,0.3)" : C.green,
                        opacity: pressed ? 0.88 : 1,
                      }]}
                      onPress={handleTeamEnroll}
                      disabled={totalDrs < 4}
                    >
                      <Feather name="users" size={16} color={C.white} style={{ marginRight: 8 }} />
                      <Text style={s.enrollBtnText}>
                        {totalDrs < 4 ? "Add at least 4 doctors above" : `Enroll Now — ₹${teamMonthly.toLocaleString("en-IN")}/mo`}
                      </Text>
                    </Pressable>
                    <Text style={[s.enrollNote, { color: "rgba(255,255,255,0.2)" }]}>
                      Bill recalculates each cycle based on current roster · Secured by Razorpay
                    </Text>
                  </View>
                </View>

                {/* Example bills */}
                <View style={[s.card, { backgroundColor: C.white, borderColor: C.border }]}>
                  <SecLabel text="Example bills" />
                  {[
                    { t: "Small clinic", c: 2, r: 6 },
                    { t: "Mid-size ER", c: 8, r: 28 },
                    { t: "Large hospital", c: 15, r: 50 },
                  ].map((ex, i) => {
                    const m = (ex.c * 599) + (ex.r * 399);
                    const a = (ex.c * 5990) + (ex.r * 3990);
                    return (
                      <View key={i} style={[s.exampleRow, i < 2 && { borderBottomWidth: 1, borderBottomColor: C.surface }]}>
                        <View>
                          <Text style={[s.exampleType, { color: C.ink }]}>{ex.t}</Text>
                          <Text style={[s.exampleDrs, { color: C.faint }]}>{ex.c}C · {ex.r}R</Text>
                        </View>
                        <View style={{ alignItems: "flex-end" }}>
                          <Text style={[s.exampleAmount, { color: C.greenDark }]}>
                            ₹{(isAnnual ? Math.round(a / 12) : m).toLocaleString("en-IN")}/mo
                          </Text>
                          {isAnnual && <Text style={[s.exampleYear, { color: C.faint }]}>₹{a.toLocaleString("en-IN")}/yr</Text>}
                        </View>
                      </View>
                    );
                  })}
                </View>

                {/* Team + Pro note */}
                <View style={[s.card, { backgroundColor: C.purpleLight, borderColor: C.purpleBorder }]}>
                  <Text style={[s.noCreditsCardTitle, { color: C.purple }]}>Team + Individual Pro</Text>
                  <Text style={[s.noCreditsCardBody, { color: C.muted }]}>
                    Team plan covers your hospital work. Individual Pro (₹1,199/mo, you pay personally) adds private Clinical Memory that your HOD cannot see — your career record across every hospital you've worked at.
                  </Text>
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* Sticky CTA */}
      <View style={[s.stickyBottom, {
        backgroundColor: isDarkMode ? "rgba(13,17,23,0.97)" : "rgba(247,248,250,0.97)",
        borderTopColor: isDarkMode ? "#2D333B" : C.border,
        paddingBottom: Math.max(insets.bottom, 16),
      }]}>
        {activeTab === "individual" ? (
          <>
            <Pressable
              style={({ pressed }) => [s.stickyCTA, {
                backgroundColor: isProActive ? (isDarkMode ? "#2D333B" : "#E5E7EB") : C.green,
                opacity: (pressed && !isProActive) || proLoading ? 0.88 : 1,
              }]}
              onPress={handleProCheckout}
              disabled={isProActive || proLoading}
            >
              {proLoading ? (
                <ActivityIndicator size="small" color={C.white} style={{ marginRight: 8 }} />
              ) : !isProActive ? (
                <Feather name="gift" size={16} color={C.white} style={{ marginRight: 8 }} />
              ) : null}
              <Text style={[s.stickyCTAText, { color: isProActive ? (isDarkMode ? "#6B7280" : "#9CA3AF") : C.white }]}>
                {proLoading ? "Opening Razorpay…" : isProActive ? "Current Plan" : "Start Pro — Free for 1st Month"}
              </Text>
            </Pressable>
            {!isProActive && (
              <Text style={[s.stickySubtext, { color: C.faint }]}>
                {isAnnual ? `Free 30 days · Then ₹${proAnnual.toLocaleString("en-IN")}/year (₹${proAnnualEq}/mo) · Save ₹${proSave.toLocaleString("en-IN")}` : "Free for 30 days · Then ₹1,199/month · Cancel anytime"}
              </Text>
            )}
          </>
        ) : teamStep === "idle" ? (
          <>
            <Pressable
              style={({ pressed }) => [s.stickyCTA, {
                backgroundColor: totalDrs < 4 ? "#E5E7EB" : C.green,
                opacity: pressed ? 0.88 : 1,
              }]}
              onPress={handleTeamEnroll}
            >
              <Feather name="users" size={16} color={totalDrs < 4 ? C.faint : C.white} style={{ marginRight: 8 }} />
              <Text style={[s.stickyCTAText, { color: totalDrs < 4 ? C.faint : C.white }]}>
                {totalDrs < 4 ? "Minimum 4 doctors required" : `Enroll Now — ₹${teamMonthly.toLocaleString("en-IN")}/month`}
              </Text>
            </Pressable>
            <Text style={[s.stickySubtext, { color: C.faint }]}>Bill updates automatically as roster changes</Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  center: { justifyContent: "center", alignItems: "center" },
  lockBanner: { flexDirection: "row", gap: 10, backgroundColor: "#FEF2F2", borderRadius: 12, padding: 14, marginBottom: 14, alignItems: "flex-start" },
  lockTitle: { fontSize: 14, fontWeight: "700" },
  lockMsg: { fontSize: 13, marginTop: 2, color: "#374151" },

  tabRow: { flexDirection: "row", borderRadius: 14, padding: 4, borderWidth: 1.5, gap: 3, marginBottom: 12 },
  tabBtn: { flex: 1, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  tabBtnText: { fontSize: 13, fontWeight: "700" },

  billingRow: { flexDirection: "row", borderRadius: 13, padding: 3, gap: 2, marginBottom: 10 },
  billingBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  billingBtnText: { fontSize: 13, fontWeight: "700" },
  savePill: { borderRadius: 5, paddingHorizontal: 6, paddingVertical: 2 },
  savePillText: { fontSize: 9, fontWeight: "800" },

  annualBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, marginBottom: 10 },
  annualBannerText: { fontSize: 12.5, fontWeight: "600" },

  card: { borderRadius: 18, padding: 16, borderWidth: 1.5, marginBottom: 14 },
  cardTopRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 },
  planTag: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", color: C.faint, marginBottom: 3 },
  planPrice: { fontSize: 26, fontWeight: "900", color: C.ink, letterSpacing: -0.8 },
  planDesc: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  activePill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 10, fontWeight: "700" },

  creditPreview: { borderRadius: 11, padding: 12, marginBottom: 12, borderWidth: 1 },
  creditPreviewTitle: { fontSize: 11, fontWeight: "700", marginBottom: 6 },
  creditTrack: { height: 5, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 99, overflow: "hidden", marginBottom: 6 },
  creditFill: { height: "100%", borderRadius: 99 },
  creditPreviewSub: { fontSize: 11 },

  frow: { flexDirection: "row", alignItems: "flex-start", gap: 9, marginBottom: 9 },
  fcheckBg: { width: 15, height: 15, borderRadius: 7.5, alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0 },
  frowText: { fontSize: 13, lineHeight: 19 },
  frowSub: { fontSize: 11, marginTop: 2, lineHeight: 15 },

  secLabel: { fontSize: 9, fontWeight: "800", letterSpacing: 1.3, textTransform: "uppercase", marginBottom: 10 },
  divider: { height: 1, marginVertical: 14 },

  proCard: { borderRadius: 20, overflow: "hidden", borderWidth: 2, marginBottom: 14, backgroundColor: C.white },
  proTagBar: { paddingVertical: 7, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  proTagLeft: { fontSize: 9, fontWeight: "800", letterSpacing: 1.5, color: C.white, textTransform: "uppercase" },
  proTagRight: { fontSize: 9, fontWeight: "600", color: "rgba(255,255,255,0.7)" },
  proPriceHeader: { padding: 16 },
  proPriceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 },
  priceDisplay: { flexDirection: "row", alignItems: "baseline", gap: 5 },
  priceStrike: { fontSize: 12, textDecorationLine: "line-through" },
  priceFree: { fontSize: 30, fontWeight: "900", letterSpacing: -1 },
  priceMain: { fontSize: 30, fontWeight: "900", letterSpacing: -1 },
  pricePer: { fontSize: 12 },
  priceSub: { fontSize: 11, marginTop: 2 },
  saveBadge: { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, alignItems: "center" },
  saveBadgeLabel: { fontSize: 10, fontWeight: "700" },
  saveBadgeAmount: { fontSize: 13, fontWeight: "900" },
  identityBox: { borderRadius: 11, padding: 12, borderWidth: 1 },
  identityTitle: { fontSize: 12, fontWeight: "700", marginBottom: 2 },
  identitySub: { fontSize: 11, lineHeight: 17 },
  proCardCTA: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 12, paddingVertical: 14, marginBottom: 6 },
  proCardCTAText: { fontSize: 14, fontWeight: "700" },
  proCardCTASub: { fontSize: 10, textAlign: "center" },
  noCreditsNote: { borderRadius: 10, padding: 12, marginBottom: 14 },
  noCreditsText: { fontSize: 12, lineHeight: 18 },
  noCreditsCardTitle: { fontSize: 12, fontWeight: "700", marginBottom: 6 },
  noCreditsCardBody: { fontSize: 12.5, lineHeight: 20 },

  teamCard: { borderRadius: 20, overflow: "hidden", borderWidth: 2, marginBottom: 14, backgroundColor: "#071810" },
  teamCardTag: { paddingVertical: 8, paddingHorizontal: 18, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderBottomWidth: 1 },
  teamTagLeft: { fontSize: 9, fontWeight: "800", letterSpacing: 1.4, textTransform: "uppercase" },
  teamTagRight: { fontSize: 9, fontWeight: "600" },
  teamPriceRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 },
  teamPriceFrom: { fontSize: 10, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 4 },
  teamPriceDisplay: { flexDirection: "row", alignItems: "baseline", gap: 3 },
  teamPriceFrom2: { fontSize: 11 },
  teamPriceMain: { fontSize: 30, fontWeight: "900", letterSpacing: -1 },
  teamPricePer: { fontSize: 12 },
  teamPriceSub: { fontSize: 11, marginTop: 2 },
  teamIcon: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  billCalc: { padding: 14, marginBottom: 16 },
  billRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  billRowLabel: { fontSize: 13, fontWeight: "600" },
  billRowRate: { fontSize: 10, marginTop: 1 },
  billStepper: { flexDirection: "row", alignItems: "center", gap: 10 },
  stepperBtn: { width: 28, height: 28, borderRadius: 8, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  stepperBtnText: { fontSize: 16, fontWeight: "700" },
  stepperVal: { fontSize: 18, fontWeight: "800", minWidth: 24, textAlign: "center" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  totalLabel: { fontSize: 10, marginBottom: 2 },
  totalDisplay: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  totalAmount: { fontSize: 28, fontWeight: "900", letterSpacing: -0.5 },
  totalPer: { fontSize: 12, fontWeight: "400" },
  totalSavings: { fontSize: 10, fontWeight: "600", marginTop: 2 },
  totalDrs: { fontSize: 11 },
  totalPerDoc: { fontSize: 10, marginTop: 2 },
  minDrsWarn: { fontSize: 11, fontWeight: "600", textAlign: "center", marginTop: 10 },
  enrollBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 12, paddingVertical: 15, marginTop: 16, marginBottom: 8 },
  enrollBtnText: { fontSize: 14, fontWeight: "700", color: C.white },
  enrollNote: { fontSize: 10, textAlign: "center" },
  memoryNote: { borderRadius: 12, padding: 13, marginBottom: 16, borderWidth: 1 },
  memoryNoteTitle: { fontSize: 11, fontWeight: "700", marginBottom: 4 },
  memoryNoteSub: { fontSize: 12, lineHeight: 19 },

  successCard: { borderRadius: 18, padding: 24, alignItems: "center", borderWidth: 2, marginBottom: 14 },
  successTitle: { fontSize: 16, fontWeight: "800", marginBottom: 6 },
  successSub: { fontSize: 13, lineHeight: 20, textAlign: "center", marginBottom: 14 },
  successBtn: { width: "100%", borderRadius: 11, paddingVertical: 12, alignItems: "center" },
  successBtnText: { fontSize: 13, fontWeight: "700", color: C.white },

  confirmCard: { borderRadius: 18, padding: 18, borderWidth: 2, marginBottom: 14, backgroundColor: C.white },
  confirmTitle: { fontSize: 15, fontWeight: "800", marginBottom: 4, letterSpacing: -0.3 },
  confirmSub: { fontSize: 12, marginBottom: 14 },
  confirmRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", paddingVertical: 9, borderBottomWidth: 1 },
  confirmRowLabel: { fontSize: 13 },
  confirmRowValue: { fontSize: 13 },
  confirmRowSub: { fontSize: 10, marginTop: 2 },
  confirmBtns: { flexDirection: "row", gap: 10, marginTop: 14 },
  confirmCancel: { flex: 1, borderRadius: 11, paddingVertical: 12, alignItems: "center", borderWidth: 1 },
  confirmCancelText: { fontSize: 13, fontWeight: "600" },
  confirmPay: { flex: 2, borderRadius: 11, paddingVertical: 12, alignItems: "center", flexDirection: "row", justifyContent: "center", gap: 7 },
  confirmPayText: { fontSize: 13, fontWeight: "700", color: C.white },
  confirmNote: { fontSize: 10, textAlign: "center", marginTop: 8 },

  payingCard: { borderRadius: 18, padding: 32, alignItems: "center", borderWidth: 1.5, marginBottom: 14, backgroundColor: C.white },
  payingTitle: { fontSize: 14, fontWeight: "700" },
  payingSub: { fontSize: 12, marginTop: 6 },

  exampleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 9 },
  exampleType: { fontSize: 13, fontWeight: "600" },
  exampleDrs: { fontSize: 11, marginTop: 1 },
  exampleAmount: { fontSize: 14, fontWeight: "800" },
  exampleYear: { fontSize: 10, marginTop: 1 },

  stickyBottom: { borderTopWidth: 1, paddingTop: 12, paddingHorizontal: 16 },
  stickyCTA: { flexDirection: "row", alignItems: "center", justifyContent: "center", borderRadius: 14, paddingVertical: 15, marginBottom: 8 },
  stickyCTAText: { fontSize: 15, fontWeight: "700" },
  stickySubtext: { fontSize: 11, textAlign: "center", marginBottom: 4 },
});
