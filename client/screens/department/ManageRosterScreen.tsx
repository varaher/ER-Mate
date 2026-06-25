import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useDepartment } from "@/context/DepartmentContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";

const ROLES = ["consultant", "resident"] as const;
type Role = typeof ROLES[number];
const ROLE_LABELS: Record<Role, string> = { consultant: "Consultant", resident: "Resident" };

const STATUS_COLORS: Record<string, string> = { active: "#10b981", pending: "#f59e0b", inactive: "#9ca3af" };
const STATUS_LABELS: Record<string, string> = { active: "Active", pending: "Invited", inactive: "Removed" };

export default function ManageRosterScreen() {
  const { theme } = useTheme();
  const { user, token } = useAuth();
  const { department, refresh: refreshDept } = useDepartment();
  const headerHeight = useHeaderHeight();

  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("resident");
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState<string | null>(null);

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
        setInvites(data.invites || []);
      }
    } catch {}
    setLoading(false);
    setRefreshing(false);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) { Alert.alert("Required", "Enter an email address."); return; }
    if (!department || !token) return;
    setInviting(true);
    setInviteLink(null);
    try {
      const res = await fetch(`${getApiUrl()}/api/department/${department.id}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: inviteEmail.trim().toLowerCase(), role: inviteRole, inviterName: user?.name }),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert("Error", data.error || "Could not send invite"); return; }
      setInviteLink(data.inviteLink);
      setInviteEmail("");
      loadRoster(true);
    } catch {
      Alert.alert("Error", "Network error");
    }
    setInviting(false);
  };

  const handleRemove = (member: any) => {
    if (!department || !token) return;
    Alert.alert("Remove Member", `Remove ${member.userId} from the department?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove", style: "destructive", onPress: async () => {
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

  const activeMembers = members.filter((m) => m.status === "active");
  const pendingMembers = members.filter((m) => m.status === "pending");

  const MemberRow = ({ member, isPending }: { member: any; isPending?: boolean }) => (
    <View style={[styles.memberRow, { borderBottomColor: theme.border }]}>
      <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
        <Text style={[styles.avatarText, { color: theme.primary }]}>{(member.userId || "?").charAt(0).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.memberName, { color: theme.text }]} numberOfLines={1}>{member.userId}</Text>
        <Text style={[styles.memberRole, { color: theme.textSecondary }]}>{member.role}</Text>
      </View>
      <View style={[styles.statusBadge, { backgroundColor: (STATUS_COLORS[member.status] || "#9ca3af") + "20" }]}>
        <Text style={[styles.statusText, { color: STATUS_COLORS[member.status] || "#9ca3af" }]}>
          {STATUS_LABELS[member.status] || member.status}
        </Text>
      </View>
      {member.role !== "hod" ? (
        <Pressable style={styles.removeBtn} onPress={() => handleRemove(member)}>
          <Feather name="trash-2" size={16} color={theme.danger} />
        </Pressable>
      ) : null}
    </View>
  );

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
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>INVITE NEW MEMBER</Text>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <TextInput
          style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
          value={inviteEmail}
          onChangeText={setInviteEmail}
          placeholder="doctor@hospital.com"
          placeholderTextColor={theme.textMuted}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <View style={styles.roleRow}>
          {ROLES.map((r) => (
            <Pressable
              key={r}
              style={[styles.roleChip, { borderColor: inviteRole === r ? theme.primary : theme.border, backgroundColor: inviteRole === r ? theme.primaryLight : "transparent" }]}
              onPress={() => setInviteRole(r)}
            >
              <Text style={[styles.roleChipText, { color: inviteRole === r ? theme.primary : theme.textSecondary }]}>{ROLE_LABELS[r]}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable
          style={({ pressed }) => [styles.inviteBtn, { backgroundColor: theme.primary, opacity: pressed || inviting ? 0.8 : 1 }]}
          onPress={handleInvite}
          disabled={inviting}
        >
          {inviting ? <ActivityIndicator color="#fff" size="small" /> : (
            <>
              <Feather name="user-plus" size={16} color="#fff" />
              <Text style={styles.inviteBtnText}>Send Invite</Text>
            </>
          )}
        </Pressable>
        {inviteLink ? (
          <View style={[styles.linkBox, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
            <Feather name="link" size={14} color={theme.textSecondary} />
            <Text style={[styles.linkText, { color: theme.textSecondary }]} numberOfLines={2}>{inviteLink}</Text>
            <Text style={[styles.linkNote, { color: theme.textMuted }]}>Share this link if email was not delivered.</Text>
          </View>
        ) : null}
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 20 }} color={theme.primary} /> : (
        <>
          {activeMembers.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.lg }]}>ACTIVE MEMBERS ({activeMembers.length})</Text>
              <View style={[styles.card, { backgroundColor: theme.card }]}>
                {activeMembers.map((m) => <MemberRow key={m.id} member={m} />)}
              </View>
            </>
          ) : null}
          {pendingMembers.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.lg }]}>PENDING INVITES ({pendingMembers.length})</Text>
              <View style={[styles.card, { backgroundColor: theme.card }]}>
                {pendingMembers.map((m) => <MemberRow key={m.id} member={m} isPending />)}
              </View>
            </>
          ) : null}
          {invites.length > 0 ? (
            <>
              <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.lg }]}>EMAIL INVITES SENT</Text>
              <View style={[styles.card, { backgroundColor: theme.card }]}>
                {invites.map((inv) => (
                  <View key={inv.id} style={[styles.memberRow, { borderBottomColor: theme.border }]}>
                    <Feather name="mail" size={18} color={theme.textMuted} />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={[styles.memberName, { color: theme.text }]}>{inv.email}</Text>
                      <Text style={[styles.memberRole, { color: theme.textSecondary }]}>{inv.role} · Expires {new Date(inv.expiresAt).toLocaleDateString()}</Text>
                    </View>
                    {inv.acceptedAt ? (
                      <Feather name="check-circle" size={16} color="#10b981" />
                    ) : (
                      <View style={[styles.statusBadge, { backgroundColor: "#fef3c7" }]}>
                        <Text style={[styles.statusText, { color: "#d97706" }]}>Pending</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </>
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: Spacing.sm },
  card: { borderRadius: BorderRadius.lg, overflow: "hidden", marginBottom: Spacing.sm },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, margin: Spacing.md, marginBottom: 0 },
  roleRow: { flexDirection: "row", gap: Spacing.sm, padding: Spacing.md, paddingTop: Spacing.sm },
  roleChip: { flex: 1, paddingVertical: 8, borderRadius: BorderRadius.md, borderWidth: 1, alignItems: "center" },
  roleChipText: { fontSize: 14, fontWeight: "600" },
  inviteBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginHorizontal: Spacing.md, marginBottom: Spacing.md, paddingVertical: 12, borderRadius: BorderRadius.md },
  inviteBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  linkBox: { margin: Spacing.md, marginTop: 0, padding: Spacing.sm, borderRadius: BorderRadius.sm, borderWidth: 1, gap: 4 },
  linkText: { fontSize: 12 },
  linkNote: { fontSize: 12, fontStyle: "italic" },
  memberRow: { flexDirection: "row", alignItems: "center", paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, borderBottomWidth: 1, gap: 10 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 14, fontWeight: "700" },
  memberName: { fontSize: 14, fontWeight: "600" },
  memberRole: { fontSize: 12, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 12, fontWeight: "700" },
  removeBtn: { padding: 6 },
});
