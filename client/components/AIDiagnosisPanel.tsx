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
import { Spacing, Typography } from "@/constants/theme";
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
}

interface DiagnosisSuggestion {
  id: string;
  diagnosis: string;
  confidence: "high" | "moderate" | "low";
  reasoning: string;
  citations: Citation[];
}

interface RedFlag {
  id: string;
  flag: string;
  severity: "critical" | "warning";
  action: string;
  citations: Citation[];
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

interface AIDiagnosisPanelProps {
  caseId: string;
  chiefComplaint: string;
  vitals: Record<string, string>;
  history: string;
  examination: string;
  age: number;
  gender: string;
  abgData?: ABGData;
  onDiagnosisSelect?: (diagnosis: string) => void;
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
  onDiagnosisSelect,
}: AIDiagnosisPanelProps) {
  const { theme } = useTheme();
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<DiagnosisSuggestion[]>([]);
  const [redFlags, setRedFlags] = useState<RedFlag[]>([]);
  const [expandedCitation, setExpandedCitation] = useState<string | null>(null);
  const [feedbackGiven, setFeedbackGiven] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const fetchDiagnosis = useCallback(async () => {
    if (!chiefComplaint) return;
    
    const apiUrl = getAIApiUrl();
    if (!apiUrl) {
      setError("AI service is not available. Please try again later.");
      return;
    }
    
    setIsLoading(true);
    setError(null);
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
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.suggestions?.length === 0 && data.redFlags?.length === 0) {
          setError("AI could not generate suggestions. This may be due to service configuration. Please try again later.");
        }
        setSuggestions(data.suggestions || []);
        setRedFlags(data.redFlags || []);
      } else {
        setError("Failed to get AI suggestions. Please try again.");
      }
    } catch (err) {
      console.error("Failed to fetch AI diagnosis:", err);
      setError("Unable to connect to AI service. Please check your connection.");
    } finally {
      setIsLoading(false);
    }
  }, [chiefComplaint, vitals, history, examination, age, gender, abgData]);

  const submitFeedback = async (
    suggestionId: string,
    feedbackType: "accepted" | "modified" | "rejected",
    suggestionText?: string,
    userCorrection?: string
  ) => {
    const apiUrl = getAIApiUrl();
    setFeedbackError(null);
    
    if (!apiUrl) {
      setFeedbackError("Unable to record feedback - service unavailable. Your selection was not saved.");
      return;
    }
    
    if (!caseId || caseId.trim() === "") {
      console.warn("Cannot submit feedback: no valid caseId");
      setFeedbackError("Unable to record feedback - please save the case first. Your selection was not saved.");
      return;
    }
    
    try {
      const response = await fetch(`${apiUrl}api/ai/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          suggestionId,
          caseId,
          feedbackType,
          suggestionText,
          userCorrection,
        }),
      });
      
      if (response.ok) {
        setFeedbackGiven((prev) => ({ ...prev, [suggestionId]: feedbackType }));
        if (feedbackType === "accepted") {
          onDiagnosisSelect?.(suggestionText || "");
        }
      } else if (response.status === 503) {
        const errorData = await response.json().catch(() => ({}));
        setFeedbackError(errorData.error || "Self-learning feedback is currently unavailable. Please try again later.");
      } else {
        const errorData = await response.json().catch(() => ({}));
        setFeedbackError(errorData.error || "Failed to save feedback. Please try again.");
      }
    } catch (err) {
      console.error("Failed to submit feedback:", err);
      setFeedbackError("Unable to connect to server. Please check your connection and try again.");
    }
  };

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case "high":
        return "#22C55E";
      case "moderate":
        return "#F59E0B";
      case "low":
        return "#EF4444";
      default:
        return theme.textSecondary;
    }
  };

  const toggleCitation = (id: string) => {
    setExpandedCitation(expandedCitation === id ? null : id);
  };

  const openCitationUrl = (url?: string) => {
    if (url) {
      Linking.openURL(url);
    }
  };

  const renderCitation = (citation: Citation, index: number) => {
    const isExpanded = expandedCitation === citation.id;

    return (
      <View key={citation.id} style={styles.citationContainer}>
        <Pressable
          style={[styles.citationButton, { backgroundColor: theme.card }]}
          onPress={() => toggleCitation(citation.id)}
        >
          <View style={styles.citationHeader}>
            <View style={styles.citationBadge}>
              <Text style={styles.citationNumber}>{index + 1}</Text>
            </View>
            <Text style={[styles.citationSource, { color: "#3B82F6" }]} numberOfLines={1}>
              {citation.source}
            </Text>
            <Feather
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={theme.textSecondary}
            />
          </View>
        </Pressable>

        {isExpanded && (
          <View style={[styles.citationExpanded, { backgroundColor: theme.backgroundDefault }]}>
            <Text style={[styles.citationTitle, { color: theme.text }]}>
              {citation.title}
            </Text>
            {citation.year && (
              <Text style={[styles.citationYear, { color: theme.textSecondary }]}>
                {citation.year}
              </Text>
            )}
            <Text style={[styles.citationExcerpt, { color: theme.text }]}>
              "{citation.excerpt}"
            </Text>
            {citation.url && (
              <Pressable
                style={styles.citationLink}
                onPress={() => openCitationUrl(citation.url)}
              >
                <Feather name="external-link" size={14} color="#3B82F6" />
                <Text style={styles.citationLinkText}>View Source</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderSuggestion = (suggestion: DiagnosisSuggestion, index: number) => {
    const suggestionId = suggestion.id;
    const feedback = feedbackGiven[suggestionId];

    return (
      <Card key={suggestion.id} style={styles.suggestionCard}>
        <View style={styles.suggestionHeader}>
          <View style={styles.diagnosisRow}>
            <Text style={[styles.diagnosisText, { color: theme.text }]}>
              {suggestion.diagnosis}
            </Text>
            <View
              style={[
                styles.confidenceBadge,
                { backgroundColor: getConfidenceColor(suggestion.confidence) + "20" },
              ]}
            >
              <Text
                style={[
                  styles.confidenceText,
                  { color: getConfidenceColor(suggestion.confidence) },
                ]}
              >
                {suggestion.confidence.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.reasoningText, { color: theme.textSecondary }]}>
          {suggestion.reasoning}
        </Text>

        {suggestion.citations.length > 0 && (
          <View style={styles.citationsSection}>
            <Text style={[styles.citationsLabel, { color: theme.text }]}>
              References:
            </Text>
            {suggestion.citations.map((c, i) => renderCitation(c, i))}
          </View>
        )}

        <View style={styles.feedbackRow}>
          {!feedback ? (
            <>
              <Pressable
                style={[styles.feedbackButton, styles.acceptButton]}
                onPress={() => submitFeedback(suggestionId, "accepted", suggestion.diagnosis)}
              >
                <Feather name="thumbs-up" size={16} color="#22C55E" />
                <Text style={[styles.feedbackText, { color: "#22C55E" }]}>Accept</Text>
              </Pressable>
              <Pressable
                style={[styles.feedbackButton, styles.rejectButton]}
                onPress={() => submitFeedback(suggestionId, "rejected", suggestion.diagnosis)}
              >
                <Feather name="thumbs-down" size={16} color="#EF4444" />
                <Text style={[styles.feedbackText, { color: "#EF4444" }]}>Reject</Text>
              </Pressable>
            </>
          ) : (
            <View style={styles.feedbackGiven}>
              <Feather
                name={feedback === "accepted" ? "check-circle" : "x-circle"}
                size={16}
                color={feedback === "accepted" ? "#22C55E" : "#EF4444"}
              />
              <Text
                style={[
                  styles.feedbackGivenText,
                  { color: feedback === "accepted" ? "#22C55E" : "#EF4444" },
                ]}
              >
                {feedback === "accepted" ? "Accepted" : "Rejected"}
              </Text>
            </View>
          )}
        </View>
      </Card>
    );
  };

  const renderRedFlag = (flag: RedFlag, index: number) => {
    const isCritical = flag.severity === "critical";
    const bgColor = isCritical ? "#FEE2E2" : "#FEF3C7";
    const borderColor = isCritical ? "#EF4444" : "#F59E0B";
    const textColor = isCritical ? "#B91C1C" : "#92400E";

    return (
      <View
        key={flag.id}
        style={[styles.redFlagCard, { backgroundColor: bgColor, borderColor }]}
      >
        <View style={styles.redFlagHeader}>
          <Feather
            name="alert-triangle"
            size={20}
            color={borderColor}
          />
          <View style={styles.redFlagContent}>
            <Text style={[styles.redFlagTitle, { color: textColor }]}>
              {flag.flag}
            </Text>
            <Text style={[styles.redFlagAction, { color: textColor }]}>
              {flag.action}
            </Text>
          </View>
        </View>

        {flag.citations.length > 0 && (
          <View style={styles.redFlagCitations}>
            {flag.citations.map((c, i) => renderCitation(c, i))}
          </View>
        )}
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
        AI suggestions with medical literature references. Your feedback helps improve accuracy.
      </Text>

      {redFlags.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: "#EF4444" }]}>
            Red Flags Detected
          </Text>
          {redFlags.map((flag, i) => renderRedFlag(flag, i))}
        </View>
      )}

      {suggestions.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>
            Differential Diagnoses
          </Text>
          {suggestions.map((s, i) => renderSuggestion(s, i))}
        </View>
      )}

      {error && (
        <View style={[styles.errorState, { backgroundColor: "#FEF2F2", borderColor: "#EF4444" }]}>
          <Feather name="alert-circle" size={20} color="#EF4444" />
          <Text style={[styles.errorText, { color: "#B91C1C" }]}>
            {error}
          </Text>
        </View>
      )}

      {feedbackError && (
        <View style={[styles.feedbackWarning, { backgroundColor: "#FEF2F2", borderColor: "#EF4444" }]}>
          <Feather name="alert-circle" size={16} color="#B91C1C" />
          <Text style={[styles.feedbackWarningText, { color: "#B91C1C" }]}>
            {feedbackError}
          </Text>
        </View>
      )}

      {!isLoading && !error && suggestions.length === 0 && redFlags.length === 0 && (
        <View style={styles.emptyState}>
          <Feather name="info" size={24} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
            Enter patient details and tap Analyze to get AI-powered diagnosis suggestions with medical literature references.
          </Text>
        </View>
      )}
    </View>
  );
}

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
    fontSize: FontSizes.sm,
    marginBottom: Spacing.md,
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
  section: {
    marginTop: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    marginBottom: Spacing.sm,
  },
  suggestionCard: {
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  suggestionHeader: {
    marginBottom: Spacing.sm,
  },
  diagnosisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  diagnosisText: {
    fontSize: FontSizes.md,
    fontWeight: "600",
    flex: 1,
  },
  confidenceBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 4,
  },
  confidenceText: {
    fontSize: FontSizes.xs,
    fontWeight: "600",
  },
  reasoningText: {
    fontSize: FontSizes.sm,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  citationsSection: {
    marginTop: Spacing.sm,
  },
  citationsLabel: {
    fontSize: FontSizes.sm,
    fontWeight: "500",
    marginBottom: Spacing.xs,
  },
  citationContainer: {
    marginBottom: Spacing.xs,
  },
  citationButton: {
    padding: Spacing.sm,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  citationHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  citationBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "#3B82F6",
    justifyContent: "center",
    alignItems: "center",
  },
  citationNumber: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "600",
  },
  citationSource: {
    flex: 1,
    fontSize: FontSizes.sm,
    fontWeight: "500",
  },
  citationExpanded: {
    padding: Spacing.sm,
    marginTop: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  citationTitle: {
    fontSize: FontSizes.sm,
    fontWeight: "600",
    marginBottom: 4,
  },
  citationYear: {
    fontSize: FontSizes.xs,
    marginBottom: 8,
  },
  citationExcerpt: {
    fontSize: FontSizes.sm,
    fontStyle: "italic",
    lineHeight: 18,
    marginBottom: Spacing.sm,
  },
  citationLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  citationLinkText: {
    color: "#3B82F6",
    fontSize: FontSizes.sm,
    fontWeight: "500",
  },
  feedbackRow: {
    flexDirection: "row",
    gap: Spacing.sm,
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  feedbackButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
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
  },
  redFlagCitations: {
    marginTop: Spacing.sm,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.1)",
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
