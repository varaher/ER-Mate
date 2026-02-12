import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  Linking,
  ScrollView,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import { Card } from "@/components/Card";
import { getApiUrl } from "@/lib/query-client";

const FontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
};

function getAIApiUrl(): string {
  try {
    return getApiUrl();
  } catch {
    return "";
  }
}

interface Citation {
  id: string;
  source: string;
  title: string;
  year?: string;
  url?: string;
  excerpt: string;
  sourceType?: "pubmed" | "textbook" | "guideline" | "wikem";
  authors?: string;
  refNumber?: number;
}

interface DiagnosisSuggestion {
  id: string;
  diagnosis: string;
  confidence: "high" | "moderate" | "low";
  severity_rank?: number;
  reasoning: string;
  keyFindings: string[];
  workup: string[];
  management: string[];
  citations: Citation[];
}

interface RedFlag {
  id: string;
  flag: string;
  severity: "critical" | "warning";
  action: string;
  timeframe?: string;
  citations: Citation[];
}

interface SearchSource {
  id: string;
  title: string;
  source: string;
  authors?: string;
  year?: string;
  url: string;
  sourceType: "pubmed" | "textbook" | "guideline" | "wikem";
}

interface ABGData {
  sampleType?: string;
  ph?: string;
  pco2?: string;
  po2?: string;
  hco3?: string;
  be?: string;
  lactate?: string;
  sao2?: string;
  fio2?: string;
  na?: string;
  k?: string;
  cl?: string;
  anionGap?: string;
  glucose?: string;
  hb?: string;
  aaGradient?: string;
  interpretation?: string;
  status?: string;
}

interface TreatmentData {
  medications?: { name: string; dose?: string; route?: string; frequency?: string }[];
  fluids?: string;
  procedures?: string;
  primaryDiagnosis?: string;
  differentialDiagnoses?: string;
  interventions?: string;
}

interface AIDiagnosisPanelProps {
  caseId: string;
  chiefComplaint: string;
  vitals: Record<string, string>;
  history: string;
  examination: string;
  age: number;
  gender: string;
  abgData?: ABGData;
  treatmentData?: TreatmentData;
  onDiagnosisSelect?: (diagnosis: string) => void;
}

const SOURCE_TYPE_ICONS: Record<string, { icon: string; color: string; label: string }> = {
  pubmed: { icon: "file-text", color: "#2563EB", label: "PubMed" },
  textbook: { icon: "book", color: "#7C3AED", label: "Textbook" },
  guideline: { icon: "shield", color: "#059669", label: "Guideline" },
  wikem: { icon: "globe", color: "#D97706", label: "WikEM" },
};

function renderInlineReasoning(reasoning: string, onCitationPress: (refNum: number) => void) {
  const parts = reasoning.split(/(\[\d+\])/g);
  return parts.map((part, i) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (match) {
      const refNum = parseInt(match[1], 10);
      return (
        <Text
          key={i}
          style={inlineStyles.citationRef}
          onPress={() => onCitationPress(refNum)}
        >
          {part}
        </Text>
      );
    }
    return <Text key={i}>{part}</Text>;
  });
}

export function AIDiagnosisPanel({
  caseId,
  chiefComplaint,
  vitals,
  history,
  examination,
  age,
  gender,
  abgData,
  treatmentData,
  onDiagnosisSelect,
}: AIDiagnosisPanelProps) {
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<DiagnosisSuggestion[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [sources, setSources] = useState<SearchSource[]>([]);
  const [expandedDiagnosis, setExpandedDiagnosis] = useState<string | null>(null);
  const [showSources, setShowSources] = useState(false);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [searchStatus, setSearchStatus] = useState<string>("");

  const fetchDiagnosis = useCallback(async () => {
    if (!chiefComplaint?.trim()) {
      setError("Please enter the chief complaint or signs & symptoms before analyzing.");
      return;
    }

    const apiUrl = getAIApiUrl();
    if (!apiUrl) {
      setError("AI service is not available. Please try again later.");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSearchStatus("Searching medical literature...");

    try {
      const response = await fetch(`${apiUrl}api/ai/diagnose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chiefComplaint,
          vitals,
          history,
          examination,
          age,
          gender,
          abgData,
          treatmentData: treatmentData || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.suggestions?.length === 0 && data.redFlags?.length === 0) {
          setError("AI could not generate suggestions. This may be due to service configuration. Please try again later.");
        }
        setSuggestions(data.suggestions || []);
        setRedFlags(data.redFlags || []);
        setSources(data.sources || []);
        if (data.suggestions?.length > 0) {
          setExpandedDiagnosis(data.suggestions[0].id);
        }
      } else {
        setError("Failed to get AI suggestions. Please try again.");
      }
    } catch (err) {
      console.error("Failed to fetch AI diagnosis:", err);
      setError("Unable to connect to AI service. Please check your connection.");
    } finally {
      setIsLoading(false);
      setSearchStatus("");
    }
  }, [chiefComplaint, vitals, history, examination, age, gender, abgData, treatmentData]);

  const submitFeedback = async (
    suggestionId: string,
    feedbackType: "accepted" | "modified" | "rejected",
    suggestionText?: string,
    userCorrection?: string
  ) => {
    const apiUrl = getAIApiUrl();
    setFeedbackError(null);

    if (!apiUrl) {
      setFeedbackError("Unable to record feedback - service unavailable.");
      return;
    }

    if (!caseId || caseId.trim() === "") {
      setFeedbackError("Unable to record feedback - please save the case first.");
      return;
    }

    try {
      const response = await fetch(`${apiUrl}api/ai/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suggestionId, caseId, feedbackType, suggestionText, userCorrection }),
      });

      if (response.ok) {
        setFeedbackGiven((prev) => ({ ...prev, [suggestionId]: feedbackType }));
        if (feedbackType === "accepted") {
          onDiagnosisSelect?.(suggestionText || "");
        }
      } else if (response.status === 503) {
        const errorData = await response.json().catch(() => ({}));
        setFeedbackError(errorData.error || "Self-learning feedback is currently unavailable.");
      } else {
        const errorData = await response.json().catch(() => ({}));
        setFeedbackError(errorData.error || "Failed to save feedback. Please try again.");
      }
    } catch (err) {
      console.error("Failed to submit feedback:", err);
      setFeedbackError("Unable to connect to server. Please check your connection.");
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high": return "#22C55E";
      case "moderate": return "#F59E0B";
      case "low": return "#EF4444";
      default: return theme.textSecondary;
    }
  };

  const getSeverityColor = (rank: number) => {
    switch (rank) {
      case 1: return "#DC2626";
      case 2: return "#EA580C";
      case 3: return "#D97706";
      case 4: return "#2563EB";
      case 5: return "#22C55E";
      default: return theme.textSecondary;
    }
  };

  const getSeverityLabel = (rank: number) => {
    switch (rank) {
      case 1: return "MOST SEVERE";
      case 2: return "SEVERE";
      case 3: return "MODERATE";
      case 4: return "MILD";
      case 5: return "LEAST SEVERE";
      default: return "";
    }
  };

  const scrollToCitation = (refNum: number) => {
    setShowSources(true);
  };

  const openUrl = (url?: string) => {
    if (url) Linking.openURL(url);
  };

  const getSourceIcon = (sourceType?: string) => {
    const info = SOURCE_TYPE_ICONS[sourceType || ""] || SOURCE_TYPE_ICONS.pubmed;
    return info;
  };

  const renderSourceBadge = (sourceType?: string) => {
    const info = getSourceIcon(sourceType);
    return (
      <View style={[styles.sourceTypeBadge, { backgroundColor: info.color + "15" }]}>
        <Feather name={info.icon as any} size={10} color={info.color} />
        <Text style={[styles.sourceTypeText, { color: info.color }]}>{info.label}</Text>
      </View>
    );
  };

  const renderBulletList = (items: string[], iconName: string, iconColor: string) => {
    if (!items || items.length === 0) return null;
    return (
      <View style={styles.bulletList}>
        {items.map((item, i) => (
          <View key={i} style={styles.bulletItem}>
            <Feather name={iconName as any} size={12} color={iconColor} style={styles.bulletIcon} />
            <Text style={[styles.bulletText, { color: theme.text }]}>{item}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderSuggestion = (suggestion: DiagnosisSuggestion, index: number) => {
    const isExpanded = expandedDiagnosis === suggestion.id;
    const feedback = feedbackGiven[suggestion.id];
    const rank = suggestion.severity_rank || (index + 1);
    const severityColor = getSeverityColor(rank);
    const severityLabel = getSeverityLabel(rank);

    return (
      <Card key={suggestion.id} style={styles.suggestionCard}>
        <Pressable onPress={() => setExpandedDiagnosis(isExpanded ? null : suggestion.id)}>
          <View style={styles.suggestionHeader}>
            <View style={styles.diagnosisRow}>
              <View style={[styles.diagnosisNumber, { backgroundColor: severityColor }]}>
                <Text style={styles.diagnosisNumberText}>{rank}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.diagnosisText, { color: theme.text }]} numberOfLines={isExpanded ? undefined : 1}>
                  {suggestion.diagnosis}
                </Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 }}>
                  <View style={[styles.confidenceBadge, { backgroundColor: severityColor + "15" }]}>
                    <Text style={[styles.confidenceText, { color: severityColor, fontSize: 9 }]}>
                      {severityLabel}
                    </Text>
                  </View>
                  <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(suggestion.confidence) + "20" }]}>
                    <Text style={[styles.confidenceText, { color: getConfidenceColor(suggestion.confidence) }]}>
                      {suggestion.confidence.toUpperCase()}
                    </Text>
                  </View>
                </View>
              </View>
              <Feather name={isExpanded ? "chevron-up" : "chevron-down"} size={18} color={theme.textSecondary} />
            </View>
          </View>
        </Pressable>

        {isExpanded ? (
          <View style={styles.expandedContent}>
            <View style={styles.reasoningSection}>
              <View style={styles.sectionLabelRow}>
                <Feather name="message-circle" size={14} color="#8B5CF6" />
                <Text style={[styles.sectionLabel, { color: "#8B5CF6" }]}>Clinical Reasoning</Text>
              </View>
              <Text style={[styles.reasoningText, { color: theme.text }]}>
                {renderInlineReasoning(suggestion.reasoning, scrollToCitation)}
              </Text>
            </View>

            {suggestion.keyFindings && suggestion.keyFindings.length > 0 ? (
              <View style={styles.subsection}>
                <View style={styles.sectionLabelRow}>
                  <Feather name="check-circle" size={14} color="#22C55E" />
                  <Text style={[styles.sectionLabel, { color: "#22C55E" }]}>Key Findings</Text>
                </View>
                {renderBulletList(suggestion.keyFindings, "check", "#22C55E")}
              </View>
            ) : null}

            {suggestion.workup && suggestion.workup.length > 0 ? (
              <View style={styles.subsection}>
                <View style={styles.sectionLabelRow}>
                  <Feather name="search" size={14} color="#3B82F6" />
                  <Text style={[styles.sectionLabel, { color: "#3B82F6" }]}>Recommended Workup</Text>
                </View>
                {renderBulletList(suggestion.workup, "arrow-right", "#3B82F6")}
              </View>
            ) : null}

            {suggestion.management && suggestion.management.length > 0 ? (
              <View style={styles.subsection}>
                <View style={styles.sectionLabelRow}>
                  <Feather name="activity" size={14} color="#D97706" />
                  <Text style={[styles.sectionLabel, { color: "#D97706" }]}>Initial Management</Text>
                </View>
                {renderBulletList(suggestion.management, "arrow-right", "#D97706")}
              </View>
            ) : null}

            {suggestion.citations.length > 0 ? (
              <View style={styles.inlineCitations}>
                <Text style={[styles.citedSourcesLabel, { color: theme.textSecondary }]}>
                  Cited Sources ({suggestion.citations.length})
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.citationChips}>
                  {suggestion.citations.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[styles.citationChip, { borderColor: theme.textSecondary + "30" }]}
                      onPress={() => openUrl(c.url)}
                    >
                      {renderSourceBadge(c.sourceType)}
                      <Text style={[styles.citationChipRef, { color: "#3B82F6" }]}>
                        [{c.refNumber}]
                      </Text>
                      <Text style={[styles.citationChipText, { color: theme.text }]} numberOfLines={1}>
                        {c.title.length > 35 ? c.title.substring(0, 35) + "..." : c.title}
                      </Text>
                      {c.url ? <Feather name="external-link" size={10} color="#3B82F6" /> : null}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            ) : null}

            <View style={styles.feedbackRow}>
              {!feedback ? (
                <>
                  <Pressable
                    style={[styles.feedbackButton, styles.acceptButton]}
                    onPress={() => submitFeedback(suggestion.id, "accepted", suggestion.diagnosis)}
                  >
                    <Feather name="thumbs-up" size={14} color="#22C55E" />
                    <Text style={[styles.feedbackText, { color: "#22C55E" }]}>Accept</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.feedbackButton, styles.rejectButton]}
                    onPress={() => submitFeedback(suggestion.id, "rejected", suggestion.diagnosis)}
                  >
                    <Feather name="thumbs-down" size={14} color="#EF4444" />
                    <Text style={[styles.feedbackText, { color: "#EF4444" }]}>Reject</Text>
                  </Pressable>
                </>
              ) : (
                <View style={styles.feedbackGiven}>
                  <Feather
                    name={feedback === "accepted" ? "check-circle" : "x-circle"}
                    size={14}
                    color={feedback === "accepted" ? "#22C55E" : "#EF4444"}
                  />
                  <Text style={[styles.feedbackGivenText, { color: feedback === "accepted" ? "#22C55E" : "#EF4444" }]}>
                    {feedback === "accepted" ? "Accepted - added to diagnosis" : "Rejected"}
                  </Text>
                </View>
              )}
            </View>
          </View>
        ) : null}
      </Card>
    );
  };

  const renderRedFlag = (flag: RedFlag) => {
    const isCritical = flag.severity === "critical";
    const bgColor = isCritical ? "#FEE2E2" : "#FEF3C7";
    const borderColor = isCritical ? "#EF4444" : "#F59E0B";
    const textColor = isCritical ? "#B91C1C" : "#92400E";

    return (
      <View key={flag.id} style={[styles.redFlagCard, { backgroundColor: bgColor, borderColor }]}>
        <View style={styles.redFlagHeader}>
          <Feather name="alert-triangle" size={18} color={borderColor} />
          <View style={styles.redFlagContent}>
            <Text style={[styles.redFlagTitle, { color: textColor }]}>{flag.flag}</Text>
            <Text style={[styles.redFlagAction, { color: textColor }]}>{flag.action}</Text>
            {flag.timeframe ? (
              <View style={[styles.timeframeBadge, { backgroundColor: borderColor + "20" }]}>
                <Feather name="clock" size={10} color={borderColor} />
                <Text style={[styles.timeframeText, { color: textColor }]}>{flag.timeframe}</Text>
              </View>
            ) : null}
          </View>
        </View>

        {flag.citations.length > 0 ? (
          <View style={styles.redFlagCitations}>
            {flag.citations.map((c) => (
              <Pressable key={c.id} style={styles.redFlagCitationRow} onPress={() => openUrl(c.url)}>
                {renderSourceBadge(c.sourceType)}
                <Text style={[styles.redFlagCitationText, { color: textColor }]} numberOfLines={1}>
                  [{c.refNumber}] {c.source}
                </Text>
                {c.url ? <Feather name="external-link" size={10} color={textColor} /> : null}
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

  const renderSourcesPanel = () => {
    if (sources.length === 0) return null;

    return (
      <View style={styles.sourcesPanel}>
        <Pressable
          style={styles.sourcesPanelHeader}
          onPress={() => setShowSources(!showSources)}
        >
          <View style={styles.sourcesPanelTitleRow}>
            <Feather name="book-open" size={16} color="#3B82F6" />
            <Text style={[styles.sourcesPanelTitle, { color: theme.text }]}>
              Sources ({sources.length})
            </Text>
          </View>
          <Feather name={showSources ? "chevron-up" : "chevron-down"} size={18} color={theme.textSecondary} />
        </Pressable>

        {showSources ? (
          <View style={styles.sourcesListContainer}>
            {sources.map((source, index) => {
              const info = getSourceIcon(source.sourceType);
              return (
                <Pressable
                  key={source.id}
                  style={[styles.sourceItem, { borderBottomColor: theme.textSecondary + "15" }]}
                  onPress={() => openUrl(source.url)}
                >
                  <View style={[styles.sourceRefBadge, { backgroundColor: info.color }]}>
                    <Text style={styles.sourceRefText}>{index + 1}</Text>
                  </View>
                  <View style={styles.sourceDetails}>
                    <View style={styles.sourceTypeRow}>
                      {renderSourceBadge(source.sourceType)}
                      {source.year ? (
                        <Text style={[styles.sourceYear, { color: theme.textSecondary }]}>{source.year}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.sourceTitle, { color: "#3B82F6" }]} numberOfLines={2}>
                      {source.title}
                    </Text>
                    <Text style={[styles.sourceJournal, { color: theme.textSecondary }]} numberOfLines={1}>
                      {source.source}
                      {source.authors ? ` - ${source.authors}` : ""}
                    </Text>
                  </View>
                  <Feather name="external-link" size={14} color="#3B82F6" />
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Feather name="cpu" size={20} color="#8B5CF6" />
          <Text style={[styles.title, { color: theme.text }]}>AI Diagnosis Assistant</Text>
        </View>
        <Pressable
          style={[styles.analyzeButton, isLoading && styles.buttonDisabled]}
          onPress={fetchDiagnosis}
          disabled={isLoading || !chiefComplaint}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="zap" size={16} color="#FFFFFF" />
              <Text style={styles.analyzeButtonText}>Analyze</Text>
            </>
          )}
        </Pressable>
      </View>

      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Evidence-based analysis with real-time medical literature search. Tap [citations] to view sources.
      </Text>

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator size="large" color="#8B5CF6" />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>{searchStatus || "Analyzing..."}</Text>
          <Text style={[styles.loadingSubtext, { color: theme.textSecondary }]}>
            Searching PubMed, WikEM, and clinical guidelines
          </Text>
        </View>
      ) : null}

      {!isLoading && redFlags.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Feather name="alert-triangle" size={16} color="#EF4444" />
            <Text style={[styles.sectionTitle, { color: "#EF4444" }]}>Red Flags</Text>
          </View>
          {redFlags.map((flag) => renderRedFlag(flag))}
        </View>
      ) : null}

      {!isLoading && suggestions.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Feather name="list" size={16} color={theme.text} />
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Provisional Diagnoses (Severity Ranked)</Text>
          </View>
          {suggestions.map((s, i) => renderSuggestion(s, i))}
        </View>
      ) : null}

      {!isLoading ? renderSourcesPanel() : null}

      {error ? (
        <View style={[styles.errorState, { backgroundColor: "#FEF2F2", borderColor: "#EF4444" }]}>
          <Feather name="alert-circle" size={20} color="#EF4444" />
          <Text style={[styles.errorText, { color: "#B91C1C" }]}>{error}</Text>
        </View>
      ) : null}

      {feedbackError ? (
        <View style={[styles.feedbackWarning, { backgroundColor: "#FEF2F2", borderColor: "#EF4444" }]}>
          <Feather name="alert-circle" size={16} color="#B91C1C" />
          <Text style={[styles.feedbackWarningText, { color: "#B91C1C" }]}>{feedbackError}</Text>
        </View>
      ) : null}

      {!isLoading && !error && suggestions.length === 0 && redFlags.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="search" size={24} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Enter patient details and tap Analyze for evidence-based diagnosis suggestions with medical literature references.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const inlineStyles = StyleSheet.create({
  citationRef: {
    color: "#3B82F6",
    fontWeight: "700",
    fontSize: FontSizes.sm,
  },
});

const styles = StyleSheet.create({
  container: {
    marginVertical: Spacing.md,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.lg,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: FontSizes.xs,
    marginBottom: Spacing.md,
    lineHeight: 16,
  },
  analyzeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    backgroundColor: "#8B5CF6",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  analyzeButtonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: FontSizes.sm,
  },
  loadingState: {
    alignItems: "center",
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  loadingText: {
    fontSize: FontSizes.md,
    fontWeight: "500",
    marginTop: Spacing.sm,
  },
  loadingSubtext: {
    fontSize: FontSizes.xs,
  },
  section: {
    marginTop: Spacing.md,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: "600",
  },
  suggestionCard: {
    padding: 0,
    marginBottom: Spacing.sm,
    overflow: "hidden",
  },
  suggestionHeader: {
    padding: Spacing.md,
  },
  diagnosisRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  diagnosisNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  diagnosisNumberText: {
    color: "#FFFFFF",
    fontSize: FontSizes.xs,
    fontWeight: "700",
  },
  diagnosisText: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    flex: 1,
  },
  confidenceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: 10,
    fontWeight: "700",
  },
  expandedContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  reasoningSection: {
    marginBottom: Spacing.md,
  },
  sectionLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: Spacing.xs,
  },
  sectionLabel: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
  },
  reasoningText: {
    fontSize: FontSizes.sm,
    lineHeight: 21,
  },
  subsection: {
    marginBottom: Spacing.md,
  },
  bulletList: {
    gap: 6,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bulletIcon: {
    marginTop: 3,
  },
  bulletText: {
    flex: 1,
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  inlineCitations: {
    marginBottom: Spacing.sm,
  },
  citedSourcesLabel: {
    fontSize: FontSizes.xs,
    fontWeight: "500",
    marginBottom: 6,
  },
  citationChips: {
    flexDirection: "row",
  },
  citationChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    marginRight: 6,
  },
  citationChipRef: {
    fontSize: 10,
    fontWeight: "700",
  },
  citationChipText: {
    fontSize: FontSizes.xs,
    maxWidth: 120,
  },
  feedbackRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  feedbackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  acceptButton: {
    borderColor: "#22C55E",
    backgroundColor: "#F0FDF4",
  },
  rejectButton: {
    borderColor: "#EF4444",
    backgroundColor: "#FEF2F2",
  },
  feedbackText: {
    fontSize: FontSizes.sm,
    fontWeight: "500",
  },
  feedbackGiven: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  feedbackGivenText: {
    fontSize: FontSizes.sm,
    fontWeight: "500",
  },
  redFlagCard: {
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: Spacing.sm,
  },
  redFlagHeader: {
    flexDirection: "row",
    gap: Spacing.sm,
  },
  redFlagContent: {
    flex: 1,
  },
  redFlagTitle: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    marginBottom: 4,
  },
  redFlagAction: {
    fontSize: FontSizes.sm,
    lineHeight: 18,
  },
  timeframeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: "flex-start",
    marginTop: 6,
  },
  timeframeText: {
    fontSize: FontSizes.xs,
    fontWeight: "600",
  },
  redFlagCitations: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
    gap: 4,
  },
  redFlagCitationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  redFlagCitationText: {
    flex: 1,
    fontSize: FontSizes.xs,
  },
  sourcesPanel: {
    marginTop: Spacing.md,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#3B82F620",
    overflow: "hidden",
  },
  sourcesPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    backgroundColor: "#3B82F608",
  },
  sourcesPanelTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sourcesPanelTitle: {
    fontSize: FontSizes.md,
    fontWeight: "600",
  },
  sourcesListContainer: {
    paddingHorizontal: Spacing.sm,
  },
  sourceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
  },
  sourceRefBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: "center",
    alignItems: "center",
  },
  sourceRefText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  sourceDetails: {
    flex: 1,
  },
  sourceTypeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 2,
  },
  sourceTypeBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  sourceTypeText: {
    fontSize: 9,
    fontWeight: "600",
  },
  sourceYear: {
    fontSize: FontSizes.xs,
  },
  sourceTitle: {
    fontSize: FontSizes.sm,
    fontWeight: "500",
    lineHeight: 18,
  },
  sourceJournal: {
    fontSize: FontSizes.xs,
    marginTop: 1,
  },
  emptyState: {
    alignItems: "center",
    padding: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    textAlign: "center",
    fontSize: FontSizes.sm,
    lineHeight: 20,
  },
  errorState: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: 8,
    borderWidth: 1,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: FontSizes.sm,
    lineHeight: 18,
  },
  feedbackWarning: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    gap: Spacing.xs,
    marginTop: Spacing.sm,
  },
  feedbackWarningText: {
    flex: 1,
    fontSize: FontSizes.xs,
    lineHeight: 16,
  },
});
