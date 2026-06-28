import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Share,
  Platform,
  Linking,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useHeaderHeight } from "@react-navigation/elements";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { useDepartment } from "@/context/DepartmentContext";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import { getApiUrl } from "@/lib/query-client";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type Nav = NativeStackNavigationProp<RootStackParamList>;

export default function SetupDepartmentScreen() {
  const { theme } = useTheme();
  const { token, user } = useAuth();
  const { refresh } = useDepartment();
  const navigation = useNavigation<Nav>();
  const headerHeight = useHeaderHeight();

  const [deptName, setDeptName] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [morningStart, setMorningStart] = useState("06:00");
  const [morningEnd, setMorningEnd] = useState("14:00");
  const [eveningStart, setEveningStart] = useState("14:00");
  const [eveningEnd, setEveningEnd] = useState("22:00");
  const [nightStart, setNightStart] = useState("22:00");
  const [nightEnd, setNightEnd] = useState("06:00");
  const [loading, setLoading] = useState(false);
  const [created, setCreated] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [createdDeptName, setCreatedDeptName] = useState("");
  const [copied, setCopied] = useState(false);
  const [deptId, setDeptId] = useState<number | null>(null);

  const handleCreate = async () => {
    if (!deptName.trim()) {
      Alert.alert("Required", "Please enter a department name.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/department/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: deptName.trim(),
          hospitalName: hospitalName.trim(),
          morningStart, morningEnd,
          eveningStart, eveningEnd,
          nightStart, nightEnd,
          hodName: user?.name || "",
          hodEmail: (user as any)?.email || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) { Alert.alert("Error", data.error || "Failed to create department"); return; }
      await refresh();
      setCreatedDeptName(deptName.trim());
      setInviteLink(data.inviteLink || "");
      setDeptId(data.department?.id || null);
      setCreated(true);
    } catch {
      Alert.alert("Error", "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleWhatsApp = () => {
    const msg = `Join our ER team on ErMate!\n\nTap the link below, sign in with Google, and fill in your name and role. I'll approve you from my end.\n\n${inviteLink}`;
    const url = `whatsapp://send?text=${encodeURIComponent(msg)}`;
    Linking.canOpenURL(url).then((supported) => {
      if (supported) {
        Linking.openURL(url);
      } else {
        Share.share({ message: msg, title: "Join ErMate Team" });
      }
    });
  };

  const handleShare = () => {
    const msg = `Join our ER team on ErMate!\n\nTap the link below, sign in with Google, and fill in your name and role. I'll approve you from my end.\n\n${inviteLink}`;
    Share.share({ message: msg, title: "Join ErMate Team" });
  };

  const TimeField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => (
    <View style={styles.timeField}>
      <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>{label}</Text>
      <TextInput
        style={[styles.timeInput, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
        value={value}
        onChangeText={onChange}
        placeholder="HH:MM"
        placeholderTextColor={theme.textMuted}
        maxLength={5}
      />
    </View>
  );

  // ── Success / Invite Link view ──────────────────────────────
  if (created) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: theme.backgroundDefault }}
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: 60 }}
      >
        <View style={[styles.successBadge, { backgroundColor: theme.primaryLight, borderColor: theme.primary + "30" }]}>
          <Feather name="check-circle" size={32} color={theme.primary} />
          <Text style={[styles.successTitle, { color: theme.primary }]}>{createdDeptName} created!</Text>
          <Text style={[styles.successSub, { color: theme.textSecondary }]}>
            Share this link with your team. They click it, sign in with Google, and request to join. You approve each one.
          </Text>
        </View>

        <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.lg }]}>TEAM INVITE LINK</Text>
        <View style={[styles.linkCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.linkText, { color: theme.text }]} numberOfLines={2} selectable>{inviteLink}</Text>
          <Pressable
            style={({ pressed }) => [styles.copyBtn, { backgroundColor: copied ? theme.primary : theme.backgroundSecondary, opacity: pressed ? 0.8 : 1 }]}
            onPress={handleCopy}
          >
            <Feather name={copied ? "check" : "copy"} size={16} color={copied ? "#fff" : theme.text} />
            <Text style={[styles.copyBtnText, { color: copied ? "#fff" : theme.text }]}>{copied ? "Copied!" : "Copy"}</Text>
          </Pressable>
        </View>

        <View style={styles.shareRow}>
          <Pressable
            style={({ pressed }) => [styles.shareBtn, { backgroundColor: "#25D366", opacity: pressed ? 0.85 : 1 }]}
            onPress={handleWhatsApp}
          >
            <Text style={styles.shareBtnText}>Share on WhatsApp</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.shareBtn, { backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border, opacity: pressed ? 0.85 : 1 }]}
            onPress={handleShare}
          >
            <Feather name="share-2" size={16} color={theme.text} />
            <Text style={[styles.shareBtnText, { color: theme.text }]}>More</Text>
          </Pressable>
        </View>

        <View style={[styles.howItWorksBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
          <Text style={[styles.howTitle, { color: theme.text }]}>How it works</Text>
          {[
            "Doctor clicks the link on their phone",
            "Signs in with Google",
            "Types their name and role",
            "You approve them from Manage Roster",
          ].map((step, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={[styles.stepNum, { backgroundColor: theme.primaryLight }]}>
                <Text style={[styles.stepNumText, { color: theme.primary }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.stepText, { color: theme.textSecondary }]}>{step}</Text>
            </View>
          ))}
        </View>

        <View style={styles.actionRow}>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: theme.primary, opacity: pressed ? 0.85 : 1 }]}
            onPress={() => navigation.replace("ManageRoster")}
          >
            <Feather name="users" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>Manage Roster</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.actionBtn, { backgroundColor: theme.backgroundSecondary, borderWidth: 1, borderColor: theme.border, opacity: pressed ? 0.85 : 1 }]}
            onPress={() => navigation.replace("MySubscriptions")}
          >
            <Feather name="credit-card" size={18} color={theme.text} />
            <Text style={[styles.actionBtnText, { color: theme.text }]}>Activate Plan</Text>
          </Pressable>
        </View>
      </ScrollView>
    );
  }

  // ── Create form ───────────────────────────────────────────
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: theme.backgroundDefault }}
      contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: 60 }}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>DEPARTMENT DETAILS</Text>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Department Name *</Text>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
            value={deptName}
            onChangeText={setDeptName}
            placeholder="e.g. Emergency Department"
            placeholderTextColor={theme.textMuted}
          />
        </View>
        <View style={styles.field}>
          <Text style={[styles.label, { color: theme.textSecondary }]}>Hospital Name</Text>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
            value={hospitalName}
            onChangeText={setHospitalName}
            placeholder="e.g. City General Hospital"
            placeholderTextColor={theme.textMuted}
          />
        </View>
      </View>

      <Text style={[styles.sectionTitle, { color: theme.textSecondary, marginTop: Spacing.lg }]}>SHIFT TIMES</Text>
      <View style={[styles.card, { backgroundColor: theme.card }]}>
        <Text style={[styles.shiftGroupTitle, { color: theme.text }]}>Morning Shift</Text>
        <View style={styles.timeRow}><TimeField label="Start" value={morningStart} onChange={setMorningStart} /><TimeField label="End" value={morningEnd} onChange={setMorningEnd} /></View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Text style={[styles.shiftGroupTitle, { color: theme.text }]}>Evening Shift</Text>
        <View style={styles.timeRow}><TimeField label="Start" value={eveningStart} onChange={setEveningStart} /><TimeField label="End" value={eveningEnd} onChange={setEveningEnd} /></View>
        <View style={[styles.divider, { backgroundColor: theme.border }]} />
        <Text style={[styles.shiftGroupTitle, { color: theme.text }]}>Night Shift</Text>
        <View style={styles.timeRow}><TimeField label="Start" value={nightStart} onChange={setNightStart} /><TimeField label="End" value={nightEnd} onChange={setNightEnd} /></View>
      </View>

      <View style={[styles.infoBox, { backgroundColor: theme.primaryLight }]}>
        <Feather name="link" size={16} color={theme.primary} />
        <Text style={[styles.infoText, { color: theme.primary }]}>
          After creating your department, you'll get a shareable link to send to your team via WhatsApp.
        </Text>
      </View>

      <Pressable
        style={({ pressed }) => [styles.createBtn, { backgroundColor: theme.primary, opacity: pressed || loading ? 0.8 : 1 }]}
        onPress={handleCreate}
        disabled={loading}
      >
        {loading ? <ActivityIndicator color="#fff" /> : (
          <>
            <Feather name="check-circle" size={20} color="#fff" />
            <Text style={styles.createBtnText}>Create Department</Text>
          </>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: Spacing.sm },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  field: { marginBottom: Spacing.md },
  label: { fontSize: 14, marginBottom: 6, fontWeight: "500" },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  shiftGroupTitle: { fontSize: 16, fontWeight: "700", marginBottom: Spacing.sm },
  timeRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.sm },
  timeField: { flex: 1 },
  timeLabel: { fontSize: 12, marginBottom: 4, fontWeight: "500" },
  timeInput: { borderWidth: 1, borderRadius: BorderRadius.sm, paddingHorizontal: 10, paddingVertical: 8, fontSize: 16, textAlign: "center" },
  divider: { height: 1, marginVertical: Spacing.md },
  infoBox: { flexDirection: "row", gap: 10, padding: Spacing.md, borderRadius: BorderRadius.md, marginTop: Spacing.sm, marginBottom: Spacing.lg, alignItems: "flex-start" },
  infoText: { flex: 1, fontSize: 14, lineHeight: 18 },
  createBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16, borderRadius: BorderRadius.lg },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  // Success state
  successBadge: { borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: "center", gap: Spacing.sm, marginBottom: Spacing.lg, borderWidth: 1 },
  successTitle: { fontSize: 22, fontWeight: "700", marginTop: 4 },
  successSub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  linkCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md, gap: Spacing.sm },
  linkText: { fontSize: 13, fontFamily: "monospace", lineHeight: 18 },
  copyBtn: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.md },
  copyBtnText: { fontSize: 14, fontWeight: "700" },
  shareRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  shareBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 13, borderRadius: BorderRadius.md },
  shareBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  howItWorksBox: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.lg },
  howTitle: { fontSize: 15, fontWeight: "700", marginBottom: Spacing.md },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: Spacing.sm },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontSize: 13, fontWeight: "700" },
  stepText: { flex: 1, fontSize: 14, lineHeight: 18 },
  actionRow: { flexDirection: "row", gap: Spacing.sm },
  actionBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: BorderRadius.lg },
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
