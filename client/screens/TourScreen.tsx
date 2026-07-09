import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  FlatList,
  Dimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius } from "@/constants/theme";

const { width: SCREEN_W } = Dimensions.get("window");

type Category = "EMR" | "Team" | "Learn" | "Tools";

interface Feature {
  id: string;
  category: Category;
  icon: string;
  iconColor: string;
  title: string;
  subtitle: string;
  description: string;
  how: string;
  isNew?: boolean;
}

const FEATURES: Feature[] = [
  // ── EMR ──────────────────────────────────────────────────
  {
    id: "triage",
    category: "EMR",
    icon: "alert-triangle",
    iconColor: "#ef4444",
    title: "Patient Triage",
    subtitle: "P1–P5 priority with vitals",
    description:
      "Rapidly triage incoming patients using the 5-level priority system. Capture chief complaint, vitals, GCS, and triage colour at the door.",
    how: "Dashboard → New Patient → fill triage form → Start Case Sheet",
  },
  {
    id: "casesheet-adult",
    category: "EMR",
    icon: "clipboard",
    iconColor: "#6366f1",
    title: "Adult Case Sheet",
    subtitle: "ATLS-based, 7 clinical tabs",
    description:
      "Full ATLS workflow across 7 tabs — Patient, History (SAMPLE), Primary Survey (ABCDE), Examination, Treatment, Notes, and Disposition. Switch between Medical and Trauma modes.",
    how: "Dashboard → Start Adult Case Sheet → work through tabs",
  },
  {
    id: "casesheet-peds",
    category: "EMR",
    icon: "heart",
    iconColor: "#ec4899",
    title: "Pediatric Case Sheet",
    subtitle: "PALS-based for patients ≤16 yrs",
    description:
      "Age-appropriate documentation with PALS-based primary survey, paediatric normal ranges, weight-based dosing references, and developmental history.",
    how: "Dashboard → Start Pediatric Case Sheet (auto-routed for age ≤16)",
  },
  {
    id: "smart-dictation",
    category: "EMR",
    icon: "mic",
    iconColor: "#10b981",
    title: "Smart Dictation",
    subtitle: "Talk naturally — ErMate fills the sheet",
    description:
      "Dictate the full case in natural speech. ErMate transcribes it and extracts structured data, mapping it to every relevant field across all 7 tabs automatically.",
    how: "Open any case sheet → Patient tab → tap Speak This Case → dictate → Apply",
  },
  {
    id: "dictation-map",
    category: "EMR",
    icon: "bar-chart-2",
    iconColor: "#10b981",
    title: "Dictation Completion Dots",
    subtitle: "Colour-coded tab indicators after dictation",
    description:
      "After Smart Dictation, each tab button shows a coloured dot — green when well-filled, amber when partially captured, red when empty. Tap any dot-marked tab to review and fill the gaps.",
    how: "After tapping Apply on dictation → check the coloured dots on each tab → tap any tab with an amber or red dot to fill gaps",
  },
  {
    id: "document-scan",
    category: "EMR",
    icon: "camera",
    iconColor: "#f59e0b",
    title: "Document Scanning",
    subtitle: "Scan referral letters, ECGs, reports",
    description:
      "Photograph a paper referral or printed report. ErMate reads the text and structures the clinical data, populating the relevant fields automatically.",
    how: "Case sheet → tap the scan icon (top bar) → take photo or pick from gallery",
  },
  {
    id: "ai-cds",
    category: "EMR",
    icon: "cpu",
    iconColor: "#8b5cf6",
    title: "Clinical Decision Support",
    subtitle: "ErMate differential with evidence citations",
    description:
      "Generates a ranked differential diagnosis labelled CONSISTENT / POSSIBLE / LESS LIKELY, with PubMed and WikEM citations. Tap Add to Case to include in documentation or Exclude to dismiss.",
    how: "Disposition tab of any case sheet → ErMate Decision Support section",
  },
  {
    id: "discharge",
    category: "EMR",
    icon: "file-text",
    iconColor: "#0ea5e9",
    title: "Discharge Summary",
    subtitle: "ErMate-generated, exportable as PDF/DOCX",
    description:
      "Auto-generates a structured discharge summary from all documented data. Export as PDF or DOCX for patient hand-off.",
    how: "Disposition tab → Generate Discharge Summary → Export",
  },
  {
    id: "vitals",
    category: "EMR",
    icon: "activity",
    iconColor: "#ef4444",
    title: "Editable Vitals",
    subtitle: "Age-based normal ranges with colour coding",
    description:
      "All vitals are editable inline in the Patient tab. Paediatric cases display age-based normal ranges and highlight abnormal values with colour coding.",
    how: "Patient tab → Vitals at Arrival section → tap any value to edit",
  },
  {
    id: "psych",
    category: "EMR",
    icon: "user",
    iconColor: "#6366f1",
    title: "Psychological Assessment",
    subtitle: "Integrated mental health screening",
    description:
      "PHQ-2, GAD-2, and PTSD flags integrated into the case sheet. Automatically flags relevant conditions for documentation.",
    how: "Examination tab → Psychological Assessment section",
  },
  {
    id: "quick-case",
    category: "EMR",
    icon: "zap",
    iconColor: "#f59e0b",
    title: "Quick Case Sheet",
    subtitle: "Skip triage for fast-track cases",
    description:
      "Start documenting immediately with just a name and complaint — no full triage required. Ideal for low-acuity or pre-triaged patients.",
    how: "Dashboard → New Patient → Quick Case Sheet",
  },

  // ── Team ─────────────────────────────────────────────────
  {
    id: "department",
    category: "Team",
    icon: "home",
    iconColor: "#6366f1",
    title: "Department Setup",
    subtitle: "HOD creates and manages the ER team",
    description:
      "HOD creates the department, sets shift schedules (Morning / Evening / Night with max consultant and resident slots), and invites team members via a shareable link or WhatsApp.",
    how: "Profile → Set Up Department (first time) or Profile → HOD Dashboard",
  },
  {
    id: "shift-checkin",
    category: "Team",
    icon: "log-in",
    iconColor: "#10b981",
    title: "Shift Check-In",
    subtitle: "Start your shift with one tap",
    description:
      "When you open the app during your shift window, the Shift Selection screen appears. Choose your shift, see real-time slot counts, and tap Start. Your shift banner shows on the Dashboard.",
    how: "Open app → Shift Selection appears → tap the shift → Start Shift",
  },
  {
    id: "shift-cases",
    category: "Team",
    icon: "layers",
    iconColor: "#6366f1",
    title: "Shift-Aware Case View",
    subtitle: "Consultants see all cases on the shift",
    description:
      "When on shift, consultants and HOD see a SHIFT CASES section in the Cases tab — all cases from every doctor currently on the same shift, colour-coded by triage priority, with doctor name and role badges.",
    how: "Cases tab → SHIFT CASES section (visible when on shift as consultant/HOD)",
  },
  {
    id: "consultant-review",
    category: "Team",
    icon: "check-circle",
    iconColor: "#10b981",
    title: "Consultant Review",
    subtitle: "Review and annotate a resident's case",
    description:
      "Tap any resident's case in the Shift Cases list to open a review modal. Write your clinical notes — the case is marked Reviewed with a green badge visible to everyone on the shift.",
    how: "Cases tab → SHIFT CASES → tap a resident's case → write review → Save",
  },
  {
    id: "hod-dashboard",
    category: "Team",
    icon: "grid",
    iconColor: "#f59e0b",
    title: "HOD Dashboard",
    subtitle: "Real-time overview of the entire ER",
    description:
      "Live view of every shift's consultant/resident slot counts, all doctors currently on shift (with duration), all active cases being documented across all shifts, and one-tap Force Out.",
    how: "Profile → HOD Dashboard",
  },
  {
    id: "handover-chat",
    category: "Team",
    icon: "message-square",
    iconColor: "#10b981",
    title: "Handover Chat",
    subtitle: "Talk through your patients — ErMate builds the sheet",
    description:
      "Speak or type about all your patients in any order. ErMate's AI tracks each one, asks a few follow-up questions (allergies, receiving doctor, discharge-readiness), then generates a structured handover sheet. Share via WhatsApp, export as PDF, or copy.",
    how: "Dashboard → New Handover → dictate or type about your patients → Finalize → Share / Export PDF",
    isNew: true,
  },
  {
    id: "handover",
    category: "Team",
    icon: "shuffle",
    iconColor: "#0ea5e9",
    title: "Handover Sheet (Manual)",
    subtitle: "Pick cases from your list and export a PDF",
    description:
      "Manually select which cases to hand over, add bed numbers and pending notes for each, then export a Rajagiri-format PDF handover sheet. Incoming handovers from the previous shift are visible in your Profile.",
    how: "Dashboard → Handover Sheet → tick cases → add notes → Export PDF",
  },
  {
    id: "roster",
    category: "Team",
    icon: "users",
    iconColor: "#8b5cf6",
    title: "Manage Roster",
    subtitle: "Add, remove, and view team members",
    description:
      "HOD manages the active team roster. Share the invite link via WhatsApp or copy-paste. Remove members with one tap. Members see the department name on their Dashboard and Profile.",
    how: "Profile → HOD Dashboard → Manage Roster",
  },

  // ── Learn ─────────────────────────────────────────────────
  {
    id: "simulation",
    category: "Learn",
    icon: "play-circle",
    iconColor: "#6366f1",
    title: "Simulation-Based Teaching",
    subtitle: "Interactive clinical case scenarios",
    description:
      "Work through branching clinical scenarios with vitals that evolve over time, investigation results, and management decisions. Designed for EM teaching and self-assessment.",
    how: "Learn tab → Simulation-Based Teaching → choose a case",
  },
  {
    id: "em-reference",
    category: "Learn",
    icon: "book-open",
    iconColor: "#0ea5e9",
    title: "EM Reference Library",
    subtitle: "ErMate guideline chat",
    description:
      "Ask any emergency medicine clinical question. Responses are grounded in EM guidelines and literature, with PubMed integration for evidence-based answers.",
    how: "Learn tab → EM Reference Library → type your question",
  },
  {
    id: "trivia",
    category: "Learn",
    icon: "award",
    iconColor: "#f59e0b",
    title: "Trivia Time",
    subtitle: "MCQ quizzes with weekly streak",
    description:
      "Case-based multiple-choice quizzes with detailed explanations. A weekly streak badge tracks how consistently you practice. The streak resets each calendar week.",
    how: "Learn tab → Trivia Time → start quiz → score card shows streak",
  },

  // ── Tools ─────────────────────────────────────────────────
  {
    id: "peds-calc",
    category: "Tools",
    icon: "thermometer",
    iconColor: "#ec4899",
    title: "Pediatric Drug Calculator",
    subtitle: "Weight-based dosing at your fingertips",
    description:
      "Enter the child's weight and get calculated doses for emergency drugs — adrenaline, atropine, adenosine, fluid boluses, and more — instantly.",
    how: "Dashboard → Pediatric Drug Calculator",
  },
  {
    id: "stats",
    category: "Tools",
    icon: "trending-up",
    iconColor: "#10b981",
    title: "My Weekly Stats",
    subtitle: "Time saved vs paper documentation",
    description:
      "Shows cases documented this week, estimated time saved vs paper (avg 14 minutes per case), top presenting complaints, and all-time totals. All computed locally from case timing data.",
    how: "Dashboard → My Weekly Stats card or Profile → My Stats",
  },
  {
    id: "cases-by-complaint",
    category: "Tools",
    icon: "tag",
    iconColor: "#8b5cf6",
    title: "Cases by Complaint",
    subtitle: "Group your cases by presenting complaint",
    description:
      "Switch the Cases tab to Tag view to see all your cases grouped by presenting complaint, sorted by frequency — useful for reviewing your caseload patterns.",
    how: "Cases tab → toggle icon (top right) → By Complaint view",
  },
  {
    id: "night-shift",
    category: "Tools",
    icon: "moon",
    iconColor: "#1e293b",
    title: "Night Shift Display Mode",
    subtitle: "Auto dark mode 9 pm – 6 am",
    description:
      "ErMate automatically switches to dark mode during night hours to reduce eye strain. Override to Always Light or Always Dark from the Profile screen.",
    how: "Profile → Display Mode → choose your preference",
  },
  {
    id: "link-web",
    category: "Tools",
    icon: "monitor",
    iconColor: "#0ea5e9",
    title: "Link to Web",
    subtitle: "Use ErMate on a desktop browser",
    description:
      "Connect your phone session to the web app via a 6-digit code or scan the QR code shown on the web login page. Your session transfers instantly.",
    how: "Profile → Link to Web (6-digit code) or scan QR on web login screen",
  },
  {
    id: "privacy",
    category: "Tools",
    icon: "shield",
    iconColor: "#6366f1",
    title: "Privacy & Data Control",
    subtitle: "You own your patient data",
    description:
      "Comprehensive Privacy Policy covers data storage, AI processing, retention, and Indian law compliance. Control data sharing preferences, biometric lock, and request data deletion from the Privacy screen.",
    how: "Profile → Privacy",
  },
];

const CATEGORIES: Array<{ key: Category; label: string; icon: string; color: string }> = [
  { key: "EMR", label: "Clinical EMR", icon: "clipboard", color: "#6366f1" },
  { key: "Team", label: "Team & Shifts", icon: "users", color: "#10b981" },
  { key: "Learn", label: "Learning", icon: "book-open", color: "#f59e0b" },
  { key: "Tools", label: "Tools", icon: "tool", color: "#0ea5e9" },
];

export default function TourScreen() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const [activeCategory, setActiveCategory] = useState<Category>("EMR");
  const scrollRef = useRef<ScrollView>(null);

  const filtered = FEATURES.filter((f) => f.category === activeCategory);
  const activeCat = CATEGORIES.find((c) => c.key === activeCategory)!;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingTop: insets.top + 60,
          paddingBottom: insets.bottom + 40,
        }}
      >
        <View style={styles.heroSection}>
          <View style={[styles.heroIcon, { backgroundColor: theme.primary + "18" }]}>
            <Feather name="compass" size={32} color={theme.primary} />
          </View>
          <Text style={[styles.heroTitle, { color: theme.text }]}>Feature Tour</Text>
          <Text style={[styles.heroSub, { color: theme.textSecondary }]}>
            Everything ErMate can do — in one place
          </Text>
          <View style={styles.countRow}>
            {CATEGORIES.map((cat) => {
              const count = FEATURES.filter((f) => f.category === cat.key).length;
              return (
                <View key={cat.key} style={[styles.countBubble, { backgroundColor: cat.color + "15" }]}>
                  <Text style={[styles.countNum, { color: cat.color }]}>{count}</Text>
                  <Text style={[styles.countLabel, { color: theme.textSecondary }]}>{cat.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryBar}
        >
          {CATEGORIES.map((cat) => {
            const isActive = activeCategory === cat.key;
            return (
              <Pressable
                key={cat.key}
                style={({ pressed }) => [
                  styles.catChip,
                  {
                    backgroundColor: isActive ? cat.color : theme.backgroundSecondary,
                    opacity: pressed ? 0.8 : 1,
                  },
                ]}
                onPress={() => {
                  setActiveCategory(cat.key);
                  scrollRef.current?.scrollTo({ y: 260, animated: true });
                }}
              >
                <Feather
                  name={cat.icon as any}
                  size={14}
                  color={isActive ? "#fff" : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.catChipText,
                    { color: isActive ? "#fff" : theme.textSecondary },
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.sectionHeader, { borderLeftColor: activeCat.color }]}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>{activeCat.label}</Text>
          <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>
            {filtered.length} feature{filtered.length !== 1 ? "s" : ""}
          </Text>
        </View>

        <View style={styles.featureList}>
          {filtered.map((feature) => (
            <FeatureCard key={feature.id} feature={feature} />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function FeatureCard({ feature }: { feature: Feature }) {
  const { theme } = useTheme();
  const [expanded, setExpanded] = useState(false);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.card,
          borderLeftColor: feature.iconColor,
          opacity: pressed ? 0.97 : 1,
        },
      ]}
      onPress={() => setExpanded((e) => !e)}
    >
      <View style={styles.cardTop}>
        <View style={[styles.cardIcon, { backgroundColor: feature.iconColor + "18" }]}>
          <Feather name={feature.icon as any} size={20} color={feature.iconColor} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.featureTitle, { color: theme.text }]}>{feature.title}</Text>
            {feature.isNew ? (
              <View style={styles.newBadge}>
                <Text style={styles.newBadgeText}>NEW</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.featureSub, { color: theme.textSecondary }]}>
            {feature.subtitle}
          </Text>
        </View>
        <Feather
          name={expanded ? "chevron-up" : "chevron-down"}
          size={16}
          color={theme.textMuted}
        />
      </View>

      {expanded ? (
        <View style={styles.cardBody}>
          <Text style={[styles.featureDesc, { color: theme.textSecondary }]}>
            {feature.description}
          </Text>
          <View style={[styles.howRow, { backgroundColor: feature.iconColor + "0f", borderColor: feature.iconColor + "30" }]}>
            <Feather name="navigation" size={12} color={feature.iconColor} />
            <Text style={[styles.howText, { color: feature.iconColor }]}>{feature.how}</Text>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroSection: { alignItems: "center", paddingHorizontal: Spacing.xl, paddingBottom: Spacing.lg },
  heroIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: "center", alignItems: "center", marginBottom: Spacing.md },
  heroTitle: { fontSize: 26, fontWeight: "800", marginBottom: 4 },
  heroSub: { fontSize: 14, textAlign: "center", marginBottom: Spacing.lg },
  countRow: { flexDirection: "row", gap: Spacing.sm, flexWrap: "wrap", justifyContent: "center" },
  countBubble: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, alignItems: "center", minWidth: 70 },
  countNum: { fontSize: 20, fontWeight: "800" },
  countLabel: { fontSize: 10, fontWeight: "600", marginTop: 1 },
  categoryBar: { paddingHorizontal: Spacing.lg, gap: Spacing.sm, paddingBottom: Spacing.md },
  catChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.full },
  catChipText: { fontSize: 13, fontWeight: "600" },
  sectionHeader: { borderLeftWidth: 4, marginHorizontal: Spacing.lg, paddingLeft: Spacing.sm, marginBottom: Spacing.md, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  sectionCount: { fontSize: 12 },
  featureList: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  card: { borderRadius: BorderRadius.lg, borderLeftWidth: 4, overflow: "hidden", marginBottom: 2 },
  cardTop: { flexDirection: "row", alignItems: "center", gap: 12, padding: Spacing.md },
  cardIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  featureTitle: { fontSize: 15, fontWeight: "700" },
  newBadge: { backgroundColor: "#10b981", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  newBadgeText: { color: "#fff", fontSize: 9, fontWeight: "800", letterSpacing: 0.5 },
  featureSub: { fontSize: 12, marginTop: 2 },
  cardBody: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md, gap: 10 },
  featureDesc: { fontSize: 13, lineHeight: 20 },
  howRow: { flexDirection: "row", alignItems: "flex-start", gap: 6, padding: 10, borderRadius: 8, borderWidth: 1 },
  howText: { fontSize: 12, fontWeight: "600", flex: 1, lineHeight: 18 },
});
