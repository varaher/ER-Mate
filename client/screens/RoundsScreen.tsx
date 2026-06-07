import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

type SubView = "home" | "case" | "debrief" | "memory";

interface CaseItem {
  id: string;
  age: number;
  gender: string;
  complaint: string;
  diagnosis: string;
  triage: number;
  triageColor: string;
  timeAgo: string;
  keyFindings: string;
  management: string;
  created_at?: string;
  category: string;
}

interface ThinkingMode {
  id: string;
  icon: React.ComponentProps<typeof Feather>["name"];
  label: string;
  tagline: string;
  color: string;
  colorBg: string;
}

const THINKING_MODES: ThinkingMode[] = [
  {
    id: "first_principles",
    icon: "zap",
    label: "First Principles",
    tagline: "Why does this actually happen?",
    color: "#3B82F6",
    colorBg: "rgba(59,130,246,0.10)",
  },
  {
    id: "devils_advocate",
    icon: "alert-triangle",
    label: "Devil's Advocate",
    tagline: "What if the diagnosis was wrong?",
    color: "#A855F7",
    colorBg: "rgba(168,85,247,0.10)",
  },
  {
    id: "pathophysiology",
    icon: "activity",
    label: "Pathophysiology",
    tagline: "Walk through what happened in the body",
    color: "#F59E0B",
    colorBg: "rgba(245,158,11,0.10)",
  },
  {
    id: "rare_but_real",
    icon: "alert-circle",
    label: "Rare but Real",
    tagline: "What dangerous diagnosis could this be?",
    color: "#EF4444",
    colorBg: "rgba(239,68,68,0.10)",
  },
  {
    id: "guidelines",
    icon: "book-open",
    label: "Guidelines",
    tagline: "What does the evidence say?",
    color: "#10B981",
    colorBg: "rgba(16,185,129,0.10)",
  },
  {
    id: "full_debrief",
    icon: "layers",
    label: "Full Debrief",
    tagline: "Complete case analysis — all lenses",
    color: "#1DB870",
    colorBg: "rgba(30,184,112,0.10)",
  },
];

const TRIAGE_COLORS: Record<number, string> = {
  1: "#7C3AED",
  2: "#EF4444",
  3: "#F59E0B",
  4: "#10B981",
  5: "#6B7280",
};

function getTriageColor(priority: number): string {
  return TRIAGE_COLORS[priority] ?? "#6B7280";
}

function timeAgo(dateStr?: string): string {
  if (!dateStr) return "Recently";
  const d = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return mins <= 1 ? "Just now" : `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return hrs === 1 ? "1 hour ago" : `${hrs} hours ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function mapRawCase(raw: any): CaseItem {
  const complaint =
    raw.presenting_complaint?.text ||
    raw.chief_complaint ||
    "No complaint recorded";
  const triage = raw.triage_priority ?? 3;
  return {
    id: String(raw.id ?? raw._id ?? Math.random()),
    age: raw.patient?.age ?? raw.age ?? 0,
    gender: raw.patient?.sex ?? raw.gender ?? "",
    complaint,
    diagnosis: raw.discharge_summary?.final_diagnosis || raw.diagnosis || complaint,
    triage,
    triageColor: getTriageColor(triage),
    timeAgo: timeAgo(raw.created_at ?? raw.timestamp),
    keyFindings: extractKeyFindings(raw),
    management: extractManagement(raw),
    created_at: raw.created_at ?? raw.timestamp,
    category: raw.category ?? "",
  };
}

function extractKeyFindings(raw: any): string {
  const parts: string[] = [];
  const v = raw.vitals || raw.primary_assessment;
  if (v) {
    if (v.hr || v.breathing_rr) parts.push(`HR ${v.hr || v.breathing_rr}`);
    if (v.bp) parts.push(`BP ${v.bp}`);
    if (v.spo2) parts.push(`SpO₂ ${v.spo2}%`);
    if (v.gcs || v.disability_gcs_total) parts.push(`GCS ${v.gcs || v.disability_gcs_total}`);
    if (v.temp || v.exposure_temperature) parts.push(`Temp ${v.temp || v.exposure_temperature}`);
  }
  const hx = raw.history?.signs_and_symptoms || raw.history?.presenting_history || "";
  if (hx && parts.length < 3) parts.push(hx.slice(0, 80));
  return parts.join(", ") || "See case sheet for full details";
}

function extractManagement(raw: any): string {
  const meds: string[] = (raw.treatment?.medications || raw.drugs_administered || [])
    .slice(0, 3)
    .map((m: any) => m.name || m.drug || String(m));
  const procs: string[] = (raw.procedures?.procedures_performed || raw.procedures_performed || [])
    .slice(0, 2)
    .map((p: any) => p.procedure || p.name || String(p));
  return [...meds, ...procs].join(", ") || "See case sheet for management details";
}

interface MemoryStats {
  totalCases: number;
  thisMonth: number;
  topCategory: string;
  topCategoryPct: number;
  categories: Array<{ label: string; count: number; color: string }>;
}

const CATEGORY_COLORS = [
  "#EF4444", "#3B82F6", "#F59E0B", "#10B981",
  "#A855F7", "#6366F1", "#EC4899", "#14B8A6",
];

function computeMemoryStats(cases: CaseItem[]): MemoryStats {
  const now = new Date();
  const thisMonth = cases.filter((c) => {
    if (!c.created_at) return false;
    const d = new Date(c.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const countMap: Record<string, number> = {};
  for (const c of cases) {
    const key = c.complaint || "Other";
    countMap[key] = (countMap[key] || 0) + 1;
  }
  const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const total = cases.length || 1;
  const categories = sorted.map(([label, count], i) => ({
    label,
    count,
    color: CATEGORY_COLORS[i % CATEGORY_COLORS.length],
  }));
  const top = categories[0];
  return {
    totalCases: cases.length,
    thisMonth,
    topCategory: top?.label ?? "—",
    topCategoryPct: top ? Math.round((top.count / total) * 100) : 0,
    categories,
  };
}

function LoadingDots({ color }: { color?: string }) {
  const c = color ?? "#1DB870";
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => (t + 1) % 3), 400);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={styles.dotsRow}>
      {[0, 1, 2].map((i) => (
        <View
          key={i}
          style={[
            styles.dot,
            { backgroundColor: c, opacity: tick === i ? 1 : 0.3 },
          ]}
        />
      ))}
    </View>
  );
}

function MarkdownText({ text, theme }: { text: string; theme: any }) {
  const lines = text.split("\n");
  return (
    <View>
      {lines.map((line, i) => {
        if (line.startsWith("───") || line.startsWith("---")) {
          return <View key={i} style={[styles.divider, { backgroundColor: theme.border }]} />;
        }
        if (!line.trim()) {
          return <View key={i} style={{ height: 6 }} />;
        }
        if (line.startsWith("→ ") || line.startsWith("→")) {
          const content = line.slice(line.startsWith("→ ") ? 2 : 1).trim();
          return (
            <View key={i} style={styles.arrowRow}>
              <Text style={[styles.arrowSymbol, { color: "#1DB870" }]}>→</Text>
              <Text style={[styles.arrowText, { color: theme.text }]}>{renderInlineBold(content, theme)}</Text>
            </View>
          );
        }
        if (line.startsWith("• ") || line.startsWith("•")) {
          const content = line.slice(line.startsWith("• ") ? 2 : 1).trim();
          return (
            <View key={i} style={styles.bulletRow}>
              <Text style={[styles.bulletDot, { color: "#1DB870" }]}>•</Text>
              <Text style={[styles.bulletText, { color: theme.textSecondary }]}>{renderInlineBold(content, theme)}</Text>
            </View>
          );
        }
        const isStandaloneHeader =
          line.startsWith("**") && line.endsWith("**") && !line.slice(2, -2).includes("**");
        if (isStandaloneHeader) {
          return (
            <Text key={i} style={[styles.mdHeader, { color: theme.text }]}>
              {line.slice(2, -2)}
            </Text>
          );
        }
        const isItalicLine =
          line.startsWith("*") && line.endsWith("*") && !line.slice(1, -1).includes("*");
        if (isItalicLine) {
          return (
            <Text key={i} style={[styles.mdItalic, { color: theme.textSecondary }]}>
              {line.slice(1, -1)}
            </Text>
          );
        }
        return (
          <Text key={i} style={[styles.mdBody, { color: theme.textSecondary }]}>
            {renderInlineBold(line, theme)}
          </Text>
        );
      })}
    </View>
  );
}

function renderInlineBold(text: string, theme: any): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <Text key={i} style={{ fontWeight: "700", color: theme.text }}>
          {part.slice(2, -2)}
        </Text>
      );
    }
    return part;
  });
}

export default function RoundsScreen() {
  const navigation = useNavigation();
  const { theme, isDark } = useTheme();
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [view, setView] = useState<SubView>("home");
  const [selectedCase, setSelectedCase] = useState<CaseItem | null>(null);
  const [selectedMode, setSelectedMode] = useState<ThinkingMode | null>(null);
  const [debriefLoading, setDebriefLoading] = useState(false);
  const [debriefError, setDebriefError] = useState<string | null>(null);
  const [fullText, setFullText] = useState("");
  const [displayedText, setDisplayedText] = useState("");
  const [debriefDone, setDebriefDone] = useState(false);
  const typewriterRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const indexRef = useRef(0);

  const { data: rawCases = [], isLoading: casesLoading } = useQuery<any[]>({
    queryKey: ["cases", user?.id],
    queryFn: async () => {
      const url = new URL("/api/cases", getApiUrl());
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(url.toString(), { headers });
      if (!res.ok) throw new Error("Failed to load cases");
      const data = await res.json();
      return Array.isArray(data) ? data : data.cases ?? [];
    },
    enabled: !!user?.id,
    staleTime: 2 * 60 * 1000,
  });

  const cases: CaseItem[] = useMemo(
    () => rawCases.slice(0, 20).map(mapRawCase),
    [rawCases]
  );

  const memoryStats = useMemo(() => computeMemoryStats(rawCases.map(mapRawCase)), [rawCases]);

  const startTypewriter = useCallback((text: string) => {
    if (typewriterRef.current) clearInterval(typewriterRef.current);
    indexRef.current = 0;
    setDisplayedText("");
    setDebriefDone(false);
    typewriterRef.current = setInterval(() => {
      indexRef.current += 5;
      setDisplayedText(text.slice(0, indexRef.current));
      if (indexRef.current >= text.length) {
        clearInterval(typewriterRef.current!);
        typewriterRef.current = null;
        setDebriefDone(true);
      }
    }, 12);
  }, []);

  useEffect(() => {
    return () => {
      if (typewriterRef.current) clearInterval(typewriterRef.current);
    };
  }, []);

  const startDebrief = useCallback(
    async (mode: ThinkingMode) => {
      if (!selectedCase) return;
      setSelectedMode(mode);
      setView("debrief");
      setDebriefLoading(true);
      setDebriefError(null);
      setFullText("");
      setDisplayedText("");
      setDebriefDone(false);

      try {
        const url = new URL("/api/rounds/debrief", getApiUrl());
        const res = await fetch(url.toString(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            caseData: {
              complaint: selectedCase.complaint,
              diagnosis: selectedCase.diagnosis,
              keyFindings: selectedCase.keyFindings,
              management: selectedCase.management,
              triage: selectedCase.triage,
              age: selectedCase.age,
              gender: selectedCase.gender,
            },
            mode: mode.id,
          }),
        });
        if (!res.ok) throw new Error("AI service unavailable");
        const data = await res.json();
        const text: string = data.text ?? "No response generated.";
        setFullText(text);
        setDebriefLoading(false);
        startTypewriter(text);
      } catch {
        setDebriefError("Unable to generate debrief. Please check your connection and try again.");
        setDebriefLoading(false);
      }
    },
    [selectedCase, startTypewriter]
  );

  const bg = theme.backgroundDefault;
  const card = theme.card;
  const border = theme.border;
  const text = theme.text;
  const textSec = theme.textSecondary;
  const textMuted = theme.textMuted;

  const topPad = headerHeight + Spacing.sm;
  const bottomPad = insets.bottom + Spacing.xl;

  function HomeView() {
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingTop: topPad, paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.px}>
          <View style={styles.homeHeader}>
            <View>
              <Text style={[styles.homeTitle, { color: text }]}>Rounds</Text>
              <Text style={[styles.homeSubtitle, { color: textMuted }]}>Debrief. Learn. Remember.</Text>
            </View>
            <Pressable
              onPress={() => setView("memory")}
              style={[styles.memoryBtn, { backgroundColor: "rgba(29,184,112,0.10)", borderColor: "rgba(29,184,112,0.25)" }]}
            >
              <Feather name="cpu" size={14} color="#1DB870" />
              <Text style={styles.memoryBtnText}>Memory</Text>
            </Pressable>
          </View>

          <View style={[styles.streakBar, { backgroundColor: isDark ? "#1a1f2e" : "#0D1117" }]}>
            <View>
              <Text style={styles.streakLabel}>THIS WEEK</Text>
              <Text style={styles.streakValue}>
                {rawCases.filter((c: any) => {
                  const d = new Date(c.created_at ?? 0);
                  const now = new Date();
                  const weekStart = new Date(now);
                  weekStart.setDate(now.getDate() - now.getDay());
                  return d >= weekStart;
                }).length} cases documented
              </Text>
            </View>
            <View style={styles.streakBadge}>
              <Feather name="trending-up" size={14} color="#F59E0B" />
              <Text style={styles.streakNum}>{memoryStats.totalCases}</Text>
              <Text style={styles.streakCaption}>total</Text>
            </View>
          </View>
        </View>

        <View style={[styles.px, { marginTop: Spacing.lg }]}>
          <Text style={[styles.sectionLabel, { color: textMuted }]}>RECENT CASES — TAP TO DEBRIEF</Text>

          {casesLoading ? (
            <View style={styles.centeredPad}>
              <ActivityIndicator color="#1DB870" />
              <Text style={[styles.loadingText, { color: textMuted }]}>Loading your cases...</Text>
            </View>
          ) : cases.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: card, borderColor: border }]}>
              <Feather name="file-text" size={32} color={textMuted} />
              <Text style={[styles.emptyTitle, { color: textSec }]}>No cases yet</Text>
              <Text style={[styles.emptySubtitle, { color: textMuted }]}>
                Document a case in the ER to start your Rounds debriefs.
              </Text>
            </View>
          ) : (
            cases.map((c) => (
              <Pressable
                key={c.id}
                style={({ pressed }) => [
                  styles.caseCard,
                  { backgroundColor: card, borderColor: border, opacity: pressed ? 0.88 : 1 },
                ]}
                onPress={() => { setSelectedCase(c); setView("case"); }}
              >
                <View style={[styles.triageBadge, { backgroundColor: c.triageColor + "22", borderColor: c.triageColor + "55" }]}>
                  <Text style={[styles.triageText, { color: c.triageColor }]}>P{c.triage}</Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.caseTitle, { color: text }]} numberOfLines={1}>
                    {c.age > 0 ? `${c.age}${c.gender}` : ""}
                    {c.age > 0 ? " · " : ""}
                    {c.complaint}
                  </Text>
                  <Text style={[styles.caseDx, { color: textMuted }]} numberOfLines={1}>
                    {c.diagnosis}
                  </Text>
                </View>
                <View style={styles.caseRight}>
                  <Text style={[styles.caseTime, { color: textMuted }]}>{c.timeAgo}</Text>
                  <Feather name="chevron-right" size={16} color={textMuted} />
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    );
  }

  function CaseView() {
    if (!selectedCase) return null;
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.caseDarkHeader, { backgroundColor: isDark ? "#1a1f2e" : "#0D1117" }]}>
          <View style={{ paddingTop: topPad }}>
            <Pressable style={styles.backBtn} onPress={() => setView("home")}>
              <Feather name="chevron-left" size={16} color="rgba(255,255,255,0.5)" />
              <Text style={styles.backText}>Back to Rounds</Text>
            </Pressable>

            <View style={[styles.row, { gap: Spacing.sm, marginTop: Spacing.sm }]}>
              <View style={[styles.triageBadgeLg, { backgroundColor: selectedCase.triageColor + "22", borderColor: selectedCase.triageColor + "55" }]}>
                <Text style={[styles.triageTextLg, { color: selectedCase.triageColor }]}>P{selectedCase.triage}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.caseHeaderTitle} numberOfLines={2}>
                  {selectedCase.age > 0 ? `${selectedCase.age}${selectedCase.gender} · ` : ""}
                  {selectedCase.complaint}
                </Text>
                <Text style={styles.caseHeaderTime}>{selectedCase.timeAgo}</Text>
              </View>
            </View>

            <View style={styles.snapshotCard}>
              <Text style={styles.snapshotLabel}>DIAGNOSIS</Text>
              <Text style={styles.snapshotDx}>{selectedCase.diagnosis}</Text>
              <Text style={[styles.snapshotLabel, { marginTop: Spacing.sm }]}>KEY FINDINGS</Text>
              <Text style={styles.snapshotValue}>{selectedCase.keyFindings}</Text>
              <View style={styles.snapshotDivider} />
              <Text style={styles.snapshotLabel}>MANAGEMENT</Text>
              <Text style={styles.snapshotValue}>{selectedCase.management}</Text>
            </View>
          </View>
        </View>

        <View style={[styles.px, { marginTop: Spacing.lg }]}>
          <Text style={[styles.sectionLabel, { color: textMuted }]}>CHOOSE A THINKING LENS</Text>
          <Text style={[styles.lensCaption, { color: textMuted }]}>
            ErMate will analyse this case through the lens you choose.
          </Text>
          <View style={{ gap: Spacing.sm, marginTop: Spacing.sm }}>
            {THINKING_MODES.map((mode) => {
              const isFullDebrief = mode.id === "full_debrief";
              return (
                <Pressable
                  key={mode.id}
                  style={({ pressed }) => [
                    styles.modeCard,
                    isFullDebrief
                      ? { backgroundColor: isDark ? "#0a2216" : "#0D2E1A", borderColor: "rgba(30,184,112,0.35)" }
                      : { backgroundColor: card, borderColor: border },
                    { opacity: pressed ? 0.88 : 1 },
                  ]}
                  onPress={() => startDebrief(mode)}
                >
                  <View style={[styles.modeIcon, { backgroundColor: mode.colorBg, borderColor: mode.color + "44" }]}>
                    <Feather name={mode.icon} size={20} color={mode.color} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.modeLabel, { color: isFullDebrief ? "#fff" : text }]}>
                      {mode.label}
                    </Text>
                    <Text style={[styles.modeTagline, { color: isFullDebrief ? "rgba(255,255,255,0.45)" : textMuted }]}>
                      {mode.tagline}
                    </Text>
                  </View>
                  <Feather
                    name="chevron-right"
                    size={18}
                    color={isFullDebrief ? "rgba(255,255,255,0.3)" : textMuted}
                  />
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    );
  }

  function DebriefView() {
    if (!selectedCase || !selectedMode) return null;
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.debriefHeader,
            {
              backgroundColor: selectedMode.colorBg,
              borderBottomColor: selectedMode.color + "30",
              paddingTop: topPad,
            },
          ]}
        >
          <Pressable style={styles.backBtn} onPress={() => setView("case")}>
            <Feather name="chevron-left" size={16} color={textMuted} />
            <Text style={[styles.backText, { color: textMuted }]}>Back</Text>
          </Pressable>
          <View style={[styles.row, { gap: Spacing.sm, marginTop: Spacing.sm }]}>
            <View style={[styles.modeBigIcon, { backgroundColor: selectedMode.colorBg, borderColor: selectedMode.color + "55" }]}>
              <Feather name={selectedMode.icon} size={24} color={selectedMode.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.debriefModeTitle, { color: text }]}>{selectedMode.label}</Text>
              <Text style={[styles.debriefCaseSub, { color: textMuted }]}>
                {selectedCase.age > 0 ? `${selectedCase.age}${selectedCase.gender} · ` : ""}
                {selectedCase.complaint}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.px}>
          {debriefLoading ? (
            <View style={styles.centeredPad}>
              <LoadingDots color={selectedMode.color} />
              <Text style={[styles.loadingText, { color: textMuted }]}>Generating debrief...</Text>
            </View>
          ) : debriefError ? (
            <View style={[styles.errorCard, { backgroundColor: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.2)" }]}>
              <Feather name="alert-circle" size={20} color="#EF4444" />
              <Text style={[styles.errorText, { color: "#EF4444" }]}>{debriefError}</Text>
              <Pressable
                style={[styles.retryBtn, { backgroundColor: selectedMode.color }]}
                onPress={() => startDebrief(selectedMode)}
              >
                <Text style={styles.retryBtnText}>Try Again</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ paddingTop: Spacing.lg }}>
              <MarkdownText text={displayedText} theme={theme} />
              {!debriefDone && displayedText.length > 0 && (
                <LoadingDots color={selectedMode.color} />
              )}
              {debriefDone && (
                <View style={{ gap: Spacing.sm, marginTop: Spacing.lg }}>
                  <View style={[styles.savedBadge, { backgroundColor: "rgba(29,184,112,0.08)", borderColor: "rgba(29,184,112,0.2)" }]}>
                    <Feather name="check-circle" size={14} color="#1DB870" />
                    <Text style={styles.savedText}>Saved to your clinical memory</Text>
                  </View>
                  <Pressable
                    style={[styles.anotherBtn, { backgroundColor: isDark ? "#1a2030" : "#0D1117" }]}
                    onPress={() => setView("case")}
                  >
                    <Text style={styles.anotherBtnText}>Try another lens</Text>
                    <Feather name="arrow-right" size={16} color="#fff" />
                  </Pressable>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  function MemoryView() {
    const totalWidth = memoryStats.totalCases || 1;
    return (
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: bottomPad }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.memoryDarkHeader, { backgroundColor: isDark ? "#1a1f2e" : "#0D1117", paddingTop: topPad }]}>
          <Pressable style={styles.backBtn} onPress={() => setView("home")}>
            <Feather name="chevron-left" size={16} color="rgba(255,255,255,0.5)" />
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          <Text style={styles.memorySubLabel}>CLINICAL MEMORY</Text>
          <Text style={styles.memoryTotal}>{memoryStats.totalCases} cases</Text>
          <Text style={styles.memoryTotalCaption}>documented across your career with ErMate</Text>

          <View style={styles.memoryStatRow}>
            {[
              { label: "This month", value: String(memoryStats.thisMonth) },
              { label: "All time", value: String(memoryStats.totalCases) },
              { label: "Top area", value: memoryStats.topCategoryPct + "%" },
            ].map((s, i) => (
              <View key={i} style={styles.memoryStat}>
                <Text style={styles.memoryStatVal}>{s.value}</Text>
                <Text style={styles.memoryStatLabel}>{s.label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.px}>
          <Text style={[styles.sectionLabel, { color: textMuted, marginTop: Spacing.lg }]}>
            CASES BY COMPLAINT
          </Text>

          {memoryStats.categories.length === 0 ? (
            <View style={[styles.emptyCard, { backgroundColor: card, borderColor: border, marginTop: Spacing.sm }]}>
              <Feather name="bar-chart-2" size={28} color={textMuted} />
              <Text style={[styles.emptyTitle, { color: textSec }]}>No data yet</Text>
              <Text style={[styles.emptySubtitle, { color: textMuted }]}>
                Start documenting cases to see your breakdown.
              </Text>
            </View>
          ) : (
            <View style={{ gap: Spacing.md, marginTop: Spacing.sm }}>
              {memoryStats.categories.map((cat, i) => (
                <View key={i}>
                  <View style={styles.catRow}>
                    <Text style={[styles.catLabel, { color: text }]} numberOfLines={1}>
                      {cat.label}
                    </Text>
                    <Text style={[styles.catCount, { color: text }]}>{cat.count}</Text>
                  </View>
                  <View style={[styles.barBg, { backgroundColor: border }]}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          backgroundColor: cat.color,
                          width: `${Math.round((cat.count / totalWidth) * 100)}%`,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}

          {memoryStats.topCategory !== "—" && (
            <View style={[styles.strongestCard, { backgroundColor: card, borderColor: border, marginTop: Spacing.lg }]}>
              <Text style={[styles.strongestTitle, { color: text }]}>Your most common presentation</Text>
              <Text style={[styles.strongestBody, { color: textSec }]}>
                <Text style={{ color: "#1DB870", fontWeight: "700" }}>{memoryStats.topCategory}</Text>
                {" "}— {memoryStats.topCategoryPct}% of your cases.{" "}
                You've managed {memoryStats.categories[0]?.count ?? 0} such patients with ErMate.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {view === "home" && <HomeView />}
      {view === "case" && selectedCase ? <CaseView /> : null}
      {view === "debrief" && selectedCase && selectedMode ? <DebriefView /> : null}
      {view === "memory" && <MemoryView />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  px: { paddingHorizontal: Spacing.lg },
  row: { flexDirection: "row", alignItems: "center" },

  homeHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.md,
  },
  homeTitle: { fontSize: 28, fontWeight: "800", letterSpacing: -0.6 },
  homeSubtitle: { fontSize: 13, marginTop: 2 },
  memoryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
  },
  memoryBtnText: { fontSize: 13, fontWeight: "600", color: "#1DB870" },

  streakBar: {
    borderRadius: BorderRadius.xl,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  streakLabel: { fontSize: 10, color: "rgba(255,255,255,0.4)", fontWeight: "700", letterSpacing: 0.8 },
  streakValue: { fontSize: 15, fontWeight: "700", color: "#fff", marginTop: 3 },
  streakBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "rgba(245,158,11,0.15)",
    borderRadius: BorderRadius.md,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  streakNum: { fontSize: 16, fontWeight: "800", color: "#F59E0B" },
  streakCaption: { fontSize: 10, color: "rgba(255,255,255,0.4)" },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: Spacing.sm,
  },
  lensCaption: { fontSize: 13, marginBottom: Spacing.sm, lineHeight: 18 },

  caseCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    marginBottom: Spacing.sm,
  },
  triageBadge: {
    width: 30,
    height: 30,
    borderRadius: 8,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  triageText: { fontSize: 10, fontWeight: "800" },
  triageBadgeLg: {
    width: 36,
    height: 36,
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  triageTextLg: { fontSize: 11, fontWeight: "800" },
  caseTitle: { fontSize: 14, fontWeight: "700" },
  caseDx: { fontSize: 12, marginTop: 2 },
  caseRight: { alignItems: "flex-end", gap: 4, flexShrink: 0 },
  caseTime: { fontSize: 10 },

  centeredPad: {
    paddingVertical: Spacing["2xl"],
    alignItems: "center",
    gap: Spacing.sm,
  },
  loadingText: { fontSize: 13, marginTop: Spacing.xs },
  emptyCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    gap: Spacing.xs,
  },
  emptyTitle: { fontSize: 16, fontWeight: "600" },
  emptySubtitle: { fontSize: 13, textAlign: "center", lineHeight: 18 },

  caseDarkHeader: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: Spacing.sm,
  },
  backText: { fontSize: 13, color: "rgba(255,255,255,0.5)" },
  caseHeaderTitle: { fontSize: 18, fontWeight: "800", color: "#fff", letterSpacing: -0.4 },
  caseHeaderTime: { fontSize: 12, color: "rgba(255,255,255,0.4)", marginTop: 3 },
  snapshotCard: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginTop: Spacing.md,
  },
  snapshotLabel: {
    fontSize: 9,
    color: "rgba(255,255,255,0.3)",
    fontWeight: "700",
    letterSpacing: 1,
    marginBottom: 5,
  },
  snapshotDx: { fontSize: 14, color: "#1DB870", fontWeight: "600", marginBottom: Spacing.sm },
  snapshotValue: { fontSize: 13, color: "rgba(255,255,255,0.6)", lineHeight: 20 },
  snapshotDivider: { height: 1, backgroundColor: "rgba(255,255,255,0.08)", marginVertical: Spacing.sm },

  modeCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
  },
  modeIcon: {
    width: 46,
    height: 46,
    borderRadius: 13,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  modeLabel: { fontSize: 15, fontWeight: "700" },
  modeTagline: { fontSize: 12, marginTop: 2 },

  debriefHeader: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1.5,
  },
  modeBigIcon: {
    width: 52,
    height: 52,
    borderRadius: 15,
    borderWidth: 2,
    justifyContent: "center",
    alignItems: "center",
    flexShrink: 0,
  },
  debriefModeTitle: { fontSize: 17, fontWeight: "800" },
  debriefCaseSub: { fontSize: 12, marginTop: 3 },

  dotsRow: { flexDirection: "row", gap: 6, paddingVertical: 8, alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4 },

  errorCard: {
    marginTop: Spacing.lg,
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    alignItems: "center",
    gap: Spacing.sm,
  },
  errorText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: BorderRadius.lg,
    marginTop: Spacing.xs,
  },
  retryBtnText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  savedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: Spacing.sm,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
  },
  savedText: { fontSize: 13, color: "#15924F", fontWeight: "500" },
  anotherBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  anotherBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  mdHeader: { fontSize: 14, fontWeight: "700", marginTop: Spacing.md, marginBottom: 4 },
  mdItalic: { fontSize: 12, fontStyle: "italic", marginBottom: 6 },
  mdBody: { fontSize: 14, lineHeight: 22, marginBottom: 2 },
  arrowRow: { flexDirection: "row", gap: 8, marginBottom: 6, alignItems: "flex-start" },
  arrowSymbol: { fontSize: 15, fontWeight: "700", lineHeight: 22 },
  arrowText: { flex: 1, fontSize: 14, lineHeight: 22 },
  bulletRow: { flexDirection: "row", gap: 8, marginBottom: 4, alignItems: "flex-start" },
  bulletDot: { fontSize: 12, lineHeight: 22, marginTop: 2 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 22 },
  divider: { height: 1, marginVertical: Spacing.md },

  memoryDarkHeader: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
  memorySubLabel: {
    fontSize: 10,
    color: "rgba(255,255,255,0.3)",
    fontWeight: "700",
    letterSpacing: 1.2,
    marginBottom: 6,
    marginTop: Spacing.sm,
  },
  memoryTotal: { fontSize: 30, fontWeight: "800", color: "#fff", letterSpacing: -0.6 },
  memoryTotalCaption: { fontSize: 13, color: "rgba(255,255,255,0.4)", marginTop: 3 },
  memoryStatRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  memoryStat: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  memoryStatVal: { fontSize: 20, fontWeight: "800", color: "#fff" },
  memoryStatLabel: { fontSize: 10, color: "rgba(255,255,255,0.35)", marginTop: 2 },

  catRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  catLabel: { fontSize: 14, fontWeight: "500", flex: 1, marginRight: 8 },
  catCount: { fontSize: 14, fontWeight: "700" },
  barBg: { height: 8, borderRadius: 99, overflow: "hidden" },
  barFill: { height: "100%", borderRadius: 99 },

  strongestCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    gap: 6,
  },
  strongestTitle: { fontSize: 14, fontWeight: "700" },
  strongestBody: { fontSize: 13, lineHeight: 20 },
});
