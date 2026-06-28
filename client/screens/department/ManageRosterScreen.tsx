import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Linking,
  Share,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "@react-navigation/native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useDepartment } from "@/context/DepartmentContext";
import { Spacing, BorderRadius } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const STATUS_COLORS: Record<string, string> = { active: "#10b981", pending: "#f59e0b", inactive: "#9ca3af" };
const STATUS_LABELS: Record<string, string> = { active: "Active", pending: "Pending", inactive: "Removed" };
const ROLE_DISPLAY: Record<string, string> = { hod: "HOD", consultant: "Consultant", resident: "Resident" };

export default function ManageRosterScreen() {
  const { theme } = useTheme();
  const { user, token } = useAuth();
  const { department, refresh: refreshDept } = useDepartment();
  const navigation = useNavigation<Nav>();
  const headerHeight = useHeaderHeight();

  const [members, setMembers] = useState<any[]>([]);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [decliningId, setDecliningId] = useState<number | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  const isHOD = members.find((m) => m.userId === (user as any)?.id || m.email === (user as any)?.email)?.role === "hod"
    || department?.hodUserId === (user as any)?.id;

  useFocusEffect(useCallback(() => { loadRoster(); }, [department?.id]));

  const loadRoster = async (silent = false) => {
    if (!department || !token) { setLoading(false); return; }
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/department/${department.id}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members || []);
        setInviteLink(data.inviteLink || null);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  const handleCopy = async () => {
    if (!inviteLink) return;
    await Clipboard.setStringAsync(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    if (!inviteLink) return;
    const msg = `Join our ER team on ErMate!\n\nTap the link below, sign in with Google, and fill in your name and role. I'll approve you from my end.\n\n${inviteLink}`;
    const url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) Linking.openURL(url);
      else Share.share({ message: msg, title: "Join ErMate Team" });
    });
  };

  const handleShare = () => {
    if (!inviteLink) return;
    const msg = `Join our ER team on ErMate!\n\nTap the link below, sign in with Google, and fill in your name and role. I'll approve you from my end.\n\n${inviteLink}`;
    Share.share({ message: msg, title: "Join ErMate Team" });
  };

  const handleRegenerate = () => {
    Alert.alert(
      "Generate New Link",
      "The old link will stop working. Any pending doctors who haven't joined yet will need the new link.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Generate", onPress: async () => {
            if (!department || !token) return;
            setRegenerating(true);
            try {
              const res = await fetch(`${getApiUrl()}/api/department/${department.id}/regenerate-invite`, {
                method: "POST",
                headers: { Authorization: `Bearer ${token}` },
              });
              const data = await res.json();
              if (res.ok) { setInviteLink(data.inviteLink); }
              else Alert.alert("Error", data.error || "Failed to regenerate link");
            } catch { Alert.alert("Error", "Network error"); }
            setRegenerating(false);
          },
        },
      ]
    );
  };

  const handleApprove = async (member: any) => {
    if (!token) return;
    setApprovingId(member.id);
    try {
      const res = await fetch(`${getApiUrl()}/api/department/members/${member.id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        loadRoster(true);
        refreshDept();
      } else {
        Alert.alert("Error", data.error || "Failed to approve");
      }
    } catch { Alert.alert("Error", "Network error"); }
    setApprovingId(null);
  };

  const handleDecline = (member: any) => {
    Alert.alert("Decline Request", `Decline ${member.name || "this doctor"}'s request?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Decline", style: "destructive", onPress: async () => {
          if (!token) return;
          setDecliningId(member.id);
          try {
            const res = await fetch(`${getApiUrl()}/api/department/members/${member.id}/decline`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) { loadRoster(true); }
            else { const d = await res.json(); Alert.alert("Error", d.error || "Failed to decline"); }
          } catch { Alert.alert("Error", "Network error"); }
          setDecliningId(null);
        },
      },
    ]);
  };

  const handleRemove = (member: any) => {
    Alert.alert("Remove Member", `Remove ${member.name || member.userId} from the department?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
          if (!department || !token) return;
          await fetch(`${getApiUrl()}/api/department/${department.id}/members/${member.userId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          });
          loadRoster(true);
          refreshDept();
        },
      },
    ]);
  };

  const activeMembers = members.filter((m) => m.status === "active" && m.role !== "hod");
  const hodMember = members.find((m) => m.role === "hod");
  const pendingMembers = members.filter((m) => m.status === "pending");

  const MemberRow = ({ member }: { member: any }) => {
    const displayName = member.name || member.email || member.userId || "Unknown";
    const initials = displayName.charAt(0).toUpperCase();
    return (
      <View style={[styles.memberRow, { borderBottomColor: theme.border }]}>
        <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
          <Text style={[styles.avatarText, { color: theme.primary }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
          <Text style={[styles.memberRole, { color: theme.textSecondary }]}>
            {ROLE_DISPLAY[member.role] || member.role}{member.email ? ` · ${member.email}` : ""}
          </Text>
        </View>
        {member.role !== "hod" ? (
          <Pressable style={styles.removeBtn} onPress={() => handleRemove(member)}>
            <Feather name="trash-2" size={16} color={theme.danger} />
          </Pressable>
        ) : null}
      </View>
    );
  };

  const PendingRow = ({ member }: { member: any }) => {
    const displayName = member.name || member.email || "Unknown";
    const initials = displayName.charAt(0).toUpperCase();
    const isApproving = approvingId === member.id;
    const isDeclining = decliningId === member.id;
    return (
      <View style={[styles.pendingRow, { borderBottomColor: theme.border }]}>
        <View style={[styles.avatar, { backgroundColor: "#f59e0b20" }]}>
          <Text style={[styles.avatarText, { color: "#f59e0b" }]}>{initials}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>{displayName}</Text>
          <Text style={[styles.memberRole, { color: theme.textSecondary }]}>
            {ROLE_DISPLAY[member.role] || member.role}{member.email ? ` · ${member.email}` : ""}
          </Text>
        </View>
        <View style={styles.approvalBtns}>
          <Pressable
            style={({ pressed }) => [styles.declineBtn, { borderColor: theme.danger, opacity: pressed || isDeclining || isApproving ? 0.7 : 1 }]}
            onPress={() => handleDecline(member)}
            disabled={isApproving || isDeclining}
          >
            {isDeclining ? <ActivityIndicator size="small" color={theme.danger} /> : <Feather name="x" size={16} color={theme.danger} />}
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.approveBtn, { backgroundColor: theme.primary, opacity: pressed || isApproving || isDeclining ? 0.7 : 1 }]}
            onPress={() => handleApprove(member)}
            disabled={isApproving || isDeclining}
          >
            {isApproving ? <ActivityIndicator size="small" color="#fff" /> : (
              <>
                <Feather name="check" size={14} color="#fff" />
                <Text style={styles.approveBtnText}>Approve</Text>
              </>
            )}
          </Pressable>
        </View>
      </View>
    );
  };

  if (!department) {
    return (
      <View style={[styles.center, { backgroundColor: theme.backgroundDefault }]}>
        <Text style={{ color: theme.textSecondary }}>No department found.</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundDefault }}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: 60 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadRoster(); }} />}
    >
      {/* Invite Link Card — HOD only */}
      {inviteLink ? (
        <>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>TEAM INVITE LINK</Text>
          <View style={[styles.linkCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Text style={[styles.linkText, { color: theme.text }]} numberOfLines={2} selectable>{inviteLink}</Text>
            <View style={styles.linkActions}>
              <Pressable
                style={({ pressed }) => [styles.linkBtn, { backgroundColor: copied ? theme.primary : theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 }]}
                onPress={handleCopy}
              >
                <Feather name={copied ? "check" : "copy"} size={14} color={copied ? "#fff" : theme.text} />
                <Text style={[styles.linkBtnText, { color: copied ? "#fff" : theme.text }]}>{copied ? "Copied!" : "Copy"}</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.linkBtn, { backgroundColor: "#25D366", opacity: pressed ? 0.8 : 1 }]}
                onPress={handleWhatsApp}
              >
                <Text style={[styles.linkBtnText, { color: "#fff" }]}>WhatsApp</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.linkBtn, { backgroundColor: theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 }]}
                onPress={handleShare}
              >
                <Feather name="share-2" size={14} color={theme.text} />
              </Pressable>
            </View>
            <Pressable onPress={handleRegenerate} disabled={regenerating} style={styles.regenRow}>
              {regenerating ? <ActivityIndicator size="small" color={theme.textMuted} /> : <Feather name="refresh-cw" size={12} color={theme.textMuted} />}
              <Text style={[styles.regenText, { color: theme.textMuted }]}>Regenerate link (invalidates old one)</Text>
            </Pressable>
          </View>
        </>
      ) : null}

      {/* Pending join requests */}
      {loading ? <ActivityIndicator style={{ marginTop: 20 }} color={theme.primary} /> : (
        <>
          {pendingMembers.length > 0 ? (
            <>
              <View style={styles.pendingHeader}>
                <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginBottom: 0 }]}>
                  PENDING REQUESTS ({pendingMembers.length})
                </Text>
                <View style={[styles.pendingBadge, { backgroundColor: "#f59e0b20" }]}>
                  <Feather name="clock" size={12} color="#f59e0b" />
                  <Text style={[styles.pendingBadgeText, { color: "#f59e0b" }]}>Awaiting approval</Text>
                </View>
              </View>
              <View style={[styles.card, { backgroundColor: theme.card, marginBottom: Spacing.lg }]}>
                {pendingMembers.map((m, i) => (
                  <View key={m.id}>
                    <PendingRow member={m} />
                  </View>
                ))}
              </View>
            </>
          ) : null}

          {/* Active members */}
          {hodMember ? (
            <>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
                ACTIVE MEMBERS ({activeMembers.length + 1})
              </Text>
              <View style={[styles.card, { backgroundColor: theme.card }]}>
                <MemberRow member={hodMember} />
                {activeMembers.map((m) => <MemberRow key={m.id} member={m} />)}
              </View>
            </>
          ) : activeMembers.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>ACTIVE MEMBERS ({activeMembers.length})</Text>
              <View style={[styles.card, { backgroundColor: theme.card }]}>
                {activeMembers.map((m) => <MemberRow key={m.id} member={m} />)}
              </View>
            </>
          ) : null}

          {/* Empty state */}
          {activeMembers.length === 0 && pendingMembers.length === 0 ? (
            <View style={[styles.emptyBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
              <Feather name="users" size={32} color={theme.textMuted} />
              <Text style={[styles.emptyTitle, { color: theme.text }]}>No team members yet</Text>
              <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                Share the invite link above with your team on WhatsApp. They click it, sign in with Google, and request to join.
              </Text>
            </View>
          ) : null}

          {/* Subscription CTA */}
          {activeMembers.length >= 2 && !(department as any).billingActive ? (
            <Pressable
              style={({ pressed }) => [styles.subscriptionCta, { backgroundColor: theme.primaryLight, borderColor: theme.primary + "40", opacity: pressed ? 0.85 : 1 }]}
              onPress={() => navigation.navigate("MySubscriptions")}
            >
              <Feather name="zap" size={20} color={theme.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.ctaTitle, { color: theme.primary }]}>Activate Team Plan</Text>
                <Text style={[styles.ctaText, { color: theme.textSecondary }]}>
                  You have {activeMembers.length + 1} active members. Unlock all team features.
                </Text>
              </View>
              <Feather name="chevron-right" size={18} color={theme.primary} />
            </Pressable>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: Spacing.sm },
  card: { borderRadius: BorderRadius.lg, overflow: "hidden", marginBottom: Spacing.lg },
  linkCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.lg, gap: 10 },
  linkText: { fontSize: 12, fontFamily: "monospace", lineHeight: 18 },
  linkActions: { flexDirection: "row", gap: 8 },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: BorderRadius.sm },
  linkBtnText: { fontSize: 13, fontWeight: "600" },
  regenRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 4 },
  regenText: { fontSize: 12 },
  pendingHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: Spacing.sm },
  pendingBadge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20 },
  pendingBadgeText: { fontSize: 11, fontWeight: "700" },
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderBottomWidth: 1, gap: 10 },
  pendingRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderBottomWidth: 1, gap: 10 },
  avatar: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 15, fontWeight: "700" },
  memberName: { fontSize: 14, fontWeight: "600" },
  memberRole: { fontSize: 12, marginTop: 2 },
  removeBtn: { padding: 8 },
  approvalBtns: { flexDirection: "row", alignItems: "center", gap: 8 },
  declineBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  approveBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20 },
  approveBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  emptyBox: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.xl, alignItems: "center", gap: Spacing.sm, marginTop: Spacing.lg },
  emptyTitle: { fontSize: 16, fontWeight: "700", marginTop: 4 },
  emptyText: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  subscriptionCta: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginTop: Spacing.sm },
  ctaTitle: { fontSize: 15, fontWeight: "700", marginBottom: 2 },
  ctaText: { fontSize: 13, lineHeight: 18 },
});
