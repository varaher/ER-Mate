import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Linking,
  ScrollView,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useTheme } from "@/hooks/useTheme";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography, TriageColors } from "@/constants/theme";

interface HandoverVitals {
  bp?: string;
  hr?: string;
  spo2?: string;
  rr?: string;
  temp?: string;
}

interface HandoverPatient {
  bedNumber?: string;
  patientName?: string;
  age?: string;
  sex?: string;
  diagnosis?: string;
  status?: "critical" | "unstable" | "stable" | "for_discharge";
  vitals?: HandoverVitals;
  activeIssues?: string[];
  medications?: string[];
  pendingTasks?: string[];
  criticalAlerts?: string[];
  awaitingResults?: string[];
}

const STATUS_COLOR: Record<string, string> = {
  critical: TriageColors.red,
  unstable: TriageColors.orange,
  stable: TriageColors.green,
  for_discharge: TriageColors.blue,
};

const STATUS_LABEL: Record<string, string> = {
  critical: "CRITICAL",
  unstable: "UNSTABLE",
  stable: "STABLE",
  for_discharge: "FOR DISCHARGE",
};

function statusEmoji(status?: string): string {
  if (status === "critical") return "\u{1F534}";
  if (status === "unstable") return "\u{1F7E0}";
  if (status === "for_discharge") return "\u{1F535}";
  return "\u{1F7E2}";
}

function buildShareText(patients: HandoverPatient[]): string {
  const lines: string[] = [];
  lines.push("*ErMate Handover*");
  lines.push(`Structured ${new Date().toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })}`);
  lines.push("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  patients.forEach((p) => {
    lines.push("");
    const nameLine = `${statusEmoji(p.status)} *${p.bedNumber || "Bed —"} — ${p.patientName || "Unknown"}${p.age ? `, ${p.age}${p.sex || ""}` : ""}*`;
    lines.push(nameLine);
    if (p.diagnosis) lines.push(`Dx: ${p.diagnosis}`);
    lines.push(`Status: ${STATUS_LABEL[p.status || "stable"]}`);
    const v = p.vitals || {};
    const vitalsParts = [v.bp && `BP ${v.bp}`, v.hr && `HR ${v.hr}`, v.spo2 && `SpO2 ${v.spo2}%`, v.rr && `RR ${v.rr}`, v.temp && `Temp ${v.temp}`].filter(Boolean);
    if (vitalsParts.length) lines.push(vitalsParts.join(" \u00b7 "));
    (p.criticalAlerts || []).forEach((a) => lines.push(`\u26A0 ${a}`));
    (p.medications || []).forEach((m) => lines.push(`\u{1F489} ${m}`));
    (p.pendingTasks || []).forEach((t) => lines.push(`\u{1F4CB} ${t}`));
    (p.awaitingResults || []).forEach((r) => lines.push(`\u23F3 ${r}`));
  });
  lines.push("");
  lines.push("\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  lines.push("Sent via ErMate \u2014 ermate.in");
  return lines.join("\n");
}

export default function PublicHandoverScreen() {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [patients, setPatients] = useState<HandoverPatient[] | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const handleStructure = async () => {
    if (!rawText.trim()) {
      Alert.alert("Nothing to structure", "Paste your handover notes first.");
      return;
    }
    setLoading(true);
    setError("");
    setPatients(null);
    try {
      const res = await fetch(new URL("/api/handover/structure", getApiUrl()).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: rawText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not structure this handover. Please try again.");
        return;
      }
      setPatients(data.patients || []);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setPatients(null);
    setRawText("");
    setError("");
  };

  const handleShareWhatsapp = async () => {
    if (!patients) return;
    const text = buildShareText(patients);
    const encoded = encodeURIComponent(text);
    const waAppUrl = `whatsapp://send?text=${encoded}`;
    const waWebUrl = `https://wa.me/?text=${encoded}`;
    try {
      if (Platform.OS !== "web") {
        const canOpen = await Linking.canOpenURL(waAppUrl);
        await Linking.openURL(canOpen ? waAppUrl : waWebUrl);
      } else {
        await Linking.openURL(waWebUrl);
      }
    } catch {
      Alert.alert("Couldn't open WhatsApp", "Copy the handover instead and paste it manually.");
    }
  };

  const handleCopy = async () => {
    if (!patients) return;
    await Clipboard.setStringAsync(buildShareText(patients));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.backgroundDefault }}
      contentContainerStyle={[
        styles.content,
        { paddingTop: headerHeight + Spacing.xl, paddingBottom: insets.bottom + Spacing["3xl"] },
      ]}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.headerBlock}>
        <View style={[styles.badge, { backgroundColor: theme.primaryLight }]}>
          <Feather name="zap" size={14} color={theme.primary} />
          <Text style={[styles.badgeText, { color: theme.primary }]}>Free \u00b7 No account needed</Text>
        </View>
        <Text style={[styles.title, { color: theme.text }]}>Quick Handover</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          Paste your shift handover notes from any source. ErMate will structure it into a clean, shareable handover sheet.
        </Text>
      </View>

      {!patients ? (
        <>
          <View style={[styles.disclaimerBox, { backgroundColor: theme.warningLight, borderColor: theme.warning }]}>
            <Feather name="shield" size={16} color={theme.warning} />
            <Text style={[styles.disclaimerText, { color: theme.text }]}>
              Only paste information you're authorized to share outside your hospital's systems. This text is processed to generate your handover and is not stored by ErMate.
            </Text>
          </View>

          <View style={[styles.pasteBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TextInput
              style={[styles.pasteInput, { color: theme.text }]}
              placeholder="Paste your handover notes from your hospital EMR, WhatsApp, or type them here..."
              placeholderTextColor={theme.textMuted}
              value={rawText}
              onChangeText={setRawText}
              multiline
              textAlignVertical="top"
            />
          </View>

          {error ? (
            <Text style={[styles.errorText, { color: theme.danger }]}>{error}</Text>
          ) : null}

          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.primary, opacity: pressed || loading ? 0.85 : 1 },
            ]}
            onPress={handleStructure}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color="#FFFFFF" size="small" />
                <Text style={styles.primaryButtonText}>Structuring...</Text>
              </View>
            ) : (
              <Text style={styles.primaryButtonText}>Structure this handover</Text>
            )}
          </Pressable>

          <Pressable style={styles.backLink} onPress={() => navigation.goBack()}>
            <Text style={[styles.backLinkText, { color: theme.textSecondary }]}>Back to login</Text>
          </Pressable>
        </>
      ) : (
        <>
          {patients.length === 0 ? (
            <Text style={[styles.errorText, { color: theme.textSecondary }]}>No patients found in that text.</Text>
          ) : (
            patients.map((p, idx) => {
              const color = STATUS_COLOR[p.status || "stable"];
              return (
                <View key={idx} style={[styles.patientCard, { backgroundColor: theme.card, borderLeftColor: color }]}>
                  <View style={styles.patientHeaderRow}>
                    <Text style={[styles.patientName, { color: theme.text }]}>
                      {p.bedNumber || "Bed —"} \u00b7 {p.patientName || "Unknown"}{p.age ? ` \u00b7 ${p.age}${p.sex || ""}` : ""}
                    </Text>
                    <View style={[styles.statusChip, { backgroundColor: color }]}>
                      <Text style={styles.statusChipText}>{STATUS_LABEL[p.status || "stable"]}</Text>
                    </View>
                  </View>
                  {p.diagnosis ? <Text style={[styles.diagnosis, { color: theme.textSecondary }]}>{p.diagnosis}</Text> : null}
                  {p.vitals && Object.values(p.vitals).some(Boolean) ? (
                    <Text style={[styles.vitalsLine, { color: theme.textMuted }]}>
                      {[p.vitals.bp && `BP ${p.vitals.bp}`, p.vitals.hr && `HR ${p.vitals.hr}`, p.vitals.spo2 && `SpO\u2082 ${p.vitals.spo2}%`, p.vitals.rr && `RR ${p.vitals.rr}`, p.vitals.temp && `Temp ${p.vitals.temp}`].filter(Boolean).join(" \u00b7 ")}
                    </Text>
                  ) : null}
                  {(p.criticalAlerts || []).length > 0 ? (
                    <View style={styles.sectionBlock}>
                      {p.criticalAlerts!.map((a, i) => (
                        <Text key={i} style={[styles.alertLine, { color: theme.danger }]}>\u26A0 {a}</Text>
                      ))}
                    </View>
                  ) : null}
                  {(p.medications || []).length > 0 ? (
                    <View style={styles.sectionBlock}>
                      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Running</Text>
                      {p.medications!.map((m, i) => (
                        <Text key={i} style={[styles.itemLine, { color: theme.text }]}>\u2022 {m}</Text>
                      ))}
                    </View>
                  ) : null}
                  {(p.pendingTasks || []).length > 0 ? (
                    <View style={styles.sectionBlock}>
                      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Pending</Text>
                      {p.pendingTasks!.map((t, i) => (
                        <Text key={i} style={[styles.itemLine, { color: theme.text }]}>\u2610 {t}</Text>
                      ))}
                    </View>
                  ) : null}
                  {(p.awaitingResults || []).length > 0 ? (
                    <View style={styles.sectionBlock}>
                      <Text style={[styles.sectionLabel, { color: theme.textMuted }]}>Awaiting</Text>
                      {p.awaitingResults!.map((r, i) => (
                        <Text key={i} style={[styles.itemLine, { color: theme.text }]}>\u2022 {r}</Text>
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })
          )}

          <View style={styles.shareRow}>
            <Pressable
              style={({ pressed }) => [styles.shareButton, { backgroundColor: "#25D366", opacity: pressed ? 0.85 : 1 }]}
              onPress={handleShareWhatsapp}
            >
              <Feather name="message-circle" size={18} color="#FFFFFF" />
              <Text style={styles.shareButtonText}>Share via WhatsApp</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [styles.shareButtonOutline, { borderColor: theme.border, opacity: pressed ? 0.85 : 1 }]}
              onPress={handleCopy}
            >
              <Feather name={copied ? "check" : "copy"} size={18} color={theme.text} />
              <Text style={[styles.shareButtonOutlineText, { color: theme.text }]}>{copied ? "Copied" : "Copy text"}</Text>
            </Pressable>
          </View>

          <Pressable style={styles.newHandoverButton} onPress={handleReset}>
            <Feather name="rotate-ccw" size={16} color={theme.primary} />
            <Text style={[styles.newHandoverText, { color: theme.primary }]}>Start a new handover</Text>
          </Pressable>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.xl,
  },
  headerBlock: {
    marginBottom: Spacing.xl,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    alignSelf: "flex-start",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    marginBottom: Spacing.md,
  },
  badgeText: {
    ...Typography.caption,
    fontWeight: "700",
  },
  title: {
    ...Typography.h1,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
  },
  disclaimerBox: {
    flexDirection: "row",
    gap: Spacing.sm,
    padding: Spacing.md,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    marginBottom: Spacing.lg,
    alignItems: "flex-start",
  },
  disclaimerText: {
    ...Typography.caption,
    flex: 1,
    lineHeight: 18,
  },
  pasteBox: {
    borderWidth: 1,
    borderRadius: BorderRadius.lg,
    minHeight: 220,
    marginBottom: Spacing.lg,
    padding: Spacing.md,
  },
  pasteInput: {
    ...Typography.body,
    minHeight: 200,
  },
  errorText: {
    ...Typography.small,
    marginBottom: Spacing.md,
  },
  primaryButton: {
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    ...Typography.bodyMedium,
    fontWeight: "700",
  },
  loadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  backLink: {
    alignItems: "center",
    paddingVertical: Spacing.md,
  },
  backLinkText: {
    ...Typography.small,
  },
  patientCard: {
    borderRadius: BorderRadius.lg,
    borderLeftWidth: 4,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  patientHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: Spacing.xs,
  },
  patientName: {
    ...Typography.h4,
    flex: 1,
    marginRight: Spacing.sm,
  },
  statusChip: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
  },
  statusChipText: {
    color: "#FFFFFF",
    ...Typography.caption,
    fontWeight: "800",
  },
  diagnosis: {
    ...Typography.bodyMedium,
    marginBottom: Spacing.xs,
  },
  vitalsLine: {
    ...Typography.small,
    marginBottom: Spacing.sm,
  },
  sectionBlock: {
    marginTop: Spacing.sm,
  },
  sectionLabel: {
    ...Typography.caption,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: Spacing.xs,
  },
  itemLine: {
    ...Typography.small,
    marginBottom: 2,
  },
  alertLine: {
    ...Typography.small,
    fontWeight: "700",
    marginBottom: 2,
  },
  shareRow: {
    flexDirection: "row",
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  shareButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.lg,
  },
  shareButtonText: {
    color: "#FFFFFF",
    ...Typography.bodyMedium,
    fontWeight: "700",
  },
  shareButtonOutline: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    height: Spacing.buttonHeight,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
  },
  shareButtonOutlineText: {
    ...Typography.bodyMedium,
    fontWeight: "700",
  },
  newHandoverButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  newHandoverText: {
    ...Typography.small,
    fontWeight: "700",
  },
});
