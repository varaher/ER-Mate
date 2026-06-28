import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  Linking,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useFocusEffect } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useDepartment } from "@/context/DepartmentContext";
import { getApiUrl } from "@/lib/query-client";

const C = {
  green: "#1DB870",
  greenDark: "#15924F",
  greenLight: "rgba(29,184,112,0.09)",
  greenBorder: "rgba(29,184,112,0.2)",
  purple: "#7C6AF6",
  purpleDark: "#5B4FD4",
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
  orangeLight: "rgba(245,158,11,0.09)",
  orangeBorder: "rgba(245,158,11,0.2)",
  red: "#EF4444",
};

interface SubStatus {
  plan: string;
  status: string;
  casesUsed: number;
  casesLimit: number;
  casesRemaining: number | null;
  currentPeriodEnd: string | null;
  credits_balance: number;
  isTrial?: boolean;
  trialEnd?: string | null;
}

function getAccess(sub: { plan: string; teamActive: boolean; casesUsed: number; aiCredits: number }) {
  const unlimited = sub.teamActive || sub.plan === "pro" || sub.plan === "trial";
  const isFree = !unlimited && sub.plan === "free";
  return {
    unlimited,
    isFree,
    cases: unlimited ? "unlimited" : `${sub.casesUsed || 0} of 10`,
    smartDictation: true,
    discharge: true,
    aiFeatures: unlimited ? "unlimited" : (sub.aiCredits > 0 ? "credits" : "blocked"),
    aiCredits: sub.aiCredits || 0,
    rounds: unlimited ? "unlimited" : (sub.aiCredits > 0 ? "credits" : "blocked"),
    clinicalMemory: sub.plan === "pro",
    handover: sub.teamActive,
    shiftMgmt: sub.teamActive,
    showCreditBar: isFree,
    showUpgrade: isFree,
  };
}

function CreditBar({ credits, maxCredits = 5, onUpgrade }: { credits: number; maxCredits?: number; onUpgrade: () => void }) {
  const used = maxCredits - credits;
  const pct = Math.min(100, (used / Math.max(1, maxCredits)) * 100);
  const low = credits <= 2 && credits > 0;
  const gone = credits === 0;
  const barColor = gone ? C.red : low ? C.orange : C.green;
  const bgColor = gone ? "#FEF2F2" : low ? C.orangeLight : C.greenLight;
  const borderColor = gone ? "#FECACA" : low ? C.orangeBorder : C.greenBorder;
  const titleColor = gone ? C.red : low ? "#92400E" : C.greenDark;

  return (
    <View style={[styles.creditBar, { backgroundColor: bgColor, borderColor }]}>
      <View style={styles.creditBarTop}>
        <Text style={[styles.creditBarTitle, { color: titleColor }]}>
          {gone ? "AI credits used up" : `${credits} AI credit${credits === 1 ? "" : "s"} remaining`}
        </Text>
        <Text style={[styles.creditBarUsed, { color: C.faint }]}>{used}/{maxCredits} used</Text>
      </View>
      <View style={styles.creditTrack}>
        <View style={[styles.creditFill, { width: `${pct}%` as any, backgroundColor: barColor }]} />
      </View>
      <Text style={[styles.creditBarDesc, { color: C.muted }]}>
        {gone
          ? "Upgrade to Pro for unlimited AI — Decision Support, Rounds, OCR, and more."
          : low
          ? `${credits} credit${credits === 1 ? "" : "s"} left. Each AI action uses 1 credit.`
          : "Each AI action (Decision Support, Rounds, OCR) uses 1 credit."}
      </Text>
      {(gone || low) && (
        <Pressable style={[styles.creditUpgradeBtn, { backgroundColor: C.green }]} onPress={onUpgrade}>
          <Text style={styles.creditUpgradeBtnText}>Upgrade to Pro — Unlimited</Text>
          <Feather name="arrow-right" size={14} color={C.white} />
        </Pressable>
      )}
    </View>
  );
}

function StatusPill({ status }: { status: "active" | "inactive" | "trial" }) {
  const map = {
    active: { label: "Active", bg: C.greenLight, color: C.greenDark, dot: C.green },
    trial: { label: "Trial", bg: C.orangeLight, color: "#92400E", dot: C.orange },
    inactive: { label: "Inactive", bg: "#F3F4F6", color: C.faint, dot: "#D1D5DB" },
  };
  const s = map[status];
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <View style={[styles.pillDot, { backgroundColor: s.dot }]} />
      <Text style={[styles.pillText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

export default function MySubscriptionsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user, token } = useAuth();
  const { department, membership, isInDepartment, activeShift, shiftSession } = useDepartment();

  const [subStatus, setSubStatus] = useState<SubStatus | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);

  const fetchSub = useCallback(async () => {
    if (!user?.id) { setLoadingSub(false); return; }
    try {
      const baseUrl = getApiUrl();
      const url = new URL(`/api/subscription/status?userId=${encodeURIComponent(user.id)}&userEmail=${encodeURIComponent(user.email || "")}`, baseUrl).href;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (!res.ok) throw new Error("status error");
      const data = await res.json();
      setSubStatus(data);
    } catch {
      setSubStatus(null);
    } finally {
      setLoadingSub(false);
    }
  }, [user?.id, user?.email, token]);

  useFocusEffect(useCallback(() => { fetchSub(); }, [fetchSub]));

  const showTeam = isInDepartment;
  const plan = subStatus?.plan ?? "free";
  const isTrial = plan === "trial";
  const showPro = plan === "pro";
  const aiCredits = subStatus?.credits_balance ?? 0;

  const access = getAccess({
    plan,
    teamActive: showTeam,
    casesUsed: subStatus?.casesUsed ?? 0,
    aiCredits,
  });

  const showFree = access.isFree;
  const showBoth = showTeam && showPro;

  const formatRenew = (iso: string | null | undefined) => {
    if (!iso) return undefined;
    try { return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
    catch { return undefined; }
  };

  const renewDate = formatRenew(subStatus?.currentPeriodEnd);
  const doctorInitial = user?.name?.charAt(0)?.toUpperCase() ?? "D";

  const handleJoinTeam = () => (navigation as any).navigate("SetupDepartment");
  const handleUpgrade = () => (navigation as any).navigate("Upgrade", {});
  const handleLeave = () =>
    Alert.alert(
      "Leave Department",
      "Department removal is managed by your HOD. You can email support if you need help.",
      [
        { text: "Email Support", onPress: () => Linking.openURL("mailto:support@ermate.app?subject=Department removal request") },
        { text: "OK", style: "cancel" },
      ]
    );
  const handleManage = () =>
    Alert.alert(
      "Manage Individual Pro",
      "To cancel or change your subscription, contact our support team.",
      [
        { text: "Email Support", onPress: () => Linking.openURL("mailto:support@ermate.app?subject=Manage%20my%20Individual%20Pro%20subscription") },
        { text: "Close", style: "cancel" },
      ]
    );

  if (loadingSub) {
    return (
      <View style={[styles.loadingWrap, { paddingTop: headerHeight + 40 }]}>
        <ActivityIndicator size="large" color={C.green} />
      </View>
    );
  }

  const roleLabel = membership?.role === "hod" ? "HOD" : membership?.role === "consultant" ? "Consultant" : "Resident";
  const hospitalCanSee = showPro
    ? "Cases on shift · Handover records · Activity logs"
    : "Cases on shift · Handover records · Activity logs · Rounds activity";
  const hospitalCannotSee = showPro
    ? "Rounds debriefs · Clinical Memory · Off-shift cases"
    : "Off-shift cases only — add Pro for private Rounds";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.surface }}
      contentContainerStyle={{
        paddingTop: headerHeight + 14,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 40,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Identity row */}
      <View style={[styles.identityRow, { backgroundColor: C.white, borderColor: C.border }]}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarText}>{doctorInitial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.identityName, { color: C.ink }]} numberOfLines={1}>{user?.name || "Doctor"}</Text>
          <Text style={[styles.identityEmail, { color: C.faint }]} numberOfLines={1}>{user?.email || ""}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {showPro && <Text style={[styles.planBadge, { color: C.green }]}>Pro · Active</Text>}
          {showTeam && <Text style={[styles.planBadge, { color: C.greenDark, marginTop: showPro ? 2 : 0 }]}>Team · Active</Text>}
          {isTrial && <Text style={[styles.planBadge, { color: C.orange }]}>Free Trial</Text>}
          {!showPro && !showTeam && !isTrial && <Text style={[styles.planBadge, { color: C.faint }]}>Free</Text>}
        </View>
      </View>

      {/* Credit bar — Free users only */}
      {access.showCreditBar && (
        <CreditBar credits={aiCredits} onUpgrade={handleUpgrade} />
      )}

      {/* Combined banner — both plans active */}
      {showBoth && (
        <View style={[styles.combinedBanner, { backgroundColor: "#071810", borderColor: "rgba(255,255,255,0.06)" }]}>
          <Text style={[styles.combinedLabel, { color: "rgba(255,255,255,0.35)" }]}>BOTH PLANS ACTIVE</Text>
          <Text style={[styles.combinedTitle, { color: C.white }]}>Full ErMate — shift work and career growth</Text>
          <View style={styles.combinedCards}>
            <View style={[styles.combinedCard, { backgroundColor: "rgba(29,184,112,0.1)", borderColor: "rgba(29,184,112,0.18)" }]}>
              <View style={styles.combinedCardHeader}>
                <Feather name="users" size={13} color={C.green} />
                <Text style={[styles.combinedCardLabel, { color: C.green }]}>TEAM PLAN</Text>
              </View>
              <Text style={[styles.combinedCardDesc, { color: "rgba(255,255,255,0.45)" }]}>Shift · Dept · Hospital pays</Text>
            </View>
            <View style={[styles.combinedCard, { backgroundColor: "rgba(124,106,246,0.1)", borderColor: "rgba(124,106,246,0.18)" }]}>
              <View style={styles.combinedCardHeader}>
                <Feather name="cpu" size={13} color={C.purple} />
                <Text style={[styles.combinedCardLabel, { color: C.purple }]}>INDIVIDUAL PRO</Text>
              </View>
              <Text style={[styles.combinedCardDesc, { color: "rgba(255,255,255,0.45)" }]}>Rounds · Memory · You pay</Text>
            </View>
          </View>
          <Text style={[styles.combinedNote, { color: "rgba(255,255,255,0.3)" }]}>
            Cases on shift → department. Rounds + Memory → yours, private, always.
          </Text>
        </View>
      )}

      {/* Trial card */}
      {isTrial && (
        <View style={[styles.card, { backgroundColor: C.white, borderColor: C.orangeBorder }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <View style={{ backgroundColor: C.orangeLight, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
              <Text style={{ color: "#92400E", fontSize: 11, fontWeight: "700", letterSpacing: 0.4 }}>FREE TRIAL</Text>
            </View>
            <Feather name="gift" size={15} color={C.orange} />
          </View>
          <Text style={{ color: C.ink, fontSize: 15, fontWeight: "700", marginBottom: 4 }}>
            All features unlocked — 30 days free
          </Text>
          <Text style={{ color: C.muted, fontSize: 13, lineHeight: 18, marginBottom: 12 }}>
            Full access to Smart Dictation, AI Decision Support, document scanning, unlimited cases, discharge summaries, and every learning tool — at no cost.
          </Text>
          {subStatus?.trialEnd ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 12 }}>
              <Feather name="clock" size={13} color={C.orange} />
              <Text style={{ color: "#92400E", fontSize: 13, fontWeight: "600" }}>
                Trial ends {new Date(subStatus.trialEnd).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable
              style={[styles.freeBtn, { backgroundColor: C.greenLight, borderColor: C.greenBorder, flex: 1 }]}
              onPress={handleUpgrade}
            >
              <Text style={[styles.freeBtnText, { color: C.greenDark }]}>Subscribe after trial</Text>
              <Feather name="arrow-right" size={13} color={C.greenDark} />
            </Pressable>
          </View>
        </View>
      )}

      {/* Free state card */}
      {showFree && !isTrial && (
        <View style={[styles.card, { backgroundColor: C.white, borderColor: C.border }]}>
          <Text style={[styles.freeTitle, { color: C.ink }]}>
            Free plan — {Math.max(0, 10 - (subStatus?.casesUsed ?? 0))} cases remaining
          </Text>
          <View style={[styles.caseTrack, { backgroundColor: C.surface }]}>
            <View style={[styles.caseFill, {
              width: `${Math.min(100, ((subStatus?.casesUsed ?? 0) / 10) * 100)}%` as any,
              backgroundColor: C.green,
            }]} />
          </View>
          <View style={styles.freeBtns}>
            <Pressable
              style={[styles.freeBtn, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]}
              onPress={handleUpgrade}
            >
              <Text style={[styles.freeBtnText, { color: C.greenDark }]}>Individual Pro</Text>
              <Feather name="arrow-right" size={13} color={C.greenDark} />
            </Pressable>
            <Pressable
              style={[styles.freeBtn, { backgroundColor: C.purpleLight, borderColor: C.purpleBorder }]}
              onPress={handleJoinTeam}
            >
              <Text style={[styles.freeBtnText, { color: C.purple }]}>Join a team</Text>
              <Feather name="arrow-right" size={13} color={C.purple} />
            </Pressable>
          </View>
        </View>
      )}

      {/* ── TEAM SECTION ── */}
      {!showFree && (
        <View style={{ marginBottom: 12 }}>
          <View style={styles.sectionHeader}>
            <Feather name="home" size={12} color={C.faint} />
            <Text style={[styles.sectionHeaderText, { color: C.faint }]}>DEPARTMENT</Text>
          </View>

          {showTeam ? (
            <View style={[styles.activeCard, { borderColor: C.greenBorder }]}>
              {/* Dark header */}
              <View style={[styles.cardHeader, { backgroundColor: "#071810" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]}>
                    <Feather name="users" size={16} color={C.green} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardHeaderLabel}>TEAM PLAN</Text>
                    <Text style={styles.cardHeaderTitle} numberOfLines={1}>{department?.name || "My Department"}</Text>
                  </View>
                </View>
                <StatusPill status="active" />
              </View>

              <View style={styles.cardBody}>
                {/* Meta grid */}
                <View style={styles.metaGrid}>
                  {[
                    { label: "Your role", value: roleLabel, color: C.greenDark },
                    { label: "Shift", value: shiftSession && activeShift ? `${activeShift.name} · On` : "Off shift", color: shiftSession && activeShift ? C.green : C.faint },
                    { label: "Hospital", value: department?.hospitalName || "—", color: C.inkSoft },
                    { label: "Paid by", value: "Hospital", color: C.inkSoft },
                  ].map((item, i) => (
                    <View key={i} style={[styles.metaCell, { backgroundColor: C.surface }]}>
                      <Text style={styles.metaCellLabel}>{item.label}</Text>
                      <Text style={[styles.metaCellValue, { color: item.color }]} numberOfLines={1}>{item.value}</Text>
                    </View>
                  ))}
                </View>

                {/* Hospital can see */}
                <View style={[styles.alertBox, { backgroundColor: C.orangeLight, borderColor: C.orangeBorder }]}>
                  <Feather name="alert-triangle" size={14} color={C.orange} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertBoxTitle, { color: "#92400E" }]}>Hospital can see</Text>
                    <Text style={[styles.alertBoxBody, { color: "#B45309" }]}>{hospitalCanSee}</Text>
                  </View>
                </View>

                {/* Hospital cannot see */}
                <View style={[styles.alertBox, { backgroundColor: C.greenLight, borderColor: C.greenBorder, marginTop: 8 }]}>
                  <Feather name="shield" size={14} color={C.greenDark} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertBoxTitle, { color: C.greenDark }]}>Hospital cannot see</Text>
                    <Text style={[styles.alertBoxBody, { color: C.muted }]}>{hospitalCannotSee}</Text>
                  </View>
                </View>

                {/* Add Pro upsell if no Pro */}
                {!showPro && (
                  <Pressable
                    style={[styles.alertBox, { backgroundColor: C.purpleLight, borderColor: C.purpleBorder, marginTop: 8, justifyContent: "space-between" }]}
                    onPress={handleUpgrade}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.alertBoxBody, { color: C.purple, lineHeight: 18 }]}>
                        Add Individual Pro for private Rounds + Clinical Memory
                      </Text>
                    </View>
                    <View style={[styles.smallBtn, { backgroundColor: C.white, borderColor: C.purpleBorder, marginLeft: 8 }]}>
                      <Text style={[styles.smallBtnText, { color: C.purple }]}>₹1,199/mo</Text>
                      <Feather name="arrow-right" size={11} color={C.purple} />
                    </View>
                  </Pressable>
                )}
              </View>

              <View style={[styles.cardFooter, { borderTopColor: C.border }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Feather name="clock" size={11} color={C.faint} />
                  <Text style={styles.footerMeta}>{renewDate ? `Next bill: ${renewDate}` : "Team plan active"}</Text>
                </View>
                <Pressable onPress={handleLeave}>
                  <Text style={styles.footerAction}>Leave department</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={[styles.card, { backgroundColor: C.white, borderColor: C.border }]}>
              <View style={styles.inactiveRow}>
                <View style={[styles.inactiveIcon, { backgroundColor: C.surface, borderColor: C.border }]}>
                  <Feather name="home" size={18} color={C.faint} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inactiveTitle, { color: C.faint }]}>Team Plan</Text>
                  <Text style={[styles.inactiveSub, { color: C.faint }]}>Not part of any department</Text>
                </View>
                <Pressable
                  style={[styles.smallBtn, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]}
                  onPress={handleJoinTeam}
                >
                  <Text style={[styles.smallBtnText, { color: C.greenDark }]}>Join team</Text>
                  <Feather name="arrow-right" size={12} color={C.greenDark} />
                </Pressable>
              </View>
            </View>
          )}
        </View>
      )}

      {/* ── INDIVIDUAL PRO SECTION ── */}
      {!showFree && (
        <View style={{ marginBottom: 12 }}>
          <View style={styles.sectionHeader}>
            <Feather name="cpu" size={12} color={C.faint} />
            <Text style={[styles.sectionHeaderText, { color: C.faint }]}>PERSONAL PLAN</Text>
          </View>

          {showPro ? (
            <View style={[styles.activeCard, { borderColor: C.purpleBorder }]}>
              {/* Dark purple header */}
              <View style={[styles.cardHeader, { backgroundColor: "#0e0b1c" }]}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                  <View style={[styles.cardHeaderIcon, { backgroundColor: C.purpleLight, borderColor: C.purpleBorder }]}>
                    <Feather name="cpu" size={16} color={C.purple} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardHeaderLabel}>INDIVIDUAL PRO</Text>
                    <Text style={styles.cardHeaderTitle}>Your career layer</Text>
                  </View>
                </View>
                <StatusPill status="active" />
              </View>

              <View style={styles.cardBody}>
                {/* Feature bullets */}
                <View style={[styles.proFeaturesBox, { backgroundColor: C.purpleLight, borderColor: C.purpleBorder }]}>
                  <Text style={[styles.proFeaturesLabel, { color: C.purple }]}>WHAT INDIVIDUAL PRO GIVES YOU</Text>
                  {[
                    { emoji: "🧠", text: "Rounds — unlimited debriefs", sub: "After every case, at any hospital" },
                    { emoji: "📚", text: "All 7 thinking lenses", sub: "First Principles to Full Debrief" },
                    { emoji: "💾", text: "Clinical Memory — full career", sub: "Every hospital you've ever worked at" },
                    { emoji: "🔒", text: "Fully private — HOD cannot see", sub: "This record belongs only to you" },
                  ].map((item, i) => (
                    <View key={i} style={[styles.proFeatureRow, i < 3 && { marginBottom: 10 }]}>
                      <Text style={styles.proFeatureEmoji}>{item.emoji}</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.proFeatureText, { color: C.inkSoft }]}>{item.text}</Text>
                        <Text style={[styles.proFeatureSub, { color: C.faint }]}>{item.sub}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Privacy note */}
                <View style={[styles.alertBox, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]}>
                  <Feather name="shield" size={14} color={C.greenDark} style={{ marginTop: 1 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertBoxBody, { color: C.greenDark, lineHeight: 18 }]}>
                      <Text style={{ fontWeight: "700" }}>Fully private.</Text>
                      {" "}No hospital, no HOD, no employer has access to your Rounds or Clinical Memory — ever.
                    </Text>
                  </View>
                </View>
              </View>

              <View style={[styles.cardFooter, { borderTopColor: C.border }]}>
                <View>
                  <Text style={[styles.footerMeta, { fontSize: 13, fontWeight: "700", color: C.ink }]}>₹1,199/month</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 }}>
                    <Feather name="clock" size={11} color={C.faint} />
                    <Text style={styles.footerMeta}>{renewDate ? `Renews ${renewDate}` : "Individual Pro active"}</Text>
                  </View>
                </View>
                <Pressable
                  style={[styles.manageBtn, { borderColor: C.border }]}
                  onPress={handleManage}
                >
                  <Text style={[styles.manageBtnText, { color: C.faint }]}>Manage</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <Pressable
              style={[styles.card, { backgroundColor: C.purpleLight, borderColor: C.purpleBorder, borderStyle: "dashed" }]}
              onPress={handleUpgrade}
            >
              <View style={styles.inactiveRow}>
                <View style={[styles.inactiveIcon, { backgroundColor: "rgba(124,106,246,0.08)", borderColor: C.purpleBorder }]}>
                  <Feather name="cpu" size={18} color={C.purple} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inactiveTitle, { color: C.purple }]}>Individual Pro</Text>
                  <Text style={[styles.inactiveSub, { color: C.muted }]}>
                    Private Rounds + Clinical Memory{showTeam ? " · HOD cannot see it" : " · Your career record"}
                  </Text>
                </View>
                <View style={[styles.proUpgradeBtn, { backgroundColor: C.purple }]}>
                  <Text style={styles.proUpgradeBtnText}>₹1,199/mo</Text>
                  <Feather name="arrow-right" size={12} color={C.white} />
                </View>
              </View>
            </Pressable>
          )}
        </View>
      )}

      {/* ── ACCESS TABLE ── */}
      {!showFree && (
        <View style={[styles.card, { backgroundColor: C.white, borderColor: C.border }]}>
          <Text style={[styles.accessTitle, { color: C.ink }]}>Your access</Text>
          {[
            { label: "Case documentation", val: access.cases === "unlimited" ? "Unlimited" : access.cases },
            { label: "Smart Dictation", val: "Always free" },
            { label: "AI Discharge Summary", val: "Always free" },
            { label: "Decision Support", val: access.unlimited ? "Unlimited" : access.aiCredits > 0 ? `${access.aiCredits} credits left` : "Upgrade to unlock" },
            { label: "Rounds debriefs", val: access.unlimited ? "Unlimited" : access.aiCredits > 0 ? `${access.aiCredits} credits left` : "Upgrade to unlock" },
            { label: "Clinical Memory", val: access.clinicalMemory ? "Private ✓" : "Add Pro" },
            { label: "Shift management", val: access.shiftMgmt ? "Active ✓" : "—" },
            { label: "Case handover", val: access.handover ? "Active ✓" : "—" },
          ].map((item, i, arr) => {
            const isGood = item.val.includes("Unlimited") || item.val.includes("✓") || item.val.includes("free");
            const isCredit = item.val.includes("credits");
            const isLocked = item.val.includes("Upgrade") || item.val.includes("Add") || item.val === "—";
            const valColor = isGood ? C.greenDark : isCredit ? C.orange : isLocked ? (item.val === "—" ? C.faint : C.red) : C.faint;
            return (
              <View key={i} style={[styles.accessRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: C.surface }]}>
                <Text style={[styles.accessLabel, { color: C.inkSoft }]}>{item.label}</Text>
                <Text style={[styles.accessVal, { color: valColor }]}>{item.val}</Text>
              </View>
            );
          })}
        </View>
      )}

      {/* Help */}
      <Pressable
        style={styles.helpRow}
        onPress={() => (navigation as any).navigate("HelpSupport")}
      >
        <Text style={[styles.helpText, { color: C.faint }]}>Questions?</Text>
        <Text style={[styles.helpLink, { color: C.green }]}>support@ermate.app</Text>
        <Feather name="arrow-right" size={13} color={C.green} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: "center", backgroundColor: C.surface },

  identityRow: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 16, padding: 14, borderWidth: 1.5, marginBottom: 12, backgroundColor: C.white },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.green, alignItems: "center", justifyContent: "center", flexShrink: 0 },
  avatarText: { fontSize: 17, fontWeight: "800", color: C.white },
  identityName: { fontSize: 15, fontWeight: "800", letterSpacing: -0.3 },
  identityEmail: { fontSize: 12, marginTop: 1 },
  planBadge: { fontSize: 11, fontWeight: "700" },

  creditBar: { borderRadius: 14, padding: 14, borderWidth: 1, marginBottom: 12 },
  creditBarTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  creditBarTitle: { fontSize: 12, fontWeight: "700" },
  creditBarUsed: { fontSize: 11 },
  creditTrack: { height: 6, backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 99, overflow: "hidden", marginBottom: 10 },
  creditFill: { height: "100%", borderRadius: 99 },
  creditBarDesc: { fontSize: 11, lineHeight: 16, marginBottom: 0 },
  creditUpgradeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 10, paddingVertical: 10, marginTop: 10 },
  creditUpgradeBtnText: { fontSize: 13, fontWeight: "700", color: C.white },

  combinedBanner: { borderRadius: 16, padding: 16, borderWidth: 1, marginBottom: 12 },
  combinedLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 },
  combinedTitle: { fontSize: 14, fontWeight: "800", marginBottom: 12, letterSpacing: -0.3 },
  combinedCards: { flexDirection: "row", gap: 8, marginBottom: 10 },
  combinedCard: { flex: 1, borderRadius: 11, padding: 11, borderWidth: 1 },
  combinedCardHeader: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 4 },
  combinedCardLabel: { fontSize: 8, fontWeight: "800", letterSpacing: 0.5 },
  combinedCardDesc: { fontSize: 11, lineHeight: 16 },
  combinedNote: { fontSize: 11, lineHeight: 17 },

  pill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 10, fontWeight: "700" },

  card: { borderRadius: 18, padding: 16, borderWidth: 1.5, marginBottom: 12, backgroundColor: C.white },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 7, paddingLeft: 2 },
  sectionHeaderText: { fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1 },

  freeTitle: { fontSize: 14, fontWeight: "700", marginBottom: 8 },
  caseTrack: { height: 6, borderRadius: 99, overflow: "hidden", marginBottom: 14 },
  caseFill: { height: "100%", borderRadius: 99 },
  freeBtns: { flexDirection: "row", gap: 10 },
  freeBtn: { flex: 1, borderRadius: 11, paddingVertical: 11, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, borderWidth: 1 },
  freeBtnText: { fontSize: 13, fontWeight: "700" },

  activeCard: { borderRadius: 16, overflow: "hidden", borderWidth: 2 },
  cardHeader: { paddingVertical: 13, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardHeaderIcon: { width: 34, height: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  cardHeaderLabel: { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.35)", letterSpacing: 0.8, textTransform: "uppercase" },
  cardHeaderTitle: { fontSize: 14, fontWeight: "800", color: C.white, letterSpacing: -0.3 },
  cardBody: { padding: 14 },
  cardFooter: { paddingVertical: 11, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1 },
  footerMeta: { fontSize: 11, color: C.faint },
  footerAction: { fontSize: 12, fontWeight: "600", color: C.faint },

  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  metaCell: { flex: 1, minWidth: "45%", borderRadius: 9, padding: 10 },
  metaCellLabel: { fontSize: 9, color: C.faint, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 },
  metaCellValue: { fontSize: 13, fontWeight: "700" },

  alertBox: { flexDirection: "row", gap: 8, borderRadius: 10, padding: 12, borderWidth: 1 },
  alertBoxTitle: { fontSize: 11, fontWeight: "700", marginBottom: 2 },
  alertBoxBody: { fontSize: 11, lineHeight: 17 },

  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  smallBtnText: { fontSize: 12, fontWeight: "600" },

  inactiveRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  inactiveIcon: { width: 40, height: 40, borderRadius: 11, alignItems: "center", justifyContent: "center", borderWidth: 1.5 },
  inactiveTitle: { fontSize: 13, fontWeight: "700" },
  inactiveSub: { fontSize: 12, marginTop: 2 },
  proUpgradeBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: 9, paddingHorizontal: 13, paddingVertical: 8 },
  proUpgradeBtnText: { fontSize: 12, fontWeight: "700", color: C.white },

  proFeaturesBox: { borderRadius: 11, padding: 13, marginBottom: 12, borderWidth: 1 },
  proFeaturesLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 12 },
  proFeatureRow: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  proFeatureEmoji: { fontSize: 16, flexShrink: 0, marginTop: 1 },
  proFeatureText: { fontSize: 13, fontWeight: "600" },
  proFeatureSub: { fontSize: 11, marginTop: 1 },

  manageBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1 },
  manageBtnText: { fontSize: 12, fontWeight: "600" },

  accessTitle: { fontSize: 13, fontWeight: "700", marginBottom: 12 },
  accessRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 7 },
  accessLabel: { fontSize: 12.5 },
  accessVal: { fontSize: 12, fontWeight: "600" },

  helpRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 8, marginTop: 4 },
  helpText: { fontSize: 13 },
  helpLink: { fontSize: 13, fontWeight: "600" },
});
