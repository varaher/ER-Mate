import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  ScrollView,
  Share,
  Platform,
  Linking,
  Modal,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import * as Clipboard from "expo-clipboard";
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

type TimeState = {
  morningStart: string;
  morningEnd: string;
  eveningStart: string;
  eveningEnd: string;
  nightStart: string;
  nightEnd: string;
};
type TimeKey = keyof TimeState;

const ITEM_H = 44;
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function parseTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return { h: isNaN(h) ? 0 : h, m: isNaN(m) ? 0 : m };
}

function DrumWheel({
  items,
  selected,
  onSelect,
  theme,
}: {
  items: string[];
  selected: string;
  onSelect: (v: string) => void;
  theme: any;
}) {
  const flatRef = useRef<FlatList<string>>(null);
  const idx = items.indexOf(selected);

  const onMomentumEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIdx = Math.round(e.nativeEvent.contentOffset.y / ITEM_H);
    const clamped = Math.max(0, Math.min(items.length - 1, newIdx));
    onSelect(items[clamped]);
    flatRef.current?.scrollToIndex({ index: clamped, animated: true });
  };

  return (
    <View style={drumStyles.wheel}>
      <View
        pointerEvents="none"
        style={[drumStyles.selector, { borderColor: theme.primary + "50", backgroundColor: theme.primary + "18" }]}
      />
      <FlatList
        ref={flatRef}
        data={items}
        keyExtractor={(item) => item}
        showsVerticalScrollIndicator={false}
        snapToInterval={ITEM_H}
        decelerationRate="fast"
        initialScrollIndex={idx >= 0 ? idx : 0}
        getItemLayout={(_, index) => ({ length: ITEM_H, offset: ITEM_H * index, index })}
        contentContainerStyle={{ paddingVertical: ITEM_H * 2 }}
        onMomentumScrollEnd={onMomentumEnd}
        renderItem={({ item }) => (
          <View style={drumStyles.item}>
            <Text
              style={[
                drumStyles.itemText,
                { color: item === selected ? theme.primary : theme.textSecondary },
                item === selected && drumStyles.selectedText,
              ]}
            >
              {item}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const drumStyles = StyleSheet.create({
  wheel: { width: 70, height: ITEM_H * 5, overflow: "hidden" },
  selector: {
    position: "absolute",
    top: ITEM_H * 2,
    left: 0,
    right: 0,
    height: ITEM_H,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    zIndex: 2,
  },
  item: { height: ITEM_H, alignItems: "center", justifyContent: "center" },
  itemText: { fontSize: 22 },
  selectedText: { fontWeight: "700", fontSize: 24 },
});

export default function SetupDepartmentScreen() {
  const { theme } = useTheme();
  const { token, user } = useAuth();
  const { refresh } = useDepartment();
  const navigation = useNavigation<Nav>();
  const headerHeight = useHeaderHeight();

  const [deptName, setDeptName] = useState("");
  const [hospitalName, setHospitalName] = useState("");
  const [times, setTimes] = useState<TimeState>({
    morningStart: "08:00",
    morningEnd: "14:00",
    eveningStart: "14:00",
    eveningEnd: "22:00",
    nightStart: "22:00",
    nightEnd: "06:00",
  });

  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerField, setPickerField] = useState<TimeKey | null>(null);
  const [pickerH, setPickerH] = useState("08");
  const [pickerM, setPickerM] = useState("00");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState(false);
  const [inviteLink, setInviteLink] = useState("");
  const [createdDeptName, setCreatedDeptName] = useState("");
  const [copied, setCopied] = useState(false);

  const openPicker = (field: TimeKey) => {
    const { h, m } = parseTime(times[field]);
    setPickerField(field);
    setPickerH(String(h).padStart(2, "0"));
    setPickerM(String(m).padStart(2, "0"));
    setPickerVisible(true);
  };

  const confirmPicker = () => {
    if (pickerField) {
      setTimes((prev) => ({ ...prev, [pickerField]: `${pickerH}:${pickerM}` }));
    }
    setPickerVisible(false);
  };

  const handleCreate = async () => {
    setError("");
    if (!deptName.trim()) {
      setError("Please enter a department name.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${getApiUrl()}/api/department/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: deptName.trim(),
          hospitalName: hospitalName.trim(),
          morningStart: times.morningStart,
          morningEnd: times.morningEnd,
          eveningStart: times.eveningStart,
          eveningEnd: times.eveningEnd,
          nightStart: times.nightStart,
          nightEnd: times.nightEnd,
          hodName: user?.name || "",
          hodEmail: (user as any)?.email || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to create department. Please try again.");
        return;
      }
      await refresh();
      setCreatedDeptName(deptName.trim());
      setInviteLink(data.inviteLink || "");
      setCreated(true);
    } catch {
      setError("Network error. Check your connection and try again.");
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
      if (supported) Linking.openURL(url);
      else Share.share({ message: msg, title: "Join ErMate Team" });
    });
  };

  const handleShare = () => {
    const msg = `Join our ER team on ErMate!\n\nTap the link below, sign in with Google, and fill in your name and role. I'll approve you from my end.\n\n${inviteLink}`;
    Share.share({ message: msg, title: "Join ErMate Team" });
  };

  const TimeField = ({ label, field }: { label: string; field: TimeKey }) => (
    <View style={styles.timeField}>
      <Text style={[styles.timeLabel, { color: theme.textSecondary }]}>{label}</Text>
      <Pressable
        style={({ pressed }) => [
          styles.timeButton,
          {
            backgroundColor: theme.backgroundSecondary,
            borderColor: theme.border,
            opacity: pressed ? 0.7 : 1,
          },
        ]}
        onPress={() => openPicker(field)}
      >
        <Feather name="clock" size={14} color={theme.primary} />
        <Text style={[styles.timeButtonText, { color: theme.text }]}>{times[field]}</Text>
      </Pressable>
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
            onPress={() => navigation.navigate("MySubscriptions")}
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
    <View style={{ flex: 1, backgroundColor: theme.backgroundDefault }}>
      {/* ── Time Picker Modal ── */}
      <Modal
        transparent
        animationType="slide"
        visible={pickerVisible}
        onRequestClose={() => setPickerVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPickerVisible(false)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: theme.card }]}>
            <View style={styles.modalHeader}>
              <Pressable onPress={() => setPickerVisible(false)}>
                <Text style={[styles.modalCancel, { color: theme.textSecondary }]}>Cancel</Text>
              </Pressable>
              <Text style={[styles.modalTitle, { color: theme.text }]}>Select Time</Text>
              <Pressable onPress={confirmPicker}>
                <Text style={[styles.modalDone, { color: theme.primary }]}>Done</Text>
              </Pressable>
            </View>

            <View style={styles.pickerPreview}>
              <Text style={[styles.pickerPreviewText, { color: theme.primary }]}>
                {pickerH}:{pickerM}
              </Text>
            </View>

            <View style={styles.drumRow}>
              <DrumWheel
                items={HOURS}
                selected={pickerH}
                onSelect={setPickerH}
                theme={theme}
              />
              <Text style={[styles.drumColon, { color: theme.text }]}>:</Text>
              <DrumWheel
                items={MINUTES}
                selected={pickerM}
                onSelect={setPickerM}
                theme={theme}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <ScrollView
        contentContainerStyle={{ paddingTop: headerHeight + Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: 80 }}
        keyboardShouldPersistTaps="handled"
      >
        {error ? (
          <View style={[styles.errorBox, { backgroundColor: "#FEE2E2", borderColor: "#FECACA" }]}>
            <Feather name="alert-circle" size={16} color="#DC2626" />
            <Text style={[styles.errorText, { color: "#DC2626" }]}>{error}</Text>
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>DEPARTMENT DETAILS</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <View style={styles.field}>
            <Text style={[styles.label, { color: theme.textSecondary }]}>Department Name *</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundSecondary }]}
              value={deptName}
              onChangeText={(v) => { setDeptName(v); setError(""); }}
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
        <Text style={[styles.shiftHint, { color: theme.textMuted }]}>Tap a time to change it</Text>
        <View style={[styles.card, { backgroundColor: theme.card }]}>
          <Text style={[styles.shiftGroupTitle, { color: theme.text }]}>Morning Shift</Text>
          <View style={styles.timeRow}>
            <TimeField label="Start" field="morningStart" />
            <TimeField label="End" field="morningEnd" />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Text style={[styles.shiftGroupTitle, { color: theme.text }]}>Evening Shift</Text>
          <View style={styles.timeRow}>
            <TimeField label="Start" field="eveningStart" />
            <TimeField label="End" field="eveningEnd" />
          </View>
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <Text style={[styles.shiftGroupTitle, { color: theme.text }]}>Night Shift</Text>
          <View style={styles.timeRow}>
            <TimeField label="Start" field="nightStart" />
            <TimeField label="End" field="nightEnd" />
          </View>
        </View>

        <View style={[styles.infoBox, { backgroundColor: theme.primaryLight }]}>
          <Feather name="link" size={16} color={theme.primary} />
          <Text style={[styles.infoText, { color: theme.primary }]}>
            After creating your department, you'll get a shareable link to send to your team via WhatsApp.
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.createBtn,
            { backgroundColor: theme.primary, opacity: pressed || loading ? 0.8 : 1 },
          ]}
          onPress={handleCreate}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Feather name="check-circle" size={20} color="#fff" />
              <Text style={styles.createBtnText}>Create Department</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 1, marginBottom: Spacing.sm },
  shiftHint: { fontSize: 12, marginBottom: Spacing.sm, marginTop: -4 },
  card: { borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm },
  field: { marginBottom: Spacing.md },
  label: { fontSize: 14, marginBottom: 6, fontWeight: "500" },
  input: { borderWidth: 1, borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16 },
  shiftGroupTitle: { fontSize: 16, fontWeight: "700", marginBottom: Spacing.sm },
  timeRow: { flexDirection: "row", gap: Spacing.md, marginBottom: Spacing.sm },
  timeField: { flex: 1 },
  timeLabel: { fontSize: 12, marginBottom: 4, fontWeight: "500" },
  timeButton: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, borderWidth: 1, borderRadius: BorderRadius.sm,
    paddingHorizontal: 10, paddingVertical: 11,
  },
  timeButtonText: { fontSize: 16, fontWeight: "600" },
  divider: { height: 1, marginVertical: Spacing.md },
  infoBox: {
    flexDirection: "row", gap: 10, padding: Spacing.md,
    borderRadius: BorderRadius.md, marginTop: Spacing.sm, marginBottom: Spacing.lg, alignItems: "flex-start",
  },
  infoText: { flex: 1, fontSize: 14, lineHeight: 18 },
  errorBox: {
    flexDirection: "row", alignItems: "center", gap: 8, padding: Spacing.md,
    borderRadius: BorderRadius.md, borderWidth: 1, marginBottom: Spacing.md,
  },
  errorText: { flex: 1, fontSize: 14, lineHeight: 18 },
  createBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 10, paddingVertical: 16, borderRadius: BorderRadius.lg,
  },
  createBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modalSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 40 },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontWeight: "600" },
  modalCancel: { fontSize: 17 },
  modalDone: { fontSize: 17, fontWeight: "700" },
  pickerPreview: { alignItems: "center", paddingVertical: Spacing.sm },
  pickerPreviewText: { fontSize: 32, fontWeight: "700", letterSpacing: 2 },
  drumRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingBottom: Spacing.md },
  drumColon: { fontSize: 28, fontWeight: "700", marginBottom: 4 },
  // Success state
  successBadge: {
    borderRadius: BorderRadius.lg, padding: Spacing.xl, alignItems: "center",
    gap: Spacing.sm, marginBottom: Spacing.lg, borderWidth: 1,
  },
  successTitle: { fontSize: 22, fontWeight: "700", marginTop: 4 },
  successSub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
  linkCard: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md, gap: Spacing.sm },
  linkText: { fontSize: 13, fontFamily: "monospace", lineHeight: 18 },
  copyBtn: {
    flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start",
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: BorderRadius.md,
  },
  copyBtnText: { fontSize: 14, fontWeight: "700" },
  shareRow: { flexDirection: "row", gap: Spacing.sm, marginBottom: Spacing.lg },
  shareBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 13, borderRadius: BorderRadius.md,
  },
  shareBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  howItWorksBox: { borderRadius: BorderRadius.lg, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.lg },
  howTitle: { fontSize: 15, fontWeight: "700", marginBottom: Spacing.md },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: Spacing.sm },
  stepNum: { width: 26, height: 26, borderRadius: 13, alignItems: "center", justifyContent: "center" },
  stepNumText: { fontSize: 13, fontWeight: "700" },
  stepText: { flex: 1, fontSize: 14, lineHeight: 18 },
  actionRow: { flexDirection: "row", gap: Spacing.sm },
  actionBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, paddingVertical: 14, borderRadius: BorderRadius.lg,
  },
  actionBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
