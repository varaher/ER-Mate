import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useNavigation, useRoute, useFocusEffect } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import type { NativeStackNavigationProp, NativeStackScreenProps } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useDepartment } from "@/context/DepartmentContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = NativeStackScreenProps<RootStackParamList, "Escalation">["route"];

export default function EscalationScreen() {
  const { theme } = useTheme();
  const { token } = useAuth();
  const { department, membership } = useDepartment();
  const navigation = useNavigation<Nav>();
  const route = useRoute<RouteProps>();
  const headerHeight = useHeaderHeight();

  const caseId = (route.params as any)?.caseId;
  const isConsultant = membership?.role === "consultant" || membership?.role === "hod";

  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [escalations, setEscalations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewNote, setReviewNote] = useState<Record<number, string>>({});
  const [reviewing, setReviewing] = useState<number | null>(null);

  useFocusEffect(useCallback(() => { loadEscalations(); }, [department?.id]));

  const loadEscalations = async () => {
    if (!department || !token) { setLoading(false); return; }
    try {
      const res = await fetch(`${getApiUrl()}/api/escalations/department/${department.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEscalations(data.escalations || []);
      }
    } catch {}
    setLoading(false);
  };

  const handleEscalate = async () => {
    if (!department || !token || !caseId) { Alert.alert("Error", "No case selected."); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/escalations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ caseId, departmentId: department.id, reason: reason.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert("Error", data.error || "Could not escalate"); return; }
      Alert.alert("Escalated", "All on-duty consultants have been notified.", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch {
      Alert.alert("Error", "Network error");
    }
    setSubmitting(false);
  };

  const handleReview = async (esc: any) => {
    if (!token) return;
    const note = reviewNote[esc.id] || "";
    setReviewing(esc.id);
    try {
      const res = await fetch(`${getApiUrl()}/api/escalations/${esc.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ reviewNote: note }),
      });
      if (res.ok) {
        Alert.alert("Reviewed", "The resident has been notified.");
        loadEscalations();
      } else {
        Alert.alert("Error", "Could not mark as reviewed");
      }
    } catch {}
    setReviewing(null);
  };

  const formatTime = (ts: string) => new Date(ts).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundDefault }}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: 80 }}
    >
      {caseId && !isConsultant ? (
        <>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ESCALATE CASE</Text>
          <View style={[styles.card, { backgroundColor: theme.card }]}>
            <Text style={[styles.caseLabel, { color: theme.textSecondary }]}>Case ID</Text>
            <Text style={[styles.caseId, { color: theme.text }]}>{caseId}</Text>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Reason for escalation (optional)</Text>
            <TextInput
              style={[styles.textarea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
              value={reason}
              onChangeText={setReason}
              placeholder="Describe why you need consultant input..."
              placeholderTextColor={theme.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <Pressable
              style={({ pressed }) => [styles.escalateBtn, { backgroundColor: "#ef4444", opacity: pressed || submitting ? 0.8 : 1 }]}
              onPress={handleEscalate}
              disabled={submitting}
            >
              {submitting ? <ActivityIndicator size="small" color="#fff" /> : (
                <>
                  <Feather name="alert-triangle" size={16} color="#fff" />
                  <Text style={styles.escalateBtnText}>Escalate to Consultant</Text>
                </>
              )}
            </Pressable>
          </View>
        </>
      ) : null}

      <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.lg }]}>
        {isConsultant ? "PENDING ESCALATIONS" : "MY ESCALATIONS"}
      </Text>
      {loading ? <ActivityIndicator color={theme.primary} /> : escalations.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
          <Feather name="check-circle" size={28} color="#10b981" />
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No escalations yet</Text>
        </View>
      ) : (
        escalations.map((esc) => (
          <View key={esc.id} style={[styles.escCard, { backgroundColor: theme.card, borderLeftColor: esc.status === "pending" ? "#ef4444" : "#10b981" }]}>
            <View style={styles.escHeader}>
              <View style={[styles.statusBadge, { backgroundColor: esc.status === "pending" ? "#fee2e2" : "#d1fae5" }]}>
                <Text style={[styles.statusText, { color: esc.status === "pending" ? "#dc2626" : "#065f46" }]}>
                  {esc.status === "pending" ? "PENDING REVIEW" : "REVIEWED"}
                </Text>
              </View>
              <Text style={[styles.escTime, { color: theme.textMuted }]}>{formatTime(esc.escalatedAt)}</Text>
            </View>
            <Text style={[styles.escCaseId, { color: theme.text }]}>Case: {esc.caseId}</Text>
            {esc.reason ? <Text style={[styles.escReason, { color: theme.textSecondary }]}>{esc.reason}</Text> : null}
            {esc.reviewNote ? (
              <View style={[styles.reviewBox, { backgroundColor: theme.backgroundSecondary }]}>
                <Text style={[styles.reviewLabel, { color: theme.textSecondary }]}>Consultant Note</Text>
                <Text style={[styles.reviewNote, { color: theme.text }]}>{esc.reviewNote}</Text>
              </View>
            ) : null}
            {isConsultant && esc.status === "pending" ? (
              <>
                <TextInput
                  style={[styles.reviewInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
                  value={reviewNote[esc.id] || ""}
                  onChangeText={(v) => setReviewNote((prev) => ({ ...prev, [esc.id]: v }))}
                  placeholder="Add review note (optional)..."
                  placeholderTextColor={theme.textMuted}
                />
                <Pressable
                  style={({ pressed }) => [styles.reviewBtn, { backgroundColor: theme.primary, opacity: pressed ? 0.8 : 1 }]}
                  onPress={() => handleReview(esc)}
                  disabled={reviewing === esc.id}
                >
                  {reviewing === esc.id ? <ActivityIndicator size="small" color="#fff" /> : (
                    <>
                      <Feather name="check" size={14} color="#fff" />
                      <Text style={styles.reviewBtnText}>Mark Reviewed</Text>
                    </>
                  )}
                </Pressable>
              </>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: Spacing.sm },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  caseLabel: { fontSize: 12, fontWeight: "600", marginBottom: 2 },
  caseId: { fontSize: 16, fontWeight: "700", marginBottom: Spacing.md },
  label: { fontSize: 14, marginBottom: 6 },
  textarea: { borderWidth: 1, borderRadius: BorderRadius.md, padding: 12, fontSize: 14, minHeight: 100, marginBottom: Spacing.md },
  escalateBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: BorderRadius.md },
  escalateBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  emptyCard: { borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: "center", gap: 8 },
  emptyText: { fontSize: 14 },
  escCard: { borderRadius: BorderRadius.md, borderLeftWidth: 4, padding: Spacing.md, marginBottom: Spacing.sm },
  escHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: "800" },
  escTime: { fontSize: 12 },
  escCaseId: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  escReason: { fontSize: 14, marginBottom: Spacing.sm },
  reviewBox: { borderRadius: BorderRadius.sm, padding: Spacing.sm, marginBottom: Spacing.sm },
  reviewLabel: { fontSize: 12, fontWeight: "600", marginBottom: 2 },
  reviewNote: { fontSize: 14 },
  reviewInput: { borderWidth: 1, borderRadius: BorderRadius.sm, padding: 10, fontSize: 14, marginBottom: Spacing.sm },
  reviewBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: BorderRadius.md },
  reviewBtnText: { color: "#fff", fontWeight: "600", fontSize: 14 },
});
