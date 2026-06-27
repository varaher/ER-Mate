import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/context/AuthContext";
import { useDepartment } from "@/context/DepartmentContext";
import { getApiUrl } from "@/lib/query-client";

// ── Color tokens ─────────────────────────────────────────────────────────────
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
  teamHeaderBg: "#0D1F14",
  proHeaderBg: "#130F26",
  combinedBg: "#0D1520",
};

type Scenario = "both" | "team_only" | "pro_only" | "free";
type PillStatus = "active" | "trial" | "inactive" | "grace";

const SCENARIOS: { id: Scenario; label: string }[] = [
  { id: "both", label: "Both active" },
  { id: "team_only", label: "Team only" },
  { id: "pro_only", label: "Pro only" },
  { id: "free", label: "Free" },
];

// ── Status pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: PillStatus }) {
  const map: Record<PillStatus, { label: string; bg: string; color: string; dot: string }> = {
    active: { label: "Active", bg: C.greenLight, color: C.greenDark, dot: C.green },
    trial: { label: "Trial", bg: C.orangeLight, color: "#92400E", dot: C.orange },
    inactive: { label: "Inactive", bg: "#F3F4F6", color: C.faint, dot: "#D1D5DB" },
    grace: { label: "Grace period", bg: C.orangeLight, color: "#92400E", dot: C.orange },
  };
  const s = map[status] ?? map.inactive;
  return (
    <View style={[styles.pill, { backgroundColor: s.bg }]}>
      <View style={[styles.pillDot, { backgroundColor: s.dot }]} />
      <Text style={[styles.pillText, { color: s.color }]}>{s.label}</Text>
    </View>
  );
}

// ── Team plan card ───────────────────────────────────────────────────────────
interface TeamCardProps {
  active: boolean;
  deptName?: string;
  role?: string;
  shiftName?: string;
  renewDate?: string;
  onJoin?: () => void;
  onLeave?: () => void;
}

function TeamPlanCard({ active, deptName, role, shiftName, renewDate, onJoin, onLeave }: TeamCardProps) {
  const roleLabel = role === "hod" ? "HOD" : role === "consultant" ? "Consultant" : "Resident";

  if (!active) {
    return (
      <View style={[styles.card, styles.cardBorder]}>
        <View style={[styles.inactiveIcon, { backgroundColor: C.surface, borderColor: C.border }]}>
          <Feather name="home" size={20} color={C.faint} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.inactiveTitle, { color: C.faint }]}>Team Plan</Text>
          <Text style={[styles.inactiveSub, { color: C.faint }]}>Not part of any department</Text>
        </View>
        <Pressable
          style={[styles.smallBtn, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]}
          onPress={onJoin}
        >
          <Text style={[styles.smallBtnText, { color: C.greenDark }]}>Join team</Text>
          <Feather name="arrow-right" size={12} color={C.greenDark} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.activeCard, { borderColor: C.greenBorder }]}>
      {/* Header */}
      <View style={[styles.cardHeader, { backgroundColor: C.teamHeaderBg }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <View style={[styles.cardHeaderIcon, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]}>
            <Feather name="home" size={16} color={C.green} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardHeaderLabel}>TEAM PLAN</Text>
            <Text style={styles.cardHeaderTitle} numberOfLines={1}>{deptName || "My Department"}</Text>
          </View>
        </View>
        <StatusPill status="active" />
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        <View style={styles.metaGrid}>
          {[
            { label: "Your role", value: roleLabel, color: C.greenDark },
            { label: "Current shift", value: shiftName ? `${shiftName} · Active` : "Off shift", color: shiftName ? C.green : C.faint },
            { label: "Department", value: deptName || "—", color: C.inkSoft },
            { label: "Paid by", value: "Hospital", color: C.inkSoft },
          ].map((item, i) => (
            <View key={i} style={[styles.metaCell, { backgroundColor: C.surface }]}>
              <Text style={styles.metaCellLabel}>{item.label}</Text>
              <Text style={[styles.metaCellValue, { color: item.color }]} numberOfLines={1}>{item.value}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.alertBox, { backgroundColor: C.orangeLight, borderColor: C.orangeBorder }]}>
          <Feather name="alert-triangle" size={14} color={C.orange} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.alertBoxTitle}>Your hospital can see</Text>
            <Text style={styles.alertBoxBody}>Cases documented during shifts · Handover records · Activity logs</Text>
          </View>
        </View>

        <View style={[styles.alertBox, { backgroundColor: C.greenLight, borderColor: C.greenBorder, marginTop: 8 }]}>
          <Feather name="shield" size={14} color={C.greenDark} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.alertBoxTitle, { color: C.greenDark }]}>Your hospital cannot see</Text>
            <Text style={[styles.alertBoxBody, { color: C.muted }]}>Rounds debriefs · Clinical Memory · Personal stats · Cases outside shift</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.cardFooter, { borderTopColor: C.border }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
          <Feather name="clock" size={11} color={C.faint} />
          <Text style={styles.footerMeta}>{renewDate ? `Renews ${renewDate}` : "Team plan active"}</Text>
        </View>
        <Pressable onPress={onLeave}>
          <Text style={styles.footerAction}>Leave department</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Individual Pro card ──────────────────────────────────────────────────────
interface ProCardProps {
  active: boolean;
  trial?: boolean;
  trialDaysLeft?: number;
  renewDate?: string;
  onUpgrade?: () => void;
  onManage?: () => void;
}

const PRO_FEATURES: { icon: keyof typeof Feather.glyphMap; text: string; sub: string }[] = [
  { icon: "refresh-cw", text: "Rounds — unlimited case debriefs", sub: "After every case, on any shift" },
  { icon: "layers", text: "All 7 thinking lenses", sub: "First Principles to Full Debrief" },
  { icon: "database", text: "Clinical Memory", sub: "Your full career — every hospital you've worked at" },
  { icon: "lock", text: "Private to you forever", sub: "Your HOD cannot access this" },
];

function IndividualProCard({ active, trial, trialDaysLeft, renewDate, onUpgrade, onManage }: ProCardProps) {
  if (!active) {
    return (
      <View style={[styles.card, styles.dashedCard, { borderColor: C.purpleBorder, backgroundColor: C.purpleLight }]}>
        <View style={[styles.inactiveIcon, { backgroundColor: "rgba(124,106,246,0.08)", borderColor: C.purpleBorder }]}>
          <Feather name="cpu" size={20} color={C.purple} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.inactiveTitle, { color: C.purple }]}>Individual Pro</Text>
          <Text style={[styles.inactiveSub, { color: C.muted }]}>Your personal career layer · Rounds + Clinical Memory</Text>
          <Text style={styles.inactiveNote}>Not subscribed — your hospital's Team plan doesn't include this</Text>
        </View>
        <Pressable style={styles.proUpgradeBtn} onPress={onUpgrade}>
          <Text style={styles.proUpgradeBtnText}>₹1,199/mo</Text>
          <Feather name="arrow-right" size={12} color={C.white} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.activeCard, { borderColor: C.purpleBorder }]}>
      {/* Header */}
      <View style={[styles.cardHeader, { backgroundColor: C.proHeaderBg }]}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <View style={[styles.cardHeaderIcon, { backgroundColor: C.purpleLight, borderColor: C.purpleBorder }]}>
            <Feather name="cpu" size={16} color={C.purple} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardHeaderLabel}>INDIVIDUAL PRO</Text>
            <Text style={styles.cardHeaderTitle}>Your career layer</Text>
          </View>
        </View>
        <StatusPill status={trial ? "trial" : "active"} />
      </View>

      {/* Body */}
      <View style={styles.cardBody}>
        {trial ? (
          <View style={[styles.trialBanner, { backgroundColor: C.orangeLight, borderColor: C.orangeBorder }]}>
            <Feather name="clock" size={12} color={C.orange} />
            <Text style={styles.trialBannerText}>
              Free trial · {trialDaysLeft ?? 0} days remaining · Then ₹1,199/month
            </Text>
          </View>
        ) : null}

        <View style={[styles.proFeaturesBox, { backgroundColor: C.purpleLight, borderColor: C.purpleBorder }]}>
          <Text style={[styles.proFeaturesLabel, { color: C.purple }]}>WHAT THIS PLAN GIVES YOU</Text>
          {PRO_FEATURES.map((item, i) => (
            <View key={i} style={[styles.proFeatureRow, i < PRO_FEATURES.length - 1 && { marginBottom: 10 }]}>
              <View style={[styles.proFeatureIconWrap, { backgroundColor: "rgba(124,106,246,0.12)" }]}>
                <Feather name={item.icon} size={13} color={C.purple} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.proFeatureText, { color: C.inkSoft }]}>{item.text}</Text>
                <Text style={[styles.proFeatureSub, { color: C.faint }]}>{item.sub}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={[styles.alertBox, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]}>
          <Feather name="shield" size={14} color={C.greenDark} style={{ marginTop: 1 }} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.alertBoxBody, { color: C.greenDark, lineHeight: 18 }]}>
              <Text style={{ fontWeight: "700" }}>Fully private.</Text>
              {" "}No hospital, no HOD, no employer has access to your Rounds debriefs or Clinical Memory — ever.
            </Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View style={[styles.cardFooter, { borderTopColor: C.border }]}>
        <View>
          <Text style={styles.footerPrice}>₹1,199/month</Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
            <Feather name="clock" size={11} color={C.faint} />
            <Text style={styles.footerMeta}>
              {trial ? `Free until ${renewDate ?? "—"} · Then charged` : renewDate ? `Renews ${renewDate}` : "Pro plan active"}
            </Text>
          </View>
        </View>
        <Pressable style={[styles.manageBtn, { borderColor: C.border }]} onPress={onManage}>
          <Text style={styles.manageBtnText}>Manage</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── Combined banner ──────────────────────────────────────────────────────────
function CombinedBanner() {
  return (
    <View style={[styles.combinedBanner, { backgroundColor: C.combinedBg }]}>
      <Text style={styles.combinedLabel}>BOTH PLANS ACTIVE</Text>
      <Text style={styles.combinedTitle}>Full ErMate — shift work and career growth</Text>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <View style={[styles.combinedPill, { backgroundColor: "rgba(29,184,112,0.1)", borderColor: "rgba(29,184,112,0.18)" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Feather name="home" size={12} color={C.green} />
            <Text style={[styles.combinedPillLabel, { color: C.green }]}>TEAM PLAN</Text>
          </View>
          <Text style={styles.combinedPillBody}>Your shift · Department cases · Hospital pays</Text>
        </View>
        <View style={[styles.combinedPill, { backgroundColor: "rgba(124,106,246,0.1)", borderColor: "rgba(124,106,246,0.18)" }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
            <Feather name="cpu" size={12} color={C.purple} />
            <Text style={[styles.combinedPillLabel, { color: C.purple }]}>INDIVIDUAL PRO</Text>
          </View>
          <Text style={styles.combinedPillBody}>Your Rounds · Your Memory · You pay</Text>
        </View>
      </View>

      <Text style={styles.combinedFootnote}>
        Cases documented during shifts belong to your department.{"\n"}
        Your Rounds debriefs and Clinical Memory belong to you — always.
      </Text>
    </View>
  );
}

// ── "Who can see what" table ─────────────────────────────────────────────────
const VISIBILITY_ROWS = [
  { item: "Cases on shift",   team: true,  pro: true,  hospital: true  },
  { item: "Handover records", team: true,  pro: false, hospital: true  },
  { item: "Activity logs",    team: true,  pro: false, hospital: true  },
  { item: "Rounds debriefs",  team: false, pro: true,  hospital: false },
  { item: "Clinical Memory",  team: false, pro: true,  hospital: false },
  { item: "Cases off-shift",  team: false, pro: true,  hospital: false },
  { item: "Personal stats",   team: false, pro: true,  hospital: false },
];

function VisibilityTable() {
  return (
    <View style={[styles.tableCard, { backgroundColor: C.white, borderColor: C.border }]}>
      <Text style={[styles.tableTitle, { color: C.ink }]}>Who can see what</Text>

      <View style={styles.tableHeaderRow}>
        <Text style={[styles.tableHeaderCell, { flex: 1, color: C.faint }]}>Feature</Text>
        <Text style={[styles.tableHeaderCell, { width: 48, textAlign: "center", color: C.greenDark }]}>Team</Text>
        <Text style={[styles.tableHeaderCell, { width: 38, textAlign: "center", color: C.purple }]}>Pro</Text>
        <Text style={[styles.tableHeaderCell, { width: 82, textAlign: "right", color: C.faint }]}>Hospital</Text>
      </View>

      {VISIBILITY_ROWS.map((row, i) => (
        <View
          key={i}
          style={[
            styles.tableRow,
            i < VISIBILITY_ROWS.length - 1 && { borderBottomWidth: 1, borderBottomColor: "#F5F6F8" },
          ]}
        >
          <Text style={[styles.tableCell, { flex: 1, color: C.inkSoft }]}>{row.item}</Text>
          <Text style={[styles.tableCheckCell, { width: 48, color: row.team ? C.greenDark : C.faint }]}>
            {row.team ? "✓" : "—"}
          </Text>
          <Text style={[styles.tableCheckCell, { width: 38, color: row.pro ? C.purple : C.faint }]}>
            {row.pro ? "✓" : "—"}
          </Text>
          <Text style={[styles.tableVisCell, { width: 82, color: row.hospital ? "#B45309" : C.greenDark }]}>
            {row.hospital ? "Yes" : "Private"}
          </Text>
        </View>
      ))}
    </View>
  );
}

// ── Free state ───────────────────────────────────────────────────────────────
interface FreeStateProps {
  casesUsed: number;
  casesLimit: number;
  onUpgradePro: () => void;
  onJoinTeam: () => void;
}

function FreeState({ casesUsed, casesLimit, onUpgradePro, onJoinTeam }: FreeStateProps) {
  return (
    <View style={[styles.freeCard, { backgroundColor: C.white, borderColor: C.border }]}>
      <View style={[styles.freeIconWrap, { backgroundColor: C.surface }]}>
        <Feather name="clipboard" size={28} color={C.faint} />
      </View>
      <Text style={[styles.freeTitle, { color: C.ink }]}>Free plan</Text>
      <Text style={[styles.freeSub, { color: C.muted }]}>
        You've used {casesUsed} of {casesLimit} free cases. Upgrade to keep documenting without limits.
      </Text>
      <View style={styles.freeBtns}>
        <Pressable
          style={[styles.freeBtn, { backgroundColor: C.greenLight, borderColor: C.greenBorder }]}
          onPress={onUpgradePro}
        >
          <Text style={[styles.freeBtnText, { color: C.greenDark }]}>Individual Pro</Text>
          <Feather name="arrow-right" size={13} color={C.greenDark} />
        </Pressable>
        <Pressable
          style={[styles.freeBtn, { backgroundColor: C.purpleLight, borderColor: C.purpleBorder }]}
          onPress={onJoinTeam}
        >
          <Text style={[styles.freeBtnText, { color: C.purple }]}>Join a team</Text>
          <Feather name="arrow-right" size={13} color={C.purple} />
        </Pressable>
      </View>
    </View>
  );
}

// ── Main screen ──────────────────────────────────────────────────────────────
export default function MySubscriptionsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { user, token } = useAuth();
  const { department, membership, shiftSession, activeShift, isInDepartment } = useDepartment();

  const [subStatus, setSubStatus] = useState<{
    plan: string;
    casesUsed: number;
    casesLimit: number;
    currentPeriodEnd: string | null;
  } | null>(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [scenario, setScenario] = useState<Scenario | null>(null);

  const hasTeam = isInDepartment;
  const hasPro = subStatus?.plan === "pro";
  const realScenario: Scenario =
    hasTeam && hasPro ? "both"
    : hasTeam ? "team_only"
    : hasPro ? "pro_only"
    : "free";

  const activeScenario: Scenario = scenario ?? realScenario;
  const showTeam = activeScenario === "both" || activeScenario === "team_only";
  const showPro = activeScenario === "both" || activeScenario === "pro_only";
  const showBoth = activeScenario === "both";
  const showFree = activeScenario === "free";
  const proTrial = activeScenario === "pro_only";

  useEffect(() => {
    fetchSub();
  }, [user?.id]);

  const fetchSub = async () => {
    if (!user?.id) { setLoadingSub(false); return; }
    try {
      const url = new URL(
        `/api/subscription/status?userId=${encodeURIComponent(user.id)}&userEmail=${encodeURIComponent(user.email || "")}`,
        getApiUrl()
      ).href;
      const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
      if (res.ok) setSubStatus(await res.json());
    } catch { }
    setLoadingSub(false);
  };

  const formatRenew = (iso: string | null | undefined) => {
    if (!iso) return undefined;
    try {
      return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
    } catch { return undefined; }
  };

  const renewDate = formatRenew(subStatus?.currentPeriodEnd);
  const doctorInitial = user?.name?.charAt(0)?.toUpperCase() ?? "D";

  const handleJoinTeam = () => (navigation as any).navigate("SetupDepartment");
  const handleUpgrade = () => (navigation as any).navigate("Upgrade", {});
  const handleLeave = () =>
    Alert.alert("Leave Department", "Contact your HOD to be removed from the department roster.");

  if (loadingSub) {
    return (
      <View style={[styles.loadingWrap, { paddingTop: headerHeight + 40 }]}>
        <ActivityIndicator size="large" color={C.green} />
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.surface }}
      contentContainerStyle={{
        paddingTop: headerHeight + 8,
        paddingHorizontal: 16,
        paddingBottom: insets.bottom + 40,
        gap: 14,
      }}
      showsVerticalScrollIndicator={false}
    >
      {/* Doctor identity card */}
      <View style={[styles.identityCard, { backgroundColor: C.white, borderColor: C.border }]}>
        <View style={[styles.avatarCircle, { backgroundColor: C.green }]}>
          <Text style={styles.avatarText}>{doctorInitial}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.identityName, { color: C.ink }]}>{user?.name || "Doctor"}</Text>
          <Text style={[styles.identityEmail, { color: C.faint }]}>{user?.email || ""}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          {showFree ? (
            <Text style={[styles.identityPlan, { color: C.faint }]}>Free plan</Text>
          ) : showBoth ? (
            <View style={{ alignItems: "flex-end", gap: 2 }}>
              <Text style={[styles.identityPlan, { color: C.green }]}>Team · Active</Text>
              <Text style={[styles.identityPlan, { color: C.purple }]}>Pro · Active</Text>
            </View>
          ) : showTeam ? (
            <Text style={[styles.identityPlan, { color: C.green }]}>Team · Active</Text>
          ) : (
            <Text style={[styles.identityPlan, { color: C.purple }]}>Pro · Active</Text>
          )}
        </View>
      </View>

      {/* Scenario switcher */}
      <View style={styles.switcherWrap}>
        <Text style={[styles.switcherLabel, { color: C.faint }]}>PREVIEW STATES</Text>
        <View style={styles.switcherRow}>
          <Pressable
            style={[styles.switcherBtn, { borderColor: scenario === null ? C.ink : C.border, backgroundColor: scenario === null ? C.ink : C.white }]}
            onPress={() => setScenario(null)}
          >
            <Text style={[styles.switcherBtnText, { color: scenario === null ? C.white : C.muted }]}>Live</Text>
          </Pressable>
          {SCENARIOS.map((s) => (
            <Pressable
              key={s.id}
              style={[styles.switcherBtn, { borderColor: scenario === s.id ? C.ink : C.border, backgroundColor: scenario === s.id ? C.ink : C.white }]}
              onPress={() => setScenario(s.id)}
            >
              <Text style={[styles.switcherBtnText, { color: scenario === s.id ? C.white : C.muted }]}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Combined banner */}
      {showBoth && <CombinedBanner />}

      {/* Free state */}
      {showFree && (
        <FreeState
          casesUsed={subStatus?.casesUsed ?? 0}
          casesLimit={subStatus?.casesLimit ?? 10}
          onUpgradePro={handleUpgrade}
          onJoinTeam={handleJoinTeam}
        />
      )}

      {/* Team plan */}
      {!showFree && (
        <View style={{ gap: 8 }}>
          <View style={styles.sectionHeader}>
            <Feather name="home" size={12} color={C.faint} />
            <Text style={[styles.sectionHeaderText, { color: C.faint }]}>DEPARTMENT</Text>
          </View>
          <TeamPlanCard
            active={showTeam}
            deptName={department?.name}
            role={membership?.role}
            shiftName={shiftSession && activeShift ? activeShift.name : undefined}
            renewDate={renewDate}
            onJoin={handleJoinTeam}
            onLeave={handleLeave}
          />
        </View>
      )}

      {/* Individual Pro */}
      {!showFree && (
        <View style={{ gap: 8 }}>
          <View style={styles.sectionHeader}>
            <Feather name="cpu" size={12} color={C.faint} />
            <Text style={[styles.sectionHeaderText, { color: C.faint }]}>YOUR PERSONAL PLAN</Text>
          </View>
          <IndividualProCard
            active={showPro}
            trial={proTrial}
            trialDaysLeft={18}
            renewDate={renewDate}
            onUpgrade={handleUpgrade}
            onManage={handleUpgrade}
          />
        </View>
      )}

      {/* Visibility table */}
      {!showFree && <VisibilityTable />}

      {/* Help link */}
      {!showFree && (
        <Pressable
          style={styles.helpRow}
          onPress={() => (navigation as any).navigate("HelpSupport")}
        >
          <Text style={[styles.helpText, { color: C.faint }]}>Questions about your subscriptions?</Text>
          <Text style={[styles.helpLink, { color: C.green }]}>Get help</Text>
          <Feather name="arrow-right" size={13} color={C.green} />
        </Pressable>
      )}
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  loadingWrap: { flex: 1, alignItems: "center", backgroundColor: "#F7F8FA" },

  pill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 4 },
  pillDot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.2 },

  card: { flexDirection: "row", alignItems: "center", borderRadius: 18, padding: 18, gap: 14 },
  cardBorder: { backgroundColor: C.white, borderWidth: 1.5, borderColor: C.border },
  dashedCard: { borderWidth: 1.5, borderStyle: "dashed" },
  activeCard: { backgroundColor: C.white, borderWidth: 2, borderRadius: 18, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
  inactiveIcon: { width: 44, height: 44, borderRadius: 13, borderWidth: 1.5, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  inactiveTitle: { fontSize: 14, fontWeight: "700" },
  inactiveSub: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  inactiveNote: { fontSize: 11, color: C.faint, marginTop: 4, fontStyle: "italic" },
  smallBtn: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 7, flexShrink: 0 },
  smallBtnText: { fontSize: 12, fontWeight: "700" },

  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 14, paddingHorizontal: 18, gap: 8 },
  cardHeaderIcon: { width: 36, height: 36, borderRadius: 10, borderWidth: 1.5, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  cardHeaderLabel: { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: 0.8 },
  cardHeaderTitle: { fontSize: 14, fontWeight: "800", color: "white", letterSpacing: -0.3, marginTop: 1 },
  cardBody: { padding: 14, paddingHorizontal: 18 },
  cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderTopWidth: 1, paddingHorizontal: 18, paddingVertical: 12 },

  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 14 },
  metaCell: { width: "47.5%", borderRadius: 10, padding: 10 },
  metaCellLabel: { fontSize: 10, color: C.faint, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 3 },
  metaCellValue: { fontSize: 13, fontWeight: "700" },

  alertBox: { flexDirection: "row", gap: 10, alignItems: "flex-start", borderWidth: 1, borderRadius: 12, padding: 10, paddingHorizontal: 13 },
  alertBoxTitle: { fontSize: 12, fontWeight: "700", color: "#92400E", marginBottom: 2 },
  alertBoxBody: { fontSize: 11, color: "#B45309", lineHeight: 17 },

  footerMeta: { fontSize: 11, color: C.faint },
  footerAction: { fontSize: 12, fontWeight: "600", color: C.faint },
  footerPrice: { fontSize: 13, fontWeight: "700", color: C.ink },

  proUpgradeBtn: { backgroundColor: C.purple, borderRadius: 10, paddingHorizontal: 11, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 0 },
  proUpgradeBtnText: { fontSize: 12, fontWeight: "700", color: C.white },
  trialBanner: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: 10, paddingVertical: 9, paddingHorizontal: 12, marginBottom: 12 },
  trialBannerText: { fontSize: 12, fontWeight: "600", color: "#92400E", flex: 1 },
  proFeaturesBox: { borderWidth: 1, borderRadius: 12, padding: 13, marginBottom: 12 },
  proFeaturesLabel: { fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 10 },
  proFeatureRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  proFeatureIconWrap: { width: 26, height: 26, borderRadius: 7, justifyContent: "center", alignItems: "center", flexShrink: 0, marginTop: 1 },
  proFeatureText: { fontSize: 13, fontWeight: "600" },
  proFeatureSub: { fontSize: 11, marginTop: 1 },
  manageBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  manageBtnText: { fontSize: 12, fontWeight: "600", color: C.faint },

  combinedBanner: { borderRadius: 18, padding: 16, paddingHorizontal: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.05)" },
  combinedLabel: { fontSize: 10, fontWeight: "700", color: "rgba(255,255,255,0.4)", letterSpacing: 1, marginBottom: 6 },
  combinedTitle: { fontSize: 15, fontWeight: "800", color: "white", marginBottom: 12, letterSpacing: -0.3 },
  combinedPill: { flex: 1, borderWidth: 1, borderRadius: 11, padding: 10, paddingHorizontal: 12 },
  combinedPillLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  combinedPillBody: { fontSize: 11, color: "rgba(255,255,255,0.5)", lineHeight: 17 },
  combinedFootnote: { fontSize: 11, color: "rgba(255,255,255,0.3)", lineHeight: 19, marginTop: 4 },

  tableCard: { borderWidth: 1.5, borderRadius: 18, padding: 16, paddingHorizontal: 18 },
  tableTitle: { fontSize: 13, fontWeight: "700", marginBottom: 12, letterSpacing: -0.2 },
  tableHeaderRow: { flexDirection: "row", alignItems: "center", marginBottom: 2, paddingBottom: 8, borderBottomWidth: 1, borderBottomColor: "#F0F1F3" },
  tableHeaderCell: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4 },
  tableRow: { flexDirection: "row", alignItems: "center", paddingVertical: 9 },
  tableCell: { fontSize: 12, fontWeight: "500" },
  tableCheckCell: { fontSize: 13, fontWeight: "700", textAlign: "center" },
  tableVisCell: { fontSize: 10, fontWeight: "700", textAlign: "right" },

  freeCard: { borderWidth: 1.5, borderRadius: 18, padding: 20, alignItems: "center" },
  freeIconWrap: { width: 60, height: 60, borderRadius: 18, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  freeTitle: { fontSize: 15, fontWeight: "800", marginBottom: 6 },
  freeSub: { fontSize: 13, textAlign: "center", lineHeight: 20, marginBottom: 16 },
  freeBtns: { flexDirection: "row", gap: 10, width: "100%" },
  freeBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderRadius: 12, paddingVertical: 12 },
  freeBtnText: { fontSize: 13, fontWeight: "700" },

  identityCard: { flexDirection: "row", alignItems: "center", borderRadius: 18, paddingVertical: 16, paddingHorizontal: 18, borderWidth: 1.5, gap: 14 },
  avatarCircle: { width: 48, height: 48, borderRadius: 24, justifyContent: "center", alignItems: "center", flexShrink: 0 },
  avatarText: { fontSize: 18, fontWeight: "800", color: "white" },
  identityName: { fontSize: 16, fontWeight: "800", letterSpacing: -0.3 },
  identityEmail: { fontSize: 12, marginTop: 1 },
  identityPlan: { fontSize: 12, fontWeight: "700" },

  switcherWrap: { gap: 6 },
  switcherLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 1.2, textTransform: "uppercase" },
  switcherRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  switcherBtn: { borderWidth: 1.5, borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 },
  switcherBtnText: { fontSize: 11, fontWeight: "600" },

  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 5, paddingLeft: 2 },
  sectionHeaderText: { fontSize: 11, fontWeight: "700", letterSpacing: 1 },

  helpRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, paddingVertical: 10 },
  helpText: { fontSize: 13 },
  helpLink: { fontSize: 13, fontWeight: "600" },
});
