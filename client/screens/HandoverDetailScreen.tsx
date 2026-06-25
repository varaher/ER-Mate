import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useDepartment } from "@/context/DepartmentContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function HandoverDetailScreen() {
  const { theme } = useTheme();
  const { token } = useAuth();
  const { department, refresh: refreshDept } = useDepartment();
  const navigation = useNavigation<Nav>();
  const headerHeight = useHeaderHeight();

  const [incoming, setIncoming] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [takingOver, setTakingOver] = useState<number | null>(null);

  useFocusEffect(useCallback(() => { loadIncoming(); }, [department?.id]));

  const loadIncoming = async (silent = false) => {
    if (!department || !token) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/handover/incoming/${department.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setIncoming(data.incoming || []);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  const handleTakeOver = async (overlay: any) => {
    if (!token) return;
    setTakingOver(overlay.id);
    try {
      const res = await fetch(`${getApiUrl()}/api/handover/${overlay.id}/receive`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        Alert.alert("Case Taken Over", "This case has been added to your active queue.", [
          { text: "OK", onPress: () => loadIncoming(true) },
        ]);
        refreshDept();
      } else {
        Alert.alert("Error", "Could not take over this case.");
      }
    } catch {
      Alert.alert("Error", "Network error. Please try again.");
    }
    setTakingOver(null);
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return `${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundDefault }}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: 80 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadIncoming(); }} />}
    >
      <View style={styles.titleRow}>
        <Text style={[styles.title, { color: theme.text }]}>Incoming Handovers</Text>
        <View style={[styles.countBadge, { backgroundColor: incoming.length > 0 ? theme.dangerLight : theme.backgroundSecondary }]}>
          <Text style={[styles.countText, { color: incoming.length > 0 ? theme.danger : theme.textMuted }]}>{incoming.length}</Text>
        </View>
      </View>
      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        Cases handed over to your shift. Tap Take Over to accept responsibility.
      </Text>

      {loading ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 40 }} />
      ) : incoming.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: theme.card }]}>
          <Feather name="check-circle" size={36} color={theme.success || "#10b981"} />
          <Text style={[styles.emptyTitle, { color: theme.text }]}>All Clear</Text>
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No incoming handovers waiting for your shift.</Text>
        </View>
      ) : (
        incoming.map((overlay) => (
          <View key={overlay.id} style={[styles.handoverCard, { backgroundColor: theme.card, borderLeftColor: theme.warning || "#f59e0b" }]}>
            <View style={styles.cardHeader}>
              <View style={[styles.urgentBadge, { backgroundColor: "#fef3c7" }]}>
                <Feather name="alert-circle" size={12} color="#d97706" />
                <Text style={styles.urgentText}>HANDOVER</Text>
              </View>
              <Text style={[styles.handoverTime, { color: theme.textMuted }]}>
                {overlay.handedOverAt ? `Handed over at ${formatTime(overlay.handedOverAt)}` : ""}
              </Text>
            </View>

            <Text style={[styles.caseId, { color: theme.text }]}>Case ID: {overlay.caseId}</Text>

            {overlay.bedNumber ? (
              <View style={styles.infoRow}>
                <Feather name="map-pin" size={14} color={theme.textMuted} />
                <Text style={[styles.infoText, { color: theme.textSecondary }]}>Bed {overlay.bedNumber}</Text>
              </View>
            ) : null}

            {overlay.pendingNotes ? (
              <View style={[styles.notesBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                <Text style={[styles.notesLabel, { color: theme.textSecondary }]}>Pending Notes</Text>
                <Text style={[styles.notesText, { color: theme.text }]}>{overlay.pendingNotes}</Text>
              </View>
            ) : null}

            <Pressable
              style={({ pressed }) => [
                styles.takeOverBtn,
                { backgroundColor: theme.primary, opacity: pressed || takingOver === overlay.id ? 0.8 : 1 },
              ]}
              onPress={() => handleTakeOver(overlay)}
              disabled={takingOver !== null}
            >
              {takingOver === overlay.id ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Feather name="check" size={16} color="#fff" />
                  <Text style={styles.takeOverText}>Take Over Case</Text>
                </>
              )}
            </Pressable>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  title: { fontSize: 24, fontWeight: "800" },
  countBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  countText: { fontSize: 14, fontWeight: "800" },
  subtitle: { fontSize: 14, marginBottom: Spacing.lg, lineHeight: 20 },
  emptyCard: { borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 18, fontWeight: "700" },
  emptyText: { fontSize: 14, textAlign: "center" },
  handoverCard: { borderRadius: BorderRadius.lg, borderLeftWidth: 4, padding: Spacing.md, marginBottom: Spacing.md },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: Spacing.sm },
  urgentBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  urgentText: { fontSize: 10, fontWeight: "800", color: "#d97706" },
  handoverTime: { fontSize: 12 },
  caseId: { fontSize: 16, fontWeight: "700", marginBottom: Spacing.sm },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: Spacing.sm },
  infoText: { fontSize: 14 },
  notesBox: { borderRadius: BorderRadius.sm, borderWidth: 1, padding: Spacing.sm, marginBottom: Spacing.md },
  notesLabel: { fontSize: 12, fontWeight: "700", marginBottom: 4 },
  notesText: { fontSize: 14, lineHeight: 20 },
  takeOverBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: BorderRadius.md },
  takeOverText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});
