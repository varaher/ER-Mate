import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  Modal,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "@/hooks/useTheme";
import { useAuth } from "@/context/AuthContext";
import { fetchCasesFromProxy, deleteCaseFromProxy } from "@/lib/api";
import { getApiUrl } from "@/lib/query-client";
import { Spacing, BorderRadius, Typography } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ProfileScreen() {
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { user, token, authMethod, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [clearingCases, setClearingCases] = useState(false);
  const [devTapCount, setDevTapCount] = useState(0);
  const [showDevTools, setShowDevTools] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const isGoogleUser = authMethod === "google";

  const closePasswordModal = () => {
    setShowPasswordModal(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError(null);
    setPasswordSuccess(false);
    setShowCurrentPw(false);
    setShowNewPw(false);
    setShowConfirmPw(false);
  };

  const handleChangePassword = async () => {
    setPasswordError(null);
    if (newPassword.length < 6) {
      setPasswordError("Password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }
    if (!isGoogleUser && !currentPassword.trim()) {
      setPasswordError("Please enter your current password.");
      return;
    }
    setPasswordLoading(true);
    try {
      const url = new URL("/api/auth/change-password", getApiUrl());
      const res = await fetch(url.toString(), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          currentPassword: isGoogleUser ? undefined : currentPassword.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setPasswordSuccess(true);
      } else {
        setPasswordError(data.error || "Could not update password. Please try again.");
      }
    } catch {
      setPasswordError("Connection error. Please try again.");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleAvatarTap = () => {
    const next = devTapCount + 1;
    setDevTapCount(next);
    if (next >= 5) {
      setShowDevTools(true);
      setDevTapCount(0);
    }
  };

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const handleClearTestData = async () => {
    setClearingCases(true);
    let cases: any[] = [];
    try {
      const result = await fetchCasesFromProxy<any[]>();
      cases = Array.isArray(result) ? result : [];
    } catch {
      setClearingCases(false);
      Alert.alert("Error", "Could not fetch cases. Please try again.");
      return;
    }
    setClearingCases(false);
    const count = cases.length;
    if (count === 0) {
      Alert.alert("No Cases", "Your account has no cases to delete.");
      return;
    }
    Alert.alert(
      "Delete All Cases",
      `This will permanently delete all ${count} cases in your account. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: `Delete ${count} Cases`,
          style: "destructive",
          onPress: async () => {
            setClearingCases(true);
            const ids = cases.map((c: any) => c.id).filter(Boolean);
            let deleted = 0;
            for (const id of ids) {
              try { await deleteCaseFromProxy(id); deleted++; } catch {}
            }
            setClearingCases(false);
            Alert.alert("Done", `${deleted} of ${count} cases deleted.`);
          },
        },
      ]
    );
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    logout();
  };

  const { nightShift } = useTheme();

  const nightShiftOptions: { label: string; value: import("@/hooks/useNightShift").NightShiftPref; icon: string }[] = [
    { label: "Auto (9pm–6am)", value: "auto", icon: "moon" },
    { label: "Always Light", value: "light", icon: "sun" },
    { label: "Always Dark", value: "dark", icon: "minus-circle" },
  ];

  const menuItems = [
    { icon: "bar-chart-2", label: "My Stats", onPress: () => navigation.navigate("Stats"), locked: false },
    { icon: "monitor", label: "Link to Web", onPress: () => navigation.navigate("LinkDevices"), locked: false },
    { icon: "star", label: "Upgrade Plan", onPress: () => navigation.navigate("Upgrade", {}), locked: false },
    { icon: "lock", label: isGoogleUser ? "Set Password" : "Change Password", onPress: () => setShowPasswordModal(true), locked: false },
    { icon: "bell", label: "Notifications", onPress: () => navigation.navigate("Notifications"), locked: false },
    { icon: "shield", label: "Privacy", onPress: () => navigation.navigate("Privacy"), locked: false },
    { icon: "help-circle", label: "Help & Support", onPress: () => navigation.navigate("HelpSupport"), locked: false },
    { icon: "info", label: "About ErMate", onPress: () => navigation.navigate("About"), locked: false },
  ];

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundDefault }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + Spacing.xl, paddingBottom: 120 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.profileCard, { backgroundColor: theme.card }]}>
          <Pressable onPress={handleAvatarTap}>
            <View style={[styles.avatar, { backgroundColor: theme.primaryLight }]}>
              <Text style={[styles.avatarText, { color: theme.primary }]}>
                {user?.name?.charAt(0)?.toUpperCase() || "D"}
              </Text>
            </View>
          </Pressable>
          <Text style={[styles.name, { color: theme.text }]}>{user?.name || "Doctor"}</Text>
          <Text style={[styles.email, { color: theme.textSecondary }]}>{user?.email || ""}</Text>
          {user?.hospital ? (
            <View style={styles.hospitalRow}>
              <Feather name="home" size={14} color={theme.textMuted} />
              <Text style={[styles.hospital, { color: theme.textMuted }]}>{user.hospital}</Text>
            </View>
          ) : null}
          <View style={[styles.planBadge, { backgroundColor: theme.primaryLight }]}>
            <Feather name="award" size={14} color={theme.primary} />
            <Text style={[styles.planText, { color: theme.primary }]}>
              {user?.subscription_plan || "Free"} Plan
            </Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.card }]}>
          {menuItems.map((item, index) => (
            <Pressable
              key={item.label}
              style={({ pressed }) => [
                styles.menuItem,
                { opacity: item.locked ? 0.5 : pressed ? 0.7 : 1 },
                index < menuItems.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.border },
              ]}
              onPress={item.locked ? undefined : item.onPress}
              disabled={item.locked}
            >
              <Feather name={item.icon as any} size={20} color={item.locked ? theme.textMuted : theme.textSecondary} />
              <Text style={[styles.menuLabel, { color: item.locked ? theme.textMuted : theme.text }]}>{item.label}</Text>
              {item.locked ? (
                <View style={[styles.lockedBadge, { backgroundColor: theme.backgroundTertiary }]}>
                  <Feather name="lock" size={12} color={theme.textMuted} />
                  <Text style={[styles.lockedText, { color: theme.textMuted }]}>Coming Soon</Text>
                </View>
              ) : (
                <Feather name="chevron-right" size={20} color={theme.textMuted} />
              )}
            </Pressable>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: theme.card, marginBottom: Spacing.lg }]}>
          <View style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
            <Feather name="moon" size={20} color={theme.textSecondary} />
            <Text style={[styles.menuLabel, { color: theme.text }]}>Display Mode</Text>
          </View>
          <View style={[styles.nightShiftOptions]}>
            {nightShiftOptions.map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  styles.nightShiftOption,
                  {
                    backgroundColor: nightShift.pref === opt.value ? theme.primary : theme.backgroundSecondary,
                    borderColor: nightShift.pref === opt.value ? theme.primary : theme.border,
                  },
                ]}
                onPress={() => nightShift.setPref(opt.value)}
              >
                <Feather
                  name={opt.icon as any}
                  size={14}
                  color={nightShift.pref === opt.value ? "#FFFFFF" : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.nightShiftLabel,
                    { color: nightShift.pref === opt.value ? "#FFFFFF" : theme.textSecondary },
                  ]}
                >
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {nightShift.isNightTime && nightShift.pref === "auto" ? (
            <View style={[styles.nightShiftActive, { backgroundColor: "#1e1b4b20" }]}>
              <Feather name="moon" size={12} color="#818cf8" />
              <Text style={[styles.nightShiftActiveText, { color: "#818cf8" }]}>
                Night shift active
              </Text>
            </View>
          ) : null}
        </View>

        {showDevTools ? (
          <View style={[styles.section, { backgroundColor: theme.card, marginBottom: Spacing.lg }]}>
            <View style={[styles.menuItem, { borderBottomWidth: 1, borderBottomColor: theme.border }]}>
              <Feather name="tool" size={20} color={theme.textMuted} />
              <Text style={[styles.menuLabel, { color: theme.textMuted, fontStyle: "italic" }]}>Developer Tools</Text>
            </View>
            <Pressable
              style={({ pressed }) => [
                styles.menuItem,
                { opacity: clearingCases ? 0.5 : pressed ? 0.7 : 1 },
              ]}
              onPress={clearingCases ? undefined : handleClearTestData}
              disabled={clearingCases}
            >
              {clearingCases ? (
                <ActivityIndicator size="small" color={theme.danger} />
              ) : (
                <Feather name="trash-2" size={20} color={theme.danger} />
              )}
              <Text style={[styles.menuLabel, { color: theme.danger }]}>
                {clearingCases ? "Deleting cases..." : "Delete All Cases"}
              </Text>
              {!clearingCases ? (
                <Feather name="chevron-right" size={20} color={theme.danger} />
              ) : null}
            </Pressable>
          </View>
        ) : null}

        <Pressable
          style={({ pressed }) => [
            styles.logoutBtn,
            { backgroundColor: theme.dangerLight, opacity: pressed ? 0.8 : 1 },
          ]}
          onPress={handleLogout}
        >
          <Feather name="log-out" size={20} color={theme.danger} />
          <Text style={[styles.logoutText, { color: theme.danger }]}>Logout</Text>
        </Pressable>

        <Text style={[styles.version, { color: theme.textMuted }]}>ErMate v1.0.0</Text>
      </ScrollView>
      <Modal
        visible={showLogoutModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLogoutModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowLogoutModal(false)}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.card }]} onPress={() => {}}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Logout</Text>
            <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
              Are you sure you want to logout?
            </Text>
            <View style={styles.modalActions}>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.backgroundTertiary }]}
                onPress={() => setShowLogoutModal(false)}
              >
                <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
              </Pressable>
              <Pressable
                style={[styles.modalBtn, { backgroundColor: theme.danger }]}
                onPress={confirmLogout}
              >
                <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>Logout</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={showPasswordModal}
        transparent
        animationType="fade"
        onRequestClose={closePasswordModal}
      >
        <Pressable style={styles.modalOverlay} onPress={closePasswordModal}>
          <Pressable style={[styles.modalContent, { backgroundColor: theme.card }]} onPress={() => {}}>
            <View style={[styles.modalHeader, { marginBottom: Spacing.md }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]}>
                {isGoogleUser ? "Set Password" : "Change Password"}
              </Text>
              <Pressable onPress={closePasswordModal}>
                <Feather name="x" size={22} color={theme.textMuted} />
              </Pressable>
            </View>

            {passwordSuccess ? (
              <View style={{ alignItems: "center", paddingVertical: Spacing.lg }}>
                <View style={[styles.successIcon, { backgroundColor: theme.primary + "20" }]}>
                  <Feather name="check-circle" size={32} color={theme.primary} />
                </View>
                <Text style={[styles.modalDesc, { color: theme.textSecondary, textAlign: "center", marginBottom: Spacing.xl }]}>
                  Password updated successfully. Use it next time you sign in.
                </Text>
                <Pressable
                  style={[styles.modalBtn, { backgroundColor: theme.primary, flex: 0, paddingHorizontal: Spacing.xl, height: 44 }]}
                  onPress={closePasswordModal}
                >
                  <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>Done</Text>
                </Pressable>
              </View>
            ) : (
              <View>
                {isGoogleUser ? (
                  <Text style={[styles.modalDesc, { color: theme.textSecondary, marginBottom: Spacing.md }]}>
                    You signed in with Google. Set a password so you can also log in with your email.
                  </Text>
                ) : (
                  <View style={[styles.pwInputRow, { borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}>
                    <Feather name="lock" size={18} color={theme.textMuted} />
                    <TextInput
                      style={[styles.pwInput, { color: theme.text }]}
                      placeholder="Current password"
                      placeholderTextColor={theme.textMuted}
                      secureTextEntry={!showCurrentPw}
                      value={currentPassword}
                      onChangeText={setCurrentPassword}
                      autoCapitalize="none"
                    />
                    <Pressable onPress={() => setShowCurrentPw((v) => !v)}>
                      <Feather name={showCurrentPw ? "eye-off" : "eye"} size={18} color={theme.textMuted} />
                    </Pressable>
                  </View>
                )}

                <View style={[styles.pwInputRow, { borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}>
                  <Feather name="lock" size={18} color={theme.textMuted} />
                  <TextInput
                    style={[styles.pwInput, { color: theme.text }]}
                    placeholder="New password"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry={!showNewPw}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowNewPw((v) => !v)}>
                    <Feather name={showNewPw ? "eye-off" : "eye"} size={18} color={theme.textMuted} />
                  </Pressable>
                </View>

                <View style={[styles.pwInputRow, { borderColor: theme.border, backgroundColor: theme.backgroundDefault }]}>
                  <Feather name="lock" size={18} color={theme.textMuted} />
                  <TextInput
                    style={[styles.pwInput, { color: theme.text }]}
                    placeholder="Confirm new password"
                    placeholderTextColor={theme.textMuted}
                    secureTextEntry={!showConfirmPw}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    autoCapitalize="none"
                  />
                  <Pressable onPress={() => setShowConfirmPw((v) => !v)}>
                    <Feather name={showConfirmPw ? "eye-off" : "eye"} size={18} color={theme.textMuted} />
                  </Pressable>
                </View>

                {passwordError ? (
                  <View style={[styles.errorBox, { backgroundColor: theme.danger + "15", borderColor: theme.danger + "40" }]}>
                    <Feather name="alert-circle" size={14} color={theme.danger} />
                    <Text style={[styles.errorText, { color: theme.danger }]}>{passwordError}</Text>
                  </View>
                ) : null}

                <View style={[styles.modalActions, { marginTop: Spacing.md }]}>
                  <Pressable
                    style={[styles.modalBtn, { backgroundColor: theme.backgroundTertiary }]}
                    onPress={closePasswordModal}
                  >
                    <Text style={[styles.modalBtnText, { color: theme.text }]}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.modalBtn, { backgroundColor: theme.primary, opacity: passwordLoading ? 0.7 : 1 }]}
                    onPress={handleChangePassword}
                    disabled={passwordLoading}
                  >
                    {passwordLoading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={[styles.modalBtnText, { color: "#FFFFFF" }]}>
                        {isGoogleUser ? "Set Password" : "Update"}
                      </Text>
                    )}
                  </Pressable>
                </View>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: Spacing.lg },
  profileCard: {
    alignItems: "center",
    padding: Spacing.xl,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.md,
  },
  avatarText: { ...Typography.h1 },
  name: { ...Typography.h3, marginBottom: Spacing.xs },
  email: { ...Typography.body },
  hospitalRow: { flexDirection: "row", alignItems: "center", gap: Spacing.xs, marginTop: Spacing.sm },
  hospital: { ...Typography.small },
  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
    gap: Spacing.xs,
  },
  planText: { ...Typography.label },
  section: { borderRadius: BorderRadius.lg, marginBottom: Spacing.lg },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  menuLabel: { flex: 1, ...Typography.body },
  nightShiftOptions: {
    flexDirection: "row",
    gap: Spacing.sm,
    padding: Spacing.md,
    flexWrap: "wrap",
  },
  nightShiftOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
  },
  nightShiftLabel: { fontSize: 12, fontWeight: "500" },
  nightShiftActive: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    margin: Spacing.md,
    marginTop: 0,
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  nightShiftActiveText: { fontSize: 12 },
  logoutBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: Spacing.lg,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  logoutText: { ...Typography.h4 },
  version: { ...Typography.caption, textAlign: "center", marginTop: Spacing.xl },
  lockedBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 3,
    borderRadius: BorderRadius.full,
    gap: 4,
  },
  lockedText: { ...Typography.caption },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
  },
  modalContent: {
    width: "100%",
    maxWidth: 340,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
  },
  modalTitle: {
    ...Typography.h3,
    marginBottom: Spacing.sm,
  },
  modalDesc: {
    ...Typography.body,
    marginBottom: Spacing.xl,
  },
  modalActions: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  modalBtn: {
    flex: 1,
    height: 44,
    borderRadius: BorderRadius.md,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnText: {
    ...Typography.bodyMedium,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: Spacing.md,
  },
  pwInputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    marginBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  pwInput: {
    flex: 1,
    ...Typography.body,
    height: "100%",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
    borderWidth: 1,
    borderRadius: BorderRadius.sm,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  errorText: { ...Typography.small, flex: 1 },
});
