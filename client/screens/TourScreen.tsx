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
    subtitle: "5-level priority at the door — works with or without hospital EMR",
    description:
      "Capture the patient the moment they arrive. Assign a P1–P5 triage priority (P1 Immediate → P5 Non-urgent), record vitals, GCS, chief complaint, and triage colour. ErMate works as a standalone EMR for hospitals that have no existing system, and fits alongside hospitals that already have one — doctors use ErMate on their phones for faster, richer documentation while the hospital system stays unchanged.",
    how: "Dashboard → New Patient → Triage form → set priority → Start Case Sheet",
  },
  {
    id: "casesheet-adult",
    category: "EMR",
    icon: "clipboard",
    iconColor: "#6366f1",
    title: "Adult Case Sheet",
    subtitle: "ATLS-based · JCI & NABH compliant · 7 clinical tabs",
    description:
      "A fully structured ATLS workflow designed to meet JCI and NABH documentation standards. Seven tabs cover everything an ER encounter requires:\n\n• Patient — demographics, vitals, allergies\n• History — SAMPLE (Signs, Allergies, Medications, Past history, Last meal, Events)\n• Primary Survey — ABCDE (Airway, Breathing, Circulation, Disability/GCS, Exposure)\n• Examination — systems review, psych screening\n• Treatment — drugs given, procedures performed\n• Notes — free-text clinical narrative\n• Disposition — diagnosis, decision support, discharge plan\n\nSwitch between Medical and Trauma mode within the same sheet.",
    how: "Dashboard → New Patient → Adult Case Sheet → work through all 7 tabs",
  },
  {
    id: "casesheet-peds",
    category: "EMR",
    icon: "heart",
    iconColor: "#ec4899",
    title: "Pediatric Case Sheet",
    subtitle: "PALS-based · Age-correct normal vitals · Weight dosing",
    description:
      "Automatically routed for patients aged 16 and under. Built on PALS (Pediatric Advanced Life Support) guidelines with the same 7-tab structure as the adult sheet. Key pediatric additions:\n\n• Every vital field shows the age-correct normal range alongside the recorded value — abnormals are highlighted in red or amber so nothing is missed\n• Weight-based drug dosing references built into the primary survey\n• Developmental history and age-appropriate examination parameters\n• All documentation meets JCI and NABH standards for paediatric ER encounters",
    how: "Dashboard → New Patient → app auto-routes to Pediatric Case Sheet for age ≤16",
  },
  {
    id: "smart-dictation",
    category: "EMR",
    icon: "mic",
    iconColor: "#10b981",
    title: "Smart Dictation",
    subtitle: "Any Indian language → structured English case sheet",
    description:
      "The biggest time-saver in ErMate. Talk naturally about your patient — in Hindi, Tamil, Telugu, Malayalam, Kannada, Bengali, Marathi, or any major Indian language. ErMate:\n\n1. Transcribes your speech using Sarvam AI (Saaras v3)\n2. Automatically translates to English\n3. Extracts structured clinical data using GPT-4o\n4. Populates all relevant fields across all 7 tabs simultaneously\n\nCritically — sections you do not mention are not left blank. ErMate fills them with clinically appropriate normal / negative defaults (e.g. airway 'Patent', allergies 'NKDA', pupils 'Equal and reactive'). The result is a complete, print-ready case sheet from a 2-minute dictation, saving 12–15 minutes of typing per case.",
    how: "Open case sheet → Patient tab → tap Speak This Case → speak freely → Apply",
  },
  {
    id: "dictation-map",
    category: "EMR",
    icon: "bar-chart-2",
    iconColor: "#10b981",
    title: "Dictation Completion Dots",
    subtitle: "Know exactly where the gaps are at a glance",
    description:
      "After Smart Dictation, every tab header shows a coloured dot:\n\n• Green — well documented (75%+ fields filled from your dictation)\n• Amber — partially captured\n• Red — not mentioned (auto-filled with normals, but worth a quick review)\n\nThe dots persist while you navigate tabs, so you can instantly see which sections need your attention without scrolling through the whole sheet.",
    how: "After tapping Apply on dictation → coloured dots appear on tab headers → tap any amber or red tab to review",
  },
  {
    id: "document-scan",
    category: "EMR",
    icon: "camera",
    iconColor: "#f59e0b",
    title: "Document Scanning",
    subtitle: "Photograph a referral or report — ErMate reads and fills the sheet",
    description:
      "Point the camera at any paper document — referral letter, printed ECG report, lab result, or old discharge summary. Sarvam Vision OCR reads the text, GPT-4o extracts the clinical data, and the relevant fields across the case sheet are populated automatically. Saves manual transcription time and reduces entry errors when the patient arrives with printed documents.",
    how: "Any case sheet → tap the scan icon in the top bar → camera or gallery → confirm",
  },
  {
    id: "ai-cds",
    category: "EMR",
    icon: "cpu",
    iconColor: "#8b5cf6",
    title: "Clinical Decision Support",
    subtitle: "AI differentials with ABG, ECG and evidence citations",
    description:
      "Once you have documented history, examination, and investigations, ErMate generates a ranked differential diagnosis list:\n\n• CONSISTENT — strongly supported by the documented findings\n• POSSIBLE — plausible given partial features\n• LESS LIKELY — worth excluding\n\nEach diagnosis comes with PubMed and WikEM citations. Investigation results — including ABG/VBG values and ECG findings you have entered — are factored into the differential. Tap Add to Case to include a diagnosis in the Disposition, or Exclude to dismiss it.",
    how: "Fill in History, Examination and Investigations → Disposition tab → ErMate Decision Support → Generate",
  },
  {
    id: "discharge",
    category: "EMR",
    icon: "file-text",
    iconColor: "#0ea5e9",
    title: "Discharge Summary",
    subtitle: "Auto-generated from your case sheet — PDF or DOCX",
    description:
      "ErMate reads everything you documented across all 7 tabs and generates a fully structured discharge summary — no copy-pasting. It includes presenting complaint, history, examination findings, investigations, treatment given, diagnosis, and follow-up instructions. Every field on the printed document has a value — undocumented fields fall back to clinically appropriate defaults so no line is ever left blank. Export as a formatted PDF or DOCX for the patient file or referral.",
    how: "Disposition tab → Generate Discharge Summary → review → Export PDF or DOCX",
  },
  {
    id: "vitals",
    category: "EMR",
    icon: "activity",
    iconColor: "#ef4444",
    title: "Editable Vitals with Normal Ranges",
    subtitle: "Colour-coded alerts · Age-based references for paediatrics",
    description:
      "All vitals (HR, BP, SpO2, RR, Temperature, GCS, GRBS) are editable inline. For adult cases, standard ER normal ranges are shown. For paediatric cases, the normal range updates dynamically based on the child's exact age — a HR of 140 is normal for an infant but flagged amber in a 10-year-old. Abnormal values are highlighted in red or amber so the treating team notices them immediately.",
    how: "Patient tab → Vitals at Arrival section → tap any value to edit inline",
  },
  {
    id: "psych",
    category: "EMR",
    icon: "user",
    iconColor: "#6366f1",
    title: "Psychological Assessment",
    subtitle: "PHQ-2, GAD-2 and PTSD screening built in",
    description:
      "Mental health flags are embedded directly into the Examination tab — not a separate form. PHQ-2 (depression), GAD-2 (anxiety), and PTSD screening questions are documented alongside the physical examination, ensuring mental health is never skipped in a busy ER. Positive flags are highlighted and flow through to the discharge summary automatically.",
    how: "Examination tab → scroll to Psychological Assessment section",
  },
  {
    id: "quick-case",
    category: "EMR",
    icon: "zap",
    iconColor: "#f59e0b",
    title: "Quick Case Sheet",
    subtitle: "Skip triage — document in seconds for pre-triaged patients",
    description:
      "For fast-track patients or those who arrive pre-triaged from another facility, skip the full triage form. Enter just the name and presenting complaint and you go straight to the case sheet. Ideal for low-acuity walk-ins, follow-up visits, or when triage has already been done by nursing.",
    how: "Dashboard → New Patient → Quick Case Sheet → name + complaint → go",
  },

  // ── Team ─────────────────────────────────────────────────
  {
    id: "department",
    category: "Team",
    icon: "home",
    iconColor: "#6366f1",
    title: "Department Setup",
    subtitle: "HOD configures the ER team once — everyone joins via link",
    description:
      "The HOD (Head of Department) creates the department with hospital name and shift schedules — Morning, Evening, and Night — each with a maximum number of consultant and resident slots. Once set up, a shareable invite link is generated. Team members join by tapping the link; no admin approval needed beyond the initial setup.",
    how: "Profile → Set Up Department (first time) → configure shifts → share invite link via WhatsApp",
  },
  {
    id: "shift-checkin",
    category: "Team",
    icon: "log-in",
    iconColor: "#10b981",
    title: "Shift Check-In",
    subtitle: "One tap to start your shift — slot counts update live",
    description:
      "When you open ErMate during a shift window, a Shift Selection screen appears automatically. You see the current slot availability (e.g. 1 of 2 consultant slots taken) in real time. Tap Start Shift and your name appears on the HOD Dashboard and in the shift cases view for all colleagues on the same shift. A shift banner on your Dashboard confirms you are active.",
    how: "Open app during shift hours → Shift Selection screen → pick your shift → Start Shift",
  },
  {
    id: "shift-cases",
    category: "Team",
    icon: "layers",
    iconColor: "#6366f1",
    title: "Shift-Aware Case View",
    subtitle: "Consultants see every case across the whole shift",
    description:
      "While on shift, consultants and the HOD see a SHIFT CASES section above their own cases in the Cases tab. This shows all patients being documented by every doctor currently on the same shift — colour-coded by triage priority (P1 red → P5 green) with the treating doctor's name and role badge on each card. The list refreshes every 30 seconds automatically.",
    how: "Cases tab → SHIFT CASES section (visible to consultants and HOD when on shift)",
  },
  {
    id: "consultant-review",
    category: "Team",
    icon: "check-circle",
    iconColor: "#10b981",
    title: "Consultant Review",
    subtitle: "Annotate a resident's case — green badge confirms review",
    description:
      "A consultant taps any resident's case in the Shift Cases list to open a review modal. After reading the case, they write clinical review notes — additional findings, management changes, or teaching points. The case is then marked Reviewed with a green badge visible to everyone on the shift, providing a clear audit trail of consultant oversight.",
    how: "Cases tab → SHIFT CASES → tap a resident's case → write notes → Save Review",
  },
  {
    id: "hod-dashboard",
    category: "Team",
    icon: "grid",
    iconColor: "#f59e0b",
    title: "HOD Dashboard",
    subtitle: "Live ER overview — all shifts, all doctors, all cases",
    description:
      "A real-time command view of the entire department. The HOD sees:\n\n• Slot counts per shift (Morning / Evening / Night)\n• Every doctor currently on shift — name, role, duration on shift\n• All active cases being documented across every shift\n• One-tap Force Out if a doctor needs to be removed from a shift\n\nDoctor names are resolved from the roster — not raw IDs.",
    how: "Profile → HOD Dashboard",
  },
  {
    id: "handover-chat",
    category: "Team",
    icon: "message-square",
    iconColor: "#10b981",
    title: "Handover Chat",
    subtitle: "Talk through all your patients — AI builds the handover sheet",
    description:
      "At the end of a shift, open Handover Chat and just talk — or type — about your patients in any order, in any language. 'Bed 3, Ravi, 45 male, STEMI, thrombolysed, echo pending.' ErMate's AI tracks each patient, asks a few follow-up questions (receiving doctor, allergy status, discharge readiness), then generates a structured handover sheet with colour-coded patient cards (Critical / Unstable / Stable / For Discharge). Share directly on WhatsApp, copy as text, or export the official 7-column PDF.",
    how: "Dashboard → New Handover → speak or type about your patients → Finalize → Share / PDF",
    isNew: true,
  },
  {
    id: "handover",
    category: "Team",
    icon: "shuffle",
    iconColor: "#0ea5e9",
    title: "Handover Sheet (Manual)",
    subtitle: "Select cases from your list — export a hospital-format PDF",
    description:
      "If you prefer selecting cases manually, use the Handover Sheet. Tick the patients you are handing over, add bed numbers and pending notes for each, then export the standard 7-column PDF (Patient Label, Presenting Complaints, Past Medical History, Provisional Diagnosis, Management Done, Management Plan, Bystander Updation Time) with a 3-way signature block. Incoming handovers from the previous shift team appear in your Profile.",
    how: "Dashboard → Handover Sheet → tick cases → add notes → Export PDF",
  },
  {
    id: "roster",
    category: "Team",
    icon: "users",
    iconColor: "#8b5cf6",
    title: "Manage Roster",
    subtitle: "Add, remove, and view the full team at a glance",
    description:
      "The HOD manages the active team roster from one screen. Each member row shows their name, email, role (Consultant / Resident), and whether they are currently on shift. Add new members by sharing the invite link via WhatsApp. Remove members with one tap. The invite link can be regenerated at any time if it is shared too widely.",
    how: "Profile → HOD Dashboard → Manage Roster",
  },

  // ── Learn ─────────────────────────────────────────────────
  {
    id: "simulation",
    category: "Learn",
    icon: "play-circle",
    iconColor: "#6366f1",
    title: "Simulation-Based Teaching",
    subtitle: "Branching scenarios with evolving vitals and decisions",
    description:
      "Work through clinical scenarios that evolve in real time — vitals change as the case progresses, investigation results arrive, and management decisions branch the case. Designed for EM teaching and self-assessment. Ideal for residents preparing for MRCEM or DNB-EM, and for consultants running bedside teaching sessions.",
    how: "Learn tab → Simulation-Based Teaching → choose a scenario → work through the case",
  },
  {
    id: "em-reference",
    category: "Learn",
    icon: "book-open",
    iconColor: "#0ea5e9",
    title: "EM Reference Library",
    subtitle: "Ask any EM question — AI answers with PubMed citations",
    description:
      "A clinical reference assistant powered by GPT-4o with PubMed integration. Ask anything — 'What is the dose of adenosine in SVT?', 'HEART score criteria', 'When to intubate in angio-oedema?' — and get a concise, evidence-based answer with literature citations. Faster than opening a textbook during a resuscitation.",
    how: "Learn tab → EM Reference Library → type your question",
  },
  {
    id: "trivia",
    category: "Learn",
    icon: "award",
    iconColor: "#f59e0b",
    title: "Trivia Time",
    subtitle: "MCQ case quizzes · Weekly streak to track your practice",
    description:
      "Case-based multiple-choice questions with detailed explanations for every answer option. A weekly streak badge shows how consistently you are practising — the count resets each calendar week, giving you a habit to maintain. Score cards show correct vs incorrect, and the streak updates live so you see your progress.",
    how: "Learn tab → Trivia Time → start quiz → view score card and streak",
  },

  // ── Tools ─────────────────────────────────────────────────
  {
    id: "plans",
    category: "Tools",
    icon: "star",
    iconColor: "#f59e0b",
    title: "Subscription Plans",
    subtitle: "Free trial · Pro · Team — all AI features included",
    description:
      "ErMate has no feature tiers — every plan includes Smart Dictation, Clinical Decision Support, Document Scanning, Discharge Summary, and all AI tools.\n\n• Free — 10 cases to try everything, no restrictions on what you can do\n• Pro — Unlimited cases. First month free, then ₹999/month (annual) or ₹1,199/month. Save ₹2,398 on the annual plan\n• Team — Per-doctor pricing. Consultants ₹599/month · Residents ₹399/month. Minimum 4 doctors. Annual plans available\n\nAll payments secured by Razorpay.",
    how: "Profile → Upgrade → choose Pro or Team → first month free",
  },
  {
    id: "peds-calc",
    category: "Tools",
    icon: "thermometer",
    iconColor: "#ec4899",
    title: "Pediatric Drug Calculator",
    subtitle: "Weight-based emergency doses in one tap",
    description:
      "Enter the child's weight in kg and get instantly calculated doses for all critical emergency drugs — adrenaline, atropine, adenosine, amiodarone, fluid boluses, and more. No mental arithmetic during a resuscitation. Doses are displayed with route and concentration so the nurse can draw it up immediately.",
    how: "Dashboard → Pediatric Drug Calculator → enter weight → see all doses",
  },
  {
    id: "stats",
    category: "Tools",
    icon: "trending-up",
    iconColor: "#10b981",
    title: "My Weekly Stats",
    subtitle: "See exactly how much documentation time you are saving",
    description:
      "ErMate tracks how long each case takes from opening to saving. Your Stats screen shows:\n\n• Cases documented this week\n• Estimated time saved versus paper documentation (average 14 minutes per case — based on avg paper time of 18 min vs ErMate's 4 min)\n• Top presenting complaints this week\n• All-time case totals\n\nAll computed locally — no data leaves your device.",
    how: "Dashboard → My Weekly Stats card, or Profile → My Stats",
  },
  {
    id: "cases-by-complaint",
    category: "Tools",
    icon: "tag",
    iconColor: "#8b5cf6",
    title: "Cases by Complaint",
    subtitle: "Spot your caseload patterns at a glance",
    description:
      "Toggle the Cases tab to By Complaint view to see all your cases grouped by presenting complaint, sorted by frequency. Useful for reviewing your personal caseload, identifying common presentations in your ER, and for audit and quality improvement discussions.",
    how: "Cases tab → toggle icon (top right) → By Complaint view",
  },
  {
    id: "night-shift",
    category: "Tools",
    icon: "moon",
    iconColor: "#334155",
    title: "Night Shift Display Mode",
    subtitle: "Auto dark mode 9 pm – 6 am to protect your eyes",
    description:
      "ErMate switches to dark mode automatically between 9 pm and 6 am — reducing glare and eye strain during night shifts without you needing to do anything. You can override this at any time: set Always Light if you prefer, or Always Dark for those who want it all the time.",
    how: "Profile → Display Mode → Auto (default) / Always Light / Always Dark",
  },
  {
    id: "link-web",
    category: "Tools",
    icon: "monitor",
    iconColor: "#0ea5e9",
    title: "Link to Web",
    subtitle: "Transfer your session to a desktop browser instantly",
    description:
      "If you want to document on a bigger screen — at a workstation or on a laptop — Link to Web transfers your login session to the browser in seconds. Open er-mate.replit.app on any browser, tap Link to Web in your Profile, and either enter the 6-digit code shown on screen or scan the QR code. No separate login required.",
    how: "Profile → Link to Web → see 6-digit code → enter on web, or scan QR from web login",
  },
  {
    id: "privacy",
    category: "Tools",
    icon: "shield",
    iconColor: "#6366f1",
    title: "Privacy & Data Control",
    subtitle: "Patient data stays yours — Indian law compliant",
    description:
      "ErMate's Privacy Policy (Version 1.0) is compliant with Indian data protection law. Key points:\n\n• Patient data is processed for documentation only — never sold or shared\n• AI processing (Sarvam, OpenAI) happens per-request and is not stored by those providers for training\n• You can request full data deletion from the Privacy screen\n• Biometric lock available for device-level protection\n• Data sharing preferences are fully configurable",
    how: "Profile → Privacy → review policy, toggle sharing preferences, request deletion",
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
